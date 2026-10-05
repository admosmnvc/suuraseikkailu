#!/usr/bin/env python3
"""Suuraseikkailu: generate the teacher-voice clips (Finnish prompts and meanings; Arabic TTS only for a
section without a human recording).

Real speech from a neural TTS provider, never snippets of the recitation:
  --provider edge        Microsoft Edge neural TTS (python package `edge-tts`, free): fi-FI-NooraNeural (placeholder)
  --provider elevenlabs  ElevenLabs (the owner's chosen voice "Aurora"), Finnish clips only; reads the API key from
                         the environment variable ELEVENLABS_API_KEY (never printed or stored); prints the character
                         / credit estimate first and spends credits only with --yes
Without --provider the provider of the last run (tools/voices.json) is used, so a later plain run never
silently switches voices. The clip list comes from the app itself (`node tools/list-clips.mjs`, i.e.
src/content/prompts.js + the Shahada chunk clips of src/content/chunks.js), so texts are defined in
exactly one place. The mastering below is also used for the Quran word recordings (tools/build-words.py).

Pipeline per clip (deterministic apart from the TTS service itself):
  1. synthesize `sayText` (= text with the SAY_AS respellings applied) with retries + backoff
  2. ffmpeg: trim leading/trailing silence, add PAD_S of silence on both ends, mono
  3. two-pass loudnorm (linear) to the median integrated loudness of the Mishary recitation
     files (tools/recitation-src/everyayah/), true-peak ceiling TP_TARGET
  4. encode MP3 (libmp3lame, mono, SAMPLE_RATE, BITRATE CBR) -> public/<file>
  5. validate every clip (exists, duration, not silent, loudness, true peak) and write
     tools/voices.json

Usage (run from anywhere; needs node, ffmpeg, edge-tts):
  python3 tools/make_voices.py              # make missing/outdated clips, validate all
  ELEVENLABS_API_KEY=... python3 tools/make_voices.py --provider elevenlabs          # estimate only
  ELEVENLABS_API_KEY=... python3 tools/make_voices.py --provider elevenlabs --yes    # switch: all fi clips
  ELEVENLABS_API_KEY=... python3 tools/make_voices.py --provider elevenlabs --samples --yes [--style 0.6]
                                            # 3 sample sentences -> ../qa/voice-samples/ (public/ untouched)
  python3 tools/make_voices.py --force      # regenerate everything
  python3 tools/make_voices.py --only praise-1,shahada-2
  python3 tools/make_voices.py --check      # validate only, no network
  python3 tools/make_voices.py --asr        # also back-transcribe with faster-whisper (optional QA)
  python3 tools/make_voices.py --prune      # delete public/audio/fi/*.mp3 and *-c-*.mp3 that no clip uses
Exit code 1 if any clip fails validation.
"""
import argparse
import asyncio
import difflib
import hashlib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
VOICES_JSON = ROOT / 'tools' / 'voices.json'
# Loudness reference: the 14 original EveryAyah Mishary Alafasy verse files as shipped in v2 (kept unchanged in
# tools/recitation-src/everyayah/; the app's public/audio/SSSAAA.mp3 are now cut by tools/build-cuts.py and
# normalised to this same target, so the reference must not be the files it normalises).
RECITATION_DIR = ROOT / 'tools' / 'recitation-src' / 'everyayah'
RECITATION_GLOB = '[01]*.mp3'

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
#  - Noora swallows a vowel in "Upeaa" ("upa"), "Herraasi" ("hööraasi") and "kaikkea" ("kaikkia"), and the
#    second l of a sentence-final "lähettiläs" ("lähettiäs", two Whisper models agree);
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
        'lähettiläs': 'lähetti-läs',
    },
    'ar': {},
}

# Whole-text TTS input per clip id (displayed text unchanged), applied before SAY_AS.
SAY_ID = {
    'intro-title': 'Suuuuraseikkailuu!',      # stretched and excited, like a cartoon title
    'bye': 'Nähdään, taas!',                  # Noora ran it together ("nahdantos"); the comma separates the words
}
# ElevenLabs: its own whole-text inputs (the Noora fixes above do not apply). The title as the owner picked it.
SAY_ID_ELEVEN = {
    'intro-title': 'Suuuura-seikkailuu!',     # stretched, like a cartoon title (owner's pick of 3 takes)
    'finale-shahada': 'Mahtavaa! Osaat koko Shahadan.',   # '!' rose like a question ('Osaatko koko...?') in 4 takes
}

