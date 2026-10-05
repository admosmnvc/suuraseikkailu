/* Suuraseikkailu v3 – art/boy.js: boy theme in the soft premium style – race car, rocket, trophy, helmet,
   checkered flag, the rocket progress picture (built part by part) and the mini-rocket reward. OWNER: art agent.
   No people: the helmet always shows a dark glossy visor. */
import { uid, f, esc, clampInt, svgOpen, starPath, sparklePath, rectPath } from './common.js';
import { INK, B, keep, lg, lgU, rg, rgU, drop, u, clay, twinkle, softStar, cloud, puff } from './soft.js';
import { emblem, crescentStar } from './desert.js';

/* ---------- motifs ---------- */

// Friendly race car facing right (as on the cover). Native box [92, 380, 236, 112].
export const CAR_BOX = [92, 380, 236, 112];
export function car(c, id, opt) {
  const k = c || keep, o = opt || {};
  // opt.wheelCls puts each whole wheel in its own group (spins around its own centre)
  const wheel = (x) => (o.wheelCls ? '<g class="' + o.wheelCls + '" style="transform-box:fill-box;transform-origin:center">' : '') +
    '<circle cx="' + x + '" cy="462" r="23" fill="' + k('#34405F') + '"/><circle cx="' + x + '" cy="462" r="10" fill="' + k('#E4ECF8') + '"/>' +
    '<g' + (o.spin ? ' class="art-spin"' : '') + '><circle cx="' + x + '" cy="456" r="2.4" fill="' + k('#9DB0D3') + '"/><circle cx="' + (x - 5.2) + '" cy="465" r="2.4" fill="' + k('#9DB0D3') + '"/><circle cx="' + (x + 5.2) + '" cy="465" r="2.4" fill="' + k('#9DB0D3') + '"/></g>' +
    (o.wheelCls ? '</g>' : '');
  return '<defs>' + lg(id + '-car', [[0, '#FF9A9C'], [1, o.color || B.red]], k) + lg(id + '-glass', [[0, '#DDF0FF'], [1, '#8CCBFF']], k) +
    (o.pennant ? lg(id + '-pen', [[0, '#7FE3D8'], [1, '#22AFA3']], k, 0, 0, 1, 0) : '') + '</defs>' +
    '<ellipse cx="210" cy="486" rx="120" ry="8" fill="' + k('#3E4C78') + '" opacity=".2"/>' +
    (o.pennant ? '<path d="M134 418L126 352" stroke="' + k('#9DB0D3') + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M126 352Q146 356 166 364Q146 370 128 378Z" fill="' + u(id + '-pen') + '"/>' + crescentStar(138, 364.5, 5.6, '#FFFFFF') : '') +
    '<path d="M100 448C100 428 112 418 130 416L160 414C172 394 190 384 214 384H236C256 384 270 396 280 412L300 416C316 418 324 430 322 448C322 458 316 462 306 462H112C104 462 100 456 100 448Z" fill="' + u(id + '-car') + '"/>' +
    '<path d="M172 412C180 398 194 392 212 392H234C248 392 258 400 266 412Z" fill="' + u(id + '-glass') + '"/>' +
    '<rect x="216" y="392" width="7" height="20" fill="#FFFFFF" opacity=".8"/>' +
    '<rect x="108" y="432" width="206" height="9" rx="4.5" fill="' + k(B.yellow) + '" opacity=".9"/>' +
    '<ellipse cx="312" cy="424" rx="6" ry="5" fill="' + k('#FFF3B0') + '"/>' +
    '<path d="M126 424C150 418 176 416 196 416" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" fill="none" opacity=".55"/>' +
    wheel(142) + wheel(280);
}

// Rocket (as on the cover). Native box [340, 92, 180, 324] with flame, ROCKET_BOX_NF without.
export const ROCKET_BOX = [340, 92, 180, 324];
export const ROCKET_BOX_NF = [340, 92, 180, 256];
export function rocket(c, id, opt) {
  const k = c || keep, o = opt || {};
  return '<defs>' + rg(id + '-body', [[0, '#FFFFFF'], [0.6, '#F1F6FF'], [1, '#C9DBF7']], k, 0.32, 0.3, 0.95) +
    lg(id + '-nose', [[0, '#FF9CA0'], [1, B.red]], k, 0, 0, 1, 1) + lg(id + '-fin', [[0, '#FFC07A'], [1, B.tangerine]], k, 0, 0, 1, 1) +
    rg(id + '-win', [[0, '#A9D9FF'], [0.6, B.sky], [1, B.blue]], k, 0.35, 0.3, 0.9) +
    lg(id + '-fl', [[0, '#FFF3B8'], [0.45, B.yellow], [1, B.tangerine]], k) + '</defs>' +
    (o.flame === false ? '' : '<g class="art-flame"><path d="M408 340C402 372 418 392 430 414C442 392 458 372 452 340Z" fill="' + u(id + '-fl') + '"/>' +
      '<path d="M418 340C415 360 424 372 430 386C436 372 445 360 442 340Z" fill="' + k('#FFF8D6') + '"/></g>') +
    '<path d="M386 258C356 278 346 306 348 344C362 334 376 330 392 330Z" fill="' + u(id + '-fin') + '"/>' +
    '<path d="M474 258C504 278 514 306 512 344C498 334 484 330 468 330Z" fill="' + u(id + '-fin') + '"/>' +
    '<rect x="402" y="322" width="56" height="22" rx="10" fill="' + k('#B9C7E3') + '"/>' +
    '<path d="M430 96C472 136 484 200 480 268L476 330H384L380 268C376 200 388 136 430 96Z" fill="' + u(id + '-body') + '"/>' +
    '<path d="M430 96C452 118 466 146 473 174C446 182 414 182 387 174C394 146 408 118 430 96Z" fill="' + u(id + '-nose') + '"/>' +
    '<circle cx="430" cy="222" r="30" fill="#FFFFFF"/><circle cx="430" cy="222" r="23" fill="' + u(id + '-win') + '"/>' +
    '<path d="M416 214a16 16 0 0 1 12-10" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".85"/>' +
    '<rect x="383" y="' + (o.decal ? 302 : 282) + '" width="' + (o.decal ? 95 : 94) + '" height="' + (o.decal ? 10 : 12) + '" rx="5" fill="' + k(B.yellow) + '" opacity=".9"/>' +
    '<path d="M404 140C396 168 394 210 396 260" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" fill="none" opacity=".7"/>' +
    (o.decal ? emblem(430, 274, 17, id + '-em', k) : '');
}

// Trophy cup with a star. 100x100.
export function trophy(c, id) {
  const k = c || keep;
  const CUP = 'M26 14H74L72 38C70 53 60 61 50 61C40 61 30 53 28 38Z';
  return '<defs>' + lgU(id + '-g', [[0, '#FFF1BC'], [1, '#FFC53A']], k, 0, 12, 0, 74) + lg(id + '-b', [[0, '#8EC2FF'], [1, B.blue]], k) + '</defs>' +
    '<path d="M30 20C14 18 12 40 32 44M70 20C86 18 88 40 68 44" fill="none" stroke="' + u(id + '-g') + '" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="' + CUP + '" fill="' + u(id + '-g') + '" stroke="' + u(id + '-g') + '" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M35 21V37" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" opacity=".65"/>' +
    '<path d="' + starPath(51, 34, 10.5, 5.2, 5) + '" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round" opacity=".92"/>' +
    '<rect x="44" y="60" width="12" height="14" rx="3" fill="' + u(id + '-g') + '"/>' +
    '<path d="M31 74H69L72 88H28Z" fill="' + u(id + '-b') + '" stroke="' + u(id + '-b') + '" stroke-width="4" stroke-linejoin="round"/>' +
    '<rect x="41" y="78" width="18" height="6" rx="3" fill="#FFFFFF" opacity=".8"/>';
}

// Racing helmet in profile with a dark glossy visor. 100x100.
export function helmet(c, id) {
  const k = c || keep;
  const SHELL = 'M13 63C9 37 28 13 56 13C79 13 94 30 94 51V61C94 71 88 78 79 78H27C19 78 14 71 13 63Z';
  return '<defs><clipPath id="' + id + '-s"><path d="' + SHELL + '"/></clipPath>' +
    rg(id + '-sh', [[0, '#A6D6FF'], [0.55, B.sky], [1, B.blue]], k, 0.32, 0.25, 0.95) +
    lg(id + '-v', [[0, '#4A5F9C'], [1, k(INK)]], k, 0, 0, 1, 1) + lg(id + '-y', [[0, '#FFE58A'], [1, B.yellow]], k) + '</defs>' +
    '<ellipse cx="54" cy="84" rx="38" ry="5" fill="' + k('#3E4C78') + '" opacity=".16"/>' +
    '<path d="' + SHELL + '" fill="' + u(id + '-sh') + '"/>' +
    '<g clip-path="url(#' + id + '-s)">' +
    '<path d="M4 46C24 22 52 12 80 16L82 25C56 21 32 31 10 55Z" fill="#FFFFFF" opacity=".95"/>' +
    '<path d="M8 56C28 34 54 26 82 27L83 32C56 30 32 39 11 61Z" fill="' + k(B.red) + '"/>' +
    '<rect x="0" y="69" width="100" height="12" fill="' + u(id + '-y') + '"/></g>' +
    '<path d="M50 36C60 31 81 31 93 40L94 56L54 58C47 52 45 41 50 36Z" fill="' + u(id + '-v') + '"/>' +
    '<path d="M60 38.5L70 36.6M57 44.5L76 41.6" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>' +
    '<ellipse cx="34" cy="27" rx="12" ry="6" transform="rotate(-28 34 27)" fill="#FFFFFF" opacity=".4"/>' +
    '<path d="' + starPath(30, 51, 6.5, 3.2, 5) + '" fill="' + k(B.yellow) + '" stroke="' + k(B.yellow) + '" stroke-width="2" stroke-linejoin="round"/>';
}

// Waving checkered flag. 100x100.
export function flag(c, id) {
  const k = c || keep;
  const FLAG = 'M27 14C42 6 56 22 72 14C80 10 88 11 94 14V54C88 51 80 50 72 54C56 62 42 46 27 54Z';
  let sq = '';
  for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) if ((r + q) % 2 === 0) sq += rectPath(27 + q * 14, 4 + r * 14, 14, 14);
  return '<defs><clipPath id="' + id + '-f"><path d="' + FLAG + '"/></clipPath>' + lg(id + '-p', [[0, '#F2F5FA'], [1, '#B9C5DB']], k, 0, 0, 1, 0) +
    lg(id + '-w', [[0, '#FFFFFF', 0.35], [0.5, '#FFFFFF', 0], [1, '#24324F', 0.12]], k, 0, 0, 1, 0) + '</defs>' +
    '<rect x="20" y="8" width="7" height="86" rx="3.5" fill="' + u(id + '-p') + '"/>' +
    '<path d="' + FLAG + '" fill="#FFFFFF"/>' +
    '<g clip-path="url(#' + id + '-f)"><path d="' + sq + '" fill="' + k('#34405F') + '"/><rect x="20" y="0" width="80" height="70" fill="' + u(id + '-w') + '"/></g>' +
    '<circle cx="23.5" cy="8" r="5.5" fill="' + k(B.yellow) + '"/>' +
    '<ellipse cx="24" cy="95" rx="12" ry="3" fill="' + k('#3E4C78') + '" opacity=".15"/>';
}

