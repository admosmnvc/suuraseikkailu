/* Suuraseikkailu v3 – art/girl.js: girl theme in the soft premium style – pony, bunny, tiara, crown, mosque, gem,
   the mosque progress picture (windows light up) and the crown reward. OWNER: art agent.
   Princess mood without people: crowns, tiaras, jewels, animals with friendly faces; the building is a mosque. */
import { uid, f, esc, clampInt, isHex, mix, svgOpen, onionPath, archPath, crescentPath, heartPath, sparklePath, starPath } from './common.js';
import { INK, G, keep, lg, lgU, rg, rgU, drop, u, clay, twinkle, softStar, flower } from './soft.js';

const LINE = '#C46A80';   // soft rose line for little mouths / nostrils (never black outlines)

/* ---------- motifs ---------- */

// Standing pony facing right. Native box [10, 0, 192, 156].
export const PONY_BOX = [10, 0, 192, 156];
export function pony(c, id) {
  const k = c || keep;
  return '<defs>' + rg(id + '-body', [[0, '#FFFFFF'], [0.65, '#FFF1EA'], [1, '#FFD9C9']], k, 0.35, 0.28, 0.9) +
    lg(id + '-leg', [[0, '#FFF3EC'], [1, '#FFD6C4']], k) + lg(id + '-legB', [[0, '#FBE2D6'], [1, '#F2C3B0']], k) +
    lg(id + '-mane', [[0, '#D3C4FF'], [0.55, G.lavender], [1, '#FF9FBA']], k, 0, 0, 1, 1) +
    rg(id + '-muz', [[0, '#FFE2EA'], [1, G.rose]], k, 0.4, 0.35, 0.9) + '</defs>' +
    '<ellipse cx="104" cy="146" rx="62" ry="8" fill="' + k('#E58AA4') + '" opacity=".25"/>' +
    '<path d="M54 68C30 60 20 82 26 102C30 114 24 124 14 128C36 132 50 114 48 98C47 88 52 80 58 78Z" fill="' + u(id + '-mane') + '"/>' +
    '<rect x="64" y="96" width="17" height="48" rx="8.5" fill="' + u(id + '-legB') + '"/>' +
    '<rect x="128" y="96" width="17" height="48" rx="8.5" fill="' + u(id + '-legB') + '"/>' +
    '<ellipse cx="104" cy="90" rx="54" ry="33" fill="' + u(id + '-body') + '"/>' +
    '<rect x="82" y="100" width="17" height="46" rx="8.5" fill="' + u(id + '-leg') + '"/>' +
    '<rect x="146" y="98" width="17" height="48" rx="8.5" fill="' + u(id + '-leg') + '"/>' +
    '<path d="M82 134h17v4a8.5 8.5 0 0 1-17 0zM146 134h17v4a8.5 8.5 0 0 1-17 0z" fill="' + k(G.coral) + '" opacity=".85"/>' +
    '<path d="M124 94C120 70 128 50 142 38L166 52C154 62 150 78 152 98Z" fill="' + u(id + '-body') + '"/>' +
    '<ellipse cx="160" cy="44" rx="28" ry="23" transform="rotate(18 160 44)" fill="' + u(id + '-body') + '"/>' +
    '<ellipse cx="180" cy="58" rx="17" ry="14" fill="' + u(id + '-muz') + '"/>' +
    '<path d="M147 27C144 15 148 6 155 3C160 10 160 20 156 28Z" fill="' + u(id + '-body') + '"/>' +
    '<path d="M151 22C150 15 152 10 155 8C157 13 157 18 155 23Z" fill="' + k(G.rose) + '"/>' +
    '<g fill="' + u(id + '-mane') + '"><circle cx="140" cy="28" r="12"/><circle cx="131" cy="42" r="12"/><circle cx="125" cy="57" r="11.5"/>' +
    '<circle cx="122" cy="72" r="10.5"/><circle cx="150" cy="24" r="9"/></g>' +
    '<path d="M60 70C70 62 92 58 110 62" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".55"/>' +
    '<ellipse cx="163" cy="42" rx="5" ry="6.2" fill="' + k(INK) + '"/><circle cx="164.8" cy="39.8" r="1.9" fill="#FFFFFF"/>' +
    '<path d="M157.5 35.2l-2.6-2.4M161 33.6l-1.1-3" stroke="' + k(INK) + '" stroke-width="1.8" stroke-linecap="round"/>' +
    '<ellipse cx="170" cy="55" rx="6" ry="4" fill="' + k(G.coral) + '" opacity=".4"/>' +
    '<circle cx="189" cy="55" r="1.8" fill="' + k(LINE) + '"/>' +
    '<path d="M176 64.5c3 2.6 7.4 2.6 10 .4" fill="none" stroke="' + k(LINE) + '" stroke-width="2.2" stroke-linecap="round"/>';
}

