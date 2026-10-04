/* Inline SVG art for the minigames (own drawings, light ice-palace palette).
   Objects only: balloons, snowflakes, lanterns, fruit, basket, gems, crown, palace. No faces/figures.
   Every function returns an SVG markup string; gradient ids are unique per call (uid). */
import { mix, shade } from '../util.js';

let uidN = 0;
export function uid(p) { uidN += 1; return 'mg' + p + uidN; }
export const SVG0 = ' aria-hidden="true" focusable="false"';

const f1 = (v) => (Math.round(v * 10) / 10).toString();

export function rg(id, cx, cy, r, stops) {
  let s = '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">';
  for (const st of stops) s += '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"' + (st[2] != null ? ' stop-opacity="' + st[2] + '"' : '') + '/>';
  return s + '</radialGradient>';
}
export function lg(id, x1, y1, x2, y2, stops) {
  let s = '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">';
  for (const st of stops) s += '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"' + (st[2] != null ? ' stop-opacity="' + st[2] + '"' : '') + '/>';
  return s + '</linearGradient>';
}

/* concave 4-point sparkle star */
export function sparkD(cx, cy, R) {
  const r = R * 0.18;
  return 'M' + f1(cx) + ' ' + f1(cy - R) + ' Q' + f1(cx + r) + ' ' + f1(cy - r) + ' ' + f1(cx + R) + ' ' + f1(cy) +
    ' Q' + f1(cx + r) + ' ' + f1(cy + r) + ' ' + f1(cx) + ' ' + f1(cy + R) +
    ' Q' + f1(cx - r) + ' ' + f1(cy + r) + ' ' + f1(cx - R) + ' ' + f1(cy) +
    ' Q' + f1(cx - r) + ' ' + f1(cy - r) + ' ' + f1(cx) + ' ' + f1(cy - R) + 'Z';
}
function poly(pts) {
  let d = '';
  pts.forEach((p, i) => { d += (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); });
  return d + 'Z';
}

/* ---------- header goal marker: a small faceted gem (off = frosted outline, on = coloured) ---------- */
export function goalGemSVG(color) {
  const id = uid('gg');
  const out = 'M5 9.2 L8.6 4 H15.4 L19 9.2 L12 21 Z';
  return '<svg viewBox="0 0 24 24"' + SVG0 + '><defs>' +
    lg(id, '0', '0', '1', '1', [[0, mix(color, '#ffffff', 0.55)], [0.5, color], [1, shade(color, -0.25)]]) + '</defs>' +
    '<path class="gg-off" d="' + out + '" fill="rgba(255,255,255,.75)" stroke="#A9BCDD" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<g class="gg-on">' +
    '<path d="' + out + '" fill="url(#' + id + ')" stroke="' + shade(color, -0.35) + '" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M5 9.2 H19 M8.6 4 L10 9.2 L12 21 L14 9.2 L15.4 4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".9" stroke-linejoin="round"/>' +
    '<path d="' + sparkD(17.6, 4.6, 3.6) + '" fill="#fff"/></g></svg>';
}

/* ---------- 0 balloon (viewBox 100 x 170) ---------- */
export function balloonSVG(c) {
  const id = uid('b');
  const body = 'M50 4 C77 4 95 25 95 51 C95 79 71 100 52 104 L48 104 C29 100 5 79 5 51 C5 25 23 4 50 4 Z';
  return '<svg viewBox="0 0 100 170"' + SVG0 + '><defs>' +
    rg(id, '.36', '.3', '.8', [[0, mix(c, '#ffffff', 0.7)], [0.45, c], [1, shade(c, -0.26)]]) +
    rg(id + 'p', '.7', '.75', '.5', [[0, '#ffffff', 0.45], [1, '#ffffff', 0]]) + '</defs>' +
    '<path d="M50 110 C42 121 58 130 49 141 C41 151 57 159 51 169" fill="none" stroke="#A9B8D8" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M44.5 111 L50 101.5 L55.5 111 Q50 113.5 44.5 111 Z" fill="' + shade(c, -0.2) + '"/>' +
    '<path d="M50 112 C42 108 38 116 44 118 Z M50 112 C58 108 62 116 56 118 Z" fill="#FF9FD6" stroke="#E57BB9" stroke-width="1"/>' +
    '<path d="' + body + '" fill="url(#' + id + ')" stroke="' + shade(c, -0.22) + '" stroke-opacity=".55" stroke-width="1.6"/>' +
    '<path d="' + body + '" fill="url(#' + id + 'p)"/>' +
    '<ellipse cx="30" cy="34" rx="7.5" ry="15" transform="rotate(32 30 34)" fill="#fff" opacity=".6"/>' +
    '<circle cx="42" cy="18" r="3.4" fill="#fff" opacity=".7"/>' +
    /* glitter */
    '<path d="' + sparkD(68, 30, 7) + '" fill="#fff" opacity=".95"/>' +
    '<path d="' + sparkD(58, 76, 5) + '" fill="#fff" opacity=".85"/>' +
    '<path d="' + sparkD(26, 66, 4) + '" fill="#fff" opacity=".8"/>' +
    '<circle cx="78" cy="56" r="1.8" fill="#fff" opacity=".9"/><circle cx="40" cy="86" r="1.5" fill="#fff" opacity=".8"/>' +
    '<circle cx="74" cy="80" r="1.3" fill="#fff" opacity=".8"/><circle cx="52" cy="44" r="1.3" fill="#fff" opacity=".7"/></svg>';
}

