/* Units of a section at a level (CONTRACTS "Flow per level – FINAL"): the level only sets the unit size –
   VAIKEA = one line, HELPPO / KESKITASO = the content chunks (word / word pair) of every line in order.
   Step k = units 1..k from the very start; a line is complete when a step covers its last unit. OWNER: ui agent. */
import { chunks } from '../content/chunks.js';

/* -> [{ line, from, to (word indexes in the line, inclusive), ar, tr, clips (null = the line clip), last }] */
export function unitsOf(sec, level) {
  const out = [];
  sec.lines.forEach((line, i) => {
    let list = [];
    if (level !== 'hard') { try { list = chunks(sec.id, i, level) || []; } catch (e) { list = []; } }
    if (!list.length) {
      out.push({ line: i, from: 0, to: line.ar.split(' ').length - 1, ar: line.ar, tr: line.tr || '', clips: null, last: true });
      return;
    }
    list.forEach((c, j) => out.push({ line: i, from: c.from, to: c.to, ar: c.ar, tr: c.tr || '', clips: c.clips || [], last: j === list.length - 1 }));
  });
  return out;
}

/* completed lines once units 1..k are said */
export function linesDoneBy(units, k) {
  let n = 0;
  for (let i = 0; i < k && i < units.length; i++) if (units[i].last) n++;
  return n;
}

/* steps before line L (= index of its first unit); L past the end -> units.length */
export function stepsBeforeLine(units, L) {
  const i = units.findIndex((u) => u.line >= L);
  return i < 0 ? units.length : i;
}

/* every word / chunk clip of the units (preload) */
export function unitClips(units) {
  const out = [];
  units.forEach((u) => { if (u.clips) out.push(...u.clips); });
  return out;
}