// Pony head in profile (stickers, avatar). 100x100 box; opt.crown adds a tiny crown.
export function ponyHead(c, id, opt) {
  const k = c || keep, o = opt || {};
  const HEAD = 'M31 99C27 76 28 52 40 35C42 31 43 28 43.5 25.5C42 18 44.5 11 49.5 6C54 10.5 57.5 16 57 22C67 24 77 33 84 44C88 50 92 56 92 63C92 71 86 76 78 76C72 76 68 73 64 71C60 75 58 85 61 99Z';
  const MUZ = 'M77 51C86 50 93 56 93 63C93 71 86 77 78 77C71 77 67 71 67 64C67 57 71 52 77 51Z';
  return '<defs>' + rg(id + '-b', [[0, '#FFFFFF'], [0.6, '#FFF1EA'], [1, '#FFD6C4']], k, 0.55, 0.3, 0.85) +
    lg(id + '-m', [[0, '#D3C4FF'], [0.55, G.lavender], [1, '#FF9FBA']], k, 0, 0, 0.6, 1) +
    rg(id + '-z', [[0, '#FFE2EA'], [1, G.rose]], k, 0.4, 0.35, 0.9) + '</defs>' +
    '<path d="M37.5 30C34.5 22 35 14.5 39 9C43 13 45 19 44.5 26Z" fill="' + k('#F4D2C3') + '"/>' +
    '<g fill="' + u(id + '-m') + '"><circle cx="38" cy="26" r="11"/><circle cx="31" cy="39" r="12"/><circle cx="27" cy="53" r="12"/>' +
    '<circle cx="25" cy="67" r="11.5"/><circle cx="25" cy="81" r="11"/><circle cx="27" cy="95" r="10"/></g>' +
    '<path d="' + HEAD + '" fill="' + u(id + '-b') + '"/>' +
    '<path d="M49.5 12.5C47.5 16 47 19.5 47.5 23L53.5 21.5C53.5 18 52 15 49.5 12.5Z" fill="' + k(G.rose) + '"/>' +
    '<path d="' + MUZ + '" fill="' + u(id + '-z') + '"/>' +
    '<g fill="' + u(id + '-m') + '"><circle cx="45" cy="26" r="8.5"/><circle cx="53.5" cy="25" r="7"/></g>' +
    '<path d="M58 31C66 32 73 37 78 43" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".7"/>' +
    '<ellipse cx="62" cy="44" rx="5.4" ry="6.6" fill="' + k(INK) + '"/><circle cx="64" cy="41.6" r="2" fill="#FFFFFF"/>' +
    '<path d="M56.6 37.8l-2.8-2.4M60 36l-1.2-3.2" stroke="' + k(INK) + '" stroke-width="1.8" stroke-linecap="round"/>' +
    '<ellipse cx="69" cy="57" rx="6" ry="4" fill="' + k(G.coral) + '" opacity=".38"/>' +
    '<circle cx="87" cy="60" r="1.8" fill="' + k(LINE) + '"/>' +
    '<path d="M75 69c3 2.6 7.4 2.6 10 .4" fill="none" stroke="' + k(LINE) + '" stroke-width="2.2" stroke-linecap="round"/>' +
    (o.crown ? '<g transform="translate(25 2) rotate(-18) scale(.3)">' + crown(k, id + '-cr') + '</g>' : '');
}

