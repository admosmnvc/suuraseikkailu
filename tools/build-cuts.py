#!/usr/bin/env python3
"""Suuraseikkailu: line clips + word-boundary PREFIX clips from real recitation / a real human voice.

Owner: "resitoinnin flow joka on vaan pilkottu" - the recording itself, cut at word boundaries. For every line
the app gets the line clip (data.js lines[].audio, file names unchanged) and a prefix clip at every easy-unit
end but the last: public/audio/cut/<base>_wW.mp3 = the line from its start to the end of word W
(Quran base SSS_AAA, other sections <secId>-<line>). Lines and file names come from the app
(`node tools/list-clips.mjs --cuts` = src/content/chunks.js cutLines()).

Sources (in tools/, not shipped):
  Quran: Mishary Rashid Alafasy, murattal, one MP3 per chapter + word timings, Quran.com QDC (curl if missing):
    https://api.qurancdn.com/api/qdc/audio/reciters/7/audio_files?chapter=N&segments=true -> audio_url
    (download.quranicaudio.com/qdc/mishari_al_afasy/murattal/N.mp3) + verse_timings[].segments =
    [[word position, start ms, end ms], ...] (malformed entries such as [1] are dropped) -> tools/recitation-src/.
    Same performance as the v2 EveryAyah verse files (tools/recitation-src/everyayah/, checked: windowed
    correlation ~0.99) at 44.1 kHz / 128 kbps instead of 22 kHz / 64 kbps, so line AND prefixes are cut from
    the chapter file: one take, one gain, a prefix is exactly the beginning of its line.
    QDC_FIXES: word starts where the QDC timing is demonstrably off (evidence in the comment).
  Other sections: tools/cut-src/<secId>.json (the Shahada: the owner's human recording) = {audio, gap_ms, trim,
    fade_out_ms, channels, bitrate, lines: [{pieces: [{ms: [from, to], words: [first, last], join?}]}]};
    pieces are separate takes of one or more words joined with gap_ms of silence; join 'continuous' = this
    piece continues the previous one in the source (one span, cut inside it).

Cutting (deterministic, numpy on one ffmpeg decode, 44.1 kHz):
  - a cut inside speech (QDC word start, 'continuous' join, line start/end of a Quran verse) moves to the
    quietest point (10 ms RMS, 1 ms steps) within +-REFINE_MS; ties -> the point closest to the given time
  - trim (human pieces): the piece edges move inwards to the first/last sample above -50 dBFS, +10 ms margin
  - raised-cosine fade-in FADE_IN_MS and fade-out fade_out_ms at every edge of a span (no click)
  - gain = TARGET - integrated loudness of the line (make_voices meter); the SAME gain for its prefixes;
    one correction pass after encoding. MP3 CBR bitexact (Quran stereo 96 kbps, Shahada mono 64 kbps)
Validation: QDC word positions 1..n = Tanzil words, pieces in order, prefix durations increasing, line
loudness, true peak, edges (first/last 1 ms <= EDGE_DB; first/last 10 ms reported), same take (Quran).
Usage:
  python3 tools/build-cuts.py            # download missing sources, cut outdated, validate all
  python3 tools/build-cuts.py --force    # cut everything again
  python3 tools/build-cuts.py --check    # validate only
  python3 tools/build-cuts.py --asr      # also back-transcribe lines + prefixes with faster-whisper (QA)
  python3 tools/build-cuts.py --asr --only audio/shahada-1.mp3   # ... of these lines only
  python3 tools/build-cuts.py --prune    # delete public/audio/cut/*.mp3 that no line uses
Writes tools/cuts.json. Exit code 1 if anything fails.
"""
import argparse
import difflib
import hashlib
import json
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_voices as mv  # noqa: E402  (shared meter, loudness target, ASR)

ROOT = mv.ROOT
PUBLIC = mv.PUBLIC
SRC_DIR = ROOT / 'tools' / 'recitation-src'
CUT_SRC_DIR = ROOT / 'tools' / 'cut-src'
OLD_DIR = SRC_DIR / 'everyayah'
CUT_DIR = PUBLIC / 'audio' / 'cut'
REPORT = ROOT / 'tools' / 'cuts.json'
API = 'https://api.qurancdn.com/api/qdc/audio/reciters/7/audio_files?chapter={}&segments=true'
SR = 44100
REFINE_MS = 80
RMS_MS = 10
FADE_IN_MS = 20
TRIM_DB = -50.0
TRIM_MARGIN_MS = 10
EDGE_DB = -40.0           # |sample| in the first / last 1 ms of a decoded clip must stay below this
PREFIX_MIN_S = 0.25
SAME_TAKE_MIN = 0.9       # median windowed correlation with the v2 verse file
QURAN = {'gap_ms': 0, 'trim': False, 'fade_out_ms': 60, 'channels': 2, 'bitrate': '96k'}
PIPELINE = 'c2'           # bump when the processing changes -> everything is cut again

