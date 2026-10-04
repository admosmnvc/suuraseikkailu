// Fails if any Arabic line in src/content/data.js differs from the v1 Tanzil text.
import { readFileSync } from 'node:fs';
import DATA from '../src/content/data.js';
const orig = JSON.parse(readFileSync(new URL('./arabic-original.json', import.meta.url), 'utf8'));
const now = DATA.sections.flatMap((s) => s.lines.map((l) => l.ar));
const bad = orig.length !== now.length || orig.some((a, i) => a !== now[i]);
if (bad) { console.error('Arabic text changed!'); process.exit(1); }
console.log('Arabic text OK (' + now.length + ' lines, identical to Tanzil v1)');
