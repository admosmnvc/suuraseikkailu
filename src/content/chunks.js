/* Chunk units for the levels HELPPO (easy) and KESKITASO (medium) and the audio of a partly said line.
   OWNER: content agent.  import { chunks, words, prefixClips } from './content/chunks.js'

   chunks(secId, lineIndex, level) -> [{ ar, tr, clips, from, to }]
   - level 'hard' (or unknown) -> []: the line itself is the unit
   - 'easy'   -> one chunk per "unit": Quran = one word; Shahada = the owner's units (SHAHADA_UNITS)
   - 'medium' -> units paired left to right (the last may be single), see pairUnits()
   - ar    = the chunk's words joined with ' ' (an exact contiguous substring of line.ar)
   - tr    = the units' transliterations joined with ' ' (Quran: words.js tr of each word)
   - from, to = index of the chunk's first and last word in words(secId, lineIndex) (inclusive)
   - clips = what to play when this chunk is the newest covered unit of its line:
             a section with prefix cuts (Quran): prefixClips(secId, lineIndex, to), i.e. the recitation from the
             line start to the end of this chunk (Quran and the Shahada); a section without: the chunk's own
             teacher clip { kind:'recitation', id:null, src:'audio/<sec>-c-<line>-<level>-<i>.mp3', text:<tts slice>, lang:'ar' }

   prefixClips(secId, lineIndex, wordEnd, level) -> [clip, ...]   (engine clips, play in order, ~150 ms apart)
   - the audio of the line from its start to the end of word wordEnd (0-based, inclusive)
   - wordEnd = last word -> [the line clip] (same shape as engine.line())
   - Quran: [{ kind:'recitation', id:null, src:'audio/cut/SSS_AAA_wW.mp3', text:'', lang:'ar' }], W = wordEnd + 1:
     Mishary Alafasy's recitation cut at the word boundary (tools/build-cuts.py); Ikhlas/Kawthar line 0 = 1:1
   - Shahada: [{ kind:'recitation', id:null, src:'audio/cut/shahada-<line>_wW.mp3', text:<tts words 1..W>, lang:'ar' }]
     from the human recording (prefixes exist at the easy-unit ends, the only ends the app asks for)
   - a section without prefix cuts: the teacher clips of the covered chunks of `level` (or of 'easy' when
     wordEnd is not a chunk end at that level)
   - unknown line / wordEnd out of range -> []
   Every call returns new objects (callers may keep or change them). */
import DATA from './data.js';
import { words, findLine, verseOf } from './words.js';

export { words };

/* Shahada easy units per line: [number of Tanzil words, transliteration]; null = one unit per word.
   Owner: أَشْهَدُ | أَنْ لَا | إِلَٰهَ | إِلَّا اللَّهُ = 'Ash-hadu' | 'an laa' | 'ilaaha' | 'illallaah';
   وَأَشْهَدُ | أَنَّ | مُحَمَّدًا | رَسُولُ اللَّهِ = 'wa ash-hadu' | 'anna' | 'Muhammadan' | 'rasuulullaah'. */
const SHAHADA_UNITS = [
  [[1, 'Ash-hadu'], [2, 'an laa'], [1, 'ilaaha'], [2, 'illallaah']],
  [[1, 'wa ash-hadu'], [1, 'anna'], [1, 'Muhammadan'], [2, 'rasuulullaah']]
];

/* Medium pairing rule (deterministic): pair units left to right; a unit that is a small particle leading
   into the next word (LEADS, exact Tanzil text of its last word) is never the second half of a pair when
   a word follows it: the pair closes early and the particle starts the next pair.
   Al-Fatiha 7: ... | ‘alayhim | wa lad daalliin  (not "‘alayhim wa lad | daalliin"). */
const LEADS = new Set(['وَلَا']);

/* Prefix cuts exist at every easy-unit end (Quran: every word boundary). Quran lines: tools/build-cuts.py from
   the Mishary chapter recitation + Quran.com word timings. A non-Quran section has them when its id is listed
   here and tools/cut-src/<secId>.json describes its human recording; files audio/cut/<secId>-<line>_wW.mp3.
   Shahada: the owner's human recording (tools/cut-src/shahada.json). */
const CUT_SECTIONS = new Set(['shahada']);
const hasCuts = (sec) => sec.quran || CUT_SECTIONS.has(sec.id);

/* 'audio/cut/001_002_w2.mp3': line start .. end of word W (1-based, 1 <= W < number of words) */
export function prefixFile(secId, lineIndex, W) {
  const found = findLine(secId, lineIndex);
  if (!found || !hasCuts(found.sec)) return null;
  const v = found.sec.quran ? verseOf(found.line) : null;
  return 'audio/cut/' + (v ? v[0] + '_' + v[1] : found.sec.id + '-' + (lineIndex + 1)) + '_w' + W + '.mp3';
}

function lineClip(line) {
  return { kind: 'recitation', id: line.rec || null, src: line.audio || null, text: line.tts || '', lang: 'ar' };
}

