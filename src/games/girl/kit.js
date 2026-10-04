/* Girl games toolkit (OWNER: games-girl). Shared by the six girl games, depends only on the core session API.

   Look: premium soft "clay / 3D-lite" – chunky rounded shapes, gentle gradients (shared defs below, url(#gg-<key>)),
   soft inner highlights, soft coloured shadows. No outlines, no halftone, no comic bursts.
   Stage: one div covering the arena, laid out in design units and scaled with transform: scale(k).
     k = min(W / minW, H / minH) for the orientation's minimum design box, so the stage always fills the arena
     (st.w x st.h design units, >= the minimum box). Games lay out in design units, pointer input arrives in
     design units too.
   Input: one pointerdown listener on the stage; handlers run synchronously in that event, so the first visual
     change (class / transform) and the SFX happen in the same frame as the touch. No pacing, no queues.
   Hints: the core glove (S.hint / S.idleHint, arena px); st.hint takes design units. */
import { SFX } from '../../audio/sfx.js';
import { reducedMotion, mix } from '../../util.js';

export const INK = '#24324F';
export const C = {
  coral: '#FF7A9A', rose: '#FFB3C7', lav: '#B9A4FF', peach: '#FFC9A8', mint: '#8EE3C8', gold: '#FFD36E', cream: '#FFF8F1',
  ink: INK, white: '#FFFFFF', plum: '#8C78E8', berry: '#F2557E', leaf: '#5CCB9F', grass: '#A6EED3', sky: '#CFEFFF',
  water: '#9FE3F0', red: '#FF6474', orange: '#FFA35C', brown: '#C99572', mud: '#A0704F', snow: '#F4EFFF', dusk: '#8A7CD4',
  fur: '#FFE6CC', ear: '#E8AE82', wall: '#D9CCFF'
};
export const WORDS = ['Hienoa!', 'Upeaa!', 'Ihanaa!', 'Jee!'];
/* gradient fill of a palette colour: G('coral') -> url(#gg-coral) */
export const G = (key) => 'url(#gg-' + key + ')';

const SVGA = ' aria-hidden="true" focusable="false"';
export function svg(vb, body, cls) {
  return '<svg viewBox="' + vb + '"' + SVGA + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</svg>';
}
const f1 = (v) => (Math.round(v * 10) / 10).toString();
/* soft glossy highlight + soft contact shadow (SVG snippets) */
export const HL = (cx, cy, rx, ry, rot) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"' +
  (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + ' fill="url(#gg-hl)"/>';
export const SH = (cx, cy, rx, ry) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#gg-sh)"/>';
/* 4-point sparkle */
export function sparkD(cx, cy, R) {
  const r = R * 0.22;
  return 'M' + f1(cx) + ' ' + f1(cy - R) + 'Q' + f1(cx + r) + ' ' + f1(cy - r) + ' ' + f1(cx + R) + ' ' + f1(cy) +
    'Q' + f1(cx + r) + ' ' + f1(cy + r) + ' ' + f1(cx) + ' ' + f1(cy + R) +
    'Q' + f1(cx - r) + ' ' + f1(cy + r) + ' ' + f1(cx - R) + ' ' + f1(cy) +
    'Q' + f1(cx - r) + ' ' + f1(cy - r) + ' ' + f1(cx) + ' ' + f1(cy - R) + 'Z';
}
export function heartD(cx, cy, s) {
  return 'M' + f1(cx) + ' ' + f1(cy + s * 0.9) + 'C' + f1(cx - s * 1.5) + ' ' + f1(cy - s * 0.1) + ' ' + f1(cx - s * 0.75) + ' ' +
    f1(cy - s * 1.15) + ' ' + f1(cx) + ' ' + f1(cy - s * 0.45) + 'C' + f1(cx + s * 0.75) + ' ' + f1(cy - s * 1.15) + ' ' +
    f1(cx + s * 1.5) + ' ' + f1(cy - s * 0.1) + ' ' + f1(cx) + ' ' + f1(cy + s * 0.9) + 'Z';
}
/* rounded 5-point star */
export function starD(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * rr) + ' ' + f1(cy + Math.sin(a) * rr);
  }
  return d + 'Z';
}
/* shared gradients (one zero-size svg per game stage; ids are unique to the girl games) */
const SHADE = '#6B4F8F';
function lin(key, hex) {
  const light = key === 'white' || key === 'cream' || key === 'snow';
  return '<linearGradient id="gg-' + key + '" x1="0.2" y1="0" x2="0.45" y2="1">' +
    '<stop offset="0" stop-color="' + mix(hex, '#ffffff', light ? 0.6 : 0.34) + '"/>' +
    '<stop offset=".55" stop-color="' + hex + '"/>' +
    '<stop offset="1" stop-color="' + mix(hex, light ? '#B9A4FF' : SHADE, light ? 0.22 : 0.16) + '"/></linearGradient>';
}
function rad(id, color, o0, o1) {
  return '<radialGradient id="gg-' + id + '"><stop offset="0" stop-color="' + color + '" stop-opacity="' + o0 + '"/>' +
    '<stop offset="1" stop-color="' + color + '" stop-opacity="' + o1 + '"/></radialGradient>';
}
export const DEFS = '<svg class="gg-defs" width="0" height="0"' + SVGA + '><defs>' +
  Object.keys(C).filter((k) => k !== 'ink').map((k) => lin(k, C[k])).join('') +
  rad('hl', '#ffffff', 0.85, 0) + rad('sh', '#5B4A8A', 0.22, 0) + rad('blush', '#FF7A9A', 0.55, 0) +
  rad('glow', '#FFE08A', 0.95, 0) +
  '<radialGradient id="gg-bub" cx=".38" cy=".34" r=".72"><stop offset="0" stop-color="#fff"/><stop offset=".68" stop-color="#F3F7FF"/>' +
  '<stop offset="1" stop-color="#C8D8FF"/></radialGradient>' +
  '</defs></svg>';

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
export function sfx(name, arg) {
  try { const f = SFX && SFX[name]; if (typeof f === 'function') f.call(SFX, arg); } catch (e) { /* stay silent */ }
}
/* place a design-unit box: left/top via transform (composited), size via width/height */
export function put(e, x, y, w, h) {
  e.style.transform = 'translate(' + f1(x) + 'px,' + f1(y) + 'px)';
  if (w != null) { e.style.width = f1(w) + 'px'; e.style.height = f1(h) + 'px'; }
}
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function pick(list) { return list[(Math.random() * list.length) | 0]; }