/* ---------- 1 snowflake (viewBox 100 x 100) ---------- */
const ARM = 'M50 50 L50 9 M50 34 L39 23 M50 34 L61 23 M50 21 L43 14 M50 21 L57 14';
export function snowflakeSVG(tint) {
  const id = uid('sf');
  let arms = '';
  for (let k = 0; k < 6; k++) arms += '<path d="' + ARM + '" transform="rotate(' + (k * 60) + ' 50 50)"/>';
  const hex = [];
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3; hex.push([50 + Math.cos(a) * 12, 50 + Math.sin(a) * 12]); }
  let tips = '';
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 3;
    tips += '<circle cx="' + f1(50 + Math.cos(a) * 43) + '" cy="' + f1(50 + Math.sin(a) * 43) + '" r="4.2"/>';
  }
  return '<svg viewBox="0 0 100 100"' + SVG0 + '><defs>' +
    rg(id, '.4', '.35', '.7', [[0, '#ffffff'], [0.6, '#E8F6FF'], [1, mix(tint, '#ffffff', 0.4)]]) + '</defs>' +
    '<g fill="none" stroke="' + tint + '" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round">' + arms + '</g>' +
    '<g fill="' + tint + '">' + tips + '</g>' +
    '<g fill="none" stroke="#ffffff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">' + arms + '</g>' +
    '<g fill="#ffffff">' + tips.replace(/r="4.2"/g, 'r="2.2"') + '</g>' +
    '<path d="' + poly(hex) + '" fill="url(#' + id + ')" stroke="' + tint + '" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="' + sparkD(50, 50, 8) + '" fill="#fff"/>' +
    '<circle cx="44" cy="45" r="2" fill="#fff"/></svg>';
}

/* ---------- 3 crystal lantern (viewBox 100 x 170). Lit state is pure CSS (.lit on the button). ---------- */
const LT_BODY = 'M26 49 H74 L80 84 L70 117 H30 L20 84 Z';
export function lanternSVG(tint) {
  const id = uid('l');
  return '<svg viewBox="0 0 100 170"' + SVG0 + '><defs>' +
    lg(id + 'm', '0', '0', '0', '1', [[0, '#FFFFFF'], [0.5, '#DCE5F5'], [1, '#B4C3DE']]) +
    lg(id + 'f', '0', '0', '1', '1', [[0, '#F7FBFF'], [0.55, '#E3EEFB'], [1, '#CBDDF3']]) +
    rg(id + 'g', '.5', '.58', '.62', [[0, '#FFFDF2'], [0.35, mix(tint, '#FFF6D6', 0.55)], [1, tint]]) +
    rg(id + 'h', '.5', '.5', '.5', [[0, tint, 0.75], [0.55, tint, 0.28], [1, tint, 0]]) + '</defs>' +
    '<ellipse class="lt-halo" cx="50" cy="84" rx="48" ry="52" fill="url(#' + id + 'h)"/>' +
    '<circle cx="50" cy="9" r="5.5" fill="none" stroke="#A3B3D2" stroke-width="3"/>' +
    '<rect x="47" y="13" width="6" height="6" rx="2" fill="url(#' + id + 'm)"/>' +
    '<path d="M27 41 Q29 22 50 17 Q71 22 73 41 Z" fill="url(#' + id + 'm)" stroke="#9AABCB" stroke-width="1.6"/>' +
    '<path d="' + sparkD(50, 30, 6) + '" fill="' + tint + '"/>' +
    '<rect x="22" y="39" width="56" height="10" rx="3" fill="url(#' + id + 'm)" stroke="#9AABCB" stroke-width="1.6"/>' +
    '<path class="lt-glass" d="' + LT_BODY + '" fill="url(#' + id + 'f)"/>' +
    '<path class="lt-glass-lit" fill="url(#' + id + 'g)" d="' + LT_BODY + '"/>' +
    /* crystal facets */
    '<path d="M26 49 L50 84 L74 49 M20 84 L50 84 L80 84 M30 117 L50 84 L70 117" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.4"/>' +
    '<g class="lt-core"><path d="M50 66 L60 84 L50 104 L40 84 Z" fill="#ffffff" stroke="' + tint + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="' + sparkD(50, 84, 9) + '" class="lt-spark" fill="' + shade(tint, -0.1) + '"/></g>' +
    '<path class="lt-frame" fill="none" stroke="#9AABCB" stroke-width="2.6" stroke-linejoin="round" d="' + LT_BODY + '"/>' +
    '<path d="M30 54 L26 80" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>' +
    '<rect x="27" y="116" width="46" height="9" rx="3" fill="url(#' + id + 'm)" stroke="#9AABCB" stroke-width="1.6"/>' +
    '<path d="M31 125 H69 Q58 137 50 152 Q42 137 31 125 Z" fill="url(#' + id + 'm)" stroke="#9AABCB" stroke-width="1.6"/>' +
    '<path d="M50 152 L56 160 L50 168 L44 160 Z" fill="' + mix(tint, '#ffffff', 0.25) + '" stroke="' + shade(tint, -0.2) + '" stroke-width="1.4"/></svg>';
}