// Bunny face with long ears and a bow. 100x100.
export function bunny(c, id) {
  const k = c || keep;
  return '<defs>' + rg(id + '-b', [[0, '#FFFFFF'], [0.7, '#FBF6FF'], [1, '#E9DEF8']], k, 0.4, 0.3, 0.85) +
    lg(id + '-e', [[0, '#FFD3DF'], [1, G.rose]], k) + clay(id + '-w', G.lavender, k) + '</defs>' +
    '<path d="M33 46C24 31 23 9 32 5C41 2 46 20 45 44Z" fill="' + u(id + '-b') + '"/>' +
    '<path d="M34.5 40C29 29 28.5 14 33 10.5C37.5 9 40.5 22 40.5 39Z" fill="' + u(id + '-e') + '"/>' +
    '<path d="M55 44C54 20 59 2 68 5C77 9 76 31 67 46Z" fill="' + u(id + '-b') + '"/>' +
    '<path d="M60 39C60 22 63 10 67 10.5C71.5 14 71 29 65.5 40Z" fill="' + u(id + '-e') + '"/>' +
    '<ellipse cx="50" cy="65" rx="31" ry="27" fill="' + u(id + '-b') + '"/>' +
    '<ellipse cx="39" cy="52" rx="10" ry="5" transform="rotate(-20 39 52)" fill="#FFFFFF" opacity=".7"/>' +
    '<ellipse cx="32" cy="73" rx="6.5" ry="4.2" fill="' + k(G.coral) + '" opacity=".35"/><ellipse cx="68" cy="73" rx="6.5" ry="4.2" fill="' + k(G.coral) + '" opacity=".35"/>' +
    '<ellipse cx="39" cy="62" rx="4.6" ry="5.6" fill="' + k(INK) + '"/><ellipse cx="61" cy="62" rx="4.6" ry="5.6" fill="' + k(INK) + '"/>' +
    '<circle cx="40.6" cy="60" r="1.7" fill="#FFFFFF"/><circle cx="62.6" cy="60" r="1.7" fill="#FFFFFF"/>' +
    '<path d="M46 68.6Q50 66.4 54 68.6Q52.4 72.6 50 72.6Q47.6 72.6 46 68.6Z" fill="' + k(G.coral) + '"/>' +
    '<path d="M50 72.6C50 76.4 46.6 78 44.2 76M50 72.6C50 76.4 53.4 78 55.8 76" fill="none" stroke="' + k(LINE) + '" stroke-width="1.8" stroke-linecap="round"/>' +
    '<ellipse cx="42.5" cy="39" rx="8" ry="5.6" transform="rotate(-18 42.5 39)" fill="' + u(id + '-w') + '"/>' +
    '<ellipse cx="57.5" cy="39" rx="8" ry="5.6" transform="rotate(18 57.5 39)" fill="' + u(id + '-w') + '"/>' +
    '<circle cx="50" cy="39.4" r="3.8" fill="' + k(G.lavender) + '"/>';
}

// Tiara with a heart jewel. 100x100.
export function tiara(c, id, color) {
  const k = c || keep;
  const BODY = 'M14 78L20 56L32 66L42 42L50 22L58 42L68 66L80 56L86 78Z';
  const BAND = 'M10 80C32 70 68 70 90 80L88 89C68 80 32 80 12 89Z';
  let pearls = '';
  for (let i = 1; i < 8; i++) {
    const t = i / 8, x = 11 + 78 * t, y = 85 - 20 * t * (1 - t);
    pearls += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="1.9" fill="#FFFFFF" opacity=".9"/>';
  }
  return '<defs>' + lg(id + '-g', [[0, '#FFEFC0'], [1, '#FFC24F']], k) + lg(id + '-b', [[0, '#FFB9CB'], [1, G.coral]], k) +
    clay(id + '-h', isHex(color) ? color : G.coral, k) + clay(id + '-m', G.mint, k) + clay(id + '-l', G.lavender, k) + '</defs>' +
    '<path d="' + BODY + '" fill="' + u(id + '-g') + '" stroke="' + u(id + '-g') + '" stroke-width="6" stroke-linejoin="round"/>' +
    '<path d="M22 70L26 58M38 60L42 50" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".6"/>' +
    '<path d="' + BAND + '" fill="' + u(id + '-b') + '" stroke="' + u(id + '-b') + '" stroke-width="4" stroke-linejoin="round"/>' + pearls +
    '<circle cx="19.5" cy="53" r="5" fill="' + u(id + '-m') + '"/><circle cx="80.5" cy="53" r="5" fill="' + u(id + '-m') + '"/>' +
    '<circle cx="42" cy="40" r="3.8" fill="' + u(id + '-l') + '"/><circle cx="58" cy="40" r="3.8" fill="' + u(id + '-l') + '"/>' +
    '<path d="' + heartPath(50, 51, 24) + '" fill="' + u(id + '-h') + '"/>' +
    '<path d="M43.5 46C44 43.6 46 42.4 48 42.8" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>';
}

