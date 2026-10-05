/* Suuraseikkailu v3 – art/desert.js: Muslim-themed extras in the soft premium style – a friendly camel, a date palm,
   and the crescent & star emblem (pennant on the race car, decal on the rocket). OWNER: art agent. */
import { f, crescentPath, starPath } from './common.js';
import { INK, keep, lg, rg, u } from './soft.js';

const LINE = '#7A4426';

// crescent (horns to the right) + small star, centred near (cx, cy)
export function crescentStar(cx, cy, r, col) {
  return '<path d="' + crescentPath(cx - r * 0.2, cy, r, 0, 0.95, 0.42) + '" fill="' + col + '"/>' +
    '<path d="' + starPath(cx + r * 0.62, cy, r * 0.4, r * 0.18, 5) + '" fill="' + col + '"/>';
}

// soft teal badge with a white crescent & star (reads in greyscale too)
export function emblem(cx, cy, r, id, c) {
  const k = c || keep;
  return '<defs>' + rg(id + '-e', [[0, '#7FE3D8'], [1, '#22AFA3']], k, 0.35, 0.3, 0.9) + '</defs>' +
    '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + u(id + '-e') + '"/>' + crescentStar(cx - r * 0.08, cy, r * 0.55, '#FFFFFF');
}

// Camel (dromedary) walking right: sturdy, warm tan, confident grin, deep-blue saddle blanket with a simple
// diamond pattern and a rope halter. Native box [12, 0, 200, 170].
// opt.legCls puts a class on each leg (they swing from the hip: transform-origin top centre).
export const CAMEL_BOX = [12, 0, 200, 170];
export function camel(c, id, opt) {
  const k = c || keep, o = opt || {};
  const leg = (x, y, h, fill) => '<rect' + (o.legCls ? ' class="' + o.legCls + '" style="transform-box:fill-box;transform-origin:50% 0"' : '') +
    ' x="' + x + '" y="' + y + '" width="15" height="' + h + '" rx="7" fill="' + fill + '"/>';
  const BODY = 'M38 100C34 78 48 66 62 64C68 40 88 30 105 37C118 42 124 56 126 66C142 66 154 76 156 94C158 112 142 124 120 124H62C46 124 40 113 38 100Z';
  let dia = '';
  for (let i = 0; i < 4; i++) { const x = 80 + i * 12; dia += 'M' + x + ' 64L' + (x + 5) + ' 70L' + x + ' 76L' + (x - 5) + ' 70Z'; }
  return '<defs>' + rg(id + '-b', [[0, '#E9C291'], [0.55, '#D19A5E'], [1, '#B07640']], k, 0.4, 0.3, 0.9) +
    lg(id + '-l', [[0, '#C98E55'], [1, '#A56C36']], k) + lg(id + '-lb', [[0, '#B47C45'], [1, '#8E5B2B']], k) +
    rg(id + '-s', [[0, '#F3D9B5'], [1, '#DDB27F']], k, 0.4, 0.35, 0.9) +
    lg(id + '-bl', [[0, '#3F7BFF'], [1, '#1D4BC4']], k) + lg(id + '-tr', [[0, '#3AD3C4'], [1, '#1FA99C']], k) + '</defs>' +
    '<ellipse cx="102" cy="165" rx="74" ry="7" fill="' + k('#6E4A2A') + '" opacity=".22"/>' +
    '<path d="M42 92C30 96 27 108 31 118" stroke="' + k('#A8703A') + '" stroke-width="6" stroke-linecap="round" fill="none"/>' +
    '<circle cx="31" cy="121" r="5.5" fill="' + k('#8E5B2B') + '"/>' +
    leg(56, 108, 54, u(id + '-lb')) + leg(122, 108, 54, u(id + '-lb')) +
    '<path d="' + BODY + '" fill="' + u(id + '-b') + '"/>' +
    leg(74, 110, 54, u(id + '-l')) + leg(140, 108, 56, u(id + '-l')) +
    '<path d="M140 94C152 86 152 60 154 42L178 40C178 64 172 92 158 108Z" fill="' + u(id + '-b') + '"/>' +
    '<ellipse cx="159" cy="24" rx="5.5" ry="8" transform="rotate(-24 159 24)" fill="' + k('#B07640') + '"/>' +
    '<ellipse cx="172" cy="36" rx="24" ry="16" transform="rotate(-8 172 36)" fill="' + u(id + '-b') + '"/>' +
    '<ellipse cx="190" cy="46" rx="14" ry="11" fill="' + u(id + '-s') + '"/>' +
    // saddle blanket: deep blue, teal trim, a row of simple diamonds
    '<path d="M66 64C74 50 90 44 106 46C118 48 124 58 126 68L120 88H68Z" fill="' + u(id + '-bl') + '"/>' +
    '<path d="M68 82H122L120 90H68Z" fill="' + u(id + '-tr') + '"/>' +
    '<path d="' + dia + '" fill="' + k('#FFD54A') + '"/>' +
    '<path d="M54 74C60 70 64 69 68 69" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".45"/>' +
    // rope halter
    '<path d="M162 28C164 40 170 50 180 54M178 39C184 37 192 37 198 40M181 55C168 70 158 82 150 92" stroke="' + k('#7A4E2A') + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
    '<circle cx="180" cy="54" r="2.8" fill="' + k('#FFD54A') + '"/>' +
    // face: eye, short confident brow, big friendly grin
    '<ellipse cx="174" cy="33.5" rx="4" ry="4.6" fill="' + k(INK) + '"/><circle cx="175.4" cy="31.8" r="1.4" fill="#FFFFFF"/>' +
    '<path d="M168.5 26.2L178.5 25" stroke="' + k('#7A4E2A') + '" stroke-width="2.6" stroke-linecap="round"/>' +
    '<circle cx="199" cy="42" r="1.7" fill="' + k(LINE) + '"/>' +
    '<path d="M183 50.5c3.8 3.8 10 3.8 13.6.2" stroke="' + k(LINE) + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>';
}