/* ---------- the rocket that is built part by part (viewBox 360x300) ----------
   18 "atoms" bottom-up: nozzle, 2 fins, 7 body rings with 5 decorations between them, nose cone, nose stripe, tip.
   total < 18: atoms are grouped evenly into `total` parts; total > 18: extra (thinner) rings. */

const SIL = 'M180 20C214 52 226 108 224 168L220 240H140L136 168C134 108 146 52 180 20Z';
const FIN_L = 'M140 176C114 192 102 222 104 258C104 266 112 268 118 262L142 236Z';
const FIN_R = 'M220 176C246 192 258 222 256 258C256 266 248 268 242 262L218 236Z';

function rocketAtoms(id, total) {
  const R = Math.max(7, total - 11), top = 100, bot = 240, h = (bot - top) / R;
  const atoms = [], clips = [];
  const inSil = (m) => '<g clip-path="url(#' + id + '-sil)">' + m + '</g>';
  const band = (y1, y2, fill) => inSil('<path d="' + rectPath(120, y1, 120, y2 - y1) + '" fill="' + fill + '"/>');
  const port = (y, r) => '<circle cx="180" cy="' + y + '" r="' + (r + 6) + '" fill="#FFFFFF"/>' +
    '<circle cx="180" cy="' + y + '" r="' + r + '" fill="' + u(id + '-win') + '"/>' +
    '<path d="M' + f(180 - r * 0.62) + ' ' + f(y - r * 0.1) + 'A' + f(r * 0.64) + ' ' + f(r * 0.64) + ' 0 0 1 ' + f(180 + r * 0.02) + ' ' + f(y - r * 0.66) + '" fill="none" stroke="#FFFFFF" stroke-width="' + f(Math.max(2.4, r * 0.2)) + '" stroke-linecap="round" opacity=".85"/>';
  const decos = [
    { y: 224, m: band(218, 230, u(id + '-skyb')) },
    { y: 194, m: port(194, 11) },
    { y: 164, m: band(159, 169, u(id + '-red')) },
    { y: 134, m: port(134, 21) },
    { y: 106, m: band(102, 111, u(id + '-yel')) }
  ];
  atoms.push('<rect x="152" y="232" width="56" height="24" rx="10" fill="' + u(id + '-noz') + '"/><rect x="160" y="236" width="18" height="5" rx="2.5" fill="#FFFFFF" opacity=".6"/>');
  atoms.push('<path d="' + FIN_L + '" fill="' + u(id + '-fin') + '"/><path d="M128 206C118 218 112 234 112 250" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none" opacity=".45"/>');
  atoms.push('<path d="' + FIN_R + '" fill="' + u(id + '-finR') + '"/>');
  let d = 0;
  for (let i = 0; i < R; i++) {
    const y2 = bot - i * h, y1 = bot - (i + 1) * h, cid = id + '-ring' + i;
    clips.push('<clipPath id="' + cid + '"><path d="' + rectPath(120, y1, 120, (y2 - y1) + (i === 0 ? 8 : 0)) + '"/></clipPath>');
    atoms.push('<g clip-path="url(#' + cid + ')"><path d="' + SIL + '" fill="' + u(id + '-body') + '"/>' +
      '<path d="M152 70C146 110 145 170 149 232" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" fill="none" opacity=".75"/>' +
      (i < R - 1 ? inSil('<path d="M120 ' + f(y1) + 'H240" stroke="#D6E1F3" stroke-width="1.6"/>') : '') + '</g>');
    while (d < decos.length && decos[d].y >= y1) { atoms.push(decos[d].m); d++; }
  }
  while (d < decos.length) { atoms.push(decos[d].m); d++; }
  atoms.push('<g clip-path="url(#' + id + '-nose)"><path d="' + SIL + '" fill="' + u(id + '-nosec') + '"/>' +
    '<path d="M164 52C168 42 172 34 176 29" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/></g>');
  atoms.push(inSil('<path d="M120 62C150 70 210 70 240 62V72C210 80 150 80 120 72Z" fill="#FFFFFF" opacity=".92"/>'));
  atoms.push('<circle cx="180" cy="20" r="8" fill="' + u(id + '-tip') + '"/>');
  const defs = '<clipPath id="' + id + '-sil"><path d="' + SIL + '"/></clipPath>' +
    '<clipPath id="' + id + '-gfl"><path d="' + FIN_L + '"/></clipPath><clipPath id="' + id + '-gfr"><path d="' + FIN_R + '"/></clipPath>' +
    '<clipPath id="' + id + '-gnz"><rect x="152" y="232" width="56" height="24" rx="10"/></clipPath>' +
    '<clipPath id="' + id + '-nose"><path d="' + rectPath(120, 0, 120, 101) + '"/></clipPath>' + clips.join('') +
    rgU(id + '-body', [[0, '#FFFFFF'], [0.55, '#F1F6FF'], [1, '#C6D6F2']], null, 160, 110, 150) +
    lgU(id + '-nosec', [[0, '#FFA4A8'], [1, B.red]], null, 140, 0, 224, 0) +
    lgU(id + '-fin', [[0, '#FFC88A'], [1, B.tangerine]], null, 104, 0, 142, 0) +
    lgU(id + '-finR', [[0, '#FFB067'], [1, '#F2852C']], null, 218, 0, 256, 0) +
    lg(id + '-noz', [[0, '#D3DCEE'], [1, '#A2B3D6']]) +
    rg(id + '-win', [[0, '#B5DEFF'], [0.6, B.sky], [1, B.blue]], null, 0.35, 0.3, 0.9) +
    lgU(id + '-skyb', [[0, '#9CD2FF'], [1, B.sky]], null, 140, 0, 220, 0) +
    lgU(id + '-red', [[0, '#FF9A9D'], [1, B.red]], null, 140, 0, 220, 0) +
    lgU(id + '-yel', [[0, '#FFE58A'], [1, B.yellow]], null, 140, 0, 220, 0) +
    clay(id + '-tip', B.yellow);
  // ghost (not built yet): pale fill + dashed edge drawn INSIDE each shape (self-clipped), so built parts cover it fully
  const gs = ' fill="#FFFFFF" fill-opacity=".6" stroke="#B9D1F3" stroke-width="5" stroke-dasharray="6 7" stroke-linecap="round"';
  const ghost = '<g clip-path="url(#' + id + '-gfl)"><path d="' + FIN_L + '"' + gs + '/></g>' +
    '<g clip-path="url(#' + id + '-gfr)"><path d="' + FIN_R + '"' + gs + '/></g>' +
    '<g clip-path="url(#' + id + '-gnz)"><rect x="152" y="232" width="56" height="24" rx="10"' + gs + '/></g>' +
    '<g clip-path="url(#' + id + '-sil)"><path d="' + SIL + '"' + gs + '/>' +
    '<g fill="none" stroke="#C9DBF5" stroke-width="2.4" stroke-dasharray="5 6" stroke-linecap="round"><circle cx="180" cy="134" r="26"/><circle cx="180" cy="194" r="16"/></g></g>' +
    '<circle cx="180" cy="20" r="7" fill="#FFFFFF" fill-opacity=".6" stroke="#B9D1F3" stroke-width="2" stroke-dasharray="4 4"/>';
  return { atoms, defs, ghost };
}

