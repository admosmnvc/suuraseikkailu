/* Boy minigame art – soft "clay / 3D-lite" SVG strings: chunky rounded shapes, gentle gradients, inner highlights,
   soft shadows. NO black outlines, NO halftone (CONTRACTS brief 1). OWNER: games-boy.
   Vehicles have friendly eyes on the windscreen; no humans anywhere. Palette: sky #5AB4FF, deep blue #2F6BFF,
   yellow #FFD54A, tangerine #FF9A3C, teal #2EC4B6, red #FF5A5F, cream #F5FAFF, ink #24324F. */
export const INK = '#24324F';
const NAVY = '#24324F';
let uid = 0;
const nid = (p) => 'bx' + p + (++uid);

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/* mix two hex colours, t 0..1 towards b */
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const light = (c, t) => mix(c, '#FFFFFF', t);
const dark = (c, t) => mix(c, NAVY, t);
function lin(id, stops, x2, y2) {
  return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' +
    stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
}
function rad(id, cx, cy, r, stops) {
  return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">' +
    stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</radialGradient>';
}
/* soft ground shadow ellipse */
function shadow(id, cx, cy, rx, ry, a) {
  return '<defs>' + rad(id, 0.5, 0.5, 0.5, [[0, NAVY, a || 0.22], [1, NAVY, 0]]) + '</defs>' +
    '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + id + ')"/>';
}

export const CAR_COLORS = [
  { body: '#FF5A5F', stripe: '#FFFFFF' },
  { body: '#2F6BFF', stripe: '#FFD54A' },
  { body: '#FFD54A', stripe: '#FF9A3C' },
  { body: '#2EC4B6', stripe: '#FFFFFF' },
  { body: '#FF9A3C', stripe: '#FFFFFF' },
  { body: '#5AB4FF', stripe: '#FFFFFF' }
];

/* friendly eyes: open (pupils in .bx-pupil, move with translate) + happy arcs (shown under .happy) */
function eyes(id, x1, y1, x2, y2, r) {
  const e = (x, y) =>
    '<g class="bx-eye-open"><ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 1.15).toFixed(1) + '" fill="url(#' + id + 'w)"/>' +
    '<g class="bx-pupil"><circle cx="' + (x + r * 0.2).toFixed(1) + '" cy="' + (y + r * 0.12).toFixed(1) + '" r="' + (r * 0.55).toFixed(1) + '" fill="' + NAVY + '"/>' +
    '<circle cx="' + (x + r * 0.38).toFixed(1) + '" cy="' + (y - r * 0.12).toFixed(1) + '" r="' + (r * 0.2).toFixed(1) + '" fill="#fff"/></g></g>' +
    '<path class="bx-eye-happy" d="M' + (x - r) + ' ' + (y + r * 0.25) + 'Q' + x + ' ' + (y - r * 1.1) + ' ' + (x + r) + ' ' + (y + r * 0.25) +
    '" fill="none" stroke="' + NAVY + '" stroke-width="' + (r * 0.42).toFixed(1) + '" stroke-linecap="round"/>';
  return '<defs>' + rad(id + 'w', 0.4, 0.35, 0.7, [[0, '#FFFFFF'], [0.7, '#FFFFFF'], [1, '#DCE6F5']]) + '</defs>' + e(x1, y1) + e(x2, y2);
}

/* Wheel, viewBox -50 -50 100 100. kind: 'normal' | 'flat' | 'new'. bolts: draw the 4 bolt heads (nuts are separate). */
export function wheelSVG(kind, bolts) {
  const id = nid('w'), flat = kind === 'flat', shiny = kind === 'new', oy = flat ? 4 : 0;
  const rim = shiny ? ['#FFF0A8', '#FFC21F'] : (flat ? ['#E9EDF5', '#AEB9CD'] : ['#FFFFFF', '#C3CEE0']);
  let s = '<defs>' + rad(id + 't', 0.4, 0.32, 0.75, [[0, shiny ? '#56668A' : '#5A6683'], [1, shiny ? '#26324F' : '#313C58']]) +
    rad(id + 'r', 0.38, 0.32, 0.75, [[0, rim[0]], [1, rim[1]]]) + rad(id + 'h', 0.4, 0.35, 0.7, [[0, '#FFFFFF'], [1, '#D3DBEA']]) + '</defs>';
  s += flat
    ? '<path d="M-44 14C-50 -14 -32 -44 0 -45C32 -44 50 -14 44 14C40 30 30 38 18 40L-18 40C-30 38 -40 30 -44 14Z" fill="url(#' + id + 't)"/>'
    : '<circle r="46" fill="url(#' + id + 't)"/><circle r="39" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="5" stroke-dasharray="6 7"/>';
  s += '<circle r="29" cy="' + oy + '" fill="url(#' + id + 'r)"/>' +
    '<circle r="29" cy="' + oy + '" fill="none" stroke="#24324F" stroke-opacity=".12" stroke-width="3"/>' +
    '<circle r="10" cy="' + oy + '" fill="url(#' + id + 'h)"/>';
  if (bolts) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      s += '<circle cx="' + (Math.cos(a) * 17).toFixed(1) + '" cy="' + (Math.sin(a) * 17 + oy).toFixed(1) + '" r="4.2" fill="' + (shiny ? '#E0A400' : '#8E9AB4') + '"/>';
    }
  }
  s += '<path d="M-30 -32A44 44 0 0 1 2 -43" fill="none" stroke="#fff" stroke-opacity="' + (shiny ? '.55' : '.22') + '" stroke-width="6" stroke-linecap="round"/>';
  if (shiny) s += '<path d="M33 -38q2 7 8 9q-6 2 -8 9q-2 -7 -8 -9q6 -2 8 -9z" fill="#fff"/>';
  if (flat) s += '<path d="M-24 35Q-34 46 -46 42M24 35Q34 46 46 42" fill="none" stroke="#313C58" stroke-width="5" stroke-linecap="round"/>';
  return '<svg viewBox="-50 -50 100 100" aria-hidden="true">' + s + '</svg>';
}