// Crown, native box 100x80 (use crown100 for a 100x100 box).
export function crown(c, id) {
  const k = c || keep;
  return '<defs>' + lg(id + '-g', [[0, '#FFE9A6'], [1, '#FFC447']], k) + lg(id + '-b', [[0, '#FFB9CB'], [1, G.coral]], k) + '</defs>' +
    '<path d="M12 64L6 22L30 42L50 10L70 42L94 22L88 64Z" fill="' + u(id + '-g') + '" stroke="' + u(id + '-g') + '" stroke-width="8" stroke-linejoin="round"/>' +
    '<rect x="8" y="58" width="84" height="18" rx="9" fill="' + u(id + '-b') + '"/>' +
    '<circle cx="6" cy="20" r="6.5" fill="' + k(G.rose) + '"/><circle cx="50" cy="8" r="7.5" fill="' + k(G.lavender) + '"/><circle cx="94" cy="20" r="6.5" fill="' + k(G.rose) + '"/>' +
    '<circle cx="30" cy="67" r="4.6" fill="' + k(G.mint) + '"/><circle cx="50" cy="67" r="5.4" fill="' + k(G.coral) + '"/><circle cx="70" cy="67" r="4.6" fill="' + k(G.mint) + '"/>' +
    '<path d="M22 50L18 32" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".6"/>';
}
export function crown100(c, id) { return '<g transform="translate(4 14) scale(.92)">' + crown(c, id) + '</g>'; }

// Pointed (Islamic) arch from `top` (the point) down to `bottom`.
export function pointedArch(cx, top, w, bottom) {
  const hw = w / 2, sh = Math.min(w * 1.05, bottom - top), ys = top + sh * 0.62;
  return 'M' + f(cx - hw) + ' ' + f(bottom) + 'V' + f(ys) + 'Q' + f(cx - hw) + ' ' + f(top + sh * 0.14) + ' ' + f(cx) + ' ' + f(top) +
    'Q' + f(cx + hw) + ' ' + f(top + sh * 0.14) + ' ' + f(cx + hw) + ' ' + f(ys) + 'V' + f(bottom) + 'Z';
}

// Minaret standing on y = base, centre x; body w, top of body y = top. Cap = small onion + crescent.
function minaret(id, x, top, base, w, k) {
  const hw = w / 2, upW = w * 0.72, bal = top + (base - top) * 0.3;
  return '<rect x="' + f(x - hw) + '" y="' + f(bal) + '" width="' + f(w) + '" height="' + f(base - bal) + '" rx="' + f(w * 0.4) + '" fill="' + u(id + '-mn') + '"/>' +
    '<rect x="' + f(x - upW / 2) + '" y="' + f(top) + '" width="' + f(upW) + '" height="' + f(bal - top + 6) + '" rx="' + f(upW * 0.4) + '" fill="' + u(id + '-mn') + '"/>' +
    '<rect x="' + f(x - hw - w * 0.25) + '" y="' + f(bal - w * 0.22) + '" width="' + f(w * 1.5) + '" height="' + f(w * 0.42) + '" rx="' + f(w * 0.21) + '" fill="' + u(id + '-band') + '"/>' +
    '<rect x="' + f(x - hw + w * 0.22) + '" y="' + f(bal + 8) + '" width="' + f(w * 0.22) + '" height="' + f(base - bal - 18) + '" rx="' + f(w * 0.11) + '" fill="#FFFFFF" opacity=".45"/>' +
    '<path d="' + onionPath(x, top + 2, upW * 0.62, upW * 1.25) + '" fill="' + u(id + '-cap') + '"/>' +
    '<path d="M' + f(x) + ' ' + f(top + 2 - upW * 1.25) + 'V' + f(top - upW * 1.25 - w * 0.36) + '" stroke="' + k('#F2B740') + '" stroke-width="' + f(Math.max(2, w * 0.12)) + '" stroke-linecap="round"/>' +
    '<path d="' + crescentPath(x, top - upW * 1.25 - w * 0.62, w * 0.27, -Math.PI / 2) + '" fill="' + k('#FFC447') + '"/>';
}