function groupAtoms(atoms, n) {
  const A = atoms.length, parts = [];
  for (let i = 0; i < n; i++) parts.push(atoms.slice(Math.floor(i * A / n), Math.floor((i + 1) * A / n)).join(''));
  return parts;
}

function flameFx(id) {
  return '<g class="art-done-fx"><g class="art-flame">' +
    '<path d="M154 252C142 270 156 286 180 300C204 286 218 270 206 252Z" fill="' + u(id + '-fl') + '"/>' +
    '<path d="M166 252C160 264 168 274 180 284C192 274 200 264 194 252Z" fill="' + u(id + '-fi') + '"/></g></g>';
}

// ship = ghost + parts (classes `cls` = rp | slot, [data-i]) + flame
function shipMarkup(id, n, k, cls) {
  const R = rocketAtoms(id, n), parts = groupAtoms(R.atoms, n);
  const inner = cls === 'slot' ? 'art-slot-in' : 'art-rp-in';
  let s = '<defs>' + R.defs + lg(id + '-fl', [[0, B.yellow], [0.5, '#FFB347'], [1, '#FF8A5B', 0.85]]) + lg(id + '-fi', [[0, '#FFFBE6'], [1, '#FFE27A']]) + '</defs>' + flameFx(id) + R.ghost;
  parts.forEach((p, i) => { s += '<g class="' + cls + (i < k ? ' on' : '') + '" data-i="' + i + '"><g class="' + inner + '">' + p + '</g></g>'; });
  return s;
}