# ElevenLabs (Finnish clips). Cheerful defaults: lower stability = livelier intonation, some style
# exaggeration, a fixed seed for repeatable takes. Every value is part of the clip key: change one and
# exactly the clips made with the old value are regenerated.
ELEVEN = {
    'voice_id': 'YSabzCJMvEHDduIDMdwV',     # owner's choice: "Aurora"
    'voice_name': 'Aurora',
    'model_id': 'eleven_v3',                # owner's choice: the livelier v3 (audio tags, see V3_EXCITED)
    'output_format': 'mp3_44100_128',
    'stability': 0.5,                       # v3: 0 creative / 0.5 natural / 1 robust
    'similarity_boost': 0.8,
    'style': 0.0,
    'use_speaker_boost': True,
    'speed': 1.0,
    'seed': 7,
    'language_code': None,                  # only for models that accept it (e.g. eleven_flash_v2_5: 'fi')
}
ELEVEN_API = 'https://api.elevenlabs.io/v1'
ELEVEN_KEY_ENV = 'ELEVENLABS_API_KEY'
CREDITS_PER_CHAR = {'eleven_multilingual_v2': 1.0, 'eleven_v3': 1.0, 'eleven_flash_v2_5': 0.5,
                    'eleven_turbo_v2_5': 0.5}
# Respellings for ElevenLabs: only the Arabic names (the Noora vowel fixes above are Noora-specific).
SAY_AS_ELEVEN = {'fi': {k: SAY_AS['fi'][k] for k in ('Al-Fatihan', 'Al-Ikhlasin', 'Al-Kawtharin', 'Kawtharin')}}
ELEVEN_CREDIT = 'Suomenkieliset kehotteet: ElevenLabs, ääni Aurora. Vanhempi voi korvata ne ja Shahadan omalla äänellään asetuksissa.'
CREDIT_PREFIX = 'Suomenkieliset kehotteet:'
DATA_JS = ROOT / 'src' / 'content' / 'data.js'
SAMPLES_DIR = ROOT.parent / 'qa' / 'voice-samples'
SAMPLE_IDS = ['intro-title', 'turn-1', 'finale-fatiha']

# Clips mastered from a fixed take instead of TTS (never re-synthesized; a new take = a new file here). The title is
# the owner's own melody turned into Aurora's voice: ElevenLabs speech-to-speech, eleven_multilingual_sts_v2, seed 9,
# stability 0.5, similarity 0.85, background noise removal (owner's pick of 3; the owner's recording is not in git).
SOURCE_TAKES = {
    'intro-title': 'tools/voice-src/intro-title.aurora-sts.mp3',
}

# eleven_v3 audio tags (sent to the TTS only, never shown): excited for the intro, praise and celebrations,
# cheerful for every other prompt, none for the calm meaning lines.
V3_EXCITED = re.compile(r'(intro-title|intro-go|nice-name|welcome-new|praise-\d+|gem|rocket-part|rocket-launch|finale-.+'
                        r'|sticker|game-done|fx-.+)')

# Take check (ElevenLabs, v3 can slip a word): back-transcribe every new take with faster-whisper and compare it
# with the text sent; below QA_MIN another take with the next seed, at most QA_TAKES, the best one stays.
QA_MODEL = 'large-v3'      # 'small' mishears Finnish too often (false alarms, missed slips)
QA_MIN = 0.93
QA_TAKES = 4

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


def voice_cfg(clip, provider, eleven=None):
    """Voice settings for a clip: ElevenLabs for Finnish clips when chosen (a fixed take for SOURCE_TAKES), Edge otherwise."""
    if provider == 'elevenlabs' and clip.get('id') in SOURCE_TAKES:
        src = ROOT / SOURCE_TAKES[clip['id']]
        return {'provider': 'elevenlabs', 'source': SOURCE_TAKES[clip['id']],
                'source_sha256': hashlib.sha256(src.read_bytes()).hexdigest()[:16]}
    if provider == 'elevenlabs' and clip['lang'] == 'fi':
        return {'provider': 'elevenlabs', **(eleven or ELEVEN)}
    return {'provider': 'edge', **VOICES[clip['lang']]}


