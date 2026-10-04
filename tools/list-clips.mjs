// Prints clip lists for the Python tools as JSON (texts are defined only in src/content/*).
//   node tools/list-clips.mjs          every pre-generated voice clip [{id, lang, text, file}]: Finnish prompts,
//                                      meanings, Shahada lines + Shahada chunk clips (tools/make_voices.py)
//   node tools/list-clips.mjs --words  every Quran word recording [{file, verse, word, words, ar, tr, uses}]
//                                      (tools/build-words.py), one entry per file
import { allVoiceClips } from '../src/content/prompts.js';
import { teacherChunkClips, words } from '../src/content/chunks.js';
import DATA from '../src/content/data.js';

function wordFiles() {
  const byFile = new Map();
  DATA.sections.filter((s) => s.quran).forEach((sec) => {
    sec.lines.forEach((_, i) => {
      const ws = words(sec.id, i);
      ws.forEach((w, k) => {
        const m = /(\d{3})_(\d{3})_(\d{3})\.mp3$/.exec(w.src || '');
        if (!m) throw new Error('no word audio for ' + sec.id + ' ' + i + ' ' + k);
        const verse = Number(m[1]) + ':' + Number(m[2]);
        const use = sec.id + '-' + i;
        const prev = byFile.get(w.src);
        if (prev) { prev.uses.push(use); return; }
        byFile.set(w.src, { file: w.src, verse, word: k + 1, words: ws.length, ar: w.ar, tr: w.tr, uses: [use] });
      });
    });
  });
  return [...byFile.values()];
}

const out = process.argv.includes('--words') ? wordFiles() : allVoiceClips(teacherChunkClips());
console.log(JSON.stringify(out, null, 1));