/* ---------- stage ---------- */
export function makeStage(S, opt) {
  const arena = S.arena;
  const rm = (S.rm != null) ? !!S.rm : reducedMotion();
  const root = el('div', 'gg-stage gg-' + opt.cls + (rm ? ' gg-rm' : ''));
  root.setAttribute('data-gg', 'stage');
  const bg = el('div', 'gg-bg');
  bg.setAttribute('aria-hidden', 'true');
  root.innerHTML = DEFS;
  root.appendChild(bg);
  const st = { el: root, bg: bg, k: 1, w: 0, h: 0, land: false, rm: rm, W: 0, H: 0 };
  const downs = [], moves = [], ups = [];
  const ptr = new Map(); /* pointerId -> last design point */
  let rect = null, layoutFn = null;

  function measure() {
    let W = arena.clientWidth, H = arena.clientHeight;
    if (!W || !H) { W = window.innerWidth || 390; H = Math.max(240, (window.innerHeight || 700) - 130); }
    const land = W / H > 1.15, m = land ? opt.L : opt.P;
    const k = Math.min(W / m[0], H / m[1]);
    const changed = W !== st.W || H !== st.H;
    st.W = W; st.H = H; st.k = k; st.land = land; st.w = W / k; st.h = H / k;
    root.style.width = f1(st.w) + 'px';
    root.style.height = f1(st.h) + 'px';
    root.style.transform = 'scale(' + k.toFixed(4) + ')';
    root.classList.toggle('is-land', land);
    rect = null;
    return changed;
  }
  st.layout = function (fn) { layoutFn = fn; measure(); fn(st); };
  st.relayout = function () { if (measure() && layoutFn) layoutFn(st); };
  st.toLocal = function (cx, cy) {
    if (!rect) rect = arena.getBoundingClientRect();
    return { x: (cx - rect.left) / st.k, y: (cy - rect.top) / st.k };
  };
  st.toArena = (x, y) => ({ x: x * st.k, y: y * st.k });
  st.add = (e) => { root.appendChild(e); return e; };
  st.onDown = (fn) => downs.push(fn);
  st.onMove = (fn) => moves.push(fn);
  st.onUp = (fn) => ups.push(fn);

  function down(e) {
    if (e.button > 0) return;
    if (e.cancelable) e.preventDefault();
    rect = arena.getBoundingClientRect();
    const p = st.toLocal(e.clientX, e.clientY);
    ptr.set(e.pointerId, p);
    try { root.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    let used = false;
    for (const fn of downs) if (fn(p, e)) used = true;
    if (used) e.__mgUsed = true; /* else the core adds its small "empty tap" sparkle */
  }
  function move(e) {
    if (!ptr.has(e.pointerId)) return;
    const p = st.toLocal(e.clientX, e.clientY);
    ptr.set(e.pointerId, p);
    for (const fn of moves) fn(p, e);
  }
  function up(e) {
    if (!ptr.has(e.pointerId)) return;
    const p = st.toLocal(e.clientX, e.clientY);
    ptr.delete(e.pointerId);
    for (const fn of ups) fn(p, e);
  }
  S.on(root, 'pointerdown', down, { passive: false });
  S.on(root, 'pointermove', move);
  S.on(root, 'pointerup', up);
  S.on(root, 'pointercancel', up);
  S.on(root, 'contextmenu', (e) => e.preventDefault());
  S.on(window, 'resize', () => st.relayout());
  S.on(window, 'orientationchange', () => S.later(() => st.relayout(), 120));

  /* ---------- hints (core glove, arena px) ---------- */
  /* spec in design units: { type: 'tap'|'drag'|'rub'|'hold', at: {x,y}, to?: {x,y}, r? } */
  st.hint = function (spec) {
    if (!spec || !S.active() || typeof S.hint !== 'function') return;
    const o = { type: spec.type, at: st.toArena(spec.at.x, spec.at.y) };
    if (spec.to) o.to = st.toArena(spec.to.x, spec.to.y);
    if (spec.r) o.r = spec.r * st.k;
    S.hint(o);
  };
  st.hideHint = () => { if (typeof S.hideHint === 'function') S.hideHint(); };
  /* fn() returns the hint spec for the current situation (or null); the core calls it after ms without a touch */
  st.idle = function (fn, ms) {
    if (typeof S.idleHint === 'function') S.idleHint(() => { const spec = fn(); if (spec) st.hint(spec); }, ms || 2600);
  };

  /* ---------- soft feedback ---------- */
  /* glowing sparkles flying out of (x, y) */
  st.sparks = function (x, y, n, colors) {
    const cols = colors || [C.gold, '#fff', C.rose, C.gold, C.lav];
    for (let i = 0; i < (n || 6); i++) {
      const s = el('span', 'gg-spark');
      const a = (i / (n || 6)) * Math.PI * 2 + Math.random() * 0.6, d = 36 + Math.random() * 34, sz = 14 + Math.random() * 14;
      s.innerHTML = i % 3 === 2 ? svg('0 0 24 24', '<circle cx="12" cy="12" r="6" fill="' + cols[i % cols.length] + '"/>')
        : svg('0 0 24 24', '<path d="' + sparkD(12, 12, 11) + '" fill="' + cols[i % cols.length] + '"/>');
      s.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + f1(x - sz / 2) + 'px;top:' + f1(y - sz / 2) +
        'px;--dx:' + f1(Math.cos(a) * d) + 'px;--dy:' + f1(Math.sin(a) * d) + 'px';
      root.appendChild(s);
      S.later(() => s.remove(), 760);
    }
  };
  st.hearts = function (x, y, n) {
    n = n || 3;
    for (let i = 0; i < n; i++) {
      const s = el('span', 'gg-heart');
      const sz = 24 + Math.random() * 12;
      s.innerHTML = svg('0 0 24 24', '<path d="' + heartD(12, 13, 8.5) + '" fill="' + G(i % 2 ? 'rose' : 'coral') + '"/>' + HL(9, 9, 3, 2, -30));
      s.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + f1(x - sz / 2 + (i - (n - 1) / 2) * 28) + 'px;top:' + f1(y - sz / 2) +
        'px;animation-delay:' + (i * 90) + 'ms';
      root.appendChild(s);
      S.later(() => s.remove(), 1400);
    }
  };
  /* clean praise word ("Hienoa!") with a soft glow, floats up and fades */
  st.praise = function (x, y, word, size) {
    if (typeof S.praise === 'function') return S.praise(word || pick(WORDS), st.toArena(x, y), false);
    const p = el('div', 'gg-praise');
    p.textContent = word || pick(WORDS);
    p.setAttribute('aria-hidden', 'true');
    const fs = size || 40, w = fs * 5;
    p.style.cssText = 'width:' + f1(w) + 'px;font-size:' + fs + 'px;left:' + f1(Math.max(4, Math.min(st.w - w - 4, x - w / 2))) +
      'px;top:' + f1(Math.max(4, Math.min(st.h - fs * 1.6, y - fs * 0.7))) + 'px';
    root.appendChild(p);
    S.later(() => p.remove(), 1300);
    return p;
  };

  arena.appendChild(root);
  return st;
}