function mosqueDefs(id, k) {
  return lg(id + '-mn', [[0, '#FFF6EF'], [1, '#FFD9C6']], k, 0, 0, 1, 0) + lg(id + '-band', [[0, '#FFC8D6'], [1, '#FF9DB6']], k, 0, 0, 1, 0) +
    lg(id + '-cap', [[0, '#FFEDB6'], [1, '#FFC24F']], k, 0, 0, 1, 0) + lg(id + '-hall', [[0, '#FFF6F0'], [1, '#FFD8C4']], k, 0, 0, 1, 0) +
    lg(id + '-dome', [[0, '#E2D8FF'], [0.55, '#BBA7FF'], [1, '#9C86FF']], k, 0, 0, 1, 0.3) + lg(id + '-sd', [[0, '#FFD3DF'], [1, '#FF9DB6']], k, 0, 0, 1, 0) +
    lg(id + '-drum', [[0, '#FFC8D6'], [1, '#FF9DB6']], k, 0, 0, 1, 0) + lg(id + '-door', [[0, '#FFA3B7'], [1, G.coral]], k) +
    lg(id + '-win', [[0, '#FFF6D8'], [1, G.gold]], k);
}

// Mosque (cover, sticker, motif, backdrop): big dome with a crescent, two slender minarets. Native box below.
export const MOSQUE_BOX = [228, 140, 228, 266];
export function mosque(c, id) {
  const k = c || keep;
  return '<defs>' + mosqueDefs(id, k) + '</defs>' +
    minaret(id, 252, 200, 404, 27, k) + minaret(id, 432, 200, 404, 27, k) +
    '<rect x="270" y="300" width="144" height="104" rx="16" fill="' + u(id + '-hall') + '"/>' +
    '<path d="' + onionPath(292, 302, 17, 32) + '" fill="' + u(id + '-sd') + '"/><path d="' + onionPath(392, 302, 17, 32) + '" fill="' + u(id + '-sd') + '"/>' +
    '<rect x="304" y="280" width="76" height="24" rx="10" fill="' + u(id + '-drum') + '"/>' +
    '<path d="' + onionPath(342, 284, 56, 92) + '" fill="' + u(id + '-dome') + '"/>' +
    '<path d="M320 214C312 230 311 252 316 270" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" fill="none" opacity=".55"/>' +
    '<path d="M342 194V180" stroke="' + k('#F2B740') + '" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="' + crescentPath(342, 172, 10, -Math.PI / 2) + '" fill="' + k('#FFC447') + '"/>' +
    '<path d="' + starPath(342, 292, 7.5, 5, 8, -Math.PI / 8) + '" fill="#FFFFFF" opacity=".85"/>' +
    '<path d="' + pointedArch(342, 334, 40, 404) + '" fill="' + u(id + '-door') + '"/>' +
    '<path d="' + pointedArch(298, 330, 18, 366) + '" fill="' + u(id + '-win') + '"/><path d="' + pointedArch(386, 330, 18, 366) + '" fill="' + u(id + '-win') + '"/>';
}

// Faceted gem. 100x100.
export function gem(c, id, color) {
  const k = c || keep, base = isHex(color) ? color : G.lavender;
  return '<defs>' + lg(id + '-t', [[0, mix(base, '#FFFFFF', 0.75)], [1, mix(base, '#FFFFFF', 0.4)]], k) +
    lg(id + '-b', [[0, mix(base, '#FFFFFF', 0.2)], [1, base]], k) + '</defs>' +
    '<path d="M26 28H74L92 46L50 92L8 46Z" fill="' + u(id + '-b') + '" stroke="' + u(id + '-b') + '" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M26 28H74L92 46H8Z" fill="' + u(id + '-t') + '" stroke="' + u(id + '-t') + '" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M50 92L64 46H92Z" fill="' + k(mix(base, INK, 0.14)) + '" opacity=".35"/>' +
    '<path d="M36 46L50 92L64 46M26 28L36 46L50 28L64 46L74 28" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>' +
    '<path d="' + sparklePath(32, 37, 7) + '" fill="#FFFFFF"/>';
}

export function heart(c, id, color) {
  const k = c || keep;
  return '<defs>' + clay(id + '-h', isHex(color) ? color : G.coral, k) + '</defs>' +
    '<path d="' + heartPath(50, 52, 86) + '" fill="' + u(id + '-h') + '"/>' +
    '<path d="M24 30C28 22 36 19 42 21" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".6"/>';
}

/* ---------- progress: a mosque whose windows glow (.pw[data-i] .on) – viewBox 360x300 ---------- */