def say_text(clip, provider='edge'):
    """Text actually sent to TTS: SAY_ID, then the longest SAY_AS keys first, whole words only."""
    eleven = provider == 'elevenlabs' and clip['lang'] == 'fi'
    text = (SAY_ID_ELEVEN if eleven else SAY_ID).get(clip.get('id'), clip['text'])
    table = (SAY_AS_ELEVEN if eleven else SAY_AS).get(clip['lang'], {})
    for src in sorted(table, key=len, reverse=True):
        text = re.sub(r'(?<![\w-])' + re.escape(src) + r'(?![\w-])', table[src], text)
    return text


def v3_tag(clip_id):
    clip_id = str(clip_id or '')
    if clip_id.startswith('mean-'):
        return ''
    return '[excited] ' if V3_EXCITED.fullmatch(clip_id) else '[cheerful] '


def tts_text(clip, cfg):
    """What one TTS call sends: say_text, plus the audio tag for eleven_v3 models."""
    text = say_text(clip, cfg['provider'])
    if cfg['provider'] == 'elevenlabs' and not cfg.get('source') and str(cfg.get('model_id', '')).startswith('eleven_v3'):
        text = v3_tag(clip.get('id')) + text
    return text


def clip_key(clip, target, cfg=None):
    """Everything that influences the output file; unchanged key + existing file = skip.
    (The Edge payload is the v2/v3 one, so existing Edge clips keep their keys.)"""
    cfg = cfg or voice_cfg(clip, 'edge')
    if cfg['provider'] == 'edge':
        payload = [PIPELINE, say_text(clip), cfg['voice'], cfg['rate'], cfg['pitch'], round(target, 1),
                   SILENCE_DB, PAD_S, TP_TARGET, SAMPLE_RATE, BITRATE]
    else:
        payload = [PIPELINE, 'elevenlabs', tts_text(clip, cfg), {k: cfg[k] for k in sorted(cfg)},
                   round(target, 1), SILENCE_DB, PAD_S, TP_TARGET, SAMPLE_RATE, BITRATE]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


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
    files = sorted(RECITATION_DIR.glob(RECITATION_GLOB))
    if not files:
        sys.exit(f'No recitation files in {RECITATION_DIR} (needed as the loudness reference).')
    return round(statistics.median(measure(f)['lufs'] for f in files), 1), len(files)


# Trim both ends (silenceremove on the reversed signal handles the tail). 10 ms of the
# sub-threshold lead-in/decay are kept and faded, so the cut itself never clicks; then pad.
# detection: 'rms' (default, 20 ms window) for TTS; the word recordings use 'peak', so nothing above the
# threshold is ever removed from a human recording.
def trim_filter(pad_s, detection='rms'):
    det = '' if detection == 'rms' else f':detection={detection}'
    cut = f'silenceremove=start_periods=1:start_threshold={SILENCE_DB}dB:start_silence=0.01{det},afade=t=in:d=0.01'
    return (f'aformat=channel_layouts=mono,{cut},areverse,{cut},areverse,'
            f'adelay={int(pad_s * 1000)}:all=1,apad=pad_dur={pad_s}')


def master(raw, out, target, pad_s=PAD_S, detection='rms'):
    """Two-pass linear loudnorm + MP3 encode. Returns loudnorm's normalization_type."""
    TRIM = trim_filter(pad_s, detection)
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


# ---------------------------------------------------------------- ElevenLabs (HTTP layer replaceable in tests)

class ElevenError(RuntimeError):
    pass


def redact(text, key):
    text = str(text)
    return text.replace(key, '***') if key else text


def _ssl_context():
    import ssl
    return ssl.create_default_context(cafile=CA_BUNDLE) if os.path.exists(CA_BUNDLE) else ssl.create_default_context()


def urllib_http(method, url, headers, data=None, timeout=60):
    """-> (status, body bytes). Honors HTTPS_PROXY; uses the sandbox CA bundle when present."""
    import urllib.error
    import urllib.request
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


HTTP = urllib_http          # tests replace this
SLEEP = __import__('time').sleep


def api_key(required=True):
    key = os.environ.get(ELEVEN_KEY_ENV, '').strip()
    if required and not key:
        sys.exit(f'{ELEVEN_KEY_ENV} is not set (export it in the shell; it is never written anywhere).')
    return key