/* ---------- 4 fruit (viewBox 100 x 100) – natural colours, kept from v1 ---------- */
export const FRUITS = ['date', 'grapes', 'pomegranate', 'fig', 'olives'];
export const FRUIT_FI = { date: 'Taateli', grapes: 'Viinirypäleet', pomegranate: 'Granaattiomena', fig: 'Viikuna', olives: 'Oliivit' };
export function fruitSVG(kind) {
  const id = uid('f');
  let s = '<svg viewBox="0 0 100 100"' + SVG0 + '><defs>';
  if (kind === 'date') {
    s += rg(id, '.38', '.3', '.75', [[0, '#C98042'], [0.55, '#8A4520'], [1, '#4E2410']]) + '</defs>' +
      '<path d="M42 23 Q41 13 48 7" stroke="#7A5A2A" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="50" cy="57" rx="25" ry="37" transform="rotate(-14 50 57)" fill="url(#' + id + ')"/>' +
      '<ellipse cx="39" cy="44" rx="6" ry="14" transform="rotate(-14 39 44)" fill="#fff" opacity=".42"/>' +
      '<path d="M63 32 Q72 56 61 86" stroke="#2E1206" stroke-width="2.2" fill="none" opacity=".3" stroke-linecap="round"/>';
  } else if (kind === 'grapes') {
    s += rg(id, '.35', '.3', '.72', [[0, '#C793F2'], [0.5, '#8E4FD0'], [1, '#4A1F8A']]) + '</defs>' +
      '<path d="M50 26 Q51 14 58 8" stroke="#6B8F2A" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="M55 21 C61 6 81 8 86 18 C77 18 71 27 55 21 Z" fill="#3FAE5A"/>' +
      '<path d="M57 20 Q70 15 82 17" stroke="#2A7A3E" stroke-width="1.6" fill="none"/>';
    const rows = [[34, [26, 42, 58, 74]], [50, [34, 50, 66]], [66, [42, 58]], [82, [50]]];
    for (const row of rows) {
      for (const gx of row[1]) {
        const gy = row[0];
        s += '<circle cx="' + gx + '" cy="' + gy + '" r="10.5" fill="url(#' + id + ')"/>' +
          '<circle cx="' + (gx - 3.5) + '" cy="' + (gy - 4) + '" r="2.7" fill="#fff" opacity=".55"/>';
      }
    }
  } else if (kind === 'pomegranate') {
    s += rg(id, '.35', '.32', '.75', [[0, '#FF8F7E'], [0.5, '#E23A44'], [1, '#8A1224']]) + '</defs>' +
      '<path d="M38 31 L39 15 L45 22 L50 11 L55 22 L61 15 L62 31 Z" fill="#B71F33" stroke="#7E1020" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="61" r="34" fill="url(#' + id + ')"/>' +
      '<ellipse cx="37" cy="47" rx="8" ry="13" transform="rotate(35 37 47)" fill="#fff" opacity=".38"/>';
  } else if (kind === 'fig') {
    s += rg(id, '.38', '.42', '.75', [[0, '#B56CA0'], [0.55, '#7A3A68'], [1, '#41163A']]) + '</defs>' +
      '<path d="M50 18 Q49 9 55 5" stroke="#6B8F2A" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
      '<path d="M50 16 C57 16 58 27 63 35 C79 50 82 70 72 83 C63 94 37 94 28 83 C18 70 21 50 37 35 C42 27 43 16 50 16 Z" fill="url(#' + id + ')"/>' +
      '<ellipse cx="38" cy="59" rx="6" ry="14" transform="rotate(14 38 59)" fill="#fff" opacity=".33"/>' +
      '<path d="M52 30 Q60 58 55 88 M62 42 Q72 62 64 84" stroke="#250A20" stroke-width="2" opacity=".28" fill="none" stroke-linecap="round"/>';
  } else {
    s += rg(id, '.35', '.3', '.75', [[0, '#CFE87A'], [0.55, '#7FA62E'], [1, '#43641A']]) + '</defs>' +
      '<path d="M12 23 Q48 31 88 18" stroke="#6E5A2E" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="M30 26 C22 9 9 6 3 10 C11 16 17 26 30 26 Z" fill="#6F9A80"/>' +
      '<path d="M71 21 C79 5 92 4 98 8 C91 14 85 22 71 21 Z" fill="#83A894"/>' +
      '<path d="M52 27 C57 11 65 6 70 5 C68 14 62 24 52 27 Z" fill="#6A9479"/>' +
      '<path d="M35 27 L35 37 M65 25 L67 50" stroke="#6E5A2E" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="34" cy="58" rx="17" ry="22" transform="rotate(18 34 58)" fill="url(#' + id + ')"/>' +
      '<ellipse cx="67" cy="70" rx="16" ry="21" transform="rotate(-6 67 70)" fill="url(#' + id + ')"/>' +
      '<ellipse cx="27" cy="50" rx="4" ry="8" transform="rotate(18 27 50)" fill="#fff" opacity=".45"/>' +
      '<ellipse cx="72" cy="64" rx="3.6" ry="7" transform="rotate(-6 72 64)" fill="#fff" opacity=".4"/>';
  }
  return s + '</svg>';
}