// Window plan for `n` lines: the 8-point star window on the dome drum is always the last one (.pw-heart); the
// others are pointed-arch windows on the prayer hall (1–3 rows) and, from 10 lines on, stacked in both minarets.
// Lit order = bottom-up, the star last.
function windowPlan(n) {
  const r = n - 1, out = [];
  const perMin = r <= 8 ? 0 : (r <= 14 ? 3 : (r <= 20 ? 4 : 5));
  const hall = r - perMin * 2;
  const perRow = Math.ceil(hall / (hall <= 5 ? 1 : (hall <= 10 ? 2 : 3))) || 1;
  const rows = hall ? Math.ceil(hall / perRow) : 0;
  const yTop = 164, yBot = 215, cellH = (yBot - yTop) / Math.max(1, rows);
  const h = rows <= 1 ? 42 : (rows === 2 ? 23 : 15.5);
  const cellW = Math.min(172 / perRow, 44), w = Math.min(cellW * 0.6, h * 0.64, 26);
  let left = hall;
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(perRow, left);
    left -= inRow;
    for (let j = 0; j < inRow; j++) out.push({ cx: 180 + (j - (inRow - 1) / 2) * cellW, cy: rows <= 1 ? 190 : yBot - (row + 0.5) * cellH, w: w, h: h });
  }
  if (perMin) {
    const th = perMin === 3 ? 24 : (perMin === 4 ? 20 : 17), tw = 12, y0 = 150, y1 = 250;
    for (let j = 0; j < perMin; j++) {
      const cy = y1 - j * (y1 - y0) / (perMin - 1);
      out.push({ cx: 46, cy: cy, w: tw, h: th }, { cx: 314, cy: cy, w: tw, h: th });
    }
  }
  out.sort((p, q) => (q.cy - p.cy) || (p.cx - q.cx));
  out.push({ cx: 180, cy: 142, w: 15, h: 15, star: true });
  return out;
}