# QDC word timings run 65 ms ahead of the verse timestamp in 11 of the 14 verses (segments[0] start =
# timestamp_from - 65). Where they run further ahead, all word starts of that verse are late-shifted by the
# excess: 108:2 by 400 ms (its QDC word starts fell inside فَصَلِّ and inside رَبِّكَ: the prefixes were heard
# as "فلس" / "فصلي لرب"; shifted they match the energy envelope and Whisper's word times 0.74 s / ~1.9 s),
# 108:3 by 50 ms, 1:6 by 10 ms; the others by 0.
QDC_LEAD_MS = -65
# Manual word starts (ms in the chapter file) for anything the rule above does not fix: {verse: {word: ms}}.
QDC_FIXES = {}


def log(*a):
    print(*a, flush=True)


def node_json(*args):
    return json.loads(subprocess.run(['node', *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout)


def curl(url, dest):
    tmp = dest.with_suffix(dest.suffix + '.part')
    p = subprocess.run(['curl', '-sS', '-L', '--retry', '3', '-o', str(tmp), '-w', '%{http_code}', url],
                       capture_output=True, text=True)
    if p.stdout.strip() != '200':
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f'download {url}: HTTP {p.stdout.strip()} {p.stderr.strip()}')
    tmp.rename(dest)
    log(f'  downloaded {dest.relative_to(ROOT)}')


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path, sr=SR, channels=2):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', str(channels), '-ar', str(sr),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).astype(np.float64)


# ---------------------------------------------------------------- sources -> line specs

def quran_source(chapter, offline):
    """-> (audio path, verse_timings by verse key, info) for a Quran chapter (QDC, Mishary = reciter 7)."""
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    js = SRC_DIR / f'qdc-{chapter}.json'
    if not js.exists():
        if offline:
            raise RuntimeError(f'missing {js.relative_to(ROOT)}')
        curl(API.format(chapter), js)
    af = json.loads(js.read_text(encoding='utf-8'))['audio_files'][0]
    audio = SRC_DIR / f'{chapter}.mp3'
    if not audio.exists():
        if offline:
            raise RuntimeError(f'missing {audio.relative_to(ROOT)}')
        curl(af['audio_url'], audio)
    info = {'api': API.format(chapter), 'audio_url': af['audio_url'], 'audio_sha256': sha256(audio),
            'qdc_audio_file_id': af.get('id')}
    return audio, {v['verse_key']: v for v in af['verse_timings']}, info


def quran_spec(verse, vt, n):
    """QDC verse timing -> one continuous piece per word (cuts at the word starts, QDC_FIXES applied)."""
    segs = [s for s in vt.get('segments', []) if isinstance(s, list) and len(s) == 3]
    pos = [s[0] for s in segs]
    if pos != list(range(1, n + 1)):
        raise RuntimeError(f'QDC word positions {pos}, expected 1..{n}')
    fix = QDC_FIXES.get(verse, {})
    shift = max(0, QDC_LEAD_MS - (int(segs[0][1]) - int(vt['timestamp_from'])))
    starts = [fix.get(k + 1, int(s[1]) + shift) for k, s in enumerate(segs)]
    bounds = [int(vt['timestamp_from'])] + starts[1:] + [int(vt['timestamp_to'])]
    pieces = [{'ms': [bounds[k], bounds[k + 1]], 'words': [k, k], 'qdc_ms': int(segs[k][1]), 'shift_ms': shift}
              for k in range(n)]
    for p in pieces[1:]:
        p['join'] = 'continuous'
    return {**QURAN, 'pieces': pieces}


