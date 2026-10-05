// Fails if any Arabic line in src/content/data.js differs from tools/arabic-original.json (the v1 Tanzil text of
// every Quran line, byte-identical; Shahada line 2 = the owner's v3 wording "... مُحَمَّدًا رَسُولُ اللَّهِ" that
// matches the human recording, owner decision), or if the word/chunk
// data (src/content/words.js, chunks.js) does not join back to the lines exactly, or an audio file is missing
// (line clips, the prefix clip of every word boundary, chunk clips).
import { existsSync, readFileSync } from 'node:fs';
import DATA from '../src/content/data.js';
import { chunks, prefixClips, words } from '../src/content/chunks.js';

const root = new URL('../', import.meta.url);
const orig = JSON.parse(readFileSync(new URL('./arabic-original.json', import.meta.url), 'utf8'));
const now = DATA.sections.flatMap((s) => s.lines.map((l) => l.ar));
const bad = orig.length !== now.length || orig.some((a, i) => a !== now[i]);
if (bad) { console.error('Arabic text changed!'); process.exit(1); }
console.log('Arabic text OK (' + now.length + ' lines: Quran identical to Tanzil v1, Shahada line 2 = owner\'s v3 wording)');

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
      if (w.src !== null) errors.push(at + ' word ' + k + ': src ' + w.src + ' (no word audio is shipped)');
    });
    // the easy units' transliterations read like the line's own (hyphens, commas, case ignored)
    const flat = (t) => t.toLowerCase().replace(/[-,.]/g, ' ').replace(/\s+/g, ' ').trim();
    if (flat(chunks(sec.id, i, 'easy').map((c) => c.tr).join(' ')) !== flat(line.tr)) {
      errors.push(at + ': easy chunk tr "' + chunks(sec.id, i, 'easy').map((c) => c.tr).join(' ') + '" vs line tr "' + line.tr + '"');
    }
    // prefix audio: every word boundary (sections without prefix cuts: every unit end), full line = the line clip
    if (line.audio) files.add(line.audio);
    const ends = new Set(chunks(sec.id, i, 'easy').map((c) => c.to));
    ws.forEach((w, k) => {
      if (!sec.quran && !ends.has(k)) return; // the app asks only for unit ends
      const pc = prefixClips(sec.id, i, k, 'easy');
      if (!pc.length) errors.push(at + ' prefix ' + k + ': no clips');
      if (k === ws.length - 1 && !(pc.length === 1 && pc[0].src === line.audio)) errors.push(at + ': full prefix is not the line clip');
      if (sec.quran && k < ws.length - 1) {
        const want = 'audio/cut/' + /(\d{3})(\d{3})\.mp3$/.exec(line.audio).slice(1).join('_') + '_w' + (k + 1) + '.mp3';
        if (pc.length !== 1 || pc[0].src !== want) errors.push(at + ' prefix ' + k + ': ' + JSON.stringify(pc) + ', want ' + want);
      }
      pc.forEach((clip) => { if (clip.kind !== 'recitation' || clip.lang !== 'ar' || !clip.src) errors.push(at + ' prefix ' + k + ': bad clip'); else files.add(clip.src); });
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
        // sections with prefix cuts (Quran, Shahada): the prefix up to the chunk's end (the line clip for the
        // last chunk); a section without: its own teacher clip
        const pre = prefixClips(sec.id, i, c.to, level);
        const cut = pre.length === 1 && (pre[0].src === line.audio || /^audio\/cut\//.test(pre[0].src));
        const want = cut ? JSON.stringify(pre) : null;
        if (!Array.isArray(c.clips) || c.clips.length !== 1 || (want && JSON.stringify(c.clips) !== want)) {
          errors.push(where + ' chunk ' + k + ': clips ' + JSON.stringify(c.clips));
        }
        (c.clips || []).forEach((clip) => {
          if (clip.kind !== 'recitation' || clip.lang !== 'ar' || !clip.src || (clip.id !== null && clip.src !== line.audio)) {
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
if (existsSync(new URL('public/audio/wbw', root))) errors.push('public/audio/wbw/ must not be shipped (tools/wbw/ is the copy)');
if (errors.length) {
  console.error('Word/chunk check FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('Words and chunks OK (' + nChunks + ' chunks join back to ar exactly, ' + files.size +
  ' line / prefix / chunk audio files exist)');
