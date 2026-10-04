/* Suuraseikkailu v3 – art/soft.js: the PREMIUM soft look (clay / 3D-lite): palettes, gradients, soft coloured
   shadows, glows, clouds, sparkles, and the colour mappers. OWNER: art agent.
   No outlines, no halftone, no comic shapes: depth comes from gradients, inner highlights and soft shadows. */
import { f, isHex, mix, sparklePath, starPath } from './common.js';

export const INK = '#24324F';
export const G = {
  coral: '#FF7A9A', rose: '#FFB3C7', lavender: '#B9A4FF', peach: '#FFC9A8', mint: '#8EE3C8', gold: '#FFD36E', cream: '#FFF8F1'
};
export const B = {
  sky: '#5AB4FF', blue: '#2F6BFF', yellow: '#FFD54A', tangerine: '#FF9A3C', teal: '#2EC4B6', red: '#FF5A5F', cream: '#F5FAFF'
};

/* colour mappers: every motif routes its colours through c(), so one drawing serves both states */
export const keep = (c) => c;
function hexRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// "not earned yet": soft, light, desaturated (a faint hint of the original hue stays)
export function ghost(c) {
  if (!isHex(c)) return c;
  const [r, g, b] = hexRgb(c);
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  const v = Math.round(206 + (L / 255) * 42);
  const gr = '#' + [v - 3, v - 1, v + 4].map((x) => Math.min(255, x).toString(16).padStart(2, '0')).join('');
  return mix(c, gr, 0.78);
}

/* gradients / filters (ids must be unique per instance: pass uid()-based ids) */
export const stops = (l, c) => l.map((s) => '<stop offset="' + s[0] + '" stop-color="' + (c ? c(s[1]) : s[1]) + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('');
// linear, objectBoundingBox (default top → bottom)
export function lg(id, l, c, x1, y1, x2, y2) {
  return '<linearGradient id="' + id + '" x1="' + (x1 || 0) + '" y1="' + (y1 || 0) + '" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' + stops(l, c) + '</linearGradient>';
}
// linear in user space
export function lgU(id, l, c, x1, y1, x2, y2) {
  return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '">' + stops(l, c) + '</linearGradient>';
}
// radial "clay" light from the upper left
export function rg(id, l, c, cx, cy, r) {
  return '<radialGradient id="' + id + '" cx="' + (cx == null ? 0.36 : cx) + '" cy="' + (cy == null ? 0.3 : cy) + '" r="' + (r || 0.85) + '">' + stops(l, c) + '</radialGradient>';
}
export function rgU(id, l, c, cx, cy, r) {
  return '<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '">' + stops(l, c) + '</radialGradient>';
}
export function drop(id, color, dy, blur, op) {
  return '<filter id="' + id + '" x="-40%" y="-40%" width="180%" height="190%" color-interpolation-filters="sRGB">' +
    '<feDropShadow dx="0" dy="' + f(dy) + '" stdDeviation="' + f(blur) + '" flood-color="' + color + '" flood-opacity="' + op + '"/></filter>';
}
export function blur(id, s) {
  return '<filter id="' + id + '" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="' + f(s) + '"/></filter>';
}
export const u = (id) => 'url(#' + id + ')';

// clay ramp from one base colour: light top-left → base → slightly deeper edge
export function clay(id, base, c, cx, cy) {
  return rg(id, [[0, mix(base, '#FFFFFF', 0.55)], [0.55, base], [1, mix(base, INK, 0.12)]], c, cx, cy, 0.9);
}
export function fade(id, base, c, dir) {
  const h = dir === 'h';
  return lg(id, [[0, mix(base, '#FFFFFF', 0.4)], [1, base]], c, 0, 0, h ? 1 : 0, h ? 0 : 1);
}

/* little soft things */
export function cloud(x, y, s, fill) {
  const k = s || 1;
  return '<g fill="' + (fill || '#FFFFFF') + '">' +
    '<ellipse cx="' + f(x) + '" cy="' + f(y + 14 * k) + '" rx="' + f(66 * k) + '" ry="' + f(22 * k) + '"/>' +
    '<circle cx="' + f(x - 30 * k) + '" cy="' + f(y + 2 * k) + '" r="' + f(25 * k) + '"/>' +
    '<circle cx="' + f(x + 4 * k) + '" cy="' + f(y - 12 * k) + '" r="' + f(34 * k) + '"/>' +
    '<circle cx="' + f(x + 38 * k) + '" cy="' + f(y + 4 * k) + '" r="' + f(23 * k) + '"/></g>';
}
export function twinkle(x, y, r, col, d, anim) {
  return '<path' + (anim === false ? '' : ' class="art-tw" style="--art-d:' + d + 's"') + ' d="' + sparklePath(x, y, r) + '" fill="' + col + '"/>';
}
// rounded 5-point star (same-colour stroke rounds the tips)
export function softStar(x, y, r, fill, d, anim) {
  return '<path' + (anim === false ? '' : ' class="art-tw" style="--art-d:' + d + 's"') + ' d="' + starPath(x, y, r, r * 0.52, 5) + '" fill="' + fill + '" stroke="' + fill + '" stroke-width="' + f(r * 0.35) + '" stroke-linejoin="round"/>';
}
export function flower(x, y, k, petal, mid) {
  let s = '<g transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(k) + ')">';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
    s += '<circle cx="' + f(Math.cos(a) * 8) + '" cy="' + f(Math.sin(a) * 8) + '" r="7" fill="' + (petal || '#FFFFFF') + '"/>';
  }
  return s + '<circle r="5.5" fill="' + (mid || G.gold) + '"/></g>';
}
// soft round puff (smoke) – needs a radial gradient id
export function puff(x, y, r, grad, d) {
  return '<circle class="art-puff" style="--art-d:' + d + 's" cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + u(grad) + '"/>';
}

// place native-coordinate art (box = [x, y, w, h]) centred on (cx, cy) fitting `size` (largest side)
export function fit(inner, box, cx, cy, size, rot) {
  const s = size / Math.max(box[2], box[3]);
  return '<g transform="translate(' + f(cx) + ' ' + f(cy) + ')' + (rot ? ' rotate(' + f(rot) + ')' : '') + ' scale(' + f(Math.round(s * 10000) / 10000) + ') translate(' +
    f(-(box[0] + box[2] / 2)) + ' ' + f(-(box[1] + box[3] / 2)) + ')">' + inner + '</g>';
}
