/* Words of every line. OWNER: content agent (CONTRACTS.md "Data: words and chunks").

   words(secId, lineIndex) -> [{ ar, tr, src }]
   - ar  = the line's Tanzil text split on ' ' (characters never altered: joined with ' ' it is line.ar again)
   - tr  = Finnish-friendly transliteration (style of data.js: long vowels doubled aa/ii/uu, ‘ = ain,
           ’ = hamza, sh/kh/gh/dh/th), written as the word sounds IN THE RECITATION FLOW, because the app plays
           the recitation cut at word boundaries (prefix clips): the pieces are data.js lines[].tr split at the
           word boundaries, an assimilated consonant staying with the previous word as in data.js
           ('Bismil-laahir-rahmaanir-rahiim' -> 'Bismil' 'laahir' 'rahmaanir' 'rahiim'). So the covered words
           joined with ' ' read like the line's own transliteration (which the app shows once the line is
           complete; tools/check-arabic.mjs checks this). One Tanzil word may contain a space ('wa iyyaaka').
   - src = null: no single-word audio is shipped. The owner chose the recitation itself, cut at word boundaries
           (prefix clips, see chunks.js prefixClips). The quran.com word recordings stay as a tools copy
           (tools/build-words.py -> tools/wbw/), and their file names come from wbwFile() below. */
import DATA from './data.js';

const BISMILLAH = ['Bismil', 'laahir', 'rahmaanir', 'rahiim'];

/* TR[secId][lineIndex][wordIndex]; tools/check-arabic.mjs checks the counts against the Tanzil words. */
const TR = {
  shahada: [
    ['Ash-hadu', 'an', 'laa', 'ilaaha', 'illal', 'laah'],
    ['wa ash-hadu', 'anna', 'Muhammadan', 'rasuulul', 'laah']
  ],
  fatiha: [
    BISMILLAH,
    ['Al-hamdu', 'lil-laahi', 'rabbil', '‘aalamiin'],
    ['Ar-rahmaanir', 'rahiim'],
    ['Maaliki', 'yawmid', 'diin'],
    ['Iyyaaka', 'na‘budu', 'wa iyyaaka', 'nasta‘iin'],
    ['Ihdinas', 'siraatal', 'mustaqiim'],
    ['Siraatal', 'ladhiina', 'an‘amta', '‘alayhim', 'ghayril', 'maghduubi', '‘alayhim', 'wa lad', 'daalliin']
  ],
  ikhlas: [
    BISMILLAH,
    ['Qul', 'huwal', 'laahu', 'ahad'],
    ['Allaahus', 'samad'],
    ['Lam', 'yalid', 'wa lam', 'yuulad'],
    ['Wa lam', 'yakul', 'lahuu', 'kufuwan', 'ahad']
  ],
  kawthar: [
    BISMILLAH,
    ['Innaa', 'a‘taynaakal', 'kawthar'],
    ['Fasalli', 'li-rabbika', 'wanhar'],
    ['Inna', 'shaani’aka', 'huwal', 'abtar']
  ]
};

const pad3 = (n) => String(n).padStart(3, '0');

export function findLine(secId, lineIndex) {
  const sec = DATA.sections.find((s) => s.id === secId);
  const line = sec && sec.lines[lineIndex];
  return line ? { sec, line } : null;
}

/* 'audio/001001.mp3' -> ['001', '001'] (sura, verse of the line's verse file; null if none) */
export function verseOf(line) {
  const m = /audio\/(\d{3})(\d{3})\.mp3$/.exec((line && line.audio) || '');
  return m ? [m[1], m[2]] : null;
}

/* quran.com word recording of word w (0-based), tools only: 'wbw/SSS_AAA_WWW.mp3' */
export function wbwFile(line, w) {
  const v = verseOf(line);
  return v ? 'wbw/' + v[0] + '_' + v[1] + '_' + pad3(w + 1) + '.mp3' : null;
}

export function words(secId, lineIndex) {
  const found = findLine(secId, lineIndex);
  if (!found) return [];
  const { sec } = found;
  const tr = (TR[sec.id] && TR[sec.id][lineIndex]) || [];
  return found.line.ar.split(' ').map((ar, w) => ({ ar, tr: tr[w] || '', src: null }));
}