export function mosqueProgress(o) {
  const n = clampInt(o.total, 1, 30, 6), k = clampInt(o.done, 0, n, 0), id = uid('msq');
  const done = k >= n;
  let wins = '';
  windowPlan(n).forEach((p, i) => {
    const top = p.cy - p.h / 2, bot = p.cy + p.h / 2;
    const shape = p.star ? starPath(p.cx, p.cy, p.w, p.w * 0.72, 8, -Math.PI / 8) : pointedArch(p.cx, top, p.w, bot);
    wins += '<g class="pw' + (p.star ? ' pw-heart' : '') + (i < k ? ' on' : '') + '" data-i="' + i + '" style="--art-d:' + f(-(i % 5) * 0.6) + 's">' +
      '<path d="' + shape + '" fill="' + u(id + '-wd') + '"/>' +
      '<g class="art-pw-lit">' +
      '<circle class="art-pw-glow" cx="' + f(p.cx) + '" cy="' + f(p.cy) + '" r="' + f(Math.max(p.w, p.h) * (p.star ? 1.5 : 0.95)) + '" fill="' + u(id + '-gl') + '"/>' +
      '<path d="' + shape + '" fill="' + u(id + '-wl') + '"/>' +
      (p.star ? '<circle cx="' + f(p.cx) + '" cy="' + f(p.cy) + '" r="4" fill="#FFFFFF" opacity=".85"/></g>'
        : '<path d="M' + f(p.cx - p.w * 0.2) + ' ' + f(bot - p.h * 0.2) + 'V' + f(top + p.h * 0.42) + '" stroke="#FFFFFF" stroke-width="' + f(Math.max(1.6, p.w * 0.16)) + '" stroke-linecap="round" opacity=".8"/></g>') +
      '<path class="art-pw-star" d="' + sparklePath(p.cx + p.w * (p.star ? 0.8 : 0.5), top + (p.star ? 0 : 2), Math.max(4.5, p.w * 0.36)) + '" fill="#FFFFFF"/>' +
      '</g>';
  });
  const fx = '<g class="art-done-fx">' +
    '<circle cx="180" cy="150" r="176" fill="' + u(id + '-halo') + '"/>' +
    softStar(104, 48, 11, G.gold, -0.2) + softStar(258, 52, 9, G.gold, -1.1) +
    '<path d="' + heartPath(96, 98, 18) + '" fill="' + G.rose + '"/><path d="' + heartPath(266, 100, 16) + '" fill="' + G.lavender + '"/>' +
    twinkle(130, 20, 8, G.gold, -0.6) + twinkle(232, 18, 7, G.coral, -1.4) + twinkle(14, 46, 7, G.gold, -0.9) + twinkle(346, 40, 7, G.coral, -1.8) + '</g>';
  return svgOpen('progress', '0 0 360 300', 'art-progress-girl art-mosque art-castle' + (done ? ' art-complete' : '') + (o.cls ? ' ' + esc(o.cls) : '')) +
    '<defs>' + drop(id + '-sh', '#E07A97', 10, 10, 0.22) + mosqueDefs(id, null) +
    lg(id + '-wd', [[0, '#EEE8FA'], [1, '#D8CFF0']]) + lg(id + '-wl', [[0, '#FFF6CF'], [1, '#FFC447']]) +
    rg(id + '-gl', [[0, '#FFE9A0', 0.85], [0.5, '#FFE08A', 0.35], [1, '#FFE08A', 0]], null, 0.5, 0.5, 0.5) +
    rg(id + '-halo', [[0, '#FFFFFF', 0.85], [0.55, '#FFF1C9', 0.4], [1, '#FFF1C9', 0]], null, 0.5, 0.5, 0.5) +
    lg(id + '-h1', [[0, '#C9F3E4'], [1, '#A6E8D1']]) + lg(id + '-h2', [[0, '#B4EEDB'], [1, '#93E2C8']]) + '</defs>' +
    fx +
    twinkle(96, 150, 7, G.gold, -0.4) + twinkle(266, 34, 6, '#FFFFFF', -1.3) +
    '<path d="M0 300V272C60 254 120 250 180 250C240 250 300 254 360 272V300Z" fill="' + u(id + '-h1') + '"/>' +
    '<g filter="' + u(id + '-sh') + '">' +
    minaret(id, 46, 76, 274, 30, keep) + minaret(id, 314, 76, 274, 30, keep) +
    '<rect x="72" y="152" width="216" height="122" rx="18" fill="' + u(id + '-hall') + '"/>' +
    '<path d="' + onionPath(100, 154, 21, 36) + '" fill="' + u(id + '-sd') + '"/><path d="' + onionPath(260, 154, 21, 36) + '" fill="' + u(id + '-sd') + '"/>' +
    '<rect x="122" y="124" width="116" height="34" rx="14" fill="' + u(id + '-drum') + '"/>' +
    '<path d="' + onionPath(180, 128, 70, 92) + '" fill="' + u(id + '-dome') + '"/>' +
    '<path d="M152 58C143 74 142 98 147 118" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" fill="none" opacity=".55"/>' +
    '<path d="M180 37V24" stroke="#F2B740" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="' + crescentPath(180, 17, 8, -Math.PI / 2) + '" fill="#FFC447"/>' +
    '<path d="' + pointedArch(180, 218, 42, 274) + '" fill="' + u(id + '-door') + '"/>' +
    wins + '</g>' +
    '<path d="M0 300V282C70 266 120 264 180 264C240 264 290 266 360 282V300Z" fill="' + u(id + '-h2') + '"/>' +
    '<path d="M20 280C60 270 100 266 140 266" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".5"/>' +
    flower(84, 288, 0.7) + flower(300, 290, 0.6, '#FFFFFF', G.coral) + flower(236, 286, 0.5) +
    '</svg>';
}
export const castleProgress = mosqueProgress;

/* ---------- reward: crown with gem sockets (.slot[data-i] .on) – viewBox 240x180 ---------- */

const GEMS = [G.mint, G.lavender, G.gold, '#FFFFFF', '#8FD3FF', G.peach];

function roundGem(id, x, y, r, col) {
  return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r * 1.6) + '" fill="' + u(id + '-gg') + '"/>' +
    '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + col + '"/>' +
    '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + u(id + '-shade') + '"/>' +
    '<path d="' + starPath(x, y, r * 0.58, r * 0.38, 8, -Math.PI / 8) + '" fill="#FFFFFF" opacity=".4"/>' +
    '<path d="' + sparklePath(x - r * 0.38, y - r * 0.4, r * 0.4) + '" fill="#FFFFFF"/>';
}