// Date palm with a cluster of dates. Native box [0, 0, 128, 192] (trunk base at the bottom centre).
export const PALM_BOX = [0, 0, 128, 192];
export function palm(c, id) {
  const k = c || keep, cx = 64, cy = 46;
  const frond = (a, len, mirror) => '<path transform="translate(' + cx + ' ' + cy + ')' + (mirror ? ' scale(-1 1)' : '') + ' rotate(' + a + ')" d="M0 -4Q' + f(len * 0.45) + ' ' + f(-len * 0.3) + ' ' + len + ' ' + f(len * 0.14) + 'Q' + f(len * 0.42) + ' ' + f(-len * 0.05) + ' 0 5Z" fill="' + u(id + (mirror ? '-fl' : '-fr')) + '"/>';
  let rings = '';
  for (let y = 70; y < 184; y += 13) rings += 'M' + f(55 + (y - 50) * 0.02) + ' ' + y + 'Q64 ' + (y + 5) + ' ' + f(72 - (y - 50) * 0.01) + ' ' + y;
  return '<defs>' + lg(id + '-t', [[0, '#D9AE7E'], [1, '#B07F52']], k, 0, 0, 1, 0) +
    lg(id + '-fr', [[0, '#8FE0B0'], [1, '#3FB37F']], k, 0, 0, 1, 0) + lg(id + '-fl', [[0, '#7AD6A2'], [1, '#34A774']], k, 0, 0, 1, 0) + '</defs>' +
    '<ellipse cx="62" cy="188" rx="26" ry="5" fill="' + k('#6F8A6A') + '" opacity=".18"/>' +
    '<path d="M52 188C54 140 58 96 60 50H68C70 96 70 140 72 188Z" fill="' + u(id + '-t') + '"/>' +
    '<path d="' + rings + '" stroke="' + k('#F0D2A8') + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".7"/>' +
    frond(20, 58, true) + frond(20, 58, false) + frond(-18, 62, true) + frond(-18, 62, false) +
    frond(-55, 54, true) + frond(-55, 54, false) + frond(-88, 44, false) +
    '<g fill="' + k('#D9822B') + '"><circle cx="56" cy="58" r="5"/><circle cx="64" cy="62" r="5.4"/><circle cx="72" cy="58" r="5"/>' +
    '<circle cx="60" cy="67" r="4.6"/><circle cx="68" cy="67" r="4.6"/></g>' +
    '<g fill="#FFFFFF" opacity=".55"><circle cx="54.6" cy="56.4" r="1.4"/><circle cx="62.6" cy="60.2" r="1.5"/><circle cx="70.6" cy="56.4" r="1.4"/></g>';
}