export function rocketProgress(o) {
  const n = clampInt(o.total, 1, 30, 18), k = clampInt(o.done, 0, n, 0), id = uid('rkt');
  const done = k >= n;
  const puffs = [[96, 274, 18], [126, 284, 15], [70, 286, 12], [264, 274, 18], [234, 284, 15], [290, 286, 12]];
  return svgOpen('progress', '0 0 360 300', 'art-progress-boy art-rocket' + (done ? ' art-complete' : '') + (o.cls ? ' ' + esc(o.cls) : '')) +
    '<defs>' + lg(id + '-pad', [[0, '#E9F0FB'], [1, '#C2D0EA']]) +
    rg(id + '-puff', [[0, '#FFFFFF'], [1, '#E0E9F8']], null, 0.4, 0.3, 0.8) +
    rg(id + '-halo', [[0, '#FFFFFF', 0.9], [0.6, '#DDEEFF', 0.45], [1, '#DDEEFF', 0]], null, 0.5, 0.5, 0.5) + '</defs>' +
    '<g class="art-done-fx"><circle cx="180" cy="150" r="170" fill="' + u(id + '-halo') + '"/></g>' +
    cloud(62, 150, 0.42, '#E6F1FF') + cloud(306, 92, 0.36, '#E6F1FF') +
    softStar(64, 58, 9, B.yellow, -0.3) + softStar(300, 34, 7, B.yellow, -1.2) + twinkle(312, 196, 8, '#9FCBFF', -0.8) + twinkle(44, 228, 7, '#9FCBFF', -1.7) +
    '<ellipse cx="180" cy="282" rx="80" ry="7" fill="#3E4C78" opacity=".12"/>' +
    '<rect x="112" y="262" width="136" height="16" rx="8" fill="' + u(id + '-pad') + '"/>' +
    '<g class="art-ship">' + shipMarkup(id, n, k, 'rp') + '</g>' +
    '<g class="art-done-fx">' + puffs.map((p, i) => puff(p[0], p[1], p[2], id + '-puff', -i * 0.35)).join('') + '</g>' +
    '</svg>';
}