export function crownReward(o) {
  const n = clampInt(o.slots, 1, 12, 5), k = clampInt(o.filled, 0, n, 0), id = uid('crw');
  const colors = Array.isArray(o.colors) && o.colors.length ? o.colors.map((c) => (isHex(c) ? c : G.mint)) : GEMS;
  const done = k >= n;
  const BODY = 'M36 130L28 62L58 96L80 46L104 88L120 26L136 88L160 46L182 96L212 62L204 130Z';
  const BAND = 'M30 124Q120 140 210 124L212 152Q120 170 28 152Z';
  let slots = '';
  const span = 168, sp = span / n, r = Math.min(12, sp * 0.34);
  for (let i = 0; i < n; i++) {
    const x = 120 + (i - (n - 1) / 2) * sp, t = (x - 30) / 180, y = 138 + 32 * t * (1 - t);
    let spark = '';
    for (let a = 0; a < 3; a++) {
      const ang = -Math.PI / 2 + (a - 1) * 0.8, r1 = r + 4, r2 = r + 7;
      spark += 'M' + f(x + Math.cos(ang) * r1) + ' ' + f(y + Math.sin(ang) * r1) + 'L' + f(x + Math.cos(ang) * r2) + ' ' + f(y + Math.sin(ang) * r2);
    }
    slots += '<g class="slot crown-slot' + (i < k ? ' on' : '') + '" data-i="' + i + '">' +
      '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r + 1.5) + '" fill="' + u(id + '-sock') + '"/>' +
      '<g class="art-slot-in">' + roundGem(id, x, y, r + 0.5, colors[i % colors.length]) + '</g>' +
      '<path class="art-slot-spark" d="' + spark + '" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>' +
      '</g>';
  }
  return svgOpen('reward', '0 0 240 180', 'art-reward-girl art-crown' + (done ? ' art-complete' : '') + (o.cls ? ' ' + esc(o.cls) : '')) +
    '<defs>' + drop(id + '-sh', '#E0A030', 10, 10, 0.3) +
    rg(id + '-bg', [[0, '#FFFFFF', 0.95], [0.6, '#FFE3EB', 0.7], [1, '#FFE3EB', 0]], null, 0.5, 0.5, 0.5) +
    lgU(id + '-g', [[0, '#FFF0C2'], [0.6, '#FFD36E'], [1, '#FFBE45']], null, 0, 26, 0, 132) +
    lgU(id + '-b', [[0, '#FFB3C7'], [1, '#FF7A9A']], null, 0, 124, 0, 166) +
    rg(id + '-sock', [[0, '#E98AA2'], [0.7, '#F6B1C3'], [1, '#FFC9D6']], null, 0.5, 0.42, 0.6) +
    rg(id + '-shade', [[0, '#FFFFFF', 0.45], [0.55, '#FFFFFF', 0], [1, '#24324F', 0.18]], null, 0.35, 0.3, 0.8) +
    rg(id + '-gg', [[0, '#FFFFFF', 0.7], [1, '#FFFFFF', 0]], null, 0.5, 0.5, 0.5) + '</defs>' +
    '<circle cx="120" cy="94" r="92" fill="' + u(id + '-bg') + '"/>' +
    '<g class="art-done-fx">' + twinkle(24, 34, 12, G.gold, -0.3) + twinkle(218, 30, 10, G.coral, -1.2) + twinkle(224, 146, 8, G.lavender, -0.8) +
    softStar(18, 132, 7, G.rose, -1.6) + '</g>' +
    '<g filter="' + u(id + '-sh') + '">' +
    '<path d="' + BODY + '" fill="' + u(id + '-g') + '" stroke="' + u(id + '-g') + '" stroke-width="10" stroke-linejoin="round"/>' +
    '<path d="M42 112L36 78M82 84L80 66" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity=".6"/>' +
    '<path d="' + BAND + '" fill="' + u(id + '-b') + '" stroke="' + u(id + '-b') + '" stroke-width="8" stroke-linejoin="round"/>' +
    '<path d="M40 132Q120 146 200 132" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" opacity=".35"/>' +
    '<circle cx="28" cy="58" r="8" fill="' + G.mint + '"/><circle cx="80" cy="41" r="7.5" fill="' + G.rose + '"/>' +
    '<circle cx="120" cy="20" r="9" fill="' + G.lavender + '"/><circle cx="160" cy="41" r="7.5" fill="' + G.rose + '"/><circle cx="212" cy="58" r="8" fill="' + G.mint + '"/>' +
    '<g fill="#FFFFFF" opacity=".7"><circle cx="25" cy="55" r="2.4"/><circle cx="77.5" cy="38.5" r="2.2"/><circle cx="117" cy="17" r="2.6"/><circle cx="157.5" cy="38.5" r="2.2"/><circle cx="209" cy="55" r="2.4"/></g>' +
    '<path d="' + heartPath(120, 68, 26) + '" fill="' + G.coral + '"/>' +
    '<path d="M112 63C113 60.5 115 59.5 117 60" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".8"/>' +
    slots + '</g></svg>';
}