/* hex nut, viewBox -20 -20 40 40 */
export function nutSVG() {
  const id = nid('n');
  let d = '';
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; d += (i ? 'L' : 'M') + (Math.cos(a) * 16).toFixed(1) + ' ' + (Math.sin(a) * 16).toFixed(1); }
  return '<svg viewBox="-20 -20 40 40" aria-hidden="true"><defs>' + lin(id, [[0, '#FFFFFF'], [1, '#B4C0D6']], 1, 1) + lin(id + 'i', [[0, '#9AA7C0'], [1, '#6F7D9B']], 1, 1) + '</defs>' +
    '<path d="' + d + 'Z" fill="url(#' + id + ')" stroke="#C9D3E4" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle r="6.5" fill="url(#' + id + 'i)"/><path d="M-10 -8L-4 -12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
}

/* Side-view car body, viewBox 0 0 400 200, facing right. Wheels are separate (centres at x 100 / 300, y 182, box 92).
   opts: { color: CAR_COLORS[i], hubs: true (draw brake hubs under the wheels) } */
export function carSideSVG(opts) {
  const o = opts || {}, c = o.color || CAR_COLORS[0], b = c.body, id = nid('c');
  const body = 'M34 182L366 182Q392 182 392 158L392 142Q392 122 370 118L324 110L294 72Q284 58 266 58L150 58Q134 58 124 70L96 110L44 116Q16 120 14 144L14 160Q14 182 34 182Z';
  let s = '<defs>' + lin(id + 'b', [[0, light(b, 0.32)], [0.45, b], [1, dark(b, 0.22)]]) +
    lin(id + 'g', [[0, '#E6F5FF'], [1, '#8FCBFF']], 0.3, 1) + lin(id + 'k', [[0, dark(b, 0.55)], [1, dark(b, 0.75)]]) +
    rad(id + 'l', 0.5, 0.5, 0.5, [[0, '#FFFBE0'], [0.6, '#FFE27A'], [1, '#FFE27A', 0]]) + '</defs>';
  s += shadow(id + 's', 200, 226, 178, 11, 0.2);
  s += '<path d="' + body + '" fill="url(#' + id + 'b)"/>' +
    '<path d="M18 132Q200 124 390 132L390 140Q200 132 16 140Z" fill="' + c.stripe + '" opacity=".9"/>' +
    '<path d="M46 182A54 54 0 0 1 154 182ZM246 182A54 54 0 0 1 354 182Z" fill="url(#' + id + 'k)"/>';
  if (o.hubs) {
    for (const x of [100, 300]) {
      s += '<circle cx="' + x + '" cy="182" r="40" fill="' + dark(b, 0.8) + '"/><circle cx="' + x + '" cy="182" r="24" fill="#9AA6BF"/><circle cx="' + x + '" cy="182" r="9" fill="#C9D3E4"/>';
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; s += '<circle cx="' + (x + Math.cos(a) * 15.6).toFixed(1) + '" cy="' + (182 + Math.sin(a) * 15.6).toFixed(1) + '" r="3.8" fill="#E6EBF3"/>'; }
    }
  }
  s += '<path d="M138 106L158 76Q162 70 170 70L202 70Q206 70 206 74L206 102Q206 106 202 106Z" fill="url(#' + id + 'g)"/>' +
    '<path d="M218 70L262 70Q270 70 276 77L300 106L222 108Q218 108 218 104Z" fill="url(#' + id + 'g)"/>' +
    '<path d="M226 76L240 76L228 100Z" fill="#fff" opacity=".55"/><path d="M146 100L162 78L170 78L152 100Z" fill="#fff" opacity=".5"/>' +
    eyes(id + 'e', 244, 90, 276, 92, 11.5) +
    '<path d="M212 66V176" stroke="' + dark(b, 0.25) + '" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="178" y="118" width="22" height="7" rx="3.5" fill="' + light(b, 0.55) + '"/>' +
    '<circle cx="380" cy="134" r="16" fill="url(#' + id + 'l)"/><circle cx="380" cy="134" r="7" fill="#FFF6C2"/>' +
    '<rect x="12" y="126" width="9" height="16" rx="4.5" fill="#FF8A8E"/>' +
    '<path d="M364 158Q375 166 386 158" fill="none" stroke="' + NAVY + '" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M140 66Q200 60 266 62" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".45"/>' +
    '<path d="M40 122Q60 116 92 114" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>';
  return '<svg viewBox="0 0 400 200" aria-hidden="true" overflow="visible">' + s + '</svg>';
}

