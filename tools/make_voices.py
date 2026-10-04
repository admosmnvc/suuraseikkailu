#!/usr/bin/env python3
"""Suuraseikkailu: generate the teacher-voice clips (Finnish prompts + Arabic Shahada).

Real speech from Microsoft Edge neural TTS (python package `edge-tts`), never snippets of the
recitation. The clip list comes from the app itself (`node tools/list-clips.mjs`, i.e.
src/content/prompts.js), so texts are defined in exactly one place.

Pipeline per clip (deterministic apart from the TTS service itself):
  1. synthesize `sayText` (= text with the SAY_AS respellings applied) with retries + backoff
  2. ffmpeg: trim leading/trailing silence, add PAD_S of silence on both ends, mono
  3. two-pass loudnorm (linear) to the median integrated loudness of the Mishary recitation
     files public/audio/[01]*.mp3, true-peak ceiling TP_TARGET
  4. encode MP3 (libmp3lame, mono, SAMPLE_RATE, BITRATE CBR) -> public/<file>
  5. validate every clip (exists, duration, not silent, loudness, true peak) and write
     tools/voices.json

Usage (run from anywhere; needs node, ffmpeg, edge-tts):
  python3 tools/make_voices.py              # make missing/outdated clips, validate all
  python3 tools/make_voices.py --force      # regenerate everything
  python3 tools/make_voices.py --only praise-1,shahada-2
  python3 tools/make_voices.py --check      # validate only, no network
  python3 tools/make_voices.py --asr        # also back-transcribe with faster-whisper (optional QA)
  python3 tools/make_voices.py --prune      # delete public/audio/fi/*.mp3 that no clip uses
Exit code 1 if any clip fails validation.
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
VOICES_JSON = ROOT / 'tools' / 'voices.json'
RECITATION_GLOB = '[01]*.mp3'          # Mishary Alafasy verse files (loudness reference)

# Voices chosen by the owner after listening to samples. edge-tts only supports rate/pitch/volume
# (no SSML speaking styles), so "cheerful teacher" = Noora a little brighter (+pitch) and a touch
# livelier (+rate); exclamation marks in the texts give the upbeat intonation.
# Arabic Shahada: Zariyah, slowed down so a 4-year-old can repeat after her, slightly brighter.
VOICES = {
    'fi': {'voice': 'fi-FI-NooraNeural', 'rate': '+3%', 'pitch': '+15Hz'},
    'ar': {'voice': 'ar-SA-ZariyahNeural', 'rate': '-25%', 'pitch': '+8Hz'},
}

# TTS-only respellings for Finnish (the texts shown in the app never change). Found by
# back-transcribing variants with Whisper:
#  - "Al-X" makes Noora spell the article as letters ("aa, äl"); written together it is read
#    as one word.
#  - long vowels as in Arabic (al-Faatiha, al-Ikhlaas); "kh" -> "h" (Finnish h before l is the
#    soft fricative), "w" -> "u" (otherwise Noora reads it as v).
#  - Noora swallows a vowel in "Upeaa" ("upa"), "Herraasi" ("hööraasi") and "kaikkea" ("kaikkia");
#    these spellings are heard as the real word, and the hyphens add no pause (checked with
#    silencedetect + word timestamps).
SAY_AS = {
    'fi': {
        'Al-Fatihan': 'Alfaatihan',
        'Al-Ikhlasin': 'Alihlaasin',
        'Al-Kawtharin': 'Alkautharin',
        'Kawtharin': 'Kautharin',
        'Upeaa': 'Upeeaa',
        'Herraasi': 'Herraa-si',
        'kaikkea': 'kaikke-a',
    },
    'ar': {},
}

SILENCE_DB = -50          # below this (RMS, 20 ms window) counts as silence when trimming
PAD_S = 0.06              # silence kept before and after the speech
TP_TARGET = -2.0          # loudnorm true-peak ceiling (0.5 dB headroom for MP3 encoding)
TP_MAX = -1.5             # validation: final MP3 true peak must not exceed this
LU_TOL = 1.5              # validation: |lufs - target| tolerance
CORRECT_LU = 0.2          # mastering: re-encode once with a gain fix if off by more than this
DUR_MIN, DUR_MAX = 0.4, 12.0
MAX_VOLUME_MIN = -20.0    # validation: volumedetect max_volume must be above this (not silent)
SAMPLE_RATE = 44100
BITRATE = '64k'
PIPELINE = 'v3'           # bump when the post-processing changes -> everything is regenerated
RETRIES = 5

# The build sandbox re-terminates TLS with its own CA; edge-tts (aiohttp) trusts only certifi.
CA_BUNDLE = os.environ.get('VOICES_CA_BUNDLE', '/root/.ccr/ca-bundle.crt')


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- clip list + texts

def list_clips():
    out = subprocess.run(['node', 'tools/list-clips.mjs'], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out)


def say_text(clip):
    """Text actually sent to TTS: longest SAY_AS keys first, whole words only."""
    text = clip['text']
    table = SAY_AS.get(clip['lang'], {})
    for src in sorted(table, key=len, reverse=True):
        text = re.sub(r'(?<![\w-])' + re.escape(src) + r'(?![\w-])', table[src], text)
    return text


def clip_key(clip, target):
    """Everything that influences the output file; unchanged key + existing file = skip."""
    cfg = VOICES[clip['lang']]
    payload = [PIPELINE, say_text(clip), cfg['voice'], cfg['rate'], cfg['pitch'], round(target, 1),
               SILENCE_DB, PAD_S, TP_TARGET, SAMPLE_RATE, BITRATE]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False).encode()).hexdigest()[:16]


# ---------------------------------------------------------------- ffmpeg helpers

def ffmpeg(*args):
    """Run ffmpeg, return stderr (where filters print their stats)."""
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-y', *map(str, args)],
                       capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError('ffmpeg failed: ' + p.stderr[-800:])
    return p.stderr


def last_json(stderr):
    """loudnorm prints its stats as the last {...} block of stderr."""
    return json.loads(stderr[stderr.rindex('{'):stderr.rindex('}') + 1])


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of',
                          'csv=p=0', str(path)], capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def measure(path):
    """EBU R128 integrated loudness, true peak, max sample volume. Mono is measured as dual-mono:
    browsers play a mono file on both speakers, exactly like the (near-mono) stereo recitation."""
    err = ffmpeg('-i', path, '-af', 'ebur128=peak=true:dualmono=true:framelog=verbose,volumedetect',
                 '-f', 'null', '-')
    summary = err[err.rindex('Summary:'):]
    lufs = re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', summary).group(1)
    peak = re.search(r'True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS', summary).group(1)
    maxv = re.search(r'max_volume: (-?[\d.]+|-inf) dB', err).group(1)
    return {
        'duration_s': round(duration(path), 3),
        'lufs': float(lufs) if lufs != '-inf' else -99.0,
        'true_peak_dbtp': float(peak) if peak != '-inf' else -99.0,
        'max_volume_db': float(maxv) if maxv != '-inf' else -99.0,
    }


def recitation_target():
    files = sorted((PUBLIC / 'audio').glob(RECITATION_GLOB))
    if not files:
        sys.exit('No recitation files found in public/audio/ (needed as the loudness reference).')
    return round(statistics.median(measure(f)['lufs'] for f in files), 1), len(files)


# Trim both ends (silenceremove on the reversed signal handles the tail). 10 ms of the
# sub-threshold lead-in/decay are kept and faded, so the cut itself never clicks; then pad PAD_S.
_CUT = f'silenceremove=start_periods=1:start_threshold={SILENCE_DB}dB:start_silence=0.01,afade=t=in:d=0.01'
TRIM = (f'aformat=channel_layouts=mono,{_CUT},areverse,{_CUT},areverse,'
        f'adelay={int(PAD_S * 1000)}:all=1,apad=pad_dur={PAD_S}')


def master(raw, out, target):
    """Two-pass linear loudnorm + MP3 encode. Returns loudnorm's normalization_type."""
    ln = f'loudnorm=I={target}:TP={TP_TARGET}:LRA=50:dual_mono=true'  # same meter as measure()
    m = last_json(ffmpeg('-i', raw, '-af', f'{TRIM},{ln}:print_format=json', '-f', 'null', '-'))
    ln2 = (f"{ln}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
           f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json")
    tmp = raw.with_suffix('.out.mp3')       # never leave half-written files in public/

    def encode(gain_db):
        return ffmpeg('-i', raw, '-af', f'{TRIM},{ln2},volume={gain_db:.2f}dB,aresample={SAMPLE_RATE}',
                      '-ac', 1, '-ar', SAMPLE_RATE, '-c:a', 'libmp3lame', '-b:a', BITRATE,
                      '-map_metadata', -1, '-fflags', '+bitexact', '-flags:a', '+bitexact', tmp)

    err = encode(0)
    # Resampling + MP3 coding shift short clips by a few tenths of a LU: one exact correction pass.
    drift = target - measure(tmp)['lufs']
    if abs(drift) > CORRECT_LU:
        err = encode(drift)
    shutil.move(tmp, out)
    return last_json(err).get('normalization_type', '?')


# ---------------------------------------------------------------- synthesis

def import_edge_tts():
    if os.path.exists(CA_BUNDLE):
        import certifi
        certifi.where = lambda: CA_BUNDLE
    import edge_tts
    return edge_tts


async def synth(edge_tts, text, cfg, path):
    for attempt in range(RETRIES):
        try:
            await edge_tts.Communicate(text, cfg['voice'], rate=cfg['rate'], pitch=cfg['pitch']).save(str(path))
            if path.stat().st_size < 1000:
                raise RuntimeError('almost empty audio')
            return
        except Exception as e:  # network hiccups, NoAudioReceived, throttling
            if attempt == RETRIES - 1:
                raise
            delay = 2 ** attempt
            log(f'  retry in {delay}s ({type(e).__name__}: {e})')
            await asyncio.sleep(delay)


async def make_all(clips, target, jobs):
    edge_tts = import_edge_tts()
    sem = asyncio.Semaphore(jobs)
    results = {}
    with tempfile.TemporaryDirectory() as tmp:
        async def one(clip):
            async with sem:
                raw = Path(tmp) / (clip['id'] + '.raw.mp3')
                await synth(edge_tts, say_text(clip), VOICES[clip['lang']], raw)
                out = PUBLIC / clip['file']
                out.parent.mkdir(parents=True, exist_ok=True)
                results[clip['id']] = await asyncio.to_thread(master, raw, out, target)
                log(f"  made {clip['file']}")
        await asyncio.gather(*(one(c) for c in clips))
    return results


# ---------------------------------------------------------------- validation + optional ASR

def validate(stats, target):
    problems = []
    if not (DUR_MIN <= stats['duration_s'] <= DUR_MAX):
        problems.append(f"duration {stats['duration_s']} s")
    if stats['max_volume_db'] <= MAX_VOLUME_MIN:
        problems.append(f"too quiet (max {stats['max_volume_db']} dB)")
    if abs(stats['lufs'] - target) > LU_TOL:
        problems.append(f"loudness {stats['lufs']} LUFS (target {target})")
    if stats['true_peak_dbtp'] > TP_MAX:
        problems.append(f"true peak {stats['true_peak_dbtp']} dBTP")
    return problems


def asr(entries, model_name):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        log('ASR skipped: pip install faster-whisper')
        return
    model = WhisperModel(model_name, device='cpu', compute_type='int8',
                         download_root=os.environ.get('VOICES_ASR_MODELS'))
    for e in entries:
        segs, _ = model.transcribe(str(PUBLIC / e['file']), language=e['lang'], beam_size=5)
        e['asr'] = {'model': model_name, 'text': ' '.join(s.text.strip() for s in segs)}
        log(f"  asr {e['id']}: {e['asr']['text']}  (expected: {e['text']})")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--force', action='store_true', help='regenerate even if up to date')
    ap.add_argument('--only', help='comma-separated clip ids')
    ap.add_argument('--check', action='store_true', help='validate only, never synthesize')
    ap.add_argument('--jobs', type=int, default=4, help='parallel TTS requests')
    ap.add_argument('--asr', nargs='?', const='large-v3-turbo', metavar='MODEL',
                    help='back-transcribe the processed clips with faster-whisper')
    ap.add_argument('--prune', action='store_true', help='delete unused public/audio/fi/*.mp3')
    args = ap.parse_args()

    clips = list_clips()
    only = set(args.only.split(',')) if args.only else None
    if only and only - {c['id'] for c in clips}:
        sys.exit('Unknown clip id(s): ' + ', '.join(sorted(only - {c['id'] for c in clips})))

    target, n_ref = recitation_target()
    log(f'Loudness target {target} LUFS (median of {n_ref} recitation files)')

    old = {}
    if VOICES_JSON.exists():
        old = {e['id']: e for e in json.loads(VOICES_JSON.read_text(encoding='utf-8')).get('clips', [])}

    def outdated(c):
        return args.force or not (PUBLIC / c['file']).exists() or old.get(c['id'], {}).get('key') != clip_key(c, target)

    todo = [c for c in clips if (not only or c['id'] in only) and outdated(c)]
    if args.check:
        todo = []
    log(f'{len(todo)} clip(s) to synthesize' + ('' if args.check else ', the rest are up to date'))
    norm = asyncio.run(make_all(todo, target, max(1, args.jobs))) if todo else {}

    entries, failed = [], []
    for c in clips:
        path = PUBLIC / c['file']
        prev = old.get(c['id'], {})
        if not path.exists():
            failed.append(f"{c['id']}: missing {c['file']}")
            continue
        cfg = VOICES[c['lang']]
        e = {'id': c['id'], 'lang': c['lang'], 'file': c['file'], 'text': c['text'], 'sayText': say_text(c),
             'voice': cfg['voice'], 'rate': cfg['rate'], 'pitch': cfg['pitch'], **measure(path),
             'normalization': norm.get(c['id'], prev.get('normalization', '?')),
             'key': clip_key(c, target) if c['id'] in norm else prev.get('key', '')}
        if c['id'] not in norm and 'asr' in prev:
            e['asr'] = prev['asr']           # file unchanged, so the old transcript still applies
        entries.append(e)
        for p in validate(e, target):
            failed.append(f"{c['id']}: {p}")

    if args.asr:
        asr([e for e in entries if not only or e['id'] in only], args.asr)

    used = {(PUBLIC / c['file']).resolve() for c in clips}
    for f in sorted((PUBLIC / 'audio' / 'fi').glob('*.mp3')):
        if f.resolve() not in used:
            if args.prune:
                f.unlink()
                log(f'  pruned {f.relative_to(ROOT)}')
            else:
                log(f'  warning: unused {f.relative_to(ROOT)} (use --prune)')

    VOICES_JSON.write_text(json.dumps({
        'note': 'Generated by tools/make_voices.py - do not edit by hand.',
        'target_lufs': target,
        'target_source': f'median integrated loudness of public/audio/{RECITATION_GLOB} (Mishary Alafasy)',
        'true_peak_max_dbtp': TP_MAX,
        'format': f'MP3 mono {SAMPLE_RATE} Hz {BITRATE}bps CBR, {PAD_S * 1000:.0f} ms padding',
        'voices': VOICES,
        'say_as': SAY_AS,
        'clips': entries,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    for e in entries:
        log(f"{e['id']:16s} {e['duration_s']:6.2f} s {e['lufs']:6.1f} LUFS {e['true_peak_dbtp']:5.1f} dBTP  {e['normalization']}")
    if failed:
        log('\nFAILED:\n  ' + '\n  '.join(failed))
        sys.exit(1)
    log(f'\nOK: {len(entries)} clips valid (target {target} LUFS +-{LU_TOL}, true peak <= {TP_MAX} dBTP)')


if __name__ == '__main__':
    main()