def section_source(sec):
    js = CUT_SRC_DIR / f'{sec}.json'
    if not js.exists():
        raise RuntimeError(f'{sec} is in CUT_SECTIONS but {js.relative_to(ROOT)} does not exist')
    d = json.loads(js.read_text(encoding='utf-8'))
    audio = CUT_SRC_DIR / d['audio']
    info = {'spec': str(js.relative_to(ROOT)), 'source': d.get('source', ''), 'audio_sha256': sha256(audio)}
    return audio, d, info


# ---------------------------------------------------------------- cutting

class Track:
    def __init__(self, path):
        self.path = path
        self.x = decode(path)
        mono = self.x.mean(axis=1)
        self.cum = np.concatenate([[0.0], np.cumsum(mono * mono)])
        self.peak = np.abs(self.x).max(axis=1)
        self.n = len(mono)
        self._low = None

    @property
    def low(self):
        if self._low is None:
            self._low = decode(self.path, 11025, 1)[:, 0]
        return self._low

    def rms_db(self, center):
        h = RMS_MS * SR // 2000
        a, b = max(0, center - h), min(self.n, center + h)
        return 10 * np.log10((self.cum[b] - self.cum[a]) / max(1, b - a) + 1e-20)

    def refine(self, t_ms):
        """Quietest 1-ms point within +-REFINE_MS of t_ms (sample index); ties -> closest to t_ms."""
        best = None
        for d in range(-REFINE_MS, REFINE_MS + 1):
            s = int(round((t_ms + d) * SR / 1000))
            if 0 <= s <= self.n:
                key = (round(self.rms_db(s), 3), abs(d), d)
                if best is None or key < best[0]:
                    best = (key, s)
        return best[1]

    def trim(self, a_ms, b_ms):
        """Speech inside [a_ms, b_ms]: first/last sample above TRIM_DB, + TRIM_MARGIN_MS (inside the span)."""
        a, b = int(a_ms * SR / 1000), min(self.n, int(b_ms * SR / 1000))
        idx = np.nonzero(self.peak[a:b] >= 10 ** (TRIM_DB / 20))[0]
        if not len(idx):
            raise RuntimeError(f'no speech in {a_ms}-{b_ms} ms')
        m = TRIM_MARGIN_MS * SR // 1000
        return max(a, a + idx[0] - m), min(b, a + idx[-1] + 1 + m)


def piece_bounds(track, spec):
    """[(a, b)] sample bounds of every piece."""
    ps = spec['pieces']
    out = []
    for k, p in enumerate(ps):
        cont_in = p.get('join') == 'continuous'
        cont_out = k + 1 < len(ps) and ps[k + 1].get('join') == 'continuous'
        if spec['trim']:
            ta, tb = track.trim(*p['ms'])
        a = out[-1][1] if cont_in else (ta if spec['trim'] else track.refine(p['ms'][0]))
        b = track.refine(p['ms'][1]) if cont_out or not spec['trim'] else tb
        out.append((a, b))
    for (a, b), nxt in zip(out, out[1:] + [None]):
        if not (a < b and (nxt is None or b <= nxt[0])):
            raise RuntimeError(f'pieces out of order: {out}')
    return out


def fade(seg, fade_out_ms):
    seg = seg.copy()
    fi, fo = min(FADE_IN_MS * SR // 1000, len(seg) // 2), min(fade_out_ms * SR // 1000, len(seg) // 2)
    seg[:fi] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi))[:, None]
    seg[len(seg) - fo:] *= (0.5 + 0.5 * np.cos(np.pi * (np.arange(fo) + 1) / fo))[:, None]
    return seg


def render(track, spec, bounds, upto):
    """Pieces 0..upto: runs of continuous pieces are one span (faded at both ends), spans joined by gap_ms."""
    x = track.x if spec['channels'] == 2 else track.x.mean(axis=1, keepdims=True)
    gap = np.zeros((spec['gap_ms'] * SR // 1000, x.shape[1]))
    parts, start = [], bounds[0][0]
    for k in range(upto + 1):
        last = k == upto or spec['pieces'][k + 1].get('join') != 'continuous'
        if last:
            if parts:
                parts.append(gap)
            parts.append(fade(x[start:bounds[k][1]], spec['fade_out_ms']))
            if k < upto:
                start = bounds[k + 1][0]
    return np.concatenate(parts)


def encode(seg, gain_db, out, bitrate):
    y = (seg * 10 ** (gain_db / 20)).astype(np.float32)
    if np.abs(y).max() >= 1.0:
        raise RuntimeError(f'{out.name}: would clip')
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix('.part.mp3')
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(y.shape[1]), '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', '-fflags', '+bitexact',
                        '-flags:a', '+bitexact', str(tmp)], input=y.tobytes(), capture_output=True)
    if p.returncode:
        raise RuntimeError('ffmpeg: ' + p.stderr.decode()[-500:])
    tmp.replace(out)