function units(sec, lineIndex, ws) {
  const own = !sec.quran && SHAHADA_UNITS[lineIndex];
  if (!own) return ws.map((w, i) => ({ from: i, to: i, tr: w.tr }));
  let from = 0;
  return own.map(([n, tr]) => {
    const u = { from, to: from + n - 1, tr };
    from += n;
    return u;
  });
}

function pairUnits(us, ws) {
  const out = [];
  let i = 0;
  while (i < us.length) {
    const next = us[i + 1];
    const lead = next && i + 2 < us.length && LEADS.has(ws[next.to].ar);
    if (next && !lead) {
      out.push({ from: us[i].from, to: next.to, tr: us[i].tr + ' ' + next.tr });
      i += 2;
    } else {
      out.push(us[i]);
      i += 1;
    }
  }
  return out;
}

function teacherFile(secId, lineIndex, level, k) {
  return 'audio/' + secId + '-c-' + (lineIndex + 1) + '-' + level + '-' + (k + 1) + '.mp3';
}

/* units of a level without clips: [{ from, to, tr }] */
function levelUnits(sec, lineIndex, level, ws) {
  const us = units(sec, lineIndex, ws);
  return level === 'medium' ? pairUnits(us, ws) : us;
}

export function prefixClips(secId, lineIndex, wordEnd, level) {
  const found = findLine(secId, lineIndex);
  if (!found) return [];
  const { sec, line } = found;
  const ws = words(secId, lineIndex);
  if (!(wordEnd >= 0 && wordEnd < ws.length)) return [];
  if (wordEnd === ws.length - 1) return [lineClip(line)];
  if (hasCuts(sec)) {
    /* text = device-speech fallback: never for the Quran; the Shahada may fall back to its tts words */
    const text = sec.quran ? '' : (line.tts || line.ar).split(' ').slice(0, wordEnd + 1).join(' ');
    return [{ kind: 'recitation', id: null, src: prefixFile(secId, lineIndex, wordEnd + 1), text, lang: 'ar' }];
  }
  for (const lv of [level === 'medium' ? 'medium' : 'easy', 'easy']) {
    const cs = chunks(secId, lineIndex, lv).filter((c) => c.to <= wordEnd);
    if (cs.length && cs[cs.length - 1].to === wordEnd) return cs.map((c) => c.clips[0]);
  }
  return [];
}

export function chunks(secId, lineIndex, level) {
  if (level !== 'easy' && level !== 'medium') return [];
  const found = findLine(secId, lineIndex);
  if (!found) return [];
  const { sec, line } = found;
  const ws = words(secId, lineIndex);
  const tts = (line.tts || line.ar).split(' ');
  return levelUnits(sec, lineIndex, level, ws).map((u, k) => {
    const clips = hasCuts(sec)
      ? prefixClips(secId, lineIndex, u.to, level)
      : [{ kind: 'recitation', id: null, src: teacherFile(sec.id, lineIndex, level, k),
        text: tts.slice(u.from, u.to + 1).join(' '), lang: 'ar' }];
    const ar = ws.slice(u.from, u.to + 1).map((w) => w.ar).join(' ');
    return { ar, tr: u.tr, clips, from: u.from, to: u.to };
  });
}

/* Teacher-voice chunk clips of the sections without prefix cuts (Shahada) for tools/make_voices.py,
   in the allVoiceClips() shape: [{ id, lang, text, file }]. */
export function teacherChunkClips() {
  const list = [];
  DATA.sections.filter((s) => !hasCuts(s)).forEach((sec) => {
    sec.lines.forEach((_, i) => {
      ['easy', 'medium'].forEach((level) => {
        chunks(sec.id, i, level).forEach((c) => {
          const clip = c.clips[0];
          list.push({ id: clip.src.replace(/^audio\/|\.mp3$/g, ''), lang: 'ar', text: clip.text, file: clip.src });
        });
      });
    });
  });
  return list;
}

/* Every prefix-cut line for tools/build-cuts.py: one entry per line audio file (Bismillah lines share 1:1).
   [{ sec, line, audio, verse, words, prefixes: [{ W, file }] at every easy-unit end but the last, uses }] */
export function cutLines() {
  const byAudio = new Map();
  DATA.sections.filter(hasCuts).forEach((sec) => {
    sec.lines.forEach((line, i) => {
      const prev = byAudio.get(line.audio);
      if (prev) { prev.uses.push(sec.id + '-' + i); return; }
      const v = sec.quran ? verseOf(line) : null;
      const ends = chunks(sec.id, i, 'easy').map((c) => c.to + 1).slice(0, -1);
      byAudio.set(line.audio, {
        sec: sec.id, line: i, audio: line.audio, verse: v ? Number(v[0]) + ':' + Number(v[1]) : null,
        words: line.ar.split(' ').length, prefixes: ends.map((W) => ({ W, file: prefixFile(sec.id, i, W) })),
        uses: [sec.id + '-' + i]
      });
    });
  });
  return [...byAudio.values()];
}