/* ---------- 4 glittering basket (viewBox 200 x 140), drawn as back + front so fruit sits inside ---------- */
export function basketBackSVG() {
  const id = uid('kb');
  return '<svg viewBox="0 0 200 140"' + SVG0 + '><defs>' +
    lg(id, '0', '0', '1', '0', [[0, '#B9A6F0'], [0.5, '#F4EFFF'], [1, '#B9A6F0']]) + '</defs>' +
    '<ellipse cx="100" cy="137" rx="78" ry="5" fill="#2F6FE0" opacity=".14"/>' +
    '<path d="M40 66 C40 2 160 2 160 66" fill="none" stroke="#9C88DA" stroke-width="13" stroke-linecap="round"/>' +
    '<path d="M40 66 C40 2 160 2 160 66" fill="none" stroke="url(#' + id + ')" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M40 66 C40 2 160 2 160 66" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2 9"/>' +
    '<path d="' + sparkD(100, 18, 7) + '" fill="#fff" stroke="#B9A6F0" stroke-width="1"/>' +
    '<ellipse cx="100" cy="64" rx="84" ry="10" fill="#8F7BCB"/></svg>';
}
export function basketFrontSVG() {
  const id = uid('k');
  let v = '', braid = '';
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    v += 'M' + f1(16 + 168 * t) + ' 70 L' + f1(37 + 126 * t) + ' 136 ';
  }
  for (let x = 16; x < 186; x += 12) braid += 'M' + x + ' 68 l7 -8 ';
  const glitter = [[40, 92, 5], [150, 100, 6], [96, 118, 4.5], [70, 106, 3.5], [126, 84, 3.5], [168, 80, 3.2]];
  let gl = '';
  for (const p of glitter) gl += '<path d="' + sparkD(p[0], p[1], p[2]) + '" fill="#fff"/>';
  return '<svg viewBox="0 0 200 140"' + SVG0 + '><defs>' +
    lg(id, '0', '0', '0', '1', [[0, '#F3EEFF'], [0.55, '#D6C9F7'], [1, '#AE9BE6']]) +
    lg(id + 'r', '0', '0', '0', '1', [[0, '#FFFFFF'], [1, '#D5DEF0']]) + '</defs>' +
    '<path d="M16 64 H184 L163 130 Q160 138 151 138 H49 Q40 138 37 130 Z" fill="url(#' + id + ')" stroke="#9C88DA" stroke-width="2"/>' +
    '<path d="' + v + '" stroke="#9C88DA" stroke-width="3" opacity=".5"/>' +
    '<path d="M22 86 H178 M28 105 H172 M33 123 H167" stroke="#9C88DA" stroke-width="3.2" opacity=".55"/>' +
    '<path d="M22 84 H178 M28 103 H172 M33 121 H167" stroke="#ffffff" stroke-width="1.4" opacity=".8"/>' + gl +
    '<rect x="8" y="56" width="184" height="16" rx="8" fill="url(#' + id + 'r)" stroke="#9AABCB" stroke-width="2.6"/>' +
    '<path d="' + braid + '" stroke="#C8B6FF" stroke-width="3" stroke-linecap="round"/>' +
    /* rose ribbon bow at the front */
    '<path d="M100 66 C88 52 72 58 78 70 C82 78 94 72 100 66 Z M100 66 C112 52 128 58 122 70 C118 78 106 72 100 66 Z" fill="#FFB3DE" stroke="#E57BB9" stroke-width="1.8"/>' +
    '<path d="M96 68 L90 86 M104 68 L110 86" stroke="#FF9FD6" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="100" cy="66" r="5" fill="#FF9FD6" stroke="#E57BB9" stroke-width="1.6"/></svg>';
}

/* ---------- 6 gems: generic faceted gem from an outer outline + an inner table ---------- */
function fitBox(pts, x0, y0, x1, y1) {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const p of pts) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
  const s = Math.min((x1 - x0) / (mxx - mnx), (y1 - y0) / (mxy - mny));
  const ox = (x0 + x1) / 2 - (mnx + mxx) / 2 * s, oy = (y0 + y1) / 2 - (mny + mxy) / 2 * s;
  return pts.map((p) => [p[0] * s + ox, p[1] * s + oy]);
}
function ring(n, rx, ry, a0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = a0 + i * 2 * Math.PI / n; out.push([50 + Math.cos(a) * rx, 50 + Math.sin(a) * ry]); }
  return out;
}
function scaleAbout(pts, cx, cy, k) { return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]); }

