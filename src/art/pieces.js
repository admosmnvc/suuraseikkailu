/* Suuraseikkailu v3 – art/pieces.js: stickers, avatars, praise badge (ART.burst), speech bubble, level badges,
   verse marker – soft premium style. OWNER: art agent. */
import { uid, f, esc, isHex, mix, svgOpen, starPath, wavyCircle, arabicDigits, themeOf } from './common.js';
import { INK, G, B, keep, ghost, lg, rg, drop, u, fit, twinkle } from './soft.js';
import { pony, PONY_BOX, ponyHead, bunny, tiara, crown100, mosque, MOSQUE_BOX, gem, heart } from './girl.js';
import { car, CAR_BOX, rocket, ROCKET_BOX, trophy, helmet, flag } from './boy.js';

// every motif in a 100x100 box: (c, id) => markup
export const MOTIFS = {
  pony: (c, id) => fit(pony(c, id), PONY_BOX, 50, 52, 98),
  'pony-head': (c, id) => ponyHead(c, id),
  'pony-crown': (c, id) => ponyHead(c, id, { crown: true }),
  horse: (c, id) => ponyHead(c, id),
  'horse-crown': (c, id) => ponyHead(c, id, { crown: true }),
  bunny, tiara: (c, id) => tiara(c, id), crown: crown100,
  mosque: (c, id) => fit(mosque(c, id), MOSQUE_BOX, 50, 51, 96),
  castle: (c, id) => fit(mosque(c, id), MOSQUE_BOX, 50, 51, 96),   // v2 name, now the mosque
  gem: (c, id) => gem(c, id, G.lavender), heart: (c, id) => heart(c, id),
  car: (c, id) => fit(car(c, id), CAR_BOX, 50, 52, 98),
  rocket: (c, id) => fit(rocket(c, id), ROCKET_BOX, 50, 50, 98),
  trophy, helmet, flag
};

/* ---------- stickers (viewBox 120x120) ---------- */

// [motif, inner disc light, inner disc deep, tilt, size, cy]
const STICKERS = {
  girl: {
    shahada: ['tiara', '#F4EFFF', '#D9CCFF', -6, 76, 62], fatiha: ['pony-head', '#E6FAF2', '#BDEFDD', 0, 86, 64],
    ikhlas: ['mosque', '#F4EFFF', '#DCD0FF', 0, 82, 62], kawthar: ['bunny', '#FFF0F4', '#FFC9D8', 4, 80, 63], bonus: ['crown', '#FFF8E2', '#FFE09A', -8, 76, 62]
  },
  boy: {
    shahada: ['car', '#EAF5FF', '#C2E0FF', -4, 84, 62], fatiha: ['rocket', '#E5F8F5', '#B4EBE4', 14, 80, 60],
    ikhlas: ['trophy', '#ECF0FF', '#C3D2FF', 0, 76, 62], kawthar: ['helmet', '#FFF8E0', '#FFE79C', 4, 78, 62], bonus: ['flag', '#FFF0E2', '#FFD3AC', -4, 76, 62]
  }
};
const ALIAS = { palace: 'bonus' };