def eleven_request(text, cfg, key):
    """-> (url, headers, body bytes) of one text-to-speech call."""
    url = f"{ELEVEN_API}/text-to-speech/{cfg['voice_id']}?output_format={cfg['output_format']}"
    body = {'text': text, 'model_id': cfg['model_id'],
            'voice_settings': {k: cfg[k] for k in ('stability', 'similarity_boost', 'style', 'use_speaker_boost', 'speed')}}
    if cfg.get('seed') is not None:
        body['seed'] = cfg['seed']
    if cfg.get('language_code'):
        body['language_code'] = cfg['language_code']
    headers = {'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg',
               'User-Agent': 'suuraseikkailu-voices/1'}
    return url, headers, json.dumps(body, ensure_ascii=False).encode('utf-8')


def eleven_synth(text, cfg, path, key):
    """One clip; retries 429 / 5xx / network errors, fails at once on other errors (key redacted)."""
    url, headers, body = eleven_request(text, cfg, key)
    for attempt in range(RETRIES):
        try:
            status, data = HTTP('POST', url, headers, body, 90)
        except Exception as e:  # noqa: BLE001  network
            status, data = None, redact(f'{type(e).__name__}: {e}', key).encode()
        if status == 200:
            if len(data) < 1000 or not (data[:3] == b'ID3' or data[0] == 0xFF):
                raise ElevenError(f'not an MP3 ({len(data)} bytes)')
            Path(path).write_bytes(data)
            return
        msg = redact(data[:300].decode('utf-8', 'replace'), key)
        if status not in (None, 429, 500, 502, 503, 504) or attempt == RETRIES - 1:
            raise ElevenError(f'ElevenLabs HTTP {status}: {msg}')
        delay = 2 ** attempt
        log(f'  retry in {delay}s (HTTP {status})')
        SLEEP(delay)


def qa_norm(text):
    """Letters only, lower case, no audio tags, runs of 3+ equal letters as 2 ('Suuuura' = 'Suura')."""
    text = re.sub(r'\[[^\]]*\]', '', text.lower())
    return re.sub(r'(.)\1{2,}', r'\1\1', re.sub(r'[^a-zåäöü]', '', text))


def qa_score(sent, heard):
    """Letter similarity; a statement heard as a question ('Osaat koko' -> 'Osaatko koko?') counts against it."""
    score = difflib.SequenceMatcher(None, qa_norm(sent), qa_norm(heard)).ratio()
    if '?' in heard and '?' not in sent:
        score -= 0.1
    return round(score, 3)


_qa = {'model': None, 'lock': threading.Lock()}


def qa_heard(path, lang):
    """Back-transcript of one file (faster-whisper, loaded once, one transcription at a time)."""
    with _qa['lock']:
        if _qa['model'] is None:
            from faster_whisper import WhisperModel
            _qa['model'] = WhisperModel(QA_MODEL, device='cpu', compute_type='int8',
                                        download_root=os.environ.get('VOICES_ASR_MODELS'))
        segs, _ = _qa['model'].transcribe(str(path), language=lang, beam_size=5)
        return ' '.join(x.text.strip() for x in segs)


def eleven_quota(key):
    """Remaining characters of the subscription, or None (best effort, free call)."""
    try:
        status, data = HTTP('GET', f'{ELEVEN_API}/user/subscription', {'xi-api-key': key, 'Accept': 'application/json',
                                                                   'User-Agent': 'suuraseikkailu-voices/1'}, None, 30)
        if status == 200:
            d = json.loads(data)
            return int(d['character_limit']) - int(d['character_count'])
    except Exception:  # noqa: BLE001
        pass
    return None


def estimate(jobs, provider, eleven):
    """Print the size of a run; returns the ElevenLabs credits it would spend."""
    chars = sum(len(tts_text(c, voice_cfg(c, provider, eleven))) for c in jobs
                if voice_cfg(c, provider, eleven)['provider'] == 'elevenlabs' and not voice_cfg(c, provider, eleven).get('source'))
    credits = chars * CREDITS_PER_CHAR.get(eleven['model_id'], 1.0)
    if chars:
        log(f'ElevenLabs: {len(jobs)} clip(s), {chars} characters = about {credits:.0f} credits '
            f"(model {eleven['model_id']}, voice {eleven['voice_name']} {eleven['voice_id']})")
    return credits