/* Top-view car, viewBox 0 0 100 160, pointing up. */
export function carTopSVG(color) {
  const c = color || CAR_COLORS[0], b = c.body, id = nid('t');
  return '<svg viewBox="0 0 100 160" aria-hidden="true" overflow="visible"><defs>' +
    lin(id + 'b', [[0, light(b, 0.3)], [0.5, b], [1, dark(b, 0.18)]], 1, 0.4) + lin(id + 'g', [[0, '#E6F5FF'], [1, '#8FCBFF']]) +
    rad(id + 'w', 0.4, 0.35, 0.7, [[0, '#FFFFFF'], [1, '#DCE6F5']]) + rad(id + 's', 0.5, 0.5, 0.5, [[0, NAVY, 0.25], [1, NAVY, 0]]) + '</defs>' +
    '<ellipse cx="54" cy="86" rx="52" ry="80" fill="url(#' + id + 's)"/>' +
    '<rect x="3" y="28" width="15" height="30" rx="7" fill="#3A4766"/><rect x="82" y="28" width="15" height="30" rx="7" fill="#3A4766"/>' +
    '<rect x="3" y="104" width="15" height="32" rx="7" fill="#3A4766"/><rect x="82" y="104" width="15" height="32" rx="7" fill="#3A4766"/>' +
    '<rect x="10" y="6" width="80" height="148" rx="28" fill="url(#' + id + 'b)"/>' +
    '<rect x="44" y="8" width="12" height="144" rx="6" fill="' + c.stripe + '" opacity=".85"/>' +
    '<path d="M20 50Q50 38 80 50L76 74Q50 68 24 74Z" fill="url(#' + id + 'g)"/>' +
    '<ellipse cx="38" cy="58" rx="8" ry="7" fill="url(#' + id + 'w)"/><circle cx="38" cy="56.5" r="4" fill="' + NAVY + '"/><circle cx="39.5" cy="55" r="1.4" fill="#fff"/>' +
    '<ellipse cx="62" cy="58" rx="8" ry="7" fill="url(#' + id + 'w)"/><circle cx="62" cy="56.5" r="4" fill="' + NAVY + '"/><circle cx="63.5" cy="55" r="1.4" fill="#fff"/>' +
    '<rect x="24" y="78" width="52" height="34" rx="12" fill="' + light(b, 0.18) + '"/>' +
    '<path d="M26 120Q50 128 74 120L76 134Q50 140 24 134Z" fill="url(#' + id + 'g)" opacity=".9"/>' +
    '<ellipse cx="25" cy="15" rx="8" ry="4.5" fill="#FFF3B0"/><ellipse cx="75" cy="15" rx="8" ry="4.5" fill="#FFF3B0"/>' +
    '<rect x="18" y="147" width="14" height="5" rx="2.5" fill="#FF8A8E"/><rect x="68" y="147" width="14" height="5" rx="2.5" fill="#FF8A8E"/>' +
    '<path d="M20 30Q22 14 40 10" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".5"/></svg>';
}

