/* Words of every line. OWNER: content agent (CONTRACTS.md "Data: words and chunks").

   words(secId, lineIndex) -> [{ ar, tr, src }]
   - ar  = the line's Tanzil text split on ' ' (characters never altered: joined with ' ' it is line.ar again)
   - tr  = Finnish-friendly transliteration (style of data.js: long vowels doubled aa/ii/uu, ‘ = ain,
           ’ = hamza, sh/kh/gh/dh/th, article with a hyphen: al-, ar-, as-, ad-), written as the word is
           said ON ITS OWN in its word recording. The quran.com word audio reads every word separately:
           a word that starts with hamzat al-wasl gets its vowel (ٱللَّهِ alone = 'Allaahi', ٱهْدِنَا = 'Ihdinaa'),
           words inside a verse keep their full ending ('Bismi', 'rabbi', 'na‘budu'), the verse's last word
           is read in pause form ('ar-rahiim', 'ahad'). Checked by back-transcribing the recordings
           (tools/words.json). Capital letter: first word of a line (as in data.js) and Allaah.
   - src = quran.com word-by-word recording 'audio/wbw/SSS_AAA_WWW.mp3' (made by tools/build-words.py),
           derived from the line's verse file (data.js lines[].audio 'audio/SSSAAA.mp3'), so the Bismillah of
           Al-Ikhlas/Al-Kawthar (line 0, audio 001001) uses the Al-Fatiha 1:1 words. null for the Shahada
           (not Quran: its chunks have teacher-voice clips, see chunks.js). */
import DATA from './data.js';

const BISMILLAH = ['Bismi', 'Allaahi', 'ar-rahmaani', 'ar-rahiim'];

/* TR[secId][lineIndex][wordIndex]; tools/check-arabic.mjs checks the counts against the Tanzil words. */
const TR = {
  shahada: [
    ['Ash-hadu', 'an', 'laa', 'ilaaha', 'illaa', 'Allaah'],
    ['wa ash-hadu', 'anna', 'Muhammadan', '‘abduhuu', 'wa rasuuluh']
  ],
  fatiha: [
    BISMILLAH,
    ['Al-hamdu', 'lillaahi', 'rabbi', 'al-‘aalamiin'],
    ['Ar-rahmaani', 'ar-rahiim'],
    ['Maaliki', 'yawmi', 'ad-diin'],
    ['Iyyaaka', 'na‘budu', 'wa iyyaaka', 'nasta‘iin'],
    ['Ihdinaa', 'as-siraata', 'al-mustaqiim'],
    ['Siraata', 'alladhiina', 'an‘amta', '‘alayhim', 'ghayri', 'al-maghduubi', '‘alayhim', 'wa laa', 'ad-daalliin']
  ],
  ikhlas: [
    BISMILLAH,
    ['Qul', 'huwa', 'Allaahu', 'ahad'],
    ['Allaahu', 'as-samad'],
    ['Lam', 'yalid', 'wa lam', 'yuulad'],
    ['Wa lam', 'yakun', 'lahuu', 'kufuwan', 'ahad']
  ],
  kawthar: [
    BISMILLAH,
    ['Innaa', 'a‘taynaaka', 'al-kawthar'],
    ['Fasalli', 'lirabbika', 'wanhar'],
    ['Inna', 'shaani’aka', 'huwa', 'al-abtar']
  ]
};

const pad3 = (n) => String(n).padStart(3, '0');

export function findLine(secId, lineIndex) {
  const sec = DATA.sections.find((s) => s.id === secId);
  const line = sec && sec.lines[lineIndex];
  return line ? { sec, line } : null;
}

/* 'audio/001001.mp3' -> 'audio/wbw/001_001_' (null if the line has no verse file) */
function wbwPrefix(line) {
  const m = /audio\/(\d{3})(\d{3})\.mp3$/.exec(line.audio || '');
  return m ? 'audio/wbw/' + m[1] + '_' + m[2] + '_' : null;
}

export function words(secId, lineIndex) {
  const found = findLine(secId, lineIndex);
  if (!found) return [];
  const { sec, line } = found;
  const tr = (TR[sec.id] && TR[sec.id][lineIndex]) || [];
  const prefix = sec.quran ? wbwPrefix(line) : null;
  return line.ar.split(' ').map((ar, w) => ({
    ar,
    tr: tr[w] || '',
    src: prefix ? prefix + pad3(w + 1) + '.mp3' : null
  }));
}