def apply_credit(path=None):
    """data.js credits: the Finnish voice line -> ELEVEN_CREDIT (only after a successful ElevenLabs run)."""
    path = Path(path or DATA_JS)
    s = path.read_text(encoding='utf-8')
    m = re.search(r'"' + re.escape(CREDIT_PREFIX) + r'[^"\n]*"', s)
    if not m:
        log(f'  warning: no "{CREDIT_PREFIX}" credit in {path.name}; add "{ELEVEN_CREDIT}" by hand')
        return False
    new = json.dumps(ELEVEN_CREDIT, ensure_ascii=False)
    if m.group(0) != new:
        path.write_text(s[:m.start()] + new + s[m.end():], encoding='utf-8')
        log(f'  credits: {ELEVEN_CREDIT}')
    return True


async def make_all(clips, target, jobs, provider='edge', eleven=None, out_dir=None, names=None, qa=None):
    """Synthesize + master clips. out_dir/names: write to out_dir/<names[id]> instead of public/<file>.
    qa (dict, ElevenLabs only): checks every take (QA_MIN / QA_TAKES) and gets {id: {score, heard, seed, takes}}."""
    cfgs = {c['id']: voice_cfg(c, provider, eleven) for c in clips}
    edge_tts = import_edge_tts() if any(v['provider'] == 'edge' for v in cfgs.values()) else None
    key = api_key() if any(v['provider'] == 'elevenlabs' and not v.get('source') for v in cfgs.values()) else ''
    sem = asyncio.Semaphore(jobs)
    results = {}
    with tempfile.TemporaryDirectory() as tmp:
        async def one(clip):
            async with sem:
                cfg = cfgs[clip['id']]
                raw = Path(tmp) / (clip['id'] + '.raw.mp3')
                out = Path(out_dir) / names[clip['id']] if out_dir else PUBLIC / clip['file']
                out.parent.mkdir(parents=True, exist_ok=True)
                if cfg.get('source'):                     # a fixed take: master only
                    shutil.copyfile(ROOT / cfg['source'], raw)
                    results[clip['id']] = await asyncio.to_thread(master, raw, out, target)
                elif cfg['provider'] != 'elevenlabs':
                    await synth(edge_tts, say_text(clip), cfg, raw)
                    results[clip['id']] = await asyncio.to_thread(master, raw, out, target)
                elif qa is None:
                    await asyncio.to_thread(eleven_synth, tts_text(clip, cfg), cfg, raw, key)
                    results[clip['id']] = await asyncio.to_thread(master, raw, out, target)
                else:
                    best = None
                    for take in range(QA_TAKES):
                        c2 = dict(cfg, seed=(cfg.get('seed') or 0) + take)
                        cand = Path(tmp) / f"{clip['id']}.take{take}.mp3"
                        await asyncio.to_thread(eleven_synth, tts_text(clip, c2), c2, raw, key)
                        norm = await asyncio.to_thread(master, raw, cand, target)
                        heard = await asyncio.to_thread(qa_heard, cand, clip['lang'])
                        score = qa_score(say_text(clip, 'elevenlabs'), heard)
                        if best is None or score > best['score']:
                            best = {'score': score, 'heard': heard, 'seed': c2['seed'], 'file': cand, 'norm': norm}
                        if score >= QA_MIN:
                            break
                        log(f"  take {take + 1} of {clip['id']}: heard \"{heard}\" ({score}), another take")
                    shutil.copyfile(best.pop('file'), out)
                    results[clip['id']] = best.pop('norm')
                    qa[clip['id']] = dict(best, takes=take + 1)
                log(f"  made {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
        await asyncio.gather(*(one(c) for c in clips))
    return results


def add_voice_args(ap):
    """CLI options shared with tools/make_name.py."""
    ap.add_argument('--provider', choices=['edge', 'elevenlabs'], help='default: the provider of the last run')
    ap.add_argument('--yes', action='store_true', help='allow spending ElevenLabs credits')
    ap.add_argument('--voice-id', help=f"ElevenLabs voice (default {ELEVEN['voice_id']} = {ELEVEN['voice_name']})")
    ap.add_argument('--model', help=f"ElevenLabs model (default {ELEVEN['model_id']})")
    for k in ('stability', 'similarity', 'style', 'speed'):
        ap.add_argument('--' + k, type=float, help='ElevenLabs voice setting')
    ap.add_argument('--seed', type=int, help='ElevenLabs seed (default %d)' % ELEVEN['seed'])
    ap.add_argument('--language-code', help='ElevenLabs language_code (models that support it)')


def eleven_from_args(args):
    e = dict(ELEVEN)
    for opt, k in (('voice_id', 'voice_id'), ('model', 'model_id'), ('stability', 'stability'),
                   ('similarity', 'similarity_boost'), ('style', 'style'), ('speed', 'speed'), ('seed', 'seed'),
                   ('language_code', 'language_code')):
        v = getattr(args, opt, None)
        if v is not None:
            e[k] = v
    if e['voice_id'] != ELEVEN['voice_id']:
        e['voice_name'] = e['voice_id']
    return e


def last_provider():
    if VOICES_JSON.exists():
        return json.loads(VOICES_JSON.read_text(encoding='utf-8')).get('provider', 'edge')
    return 'edge'


def gate(credits, args, eleven):
    """True = go on. Credits are spent only with --yes (and a key)."""
    if not credits:
        return True
    if not args.yes:
        log('Nothing was sent. Add --yes to spend these credits.')
        return False
    left = eleven_quota(api_key())
    if left is not None:
        log(f'ElevenLabs: {left} characters left on the subscription')
        if left < credits:
            sys.exit('Not enough ElevenLabs credits for this run.')
    return True


def run_samples(clips, target, args, provider, eleven):
    """--samples: a few sentences with the current settings -> SAMPLES_DIR (public/ and voices.json untouched)."""
    pick = [c for c in clips if c['id'] in SAMPLE_IDS]
    names = {}
    for c in pick:
        tag = clip_key(c, target, voice_cfg(c, provider, eleven))[:8]
        names[c['id']] = f"{provider}-{c['id']}-{tag}.mp3"
    if not gate(estimate(pick, provider, eleven), args, eleven):
        return
    asyncio.run(make_all(pick, target, 2, provider, eleven, SAMPLES_DIR, names))
    settings = {c['id']: {'file': names[c['id']], 'text': c['text'], 'sayText': tts_text(c, voice_cfg(c, provider, eleven)),
                          'settings': voice_cfg(c, provider, eleven)} for c in pick}
    idx = SAMPLES_DIR / 'samples.json'
    old = json.loads(idx.read_text(encoding='utf-8')) if idx.exists() else {}
    old.update({v['file']: v for v in settings.values()})
    idx.write_text(json.dumps(old, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for v in settings.values():
        log(f"  sample {SAMPLES_DIR / v['file']}  {measure(SAMPLES_DIR / v['file'])}")


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
    ap.add_argument('--jobs', type=int, help='parallel TTS requests (default: edge 4, elevenlabs 2)')
    ap.add_argument('--samples', action='store_true', help=f'only render {", ".join(SAMPLE_IDS)} to {SAMPLES_DIR}')
    add_voice_args(ap)
    ap.add_argument('--asr', nargs='?', const='large-v3-turbo', metavar='MODEL',
                    help='back-transcribe the processed clips with faster-whisper')
    ap.add_argument('--prune', action='store_true', help='delete unused public/audio/fi/*.mp3, *-c-*.mp3')
    ap.add_argument('--no-qa', action='store_true', help='ElevenLabs: skip the take check (faster-whisper)')
    args = ap.parse_args()

    clips = list_clips()
    only = set(args.only.split(',')) if args.only else None
    if only and only - {c['id'] for c in clips}:
        sys.exit('Unknown clip id(s): ' + ', '.join(sorted(only - {c['id'] for c in clips})))

    target, n_ref = recitation_target()
    log(f'Loudness target {target} LUFS (median of {n_ref} recitation files)')
    provider = args.provider or last_provider()
    eleven = eleven_from_args(args)
    log(f'Provider: {provider}')
    if args.samples:
        run_samples(clips, target, args, provider, eleven)
        return

    old = {}
    if VOICES_JSON.exists():
        old = {e['id']: e for e in json.loads(VOICES_JSON.read_text(encoding='utf-8')).get('clips', [])}

    def outdated(c):
        key = clip_key(c, target, voice_cfg(c, provider, eleven))
        return args.force or not (PUBLIC / c['file']).exists() or old.get(c['id'], {}).get('key') != key

    todo = [c for c in clips if (not only or c['id'] in only) and outdated(c)]
    if args.check:
        todo = []
    log(f'{len(todo)} clip(s) to synthesize' + ('' if args.check else ', the rest are up to date'))
    if todo and not gate(estimate(todo, provider, eleven), args, eleven):
        return
    jobs = args.jobs or (2 if provider == 'elevenlabs' else 4)
    qa = None if args.no_qa or provider != 'elevenlabs' else {}
    norm = asyncio.run(make_all(todo, target, max(1, jobs), provider, eleven, qa=qa)) if todo else {}
    qa = qa or {}

    entries, failed = [], []
    for c in clips:
        path = PUBLIC / c['file']
        prev = old.get(c['id'], {})
        if not path.exists():
            failed.append(f"{c['id']}: missing {c['file']}")
            continue
        made = c['id'] in norm
        if made:
            cfg = voice_cfg(c, provider, eleven)
            if c['id'] in qa and cfg['provider'] == 'elevenlabs':
                cfg = dict(cfg, seed=qa[c['id']]['seed'])     # the take that stayed
        elif 'settings' in prev:
            cfg = prev['settings']
        elif 'voice' in prev:                # v3 entries (Edge): voice/rate/pitch at the top level
            cfg = {'provider': 'edge', 'voice': prev['voice'], 'rate': prev['rate'], 'pitch': prev['pitch']}
        else:
            cfg = voice_cfg(c, 'edge')
        e = {'id': c['id'], 'lang': c['lang'], 'file': c['file'], 'text': c['text'],
             'sayText': tts_text(c, cfg), 'provider': cfg['provider'], 'settings': cfg,
             **measure(path), 'normalization': norm.get(c['id'], prev.get('normalization', '?')),
             'key': clip_key(c, target, voice_cfg(c, provider, eleven)) if made else prev.get('key', '')}
        if c['id'] in qa:
            e['qa'] = qa[c['id']]
        elif not made and 'qa' in prev:
            e['qa'] = prev['qa']
        if c['id'] not in norm and 'asr' in prev:
            e['asr'] = prev['asr']           # file unchanged, so the old transcript still applies
        entries.append(e)
        for p in validate(e, target):
            failed.append(f"{c['id']}: {p}")

    if args.asr:
        asr([e for e in entries if not only or e['id'] in only], args.asr)

    used = {(PUBLIC / c['file']).resolve() for c in clips}
    generated = sorted((PUBLIC / 'audio' / 'fi').glob('*.mp3')) + sorted((PUBLIC / 'audio').glob('*-c-*.mp3'))
    for f in generated:
        if f.resolve() not in used:
            if args.prune:
                f.unlink()
                log(f'  pruned {f.relative_to(ROOT)}')
            else:
                log(f'  warning: unused {f.relative_to(ROOT)} (use --prune)')

    fi_providers = {e['provider'] for e in entries if e['lang'] == 'fi'}
    VOICES_JSON.write_text(json.dumps({
        'note': 'Generated by tools/make_voices.py - do not edit by hand.',
        'provider': provider,
        'target_lufs': target,
        'target_source': 'median integrated loudness of tools/recitation-src/everyayah/*.mp3 (Mishary Alafasy, v2 verse files)',
        'true_peak_max_dbtp': TP_MAX,
        'format': f'MP3 mono {SAMPLE_RATE} Hz {BITRATE}bps CBR, {PAD_S * 1000:.0f} ms padding',
        'voices': VOICES,
        'elevenlabs': eleven if 'elevenlabs' in fi_providers else None,
        'say_id': SAY_ID,
        'say_as': SAY_AS,
        'say_as_elevenlabs': SAY_AS_ELEVEN,
        'say_id_elevenlabs': SAY_ID_ELEVEN,
        'clips': entries,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    for e in entries:
        log(f"{e['id']:20s} {e['duration_s']:6.2f} s {e['lufs']:6.1f} LUFS {e['true_peak_dbtp']:5.1f} dBTP  {e['normalization']}")
    weak = sorted((e['qa']['score'], e['id'], e['qa']['heard']) for e in entries if e.get('qa') and e['qa']['score'] < QA_MIN)
    for sc, cid, heard in weak:
        log(f'  check by ear: {cid} heard "{heard}" ({sc}) after {QA_TAKES} takes')
    if failed:
        log('\nFAILED:\n  ' + '\n  '.join(failed))
        sys.exit(1)
    if fi_providers == {'elevenlabs'} and not args.check:
        apply_credit()                       # every Finnish clip is ElevenLabs now
    log(f'\nOK: {len(entries)} clips valid (target {target} LUFS +-{LU_TOL}, true peak <= {TP_MAX} dBTP)')


if __name__ == '__main__':
    main()