/* rounded 5-point star, viewBox 0 0 100 100 */
export const STAR_D = 'M50 7C53 7 55 9 56.5 12.5L64 29 82 31.5C89 32.5 91.5 40 86.5 45L73.5 57.5 76.5 75.5C77.5 82.5 71 87 65 84L50 75.5 35 84C29 87 22.5 82.5 23.5 75.5L26.5 57.5 13.5 45C8.5 40 11 32.5 18 31.5L36 29 43.5 12.5C45 9 47 7 50 7Z';
export function starSVG() {
  const id = nid('s');
  return '<svg viewBox="0 0 100 100" aria-hidden="true" overflow="visible"><defs>' + rad(id, 0.38, 0.3, 0.8, [[0, '#FFF6C8'], [0.45, '#FFD54A'], [1, '#FFB21F']]) +
    rad(id + 'g', 0.5, 0.5, 0.5, [[0, '#FFE27A', 0.55], [1, '#FFE27A', 0]]) + '</defs>' +
    '<circle cx="50" cy="52" r="56" fill="url(#' + id + 'g)"/><path d="' + STAR_D + '" fill="url(#' + id + ')"/>' +
    '<ellipse cx="40" cy="30" rx="8" ry="5" transform="rotate(-25 40 30)" fill="#fff" opacity=".8"/></svg>';
}

/* traffic cone, viewBox 0 0 100 110 */
export function coneSVG() {
  const id = nid('k');
  return '<svg viewBox="0 0 100 110" aria-hidden="true" overflow="visible"><defs>' + lin(id, [[0, '#FFC08A'], [0.5, '#FF9A3C'], [1, '#E9741E']], 1, 0) + '</defs>' +
    '<ellipse cx="52" cy="104" rx="46" ry="6" fill="#24324F" opacity=".14"/>' +
    '<rect x="8" y="86" width="84" height="16" rx="8" fill="#F08A35"/>' +
    '<path d="M40 8Q50 2 60 8L80 90H20Z" fill="url(#' + id + ')"/>' +
    '<path d="M31 40H69L74 62H26Z" fill="#fff" opacity=".95"/><path d="M44 12L32 70" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/></svg>';
}

/* scissor jack, viewBox 0 0 120 60 (scale Y to lift) */
export function jackSVG() {
  const id = nid('j');
  return '<svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true"><defs>' + lin(id, [[0, '#FFE27A'], [1, '#FFC21F']]) + '</defs>' +
    '<rect x="4" y="50" width="112" height="9" rx="4.5" fill="url(#' + id + ')"/>' +
    '<path d="M20 50L60 30L100 50M20 6L60 30L100 6" fill="none" stroke="#FF9A3C" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="60" cy="30" r="6" fill="#E9741E"/>' +
    '<rect x="30" y="0" width="60" height="8" rx="4" fill="url(#' + id + ')"/></svg>';
}

