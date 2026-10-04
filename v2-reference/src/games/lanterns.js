/* 3 - Sytytä kristallilyhdyt! Six crystal lanterns hang on silver chains and swing gently;
   tapping one (or near one) lights it with a warm glow. One lantern per STEP ms (extra taps wait their turn). */
import { TAU, clamp, rand, shuffle } from '../util.js';
import { FX } from '../fx.js';
import { makeItem, nearest, snd } from './core.js';
import { lanternSVG } from './svg.js';

export const GOAL = 6;
/* lilac, rose, aqua, ice blue, periwinkle, warm cream */
const TINTS = ['#C8B6FF', '#FFA6D8', '#7FE0E0', '#8FD0FF', '#9DB4FF', '#FFD98A'];
const STRING_F = [0.04, 0.6, 0.22, 0.95, 0.12, 0.78]; /* chain length per column, left to right */
const STEP = 1500; /* ms between two lit lanterns: mashing still takes ~10 s */

export function game(S) {
  const list = [], order = shuffle([0, 1, 2, 3, 4, 5]);
  let lw = 80, lh = 136;
  const step = S.paced(STEP, (a) => {
    const it = (a.it && !a.it.gone) ? a.it : nearest(list, a.p, Infinity);
    if (it) light(it, false);
  });
  for (let i = 0; i < 6; i++) {
    const tint = TINTS[order[i]];
    const wrap = document.createElement('div');
    wrap.className = 'mg-lantern';
    const chain = document.createElement('span');
    chain.className = 'mg-chain';
    const lamp = makeItem('mg-lamp', lanternSVG(tint), 'Lyhty', 80, 136);
    lamp.style.setProperty('--lg', tint);
    lamp.style.setProperty('--fd', (-Math.random() * 1.2).toFixed(2) + 's');
    wrap.appendChild(chain);
    wrap.appendChild(lamp);
    const it = { wrap: wrap, chain: chain, el: lamp, tint: tint, gone: false, L: 0, x: 0, ph: rand(0, TAU), f: 1, amp: 0, ang: 0 };
    lamp.__mg = it;
    it.hit = (p) => step({ it: it, p: p || { x: it.cx, y: it.cy } }, p);
    S.add(wrap);
    list.push(it);
  }
  function layout() {
    lw = Math.round(clamp(Math.min(S.W * 0.24, (S.H - 24) / 3.75), 64, 124));
    lh = Math.round(lw * 1.7);
    const spare = clamp(S.H - 2 * lh - 16, 0, lh * 2.2);
    const step = Math.max(0, S.W - lw - 12) / 5;
    list.forEach((it, i) => {
      const row = i % 2;
      it.L = Math.round(6 + (row ? lh : 0) + spare * STRING_F[i]);
      it.x = 6 + step * i;
      const d = it.L + lh * 0.55;
      it.amp = S.rm ? 0 : Math.atan(11 / d) * 180 / Math.PI;
      it.f = clamp(Math.sqrt(220 / d), 0.6, 1.6) * 1.15;
      it.wrap.style.width = lw + 'px';
      it.wrap.style.height = (it.L + lh) + 'px';
      it.chain.style.height = (it.L + 6) + 'px';
      it.el.style.width = lw + 'px';
      it.el.style.height = lh + 'px';
      it.el.style.top = it.L + 'px';
      place(it);
    });
  }
  function place(it) {
    it.ang = it.amp ? Math.sin(S.t * it.f + it.ph) * it.amp : 0;
    const a = it.ang * Math.PI / 180, d = it.L + lh * 0.55;
    it.cx = it.x + lw / 2 - d * Math.sin(a);
    it.cy = d * Math.cos(a);
    it.r = lw * 0.42;
    it.wrap.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,0,0) rotate(' + it.ang.toFixed(2) + 'deg)';
  }
  function light(it, quiet) {
    if (it.gone) return;
    S.spend(it);
    it.el.classList.add('lit');
    it.el.setAttribute('aria-label', 'Lyhty loistaa');
    const v = S.vp(it.cx, it.cy);
    FX.sparkle(v.x, v.y);
    if (!quiet) { snd('chime', S.score); S.point(); }
  }
  S.update = function () {
    if (S.rm) return;
    for (const it of list) place(it);
  };
  S.near = (p) => nearest(list, p, Infinity);
  S.resize = layout;
  S.fillRest = function () {
    const rest = list.filter((it) => !it.gone);
    rest.forEach((it, i) => S.later(() => light(it, true), i * 140));
    if (rest.length) snd('sparkle');
    return rest.length ? rest.length * 140 + 200 : 0;
  };
  layout();
}
