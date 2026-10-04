// Prints every pre-generated voice clip as JSON: [{id, lang, text, file}]
import { allVoiceClips } from '../src/content/prompts.js';
console.log(JSON.stringify(allVoiceClips(), null, 1));