/* ---------- reward: mini rocket with part slots (.slot[data-i] .on) – viewBox 240x180 ---------- */

export function rocketReward(o) {
  const n = clampInt(o.slots, 1, 12, 5), k = clampInt(o.filled, 0, n, 0), id = uid('rkr');
  const done = k >= n;
  return svgOpen('reward', '0 0 240 180', 'art-reward-boy art-rocket-reward' + (done ? ' art-complete' : '') + (o.cls ? ' ' + esc(o.cls) : '')) +
    '<defs>' + rg(id + '-bg', [[0, '#FFFFFF', 0.95], [0.6, '#DCEEFF', 0.75], [1, '#DCEEFF', 0]], null, 0.5, 0.5, 0.5) + '</defs>' +
    '<circle cx="120" cy="92" r="92" fill="' + u(id + '-bg') + '"/>' +
    cloud(46, 132, 0.36, '#FFFFFF') + cloud(196, 50, 0.3, '#FFFFFF') +
    '<path d="M30 150L62 124M50 166L80 142M18 128L44 106" stroke="#BCD9FF" stroke-width="5" stroke-linecap="round"/>' +
    '<g class="art-done-fx">' + softStar(206, 26, 9, B.yellow, -0.4) + twinkle(30, 36, 9, B.sky, -1.3) + twinkle(222, 140, 8, B.yellow, -0.9) + '</g>' +
    '<g transform="translate(122 94) rotate(40) scale(.54) translate(-180 -146)">' + shipMarkup(id, n, k, 'slot') + '</g>' +
    '</svg>';
}