/* sponge (viewBox 0 0 100 70), shower head (0 0 100 100), polishing cloth (0 0 100 80) */
export function spongeSVG() {
  const id = nid('sp');
  return '<svg viewBox="0 0 100 70" aria-hidden="true"><defs>' + lin(id, [[0, '#FFE98A'], [1, '#FFC93A']]) + '</defs>' +
    '<rect x="6" y="10" width="88" height="54" rx="18" fill="url(#' + id + ')"/>' +
    '<circle cx="28" cy="30" r="6" fill="#F2B21E" opacity=".6"/><circle cx="58" cy="24" r="4" fill="#F2B21E" opacity=".6"/><circle cx="72" cy="44" r="7" fill="#F2B21E" opacity=".6"/><circle cx="40" cy="48" r="4.5" fill="#F2B21E" opacity=".6"/>' +
    '<path d="M18 20Q40 12 70 16" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/>' +
    '<circle cx="86" cy="10" r="9" fill="#fff" opacity=".9"/><circle cx="12" cy="62" r="6" fill="#fff" opacity=".9"/></svg>';
}
export function showerSVG() {
  const id = nid('sh');
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs>' + lin(id, [[0, '#8FD0FF'], [1, '#2F6BFF']]) + '</defs>' +
    '<path d="M60 96V60" stroke="#2F6BFF" stroke-width="12" stroke-linecap="round"/>' +
    '<path d="M22 58Q22 20 60 20Q98 20 98 58Z" fill="url(#' + id + ')"/>' +
    '<circle cx="38" cy="50" r="3.5" fill="#fff" opacity=".85"/><circle cx="52" cy="52" r="3.5" fill="#fff" opacity=".85"/><circle cx="66" cy="52" r="3.5" fill="#fff" opacity=".85"/><circle cx="80" cy="50" r="3.5" fill="#fff" opacity=".85"/>' +
    '<path d="M36 34Q46 26 58 27" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/></svg>';
}
export function clothSVG() {
  const id = nid('cl');
  return '<svg viewBox="0 0 100 80" aria-hidden="true"><defs>' + lin(id, [[0, '#FF8D90'], [1, '#FF5A5F']]) + '</defs>' +
    '<path d="M8 18Q30 6 52 16Q74 26 94 14L90 64Q70 76 48 66Q26 56 10 70Z" fill="url(#' + id + ')"/>' +
    '<path d="M12 34Q32 24 52 34Q72 44 92 32M11 50Q30 40 50 50Q70 60 91 48" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>' +
    '<path d="M80 2q2 6 7 8q-5 2 -7 8q-2 -6 -7 -8q5 -2 7 -8z" fill="#FFD54A"/></svg>';
}

/* fuel pump (viewBox 0 0 120 220): .bf-litres shows litres (HTML overlay), hose drawn by the game */
export function pumpSVG() {
  const id = nid('p');
  return '<svg viewBox="0 0 120 220" aria-hidden="true" overflow="visible"><defs>' + lin(id, [[0, '#FF8D90'], [0.5, '#FF5A5F'], [1, '#E5464B']], 1, 0.3) +
    lin(id + 's', [[0, '#FFFFFF'], [1, '#EAF4FF']]) + '</defs>' +
    '<ellipse cx="62" cy="214" rx="58" ry="7" fill="#24324F" opacity=".14"/>' +
    '<rect x="6" y="198" width="108" height="16" rx="8" fill="#C3CEE0"/>' +
    '<rect x="14" y="10" width="92" height="192" rx="24" fill="url(#' + id + ')"/>' +
    '<rect x="26" y="26" width="68" height="44" rx="12" fill="url(#' + id + 's)"/>' +
    '<rect x="30" y="88" width="60" height="28" rx="12" fill="#FFD54A"/>' +
    '<path d="M60 93C54 101 52 105 52 108A8 8 0 0 0 68 108C68 105 66 101 60 93Z" fill="#FF5A5F"/>' +
    '<rect x="100" y="70" width="14" height="40" rx="7" fill="#C3CEE0"/>' +
    '<path d="M24 22Q60 14 96 22" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".45"/>' +
    '<path d="M22 40V180" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".18"/></svg>';
}
/* fuel nozzle (viewBox 0 0 120 80), spout tip on the right at (118, 26) */
export function nozzleSVG() {
  const id = nid('z');
  return '<svg viewBox="0 0 120 80" aria-hidden="true" overflow="visible"><defs>' + lin(id, [[0, '#6FE3D6'], [1, '#1FA99C']]) + lin(id + 'm', [[0, '#F2F5FA'], [1, '#AEB9CD']]) + '</defs>' +
    '<path d="M70 20L114 17Q119 17 119 22V28Q119 32 114 32L72 38Z" fill="url(#' + id + 'm)"/>' +
    '<path d="M10 18Q10 6 22 6L68 10Q80 12 80 24L80 40Q80 50 68 50L46 50L38 74Q36 78 30 78L20 78Q14 78 14 72L18 50Q10 48 10 38Z" fill="url(#' + id + ')"/>' +
    '<path d="M34 50Q34 62 50 62L62 62" fill="none" stroke="#1FA99C" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M20 15L60 17" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/></svg>';
}