export function sticker(theme, sid, earned) {
  const t = themeOf(theme), key = ALIAS[sid] || sid;
  const sp = STICKERS[t][key] || STICKERS[t].bonus;
  const on = !!earned, id = uid('stk'), c = on ? keep : ghost;
  const motif = '<g clip-path="url(#' + id + '-c)"><g transform="translate(60 ' + sp[5] + ') rotate(' + sp[3] + ') scale(' + f(sp[4] / 100) + ') translate(-50 -50)">' + MOTIFS[sp[0]](c, id + '-m') + '</g></g>';
  let s = svgOpen('sticker', '0 0 120 120', 'art-sticker-' + esc(sid) + ' art-sticker-' + t + (on ? ' earned' : ' ghost'));
  s += '<defs><clipPath id="' + id + '-c"><circle cx="60" cy="60" r="45"/></clipPath>' +
    rg(id + '-in', [[0, on ? sp[1] : '#F1F2F6'], [1, on ? sp[2] : '#E3E6ED']], null, 0.4, 0.3, 0.85) +
    (on ? drop(id + '-sh', t === 'boy' ? '#3C6FD8' : '#E0708F', 5, 5, 0.22) : '') + '</defs>';
  if (on) {
    s += '<circle cx="60" cy="60" r="53" fill="#FFFFFF" filter="' + u(id + '-sh') + '"/>' +
      '<circle cx="60" cy="60" r="45" fill="' + u(id + '-in') + '"/>' + motif +
      '<path d="M24 44A38 38 0 0 1 42 22" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".8"/>' +
      twinkle(98, 22, 8, t === 'boy' ? B.yellow : G.gold, -0.7);
  } else {
    s += '<circle cx="60" cy="60" r="53" fill="#F7F8FA" stroke="#D8DCE6" stroke-width="2.4" stroke-dasharray="3 7" stroke-linecap="round"/>' +
      '<circle cx="60" cy="60" r="45" fill="' + u(id + '-in') + '"/><g opacity=".85">' + motif + '</g>';
  }
  return s + '</svg>';
}

/* ---------- avatar: round profile badge (viewBox 120x120) ---------- */

export function avatar(theme, cls) {
  const t = themeOf(theme), id = uid('ava'), girl = t === 'girl';
  const inner = girl
    ? '<g transform="translate(58 68) scale(.84) translate(-50 -50)">' + ponyHead(keep, id + '-h', { crown: true }) + '</g>'
    : '<path d="M14 54H34M10 66H28" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".85"/>' + fit(car(keep, id + '-c'), [92, 380, 236, 112], 64, 64, 90);
  return svgOpen('avatar', '0 0 120 120', 'art-avatar-' + t + (cls ? ' ' + esc(cls) : '')) +
    '<defs><clipPath id="' + id + '-c"><circle cx="60" cy="60" r="48"/></clipPath>' +
    rg(id + '-bg', girl ? [[0, '#FFF1F5'], [1, '#FFC2D2']] : [[0, '#EEF7FF'], [1, '#B8DCFF']], null, 0.4, 0.3, 0.85) +
    drop(id + '-sh', girl ? '#E0708F' : '#3C6FD8', 6, 6, 0.25) + '</defs>' +
    '<circle cx="60" cy="60" r="54" fill="#FFFFFF" filter="' + u(id + '-sh') + '"/>' +
    '<circle cx="60" cy="60" r="48" fill="' + u(id + '-bg') + '"/>' +
    '<g clip-path="url(#' + id + '-c)">' + inner + '</g>' +
    '</svg>';
}

/* ---------- praise badge (kept as ART.burst for compatibility): soft rosette with a glow; text is HTML on top ---------- */

export function burst(color, cls) {
  const col = isHex(color) ? color : G.gold, id = uid('bdg');
  const shape = wavyCircle(100, 100, 80, 12, 0.055);
  return svgOpen('burst', '0 0 200 200', 'art-badge' + (cls ? ' ' + esc(cls) : '')) +
    '<defs>' + rg(id + '-g', [[0, col, 0.55], [0.6, col, 0.2], [1, col, 0]], null, 0.5, 0.5, 0.5) +
    rg(id + '-f', [[0, mix(col, '#FFFFFF', 0.6)], [0.7, mix(col, '#FFFFFF', 0.15)], [1, col]], null, 0.38, 0.3, 0.9) +
    drop(id + '-sh', mix(col, INK, 0.25), 8, 9, 0.28) + '</defs>' +
    '<circle cx="100" cy="100" r="99" fill="' + u(id + '-g') + '"/>' +
    '<path d="' + shape + '" fill="' + u(id + '-f') + '" filter="' + u(id + '-sh') + '"/>' +
    '<ellipse cx="82" cy="58" rx="40" ry="16" transform="rotate(-18 82 58)" fill="#FFFFFF" opacity=".35"/>' +
    twinkle(170, 36, 12, '#FFFFFF', -0.4) + twinkle(30, 160, 9, '#FFFFFF', -1.2) +
    '</svg>';
}

