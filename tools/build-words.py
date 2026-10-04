#!/usr/bin/env python3
"""Suuraseikkailu: build the word-by-word recordings for HELPPO / KESKITASO (Quran lines only).

Source: quran.com word audio https://audio.qurancdn.com/wbw/SSS_AAA_WWW.mp3 (human recordings, one word
per file, never cut from a recitation). The word list comes from the app (`node tools/list-clips.mjs --words`
= src/content/words.js), so file names are defined in one place.

Pipeline (deterministic):
  1. download every original with curl into tools/wbw-src/ if missing (python urllib is refused by the
     build proxy); for every verse also ask for word N+1, which must not exist (404) = quran.com has
     exactly as many words as the Tanzil line
  2. check the original: ffprobe reads it, duration DUR_MIN..DUR_MAX s (LONG_WORDS: documented exceptions)
  3. master with make_voices.master() (same chain as the teacher voices): mono, edge silence trimmed
     (peak below -50 dBFS, 10 ms soft lead-in kept) + PAD_S padding = ~40 ms at each end, two-pass linear loudnorm
     to the recitation target (median of the Mishary verse files, about -18.4 LUFS), true peak <= -2 dBTP,
     MP3 mono 44.1 kHz 64 kbps -> public/audio/wbw/<same name>
  4. validate (duration, loudness, true peak, not silent, nothing but edge silence removed, duration per
     letter plausible) and write tools/words.json
Usage:
  python3 tools/build-words.py            # download missing, master outdated, validate all
  python3 tools/build-words.py --force    # master everything again
  python3 tools/build-words.py --check    # validate only (no network, no ffmpeg encode)
  python3 tools/build-words.py --asr      # also back-transcribe with faster-whisper (optional QA)
  python3 tools/build-words.py --prune    # delete public/audio/wbw/*.mp3 that no word uses
Exit code 1 if anything fails.
"""
import argparse
import difflib
import hashlib
import json
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_voices as mv  # noqa: E402  (shared meter + mastering)

ROOT = mv.ROOT
PUBLIC = mv.PUBLIC
SRC_DIR = ROOT / 'tools' / 'wbw-src'           # untouched originals (cache, re-downloaded if missing)
OUT_DIR = PUBLIC / 'audio' / 'wbw'
REPORT = ROOT / 'tools' / 'words.json'
BASE_URL = 'https://audio.qurancdn.com/'
PAD_S = 0.03              # + the 10 ms kept lead-in/decay = ~40 ms of silence at each end
TRIM_DETECTION = 'peak'   # trim only where every sample is below -50 dBFS (never a quiet word tail)
DUR_MIN, DUR_MAX = 0.2, 4.0
# ٱلضَّآلِّينَ (1:7, last word): madd laazim held for 6 counts, the longest word of the three surahs.
LONG_WORDS = {'audio/wbw/001_007_009.mp3': 7.0}
RATIO_SPREAD = 3.0        # speech seconds per letter must be within median / 3 .. median * 3
PIPELINE = 'w1'           # bump when the processing changes -> everything is mastered again


def log(*a):
    print(*a, flush=True)


def list_words():
    out = subprocess.run(['node', 'tools/list-clips.mjs', '--words'], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out)


def url_of(file):
    return BASE_URL + file[len('audio/'):]


def curl_status(url, dest=None):
    args = ['curl', '-sS', '-L', '--retry', '3', '-o', str(dest) if dest else '/dev/null', '-w', '%{http_code}', url]
    p = subprocess.run(args, capture_output=True, text=True)
    return int(p.stdout.strip() or 0)


def download(entry):
    dest = SRC_DIR / Path(entry['file']).name
    if dest.exists():
        return False
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix('.part')
    code = curl_status(url_of(entry['file']), tmp)
    if code != 200:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"download {url_of(entry['file'])}: HTTP {code}")
    tmp.rename(dest)
    log(f"  downloaded {dest.relative_to(ROOT)}")
    return True


