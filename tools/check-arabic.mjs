// Fails if any Arabic line in src/content/data.js differs from the v1 Tanzil text, or if the word/chunk
// data (src/content/words.js, chunks.js) does not join back to the lines exactly, or a chunk audio file is missing.
import { existsSync, readFileSync } from 'node:fs';
import DATA from '../src/content/data.js';
import { chunks, words } from '../src/content/chunks.js';

const root = new URL('../', import.meta.url);
const orig = JSON.parse(readFileSync(new URL('./arabic-original.json', import.meta.url), 'utf8'));
const now = DATA.sections.flatMap((s) => s.lines.map((l) => l.ar));
const bad = orig.length !== now.length || orig.some((a, i) => a !== now[i]);
if (bad) { console.error('Arabic text changed!'); process.exit(1); }
console.log('Arabic text OK (' + now.length + ' lines, identical to Tanzil v1)');

const errors = [];
const files = new Set();
let nChunks = 0;
DATA.sections.forEach((sec) => {
  sec.lines.forEach((line, i) => {
    const at = sec.id + ' line ' + i;
    const ws = words(sec.id, i);
    if (ws.map((w) => w.ar).join(' ') !== line.ar) errors.push(at + ': words do not join back to ar');
    ws.forEach((w, k) => {
      if (!w.tr || /\s{2}|^\s|\s$/.test(w.tr)) errors.push(at + ' word ' + k + ': bad tr "' + w.tr + '"');
      if (sec.quran !== !!w.src) errors.push(at + ' word ' + k + ': src ' + w.src);
    });
    if (!sec.quran && line.tts && line.tts.split(' ').length !== ws.length) {
      errors.push(at + ': tts has ' + line.tts.split(' ').length + ' words, ar ' + ws.length);
    }
    if (chunks(sec.id, i, 'hard').length) errors.push(at + ': hard must have no chunks');
    ['easy', 'medium'].forEach((level) => {
      const cs = chunks(sec.id, i, level);
      const where = at + ' ' + level;
      if (!cs.length) errors.push(where + ': no chunks');
      // contiguous, in order, covering the whole line: the chunks joined with ' ' are the line again
      if (cs.map((c) => c.ar).join(' ') !== line.ar) errors.push(where + ': chunks do not join back to ar');
      let pos = 0;
      cs.forEach((c, k) => {
        nChunks++;
        const idx = line.ar.indexOf(c.ar, pos);
        if (!c.ar || idx !== pos) errors.push(where + ' chunk ' + k + ': not the next exact substring of ar');
        pos = idx + c.ar.length + 1;
        if (c.ar !== ws.slice(c.from, c.to + 1).map((w) => w.ar).join(' ')) errors.push(where + ' chunk ' + k + ': from/to');
        if (!c.tr) errors.push(where + ' chunk ' + k + ': empty tr');
        if (sec.quran && c.tr !== ws.slice(c.from, c.to + 1).map((w) => w.tr).join(' ')) {
          errors.push(where + ' chunk ' + k + ': tr is not the words\' tr joined');
        }
        const expect = sec.quran ? c.to - c.from + 1 : 1;
        if (!Array.isArray(c.clips) || c.clips.length !== expect) errors.push(where + ' chunk ' + k + ': clips');
        (c.clips || []).forEach((clip) => {
          if (clip.kind !== 'recitation' || clip.id !== null || clip.lang !== 'ar' || !clip.src) {
            errors.push(where + ' chunk ' + k + ': bad clip ' + JSON.stringify(clip));
          }
          if (!sec.quran && !clip.text) errors.push(where + ' chunk ' + k + ': teacher clip without text');
          if (clip.src) files.add(clip.src);
        });
      });
    });
  });
});
const missing = [...files].filter((f) => !existsSync(new URL('public/' + f, root)));
missing.forEach((f) => errors.push('missing audio file public/' + f));
if (errors.length) {
  console.error('Word/chunk check FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('Words and chunks OK (' + nChunks + ' chunks join back to ar exactly, ' + files.size + ' chunk audio files exist)');