/* ---------- speech bubble (viewBox 220x160) ---------- */

export function bubble(cls) {
  const id = uid('bub');
  const d = 'M54 14H166C188 14 206 32 206 54V82C206 104 188 122 166 122H92L60 145C55 149 49 146 50 140L54 122C32 120 14 104 14 82V54C14 32 32 14 54 14Z';
  return svgOpen('bubble', '0 0 220 160', cls) +
    '<defs>' + lg(id + '-f', [[0, '#FFFFFF'], [1, '#F4F7FC']]) + drop(id + '-sh', '#6A7CA8', 8, 10, 0.2) + '</defs>' +
    '<path d="' + d + '" fill="' + u(id + '-f') + '" filter="' + u(id + '-sh') + '"/>' +
    '<path d="M40 40C46 30 56 26 68 25" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>' +
    '</svg>';
}

/* ---------- level badge: 1 / 2 / 3 filled stars (viewBox 120x72) ---------- */

const LEVEL_OF = { easy: 1, helppo: 1, '1': 1, medium: 2, keskitaso: 2, '2': 2, hard: 3, vaikea: 3, '3': 3 };
const LEVEL_TINT = { 1: ['#EEFBF6', '#C9F1E1'], 2: ['#FFF8E6', '#FFE6AE'], 3: ['#FFF0F4', '#FFCCD9'] };

export function levelIcon(level, cls) {
  const n = LEVEL_OF[String(level).toLowerCase()] || 1, id = uid('lvl'), tint = LEVEL_TINT[n];
  // big stars that fill the pill so the count reads at 26–30 px height; empty = neutral grey
  const pos = [[28, 36, 16], [60, 35, 19], [92, 36, 16]];
  let stars = '';
  pos.forEach((p, i) => {
    const d = starPath(p[0], p[1], p[2], p[2] * 0.5, 5);
    stars += i < n
      ? '<path d="' + d + '" fill="' + u(id + '-s') + '" stroke="' + u(id + '-s') + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<circle cx="' + f(p[0] - p[2] * 0.24) + '" cy="' + f(p[1] - p[2] * 0.22) + '" r="' + f(p[2] * 0.15) + '" fill="#FFFFFF" opacity=".85"/>'
      : '<path d="' + d + '" fill="#D9DCE6" stroke="#D9DCE6" stroke-width="4" stroke-linejoin="round"/>';
  });
  return svgOpen('level', '0 0 120 72', 'art-level-' + n + (cls ? ' ' + esc(cls) : '')) +
    '<defs>' + lg(id + '-t', [[0, tint[0]], [1, tint[1]]]) + lg(id + '-s', [[0, '#FFDD6E'], [1, '#F5A51F']]) + drop(id + '-sh', '#7C8DB5', 4, 5, 0.22) + '</defs>' +
    '<rect x="4" y="8" width="112" height="56" rx="28" fill="#FFFFFF" filter="' + u(id + '-sh') + '"/>' +
    '<rect x="7" y="11" width="106" height="50" rx="25" fill="' + u(id + '-t') + '"/>' +
    stars + '</svg>';
}

/* ---------- verse-end marker: calm, sits right next to the Arabic ---------- */

export function ayah(n) {
  const digits = arabicDigits(n), len = digits.length;
  const fs = len <= 1 ? 18 : (len === 2 ? 14.5 : 11.5);
  const y = 20 + fs * 0.225;
  return '<span class="ayah" role="img" aria-label="jae ' + esc(n == null ? '' : n) + '">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<path d="' + starPath(20, 20, 18.4, 14.8, 8, -Math.PI / 2) + '" fill="#FFF8EC" stroke="#EFCB7E" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="20" cy="20" r="12" fill="#FFFFFF" class="art-ayah-ring" stroke-width="1.6"/>' +
    '<text x="20" y="' + f(y) + '" text-anchor="middle" direction="ltr" font-family="\'Amiri Quran\', Amiri, serif" font-size="' + fs + '" fill="' + INK + '">' + esc(digits) + '</text>' +
    '</svg></span>';
}