def next_word_url(entry):
    """URL of word N+1 of the entry's verse (must not exist)."""
    return url_of(re.sub(r'_\d{3}\.mp3$', '_%03d.mp3' % (entry['words'] + 1), entry['file']))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def speech_seconds(path):
    """Time from the first to the last sample above the trim threshold (silencedetect, independent of
    the trim filter): the mastered file must be at least this long, i.e. only edge silence was removed."""
    err = mv.ffmpeg('-i', path, '-af', f'aformat=channel_layouts=mono,silencedetect=n={mv.SILENCE_DB}dB:d=0.01',
                    '-f', 'null', '-')
    total = mv.duration(path)
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    lead = ends[0] if starts and starts[0] <= 0.001 and ends else 0.0
    tail = total
    if starts and (len(ends) < len(starts) or ends[-1] >= total - 0.002) and starts[-1] > lead:
        tail = starts[-1]
    return round(max(0.0, tail - lead), 3)


def letters(ar):
    return sum(1 for ch in ar if unicodedata.category(ch) == 'Lo' and ch != 'ـ')


def skeleton(ar):
    """Consonant skeleton for comparing an ASR transcript with the word (marks, tatweel, alef forms)."""
    s = ''.join(ch for ch in unicodedata.normalize('NFKD', ar) if unicodedata.category(ch) == 'Lo')
    s = s.replace('ـ', '')
    for a in 'ٱأإآ':
        s = s.replace(a, 'ا')
    return s.replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')