/* outlines in a 100 x 100 box; each returns { o: outer points, t: table points } */
const CUTS = {
  round() { const o = ring(10, 44, 44, -Math.PI / 2 + Math.PI / 10); return { o, t: scaleAbout(o, 50, 50, 0.52) }; },
  oval() { const o = ring(12, 32, 45, -Math.PI / 2); return { o, t: scaleAbout(o, 50, 50, 0.5) }; },
  cushion() { const o = [[22, 8], [78, 8], [92, 22], [92, 78], [78, 92], [22, 92], [8, 78], [8, 22]]; return { o, t: scaleAbout(o, 50, 50, 0.56) }; },
  hex() { const o = ring(6, 45, 45, -Math.PI / 2); return { o, t: scaleAbout(o, 50, 50, 0.52) }; },
  drop() {
    const raw = [];
    for (let i = 0; i < 14; i++) { const t = i * 2 * Math.PI / 14; raw.push([Math.sin(t) * Math.sin(t / 2), -Math.cos(t)]); }
    const o = fitBox(raw, 10, 5, 90, 95);
    return { o, t: scaleAbout(o, 50, 64, 0.5) };
  },
  heart() {
    const raw = [];
    for (let i = 0; i < 18; i++) {
      const t = i * 2 * Math.PI / 18;
      raw.push([16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
    }
    const o = fitBox(raw, 6, 10, 94, 92);
    return { o, t: scaleAbout(o, 50, 46, 0.5) };
  }
};
export const GEM_CUTS = Object.keys(CUTS);
/* sapphire, rose, amethyst, aqua, orchid, ice */
export const GEM_COLORS = ['#4A86FF', '#FF7FC2', '#9A7BFF', '#2FC4D6', '#B45FE0', '#8CD6F7'];

export function gemSVG(cut, color) {
  const g = (CUTS[cut] || CUTS.round)(), o = g.o, t = g.t, n = o.length;
  let cx = 0, cy = 0;
  for (const p of o) { cx += p[0]; cy += p[1]; }
  cx /= n; cy /= n;
  const LA = -0.75 * Math.PI; /* light from the top left */
  let facets = '';
  for (let i = 0; i < n; i++) {
    const a = o[i], b = o[(i + 1) % n], c = t[(i + 1) % n], d = t[i];
    const th = Math.atan2((a[1] + b[1]) / 2 - cy, (a[0] + b[0]) / 2 - cx);
    const lit = Math.cos(th - LA);
    const tone = (x) => (x > 0 ? mix(color, '#ffffff', 0.1 + 0.5 * x) : shade(color, 0.4 * x));
    /* each side split into two triangles of slightly different tone = sparkly facets */
    facets += '<path d="' + poly([a, b, c]) + '" fill="' + tone(lit + 0.1) + '"/>' +
      '<path d="' + poly([a, c, d]) + '" fill="' + tone(lit - 0.12) + '"/>';
  }
  let lines = '';
  for (let i = 0; i < n; i++) lines += 'M' + f1(o[i][0]) + ' ' + f1(o[i][1]) + 'L' + f1(t[i][0]) + ' ' + f1(t[i][1]);
  const tc = t.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
  const hi = scaleAbout(t, tc[0], tc[1], 0.45).map((p) => [p[0] - 6, p[1] - 6]);
  return '<svg viewBox="0 0 100 100"' + SVG0 + '>' + facets +
    '<path d="' + poly(t) + '" fill="' + mix(color, '#ffffff', 0.42) + '"/>' +
    '<path d="' + poly(hi) + '" fill="#ffffff" opacity=".42"/>' +
    '<path d="' + lines + '" stroke="#ffffff" stroke-opacity=".45" stroke-width="1"/>' +
    '<path d="' + poly(t) + '" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2"/>' +
    '<path d="' + poly(o) + '" fill="none" stroke="' + shade(color, -0.4) + '" stroke-width="2.6" stroke-linejoin="round"/>' +
    '<path d="' + sparkD(t[0][0] - 2, t[0][1] + 4, 8) + '" fill="#ffffff"/></svg>';
}

/* ---------- 6 crown (viewBox 400 x 262). Sockets in fill order; gems are HTML overlays. ---------- */
export const CROWN_VB = [400, 262];
export const CROWN_SOCKETS = [
  { x: 122, y: 214, r: 20 }, { x: 278, y: 214, r: 20 }, { x: 200, y: 217, r: 20 },
  { x: 114, y: 132, r: 19 }, { x: 286, y: 132, r: 19 }, { x: 200, y: 108, r: 26 }
];
export function crownSVG() {
  const id = uid('cr');
  const body = 'M44 186 L30 92 Q78 128 112 64 Q150 126 200 18 Q250 126 288 64 Q322 128 370 92 L356 186 Z';
  const band = 'M36 174 Q200 202 364 174 L356 232 Q200 262 44 232 Z';
  let pearls = '';
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = (1 - t) * (1 - t) * 50 + 2 * t * (1 - t) * 200 + t * t * 350, y = (1 - t) * (1 - t) * 238 + 2 * t * (1 - t) * 262 + t * t * 238;
    pearls += '<circle cx="' + f1(x) + '" cy="' + f1(y - 6) + '" r="3.6"/>';
  }
  let sockets = '';
  for (const s of CROWN_SOCKETS) {
    sockets += '<circle cx="' + s.x + '" cy="' + s.y + '" r="' + (s.r + 5) + '" fill="url(#' + id + 'r)" stroke="#8C7DD0" stroke-width="2.4"/>' +
      '<circle cx="' + s.x + '" cy="' + s.y + '" r="' + s.r + '" fill="url(#' + id + 'w)"/>';
  }
  const tip = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + id + 'p)" stroke="#9C8FD6" stroke-width="1.8"/>';
  return '<svg viewBox="0 0 400 262"' + SVG0 + '><defs>' +
    lg(id + 'b', '0', '0', '0', '1', [[0, '#FFFFFF'], [0.45, '#ECE6FF'], [1, '#C4B5F2']]) +
    lg(id + 'd', '0', '0', '0', '1', [[0, '#E9E2FF'], [0.5, '#D3C6F6'], [1, '#A897E0']]) +
    lg(id + 'r', '0', '0', '0', '1', [[0, '#FFFFFF'], [1, '#C9C0EA']]) +
    rg(id + 'w', '.45', '.4', '.65', [[0, '#F3F0FF'], [1, '#B9AEE3']]) +
    rg(id + 'p', '.35', '.3', '.7', [[0, '#FFFFFF'], [0.6, '#F1EEFF'], [1, '#C9C0EA']]) + '</defs>' +
    '<ellipse cx="200" cy="252" rx="170" ry="9" fill="#2F6FE0" opacity=".1"/>' +
    '<path d="' + body + '" fill="url(#' + id + 'b)" stroke="#8C7DD0" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M60 178 L52 114 Q86 142 114 92 Q152 148 200 50 Q248 148 286 92 Q314 142 348 114 L340 178" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity=".9" stroke-linejoin="round"/>' +
    '<path d="' + band + '" fill="url(#' + id + 'd)" stroke="#8C7DD0" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M48 184 Q200 211 352 184" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity=".85"/>' +
    '<g fill="#ffffff" stroke="#A99BDE" stroke-width="1">' + pearls + '</g>' +
    tip(30, 90, 9) + tip(112, 62, 10) + tip(288, 62, 10) + tip(370, 90, 9) +
    '<path d="' + sparkD(200, 16, 22) + '" fill="#ffffff" stroke="#7FD3F2" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="' + sparkD(200, 16, 9) + '" fill="#BFE6FF"/>' +
    sockets +
    '<path d="' + sparkD(64, 152, 6) + '" fill="#fff"/><path d="' + sparkD(336, 152, 6) + '" fill="#fff"/>' +
    '<path d="' + sparkD(160, 168, 4.5) + '" fill="#fff"/><path d="' + sparkD(240, 168, 4.5) + '" fill="#fff"/></svg>';
}

/* ---------- 7 ice palace (viewBox 400 x 440): domes + crescents, 8 windows ---------- */
export const PALACE_VB = [400, 440];
/* type: 'arch' (pointed arch) or 'round'; order = index for data-i */
export const PALACE_WINDOWS = [
  { x: 65, y: 236, w: 42, h: 64, type: 'arch' }, { x: 335, y: 236, w: 42, h: 64, type: 'arch' },
  { x: 136, y: 290, w: 36, h: 62, type: 'arch' }, { x: 264, y: 290, w: 36, h: 62, type: 'arch' },
  { x: 65, y: 330, w: 42, h: 64, type: 'arch' }, { x: 335, y: 330, w: 42, h: 64, type: 'arch' },
  { x: 200, y: 280, w: 50, h: 80, type: 'arch' }, { x: 200, y: 168, w: 40, h: 40, type: 'round' }
];
function archD(cx, cy, w, h) {
  const l = cx - w / 2, r = cx + w / 2, b = cy + h / 2, top = cy - h / 2, sp = top + w * 0.62;
  return 'M' + f1(l) + ' ' + f1(b) + ' L' + f1(l) + ' ' + f1(sp) + ' Q' + f1(l) + ' ' + f1(top + w * 0.12) + ' ' + f1(cx) + ' ' + f1(top) +
    ' Q' + f1(r) + ' ' + f1(top + w * 0.12) + ' ' + f1(r) + ' ' + f1(sp) + ' L' + f1(r) + ' ' + f1(b) + ' Z';
}
function crescent(id, cx, cy, R) {
  return '<mask id="' + id + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#fff"/>' +
    '<circle cx="' + f1(cx + R * 0.45) + '" cy="' + f1(cy - R * 0.2) + '" r="' + f1(R * 0.82) + '" fill="#000"/></mask>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#FFE7A3" stroke="#D9AE4E" stroke-width="1.5" mask="url(#' + id + ')"/>';
}
function onion(cx, base, w, h) {
  const l = cx - w / 2, r = cx + w / 2, top = base - h;
  return 'M' + l + ' ' + base + ' C' + f1(l - w * 0.08) + ' ' + f1(base - h * 0.45) + ' ' + f1(cx - w * 0.2) + ' ' + f1(base - h * 0.62) + ' ' + cx + ' ' + top +
    ' C' + f1(cx + w * 0.2) + ' ' + f1(base - h * 0.62) + ' ' + f1(r + w * 0.08) + ' ' + f1(base - h * 0.45) + ' ' + r + ' ' + base + ' Z';
}
export function palaceSVG() {
  const id = uid('pa');
  const W1 = 'url(#' + id + 'w)', DM = 'url(#' + id + 'd)', ST = '#A9BEDF';
  let halos = '', wins = '';
  PALACE_WINDOWS.forEach((w, i) => {
    const d = w.type === 'round' ? null : archD(w.x, w.y, w.w, w.h);
    const shape = (cls, extra) => d ? '<path class="' + cls + '" d="' + d + '"' + extra + '/>'
      : '<circle class="' + cls + '" cx="' + w.x + '" cy="' + w.y + '" r="' + (w.w / 2) + '"' + extra + '/>';
    const frame = d ? '<path d="' + archD(w.x, w.y + 1, w.w + 10, w.h + 10) + '" fill="#ffffff" stroke="' + ST + '" stroke-width="2"/>'
      : '<circle cx="' + w.x + '" cy="' + w.y + '" r="' + (w.w / 2 + 5) + '" fill="#ffffff" stroke="' + ST + '" stroke-width="2"/>';
    const lattice = d
      ? '<path d="M' + w.x + ' ' + f1(w.y - w.h / 2 + 4) + ' V' + f1(w.y + w.h / 2) + ' M' + f1(w.x - w.w / 2) + ' ' + f1(w.y + w.h * 0.1) + ' H' + f1(w.x + w.w / 2) + '" class="pw-bar"/>'
      : '<path d="M' + f1(w.x - w.w / 2) + ' ' + w.y + ' H' + f1(w.x + w.w / 2) + ' M' + w.x + ' ' + f1(w.y - w.w / 2) + ' V' + f1(w.y + w.w / 2) + '" class="pw-bar"/>';
    halos += '<ellipse class="pw-halo" data-i="' + i + '" cx="' + w.x + '" cy="' + w.y + '" rx="' + f1(w.w * 1.25) + '" ry="' + f1(w.h * 0.95) + '" fill="url(#' + id + 'h)"/>';
    wins += '<g class="pw" data-i="' + i + '">' + frame +
      shape('pw-glass', ' fill="url(#' + id + 'g)"') + shape('pw-lit', ' fill="url(#' + id + 'l)"') + lattice +
      '<path class="pw-spark" d="' + sparkD(w.x + w.w * 0.18, w.y - w.h * 0.12, Math.min(w.w, w.h) * 0.2) + '" fill="#ffffff"/></g>';
  });
  return '<svg viewBox="0 0 400 440"' + SVG0 + '><defs>' +
    lg(id + 'w', '0', '0', '0', '1', [[0, '#FFFFFF'], [0.6, '#EEF6FF'], [1, '#D3E6FA']]) +
    lg(id + 'd', '0', '0', '1', '1', [[0, '#F1EBFF'], [0.55, '#CDBEF7'], [1, '#A592E6']]) +
    lg(id + 'g', '0', '0', '0', '1', [[0, '#D9E7F8'], [1, '#B4C8E8']]) +
    rg(id + 'l', '.5', '.6', '.7', [[0, '#FFFDF0'], [0.45, '#FFE7A3'], [1, '#FFC46B']]) +
    rg(id + 'h', '.5', '.5', '.5', [[0, '#FFD98A', 0.85], [0.5, '#FFE7A3', 0.35], [1, '#FFE7A3', 0]]) +
    lg(id + 'i', '0', '0', '0', '1', [[0, '#FFFFFF'], [1, '#CFE3F7']]) + '</defs>' +
    /* soft ground shadow + icy steps */
    '<ellipse cx="200" cy="430" rx="196" ry="10" fill="#2F6FE0" opacity=".1"/>' +
    '<rect x="2" y="410" width="396" height="24" rx="12" fill="url(#' + id + 'i)" stroke="' + ST + '" stroke-width="2"/>' +
    '<rect x="16" y="394" width="368" height="22" rx="10" fill="url(#' + id + 'i)" stroke="' + ST + '" stroke-width="2"/>' +
    /* side towers */
    '<rect x="22" y="182" width="86" height="216" rx="6" fill="' + W1 + '" stroke="' + ST + '" stroke-width="2.4"/>' +
    '<rect x="292" y="182" width="86" height="216" rx="6" fill="' + W1 + '" stroke="' + ST + '" stroke-width="2.4"/>' +
    '<rect x="16" y="172" width="98" height="16" rx="6" fill="#ffffff" stroke="' + ST + '" stroke-width="2.4"/>' +
    '<rect x="286" y="172" width="98" height="16" rx="6" fill="#ffffff" stroke="' + ST + '" stroke-width="2.4"/>' +
    '<path d="' + onion(65, 174, 78, 74) + '" fill="' + DM + '" stroke="#8F7FD0" stroke-width="2.4"/>' +
    '<path d="' + onion(335, 174, 78, 74) + '" fill="' + DM + '" stroke="#8F7FD0" stroke-width="2.4"/>' +
    '<path d="M48 160 Q52 132 64 116" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M318 160 Q322 132 334 116" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M65 100 V86 M335 100 V86" stroke="#D9AE4E" stroke-width="3" stroke-linecap="round"/>' +
    crescent(id + 'c1', 65, 76, 10) + crescent(id + 'c2', 335, 76, 10) +
    /* main hall + drum + big dome */
    '<rect x="104" y="214" width="192" height="184" rx="4" fill="' + W1 + '" stroke="' + ST + '" stroke-width="2.4"/>' +
    '<rect x="98" y="204" width="204" height="16" rx="6" fill="#ffffff" stroke="' + ST + '" stroke-width="2.4"/>' +
    '<path d="' + onion(200, 206, 168, 156) + '" fill="' + DM + '" stroke="#8F7FD0" stroke-width="2.6"/>' +
    '<path d="M140 190 Q146 128 196 72" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".75"/>' +
    '<path d="M200 50 V28" stroke="#D9AE4E" stroke-width="3.4" stroke-linecap="round"/>' +
    crescent(id + 'c3', 200, 18, 13) +
    /* door (decor) */
    '<path d="' + archD(200, 366, 50, 60) + '" fill="#E7DEFF" stroke="#9C8FD6" stroke-width="2.4"/>' +
    '<path d="M200 352 V396" stroke="#9C8FD6" stroke-width="2"/>' +
    /* one small diamond on the arch (two round knobs side by side read as a pair of eyes) */
    '<path d="M200 340 L204 345.5 L200 351 L196 345.5 Z" fill="#9C8FD6"/>' +
    /* icicle trims */
    '<path d="M104 220 l6 10 l6 -10 l6 12 l6 -12 l6 9 l6 -9 M278 220 l6 10 l6 -10" fill="none" stroke="#BFE6FF" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<g class="pw-halos">' + halos + '</g>' + wins +
    /* frosty sparkles on the walls */
    '<path d="' + sparkD(40, 286, 5) + '" fill="#fff"/><path d="' + sparkD(360, 290, 5) + '" fill="#fff"/>' +
    '<path d="' + sparkD(126, 380, 4) + '" fill="#fff"/><path d="' + sparkD(276, 380, 4) + '" fill="#fff"/></svg>';
}

/* ---------- 7 crescent moon for the palace sky (viewBox 100 x 100) ---------- */
export function moonSVG() {
  const id = uid('mo');
  return '<svg viewBox="0 0 100 100"' + SVG0 + '><defs>' +
    rg(id + 'g', '.4', '.4', '.7', [[0, '#FFFBEA'], [1, '#FFE29A']]) +
    '<mask id="' + id + 'm"><circle cx="50" cy="52" r="34" fill="#fff"/><circle cx="66" cy="42" r="29" fill="#000"/></mask></defs>' +
    '<circle cx="50" cy="52" r="34" fill="url(#' + id + 'g)" stroke="#E7BE62" stroke-width="2" mask="url(#' + id + 'm)"/>' +
    '<path d="' + sparkD(80, 72, 8) + '" fill="#fff"/><path d="' + sparkD(88, 20, 5) + '" fill="#fff"/></svg>';
}

/* ---------- 5 light palace silhouette for the aurora sky (viewBox 400 x 90) ---------- */
export function skylineSVG() {
  const c = (cx, cy, R) => {
    const id = uid('sc');
    return '<mask id="' + id + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#fff"/><circle cx="' + f1(cx + R * 0.45) + '" cy="' + f1(cy - R * 0.2) + '" r="' + f1(R * 0.82) + '" fill="#000"/></mask>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#FFF3C8" mask="url(#' + id + ')"/>';
  };
  return '<svg class="mg-skyline" viewBox="0 0 400 90" preserveAspectRatio="xMidYMax meet"' + SVG0 + '>' +
    '<path fill="#FFFFFF" stroke="#B9C8E8" stroke-width="1.2" d="M0 90 V72 Q50 64 104 70 T214 68 T320 66 T400 72 V90 Z' +
    ' M150 90 V58 H232 V90 Z M160 58 C158 44 176 38 191 25 C206 38 224 44 222 58 Z' +
    ' M132 90 V36 H148 V90 Z M131 36 C131 30 136 27 140 21 C144 27 149 30 149 36 Z' +
    ' M236 90 V42 H250 V90 Z M235 42 C235 37 239 34 243 29 C247 34 251 37 251 42 Z' +
    ' M40 90 V64 H74 V90 Z M46 64 C46 58 52 55 57 49 C62 55 68 58 68 64 Z' +
    ' M300 90 V60 H340 V90 Z M306 60 C306 53 314 49 320 42 C326 49 334 53 334 60 Z"/>' +
    c(191, 17, 5) + c(140, 15, 3.5) + c(243, 23, 3.5) +
    '<path fill="#FFD98A" d="M185 74 h12 v16 h-12 Z M52 74 h10 v10 h-10 Z M314 72 h12 v10 h-12 Z M137 52 h6 v9 h-6 Z M240 56 h6 v9 h-6 Z"/></svg>';
}
