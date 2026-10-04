/* Chunk sub-steps for the levels HELPPO (easy) and KESKITASO (medium). OWNER: content agent.
   import { chunks, words } from './content/chunks.js'   (CONTRACTS.md "Data: words and chunks")

   chunks(secId, lineIndex, level) -> [{ ar, tr, clips, from, to }]
   - level 'hard' (or unknown) -> []: the line itself is the step
   - 'easy'   -> one chunk per "unit": Quran = one word; Shahada = the owner's units (SHAHADA_UNITS)
   - 'medium' -> units paired left to right (the last may be single), see pairUnits()
   - ar    = the chunk's words joined with ' ' (an exact contiguous substring of line.ar)
   - tr    = the units' transliterations joined with ' ' (Quran: words.js tr of each word)
   - clips = engine clips, played in order with gap 0:
             Quran:   one { kind:'recitation', id:null, src:'audio/wbw/SSS_AAA_WWW.mp3', text:'', lang:'ar' } per word
             Shahada: one { kind:'recitation', id:null, src:'audio/shahada-c-<line>-<level>-<i>.mp3',
                      text:<slice of lines[].tts>, lang:'ar' } (teacher voice, made by tools/make_voices.py)
   - from, to = index of the chunk's first and last word in words(secId, lineIndex) (extra, inclusive)
   Every call returns new objects (callers may keep or change them). */
import DATA from './data.js';
import { words, findLine } from './words.js';

export { words };

/* Shahada easy units per line: [number of Tanzil words, transliteration]; null = one unit per word.
   Owner's example: أَشْهَدُ | أَنْ لَا | إِلَٰهَ | إِلَّا اللَّهُ = 'Ash-hadu' | 'an laa' | 'ilaaha' | 'illallaah'. */
const SHAHADA_UNITS = [
  [[1, 'Ash-hadu'], [2, 'an laa'], [1, 'ilaaha'], [2, 'illallaah']],
  null
];

/* Medium pairing rule (deterministic): pair units left to right; a unit that is a small particle leading
   into the next word (LEADS, exact Tanzil text of its last word) is never the second half of a pair when
   a word follows it: the pair closes early and the particle starts the next pair.
   Al-Fatiha 7: ... | ‘alayhim | wa laa ad-daalliin  (not "‘alayhim wa laa | ad-daalliin"). */
const LEADS = new Set(['وَلَا']);

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

function clipFile(secId, lineIndex, level, k) {
  return 'audio/' + secId + '-c-' + (lineIndex + 1) + '-' + level + '-' + (k + 1) + '.mp3';
}

export function chunks(secId, lineIndex, level) {
  if (level !== 'easy' && level !== 'medium') return [];
  const found = findLine(secId, lineIndex);
  if (!found) return [];
  const { sec, line } = found;
  const ws = words(secId, lineIndex);
  let us = units(sec, lineIndex, ws);
  if (level === 'medium') us = pairUnits(us, ws);
  const tts = (line.tts || line.ar).split(' ');
  return us.map((u, k) => {
    const part = ws.slice(u.from, u.to + 1);
    const clips = sec.quran
      ? part.map((w) => ({ kind: 'recitation', id: null, src: w.src, text: '', lang: 'ar' }))
      : [{ kind: 'recitation', id: null, src: clipFile(sec.id, lineIndex, level, k),
        text: tts.slice(u.from, u.to + 1).join(' '), lang: 'ar' }];
    return { ar: part.map((w) => w.ar).join(' '), tr: u.tr, clips, from: u.from, to: u.to };
  });
}

/* Teacher-voice chunk clips of the non-Quran sections (Shahada) for tools/make_voices.py,
   in the allVoiceClips() shape: [{ id, lang, text, file }]. */
export function teacherChunkClips() {
  const list = [];
  DATA.sections.filter((s) => !s.quran).forEach((sec) => {
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