def word_key(src_hash, target):
    payload = [PIPELINE, src_hash, round(target, 1), mv.SILENCE_DB, TRIM_DETECTION, PAD_S, mv.TP_TARGET,
               mv.SAMPLE_RATE, mv.BITRATE]
    return hashlib.sha256(json.dumps(payload).encode()).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--force', action='store_true', help='master again even if up to date')
    ap.add_argument('--check', action='store_true', help='validate only')
    ap.add_argument('--asr', nargs='?', const='large-v3-turbo', metavar='MODEL',
                    help='back-transcribe the mastered words with faster-whisper')
    ap.add_argument('--prune', action='store_true', help='delete unused public/audio/wbw/*.mp3')
    args = ap.parse_args()

    entries = list_words()
    target, n_ref = mv.recitation_target()
    log(f'{len(entries)} word files, loudness target {target} LUFS (median of {n_ref} recitation files)')
    old = json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else {}
    old_words = {w['file']: w for w in old.get('words', [])}
    verses = dict(old.get('verses', {}))
    failed = []

    # 1. originals + word count per verse
    for e in entries:
        if args.check:
            continue
        fresh = download(e)
        if fresh or e['verse'] not in verses:
            code = curl_status(next_word_url(e))
            verses[e['verse']] = {'words': e['words'], 'next_word': next_word_url(e), 'next_word_http': code}
    for e in entries:
        v = verses.get(e['verse'])
        if not v or v['words'] != e['words']:
            failed.append(f"{e['verse']}: word count not verified against quran.com")
        elif v['next_word_http'] == 200:
            failed.append(f"{e['verse']}: quran.com has more than {e['words']} words")

    # 2.-3. check originals, master outdated
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        for e in entries:
            src = SRC_DIR / Path(e['file']).name
            out = PUBLIC / e['file']
            prev = old_words.get(e['file'], {})
            if not src.exists():
                failed.append(f"{e['file']}: original missing ({src.relative_to(ROOT)})")
                continue
            orig = {'url': url_of(e['file']), 'sha256': sha256(src), 'bytes': src.stat().st_size}
            orig.update({k: v for k, v in mv.measure(src).items() if k != 'max_volume_db'})
            orig['speech_s'] = speech_seconds(src)
            dmax = LONG_WORDS.get(e['file'], DUR_MAX)
            if not (DUR_MIN <= orig['duration_s'] <= dmax):
                failed.append(f"{e['file']}: original duration {orig['duration_s']} s")
            key = word_key(orig['sha256'], target)
            norm = prev.get('normalization', '?')
            if not args.check and (args.force or not out.exists() or prev.get('key') != key):
                raw = Path(tmp) / src.name
                shutil.copyfile(src, raw)
                out.parent.mkdir(parents=True, exist_ok=True)
                norm = mv.master(raw, out, target, PAD_S, TRIM_DETECTION)
                log(f"  mastered {e['file']}")
            else:
                key = prev.get('key', '')      # unchanged file (or --check): keep what made it
            if not out.exists():
                failed.append(f"{e['file']}: missing")
                continue
            r = {**e, 'original': orig, **mv.measure(out), 'normalization': norm, 'key': key}
            if 'asr' in prev and prev.get('key') == key:
                r['asr'] = prev['asr']
            report.append(r)

    # 4. validation
    for r in report:
        problems = [p for p in mv.validate(r, target) if not p.startswith('duration')]
        if not (DUR_MIN <= r['duration_s'] <= LONG_WORDS.get(r['file'], DUR_MAX)):
            problems.append(f"duration {r['duration_s']} s")
        if r['duration_s'] + 0.02 < r['original']['speech_s']:
            problems.append(f"shorter ({r['duration_s']} s) than the original speech ({r['original']['speech_s']} s)")
        failed += [f"{r['file']}: {p}" for p in problems]
    ratios = {r['file']: r['original']['speech_s'] / max(1, letters(r['ar'])) for r in report}
    if ratios:
        med = statistics.median(ratios.values())
        for f, q in ratios.items():
            if f not in LONG_WORDS and not (med / RATIO_SPREAD <= q <= med * RATIO_SPREAD):
                failed.append(f'{f}: {q:.3f} s per letter (median {med:.3f}) - wrong word?')

    if args.asr:
        jobs = [{'id': Path(r['file']).stem, 'file': r['file'], 'lang': 'ar', 'text': r['ar']} for r in report]
        mv.asr(jobs, args.asr)
        for r, j in zip(report, jobs):
            if 'asr' in j:
                r['asr'] = j['asr']
    for r in report:
        if 'asr' in r:
            r['asr']['similarity'] = round(difflib.SequenceMatcher(
                None, skeleton(r['ar']), skeleton(r['asr']['text'])).ratio(), 2)

    used = {(PUBLIC / e['file']).resolve() for e in entries}
    for f in sorted(OUT_DIR.glob('*.mp3')):
        if f.resolve() not in used:
            if args.prune:
                f.unlink()
                log(f'  pruned {f.relative_to(ROOT)}')
            else:
                log(f'  warning: unused {f.relative_to(ROOT)} (use --prune)')

    REPORT.write_text(json.dumps({
        'note': 'Generated by tools/build-words.py - do not edit by hand.',
        'source': 'Quran.com word-by-word audio, ' + BASE_URL + 'wbw/SSS_AAA_WWW.mp3 (human recordings)',
        'target_lufs': target,
        'true_peak_max_dbtp': mv.TP_MAX,
        'format': f'MP3 mono {mv.SAMPLE_RATE} Hz {mv.BITRATE}bps CBR, edge silence ~{(PAD_S + 0.01) * 1000:.0f} ms',
        'verses': dict(sorted(verses.items(), key=lambda kv: [int(x) for x in kv[0].split(':')])),
        'words': report,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    for r in report:
        a = r.get('asr')
        asr_txt = f"  asr {a['text']} ({a['similarity']})" if a else ''
        log(f"{Path(r['file']).name} {r['original']['duration_s']:5.2f}->{r['duration_s']:5.2f} s "
            f"{r['lufs']:6.1f} LUFS {r['true_peak_dbtp']:5.1f} dBTP  {r['tr']}{asr_txt}")
    if failed:
        log('\nFAILED:\n  ' + '\n  '.join(failed))
        sys.exit(1)
    log(f'\nOK: {len(report)} word files valid, {len(verses)} verses with exactly the Tanzil word count')


if __name__ == '__main__':
    main()