/* traffic light (viewBox 0 0 100 250): lamps .bx-l-red/.bx-l-yellow/.bx-l-green, lit by class on the wrapper */
export function lightSVG() {
  const id = nid('l');
  const lamp = (cls, cy, on) => '<circle cx="50" cy="' + cy + '" r="27" fill="#1E2A44" opacity=".55"/>' +
    '<circle cx="50" cy="' + cy + '" r="25" fill="' + mix(on, '#33405F', 0.72) + '"/>' +
    '<circle class="' + cls + ' bx-lit" cx="50" cy="' + cy + '" r="40" fill="url(#' + id + cls + 'g)"/>' +
    '<circle class="' + cls + ' bx-lit" cx="50" cy="' + cy + '" r="25" fill="url(#' + id + cls + ')"/>' +
    '<ellipse cx="42" cy="' + (cy - 11) + '" rx="9" ry="5" fill="#fff" opacity=".35"/>';
  const g = (cls, on) => rad(id + cls, 0.4, 0.35, 0.7, [[0, light(on, 0.6)], [1, on]]) + rad(id + cls + 'g', 0.5, 0.5, 0.5, [[0, on, 0.55], [1, on, 0]]);
  return '<svg viewBox="0 0 100 250" aria-hidden="true" overflow="visible"><defs>' + lin(id + 'h', [[0, '#4A5A80'], [1, '#2C3856']], 1, 0.3) +
    g('bx-l-red', '#FF5A5F') + g('bx-l-yellow', '#FFD54A') + g('bx-l-green', '#3DDC84') + '</defs>' +
    '<rect x="42" y="196" width="16" height="54" rx="6" fill="#9AA6BF"/>' +
    '<rect x="8" y="6" width="84" height="198" rx="30" fill="url(#' + id + 'h)"/>' +
    lamp('bx-l-red', 42, '#FF5A5F') + lamp('bx-l-yellow', 105, '#FFD54A') + lamp('bx-l-green', 168, '#3DDC84') +
    '<path d="M18 30V180" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".12"/></svg>';
}

/* gas pedal (viewBox 0 0 120 150) */
export function pedalSVG() {
  const id = nid('pd');
  return '<svg viewBox="0 0 120 150" aria-hidden="true" overflow="visible"><defs>' + lin(id, [[0, '#7BEDB0'], [1, '#22B866']]) + '</defs>' +
    '<rect x="10" y="10" width="100" height="130" rx="30" fill="url(#' + id + ')"/>' +
    '<rect x="28" y="34" width="64" height="10" rx="5" fill="#fff" opacity=".35"/><rect x="28" y="58" width="64" height="10" rx="5" fill="#fff" opacity=".35"/>' +
    '<rect x="28" y="82" width="64" height="10" rx="5" fill="#fff" opacity=".35"/><rect x="28" y="106" width="64" height="10" rx="5" fill="#fff" opacity=".35"/>' +
    '<path d="M24 22Q60 14 96 22" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".55"/></svg>';
}

/* checkered finish banner strip, viewBox 0 0 200 20 */
export function checkerSVG() {
  let s = '';
  for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) s += '<rect x="' + i * 10 + '" y="' + j * 10 + '" width="10" height="10" fill="#33456B"/>';
  return '<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><rect width="200" height="20" fill="#fff"/>' + s + '</svg>';
}

/* padlock, viewBox 0 0 40 44 */
export function lockSVG() {
  const id = nid('lk');
  return '<svg viewBox="0 0 40 44" aria-hidden="true"><defs>' + lin(id, [[0, '#FFE98A'], [1, '#FFC21F']]) + '</defs>' +
    '<path d="M10 20V13a10 10 0 0 1 20 0v7" fill="none" stroke="#C3CEE0" stroke-width="5" stroke-linecap="round"/>' +
    '<rect x="5" y="19" width="30" height="22" rx="7" fill="url(#' + id + ')"/><circle cx="20" cy="30" r="3.5" fill="#E09A00"/></svg>';
}
