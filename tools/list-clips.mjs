// Prints clip lists for the Python tools as JSON (texts and file names are defined only in src/content/*).
//   node tools/list-clips.mjs          every pre-generated voice clip [{id, lang, text, file}]: Finnish prompts,
//                                      meanings, teacher chunk clips of sections without cuts (make_voices.py)
//   node tools/list-clips.mjs --cuts   every prefix-cut line [{sec, line, audio, verse, words, prefixes, uses}]
//                                      (tools/build-cuts.py)
//   node tools/list-clips.mjs --words  every quran.com word recording [{file, verse, word, words, ar, uses}]
//                                      (tools/build-words.py, tools copy only), one entry per file
import { allVoiceClips } from '../src/content/prompts.js';
import { cutLines, teacherChunkClips, words } from '../src/content/chunks.js';
import { wbwFile } from '../src/content/words.js';
import DATA from '../src/content/data.js';

function wordFiles() {
  const byFile = new Map();
  DATA.sections.filter((s) => s.quran).forEach((sec) => {
    sec.lines.forEach((line, i) => {
      const ws = words(sec.id, i);
      ws.forEach((w, k) => {
        const file = wbwFile(line, k);
        const m = /(\d{3})_(\d{3})_(\d{3})\.mp3$/.exec(file || '');
        if (!m) throw new Error('no word audio for ' + sec.id + ' ' + i + ' ' + k);
        const use = sec.id + '-' + i;
        const prev = byFile.get(file);
        if (prev) { prev.uses.push(use); return; }
        byFile.set(file, { file, verse: Number(m[1]) + ':' + Number(m[2]), word: k + 1, words: ws.length, ar: w.ar, uses: [use] });
      });
    });
  });
  return [...byFile.values()];
}

const arg = process.argv[2];
// voice clips whose file is a cut line (the Shahada lines are a human recording now) are not TTS clips
const cutAudio = new Set(cutLines().map((e) => e.audio));
const voices = () => allVoiceClips(teacherChunkClips()).filter((c) => !cutAudio.has(c.file));
const out = arg === '--words' ? wordFiles() : arg === '--cuts' ? cutLines() : voices();
console.log(JSON.stringify(out, null, 1));