def wav_lufs(seg):
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / 'm.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(seg.shape[1]),
                        '-i', '-', str(f)], input=seg.astype(np.float32).tobytes(), check=True)
        return mv.measure(f)['lufs']


def edges(path):
    y = np.abs(decode(path)).max(axis=1)
    db = lambda v: round(float(20 * np.log10(v + 1e-9)), 1)  # noqa: E731
    one, ten = SR // 1000, SR // 100
    return {'first_1ms_db': db(y[:one].max()), 'last_1ms_db': db(y[-one:].max()),
            'first_10ms_db': db(y[:ten].max()), 'last_10ms_db': db(y[-ten:].max())}


def same_take(track, s0, s1, old_path):
    """Median correlation of 0.5 s windows of the new line against the v2 verse file (both decoded by ffmpeg at
    11025 Hz mono; one global lag within +-200 ms, then +-5 ms per window)."""
    if not old_path.exists():
        return None
    sr, q = 11025, SR // 11025
    a = track.low[s0 // q:s1 // q]
    b = decode(old_path, sr, 1)[:, 0]
    nf = 1 << (len(a) + len(b) - 1).bit_length()
    r = np.fft.irfft(np.fft.rfft(a, nf) * np.conj(np.fft.rfft(b, nf)), nf)
    lag = max(range(-sr // 5, sr // 5 + 1), key=lambda k: r[k % nf])
    out, w, fine = [], sr // 2, sr // 200
    for i in range(0, len(b) - w, w):
        y = b[i:i + w]
        if np.sqrt((y * y).mean()) < 0.003:
            continue
        cs = [float(np.dot(a[j:j + w], y) / (np.linalg.norm(a[j:j + w]) * np.linalg.norm(y) + 1e-12))
              for j in range(i + lag - fine, i + lag + fine + 1) if 0 <= j and j + w <= len(a)]
        if cs:
            out.append(max(cs))
    return {'median_corr': round(float(np.median(out)), 3) if out else None, 'windows': len(out),
            'lag_ms': round(lag * 1000 / sr, 1), 'old_file': str(old_path.relative_to(ROOT))}


def skeleton(ar):
    s = ''.join(ch for ch in unicodedata.normalize('NFKD', ar) if unicodedata.category(ch) == 'Lo')
    s = s.replace('ـ', '')
    for a in 'ٱأإآ':
        s = s.replace(a, 'ا')
    return s.replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')


def cut_key(src_hash, item):
    payload = [PIPELINE, src_hash, item, mv.recitation_target()[0], REFINE_MS, RMS_MS, FADE_IN_MS, TRIM_DB,
               TRIM_MARGIN_MS, SR]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False).encode()).hexdigest()[:16]


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--check', action='store_true', help='validate only')
    ap.add_argument('--asr', nargs='?', const='large-v3-turbo', metavar='MODEL')
    ap.add_argument('--only', help='--asr only for these line files (comma-separated, e.g. audio/shahada-1.mp3)')
    ap.add_argument('--prune', action='store_true')
    args = ap.parse_args()

    target = mv.recitation_target()[0]
    lines = node_json('tools/list-clips.mjs', '--cuts')
    tanzil = node_json('-e', "import('./src/content/data.js').then(m => console.log(JSON.stringify(Object.fromEntries("
                             "m.default.sections.flatMap(s => s.lines.map(l => [l.audio, l.ar]))))))")
    old = json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else {}
    old_lines = {e['audio']: e for e in old.get('lines', [])}
    log(f'{len(lines)} lines, {sum(len(e["prefixes"]) for e in lines)} prefixes, target {target} LUFS')

    failed, report, sources, tracks = [], [], {}, {}
    for e in lines:
        name = e['audio']
        words = tanzil[name].split(' ')
        try:
            if e['verse']:
                ch = e['verse'].split(':')[0]
                if ch not in sources:
                    sources[ch] = quran_source(int(ch), args.check)
                audio, timings, info = sources[ch]
                spec = quran_spec(e['verse'], timings[e['verse']], len(words))
            else:
                if e['sec'] not in sources:
                    sources[e['sec']] = section_source(e['sec'])
                audio, d, info = sources[e['sec']]
                spec = {k: d[k] for k in QURAN}
                spec['pieces'] = d['lines'][e['line']]['pieces']
            covered = [w for p in spec['pieces'] for w in range(p['words'][0], p['words'][1] + 1)]
            if covered != list(range(len(words))):
                raise RuntimeError(f'pieces cover words {covered}, the line has {len(words)}')
            ends = {p['words'][1] + 1: k for k, p in enumerate(spec['pieces'])}
            missing = [p['W'] for p in e['prefixes'] if p['W'] not in ends]
            if missing:
                raise RuntimeError(f'no piece ends at word(s) {missing}')
        except Exception as ex:  # noqa: BLE001
            failed.append(f'{name}: {ex}')
            continue

        key = cut_key(info['audio_sha256'], [name, [p['file'] for p in e['prefixes']], spec])
        prev = old_lines.get(name, {})
        outs = [PUBLIC / name] + [PUBLIC / p['file'] for p in e['prefixes']]
        todo = not args.check and (args.force or prev.get('key') != key or not all(o.exists() for o in outs))
        if todo:
            if str(audio) not in tracks:
                tracks[str(audio)] = Track(audio)
            tr = tracks[str(audio)]
            bounds = piece_bounds(tr, spec)
            line_seg = render(tr, spec, bounds, len(bounds) - 1)
            prefix_segs = [render(tr, spec, bounds, ends[p['W']]) for p in e['prefixes']]
            gain = target - wav_lufs(line_seg)
            for attempt in range(2):
                encode(line_seg, gain, outs[0], spec['bitrate'])
                drift = target - mv.measure(outs[0])['lufs']
                if abs(drift) <= mv.CORRECT_LU or attempt:
                    break
                gain += drift
            for seg, o in zip(prefix_segs, outs[1:]):
                encode(seg, gain, o, spec['bitrate'])
            cut_info = {'gain_db': round(gain, 2),
                        'pieces': [{'words': p['words'], 'ms_given': p['ms'], 'ms': [round(a * 1000 / SR, 1),
                                    round(b * 1000 / SR, 1)], **{k: p[k] for k in ('qdc_ms', 'shift_ms') if k in p}}
                                   for p, (a, b) in zip(spec['pieces'], bounds)],
                        'same_take': same_take(tr, bounds[0][0], bounds[-1][1], OLD_DIR / Path(name).name)
                        if e['verse'] else None}
            log(f"  cut {name} + {len(prefix_segs)} prefixes (gain {gain:+.2f} dB)")
        elif prev:
            cut_info = {k: prev.get(k) for k in ('gain_db', 'pieces', 'same_take')}
        else:
            failed.append(f'{name}: not cut yet')
            continue

        entry = {'audio': name, 'verse': e['verse'], 'sec': e['sec'], 'line': e['line'], 'uses': e['uses'],
                 'words': len(words), 'source': info, 'format': {k: spec[k] for k in QURAN}, 'key': key, **cut_info}
        if not all(o.exists() for o in outs):
            failed.append(f'{name}: missing output files')
            continue
        entry.update(mv.measure(outs[0]))
        entry['edges'] = edges(outs[0])
        prev_prefix = {p['file']: p for p in prev.get('prefixes', [])}
        entry['prefixes'] = []
        for p in e['prefixes']:
            q = {'file': p['file'], 'W': p['W'], 'words': ' '.join(words[:p['W']]), **mv.measure(PUBLIC / p['file']),
                 'edges': edges(PUBLIC / p['file'])}
            if not todo and 'asr' in prev_prefix.get(p['file'], {}):
                q['asr'] = prev_prefix[p['file']]['asr']
            entry['prefixes'].append(q)
        if not todo and 'asr' in prev:
            entry['asr'] = prev['asr']

        # validation
        if abs(entry['lufs'] - target) > 0.5:
            failed.append(f'{name}: loudness {entry["lufs"]} LUFS')
        take = entry.get('same_take') or {}
        if take and (take.get('median_corr') or 0) < SAME_TAKE_MIN:
            failed.append(f'{name}: not the same take as the v2 verse file ({take})')
        for c in [entry] + entry['prefixes']:
            label = c.get('file', name)
            if c['true_peak_dbtp'] > mv.TP_MAX:
                failed.append(f'{label}: true peak {c["true_peak_dbtp"]} dBTP')
            if c['edges']['first_1ms_db'] > EDGE_DB or c['edges']['last_1ms_db'] > EDGE_DB:
                failed.append(f'{label}: edge not silent {c["edges"]}')
        prev_d = 0
        for q in entry['prefixes']:
            if q['duration_s'] < PREFIX_MIN_S or q['duration_s'] <= prev_d or q['duration_s'] >= entry['duration_s']:
                failed.append(f"{q['file']}: duration {q['duration_s']} s")
            prev_d = q['duration_s']
        report.append(entry)

    if args.asr:
        jobs = []
        for e in [e for e in report if not args.only or e['audio'] in args.only.split(',')]:
            jobs.append({'id': Path(e['audio']).stem, 'file': e['audio'], 'lang': 'ar', 'text': tanzil[e['audio']], 'ref': e})
            jobs += [{'id': Path(q['file']).stem, 'file': q['file'], 'lang': 'ar', 'text': q['words'], 'ref': q}
                     for q in e['prefixes']]
        mv.asr(jobs, args.asr)
        for j in jobs:
            if 'asr' in j:
                j['ref']['asr'] = j['asr']
    for e in report:
        all_words = tanzil[e['audio']].split(' ')
        for c, k in [(e, len(all_words))] + [(q, q['W']) for q in e['prefixes']]:
            if 'asr' not in c:
                continue
            got = skeleton(c['asr']['text'].replace(' ', ''))
            sim = lambda m: difflib.SequenceMatcher(None, skeleton(''.join(all_words[:m])), got).ratio()  # noqa: E731
            c['asr']['similarity'] = round(sim(k), 2)
            c['asr']['best_word_count'] = max(range(1, len(all_words) + 1), key=lambda m: (round(sim(m), 3), -abs(m - k)))

    used = {(PUBLIC / q['file']).resolve() for e in lines for q in e['prefixes']}
    for f in sorted(CUT_DIR.glob('*.mp3')):
        if f.resolve() not in used:
            if args.prune:
                f.unlink()
                log(f'  pruned {f.relative_to(ROOT)}')
            else:
                log(f'  warning: unused {f.relative_to(ROOT)} (use --prune)')

    REPORT.write_text(json.dumps({
        'note': 'Generated by tools/build-cuts.py - do not edit by hand.',
        'sources': {'quran': 'Mishary Rashid Alafasy (murattal), chapter audio + word timings: Quran.com QDC '
                             '(api.qurancdn.com, download.quranicaudio.com)',
                    'other': 'tools/cut-src/<secId>.json (Shahada: human recording, see its note)'},
        'target_lufs': target, 'true_peak_max_dbtp': mv.TP_MAX,
        'processing': f'cuts refined within +-{REFINE_MS} ms to the quietest {RMS_MS} ms RMS point; human pieces '
                      f'trimmed at {TRIM_DB} dBFS + {TRIM_MARGIN_MS} ms; fade-in {FADE_IN_MS} ms, fade-out per format',
        'qdc_lead_ms': QDC_LEAD_MS, 'qdc_fixes': QDC_FIXES,
        'lines': report,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    for e in report:
        t = e.get('same_take') or {}
        a = e.get('asr')
        log(f"{e['audio']:20s} {e['duration_s']:6.2f} s {e['lufs']:6.1f} LUFS {e['true_peak_dbtp']:5.1f} dBTP "
            f"gain {e['gain_db']:+.2f}" + (f" same-take {t.get('median_corr')}" if t else '') +
            (f"  asr {a['text']} ({a['similarity']})" if a else ''))
        for q in e['prefixes']:
            a = q.get('asr')
            at = f"  asr {a['text']} ({a['similarity']}, best {a['best_word_count']}/{q['W']})" if a else ''
            log(f"   {Path(q['file']).name:18s} {q['duration_s']:5.2f} s {q['lufs']:6.1f} LUFS  "
                f"edges {q['edges']['first_10ms_db']}/{q['edges']['last_10ms_db']} dB{at}")
    if failed:
        log('\nFAILED:\n  ' + '\n  '.join(failed))
        sys.exit(1)
    log(f'\nOK: {len(report)} lines, {sum(len(e["prefixes"]) for e in report)} prefix clips valid')


if __name__ == '__main__':
    main()
