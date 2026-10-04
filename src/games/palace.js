/* 7 - Sytytä palatsin valot! An ice palace (domes, small crescents) with eight big windows.
   Any tap lights the nearest window that is still dark: warm glow + clink. When every window shines,
   the whole palace sparkles. One window per STEP ms (extra taps wait their turn), so mashing still
   takes ~10 s. If nobody has lit a window for a moment, one dark window gets a soft golden ring. */
import { FX } from '../fx.js';
import { makeItem, nearest, snd } from './core.js';
import { palaceSVG, moonSVG, PALACE_WINDOWS, PALACE_VB } from './svg.js';

export const GOAL = PALACE_WINDOWS.length; /* 8 */
const STEP = 1200;  /* ms between two lit windows */
const NUDGE = 2.6;  /* s without a lit window before the hint ring shows */
const HIT = 72;     /* min hit size (px) of a window: a bit more than 64 for small fingers */

export function game(S) {
  const pal = { el: document.createElement('div'), x: 0, y: 0, k: 1 };
  pal.el.className = 'mg-palace';
  pal.el.innerHTML = palaceSVG();
  S.add(pal.el);
  /* a crescent moon fills the sky above the palace on tall screens (decor only) */
  const moon = document.createElement('div');
  moon.className = 'mg-moon';
  moon.innerHTML = moonSVG();
  S.add(moon);

  let idle = 0, nudged = null;
  const step = S.paced(STEP, (a) => {
    const it = (a.it && !a.it.gone) ? a.it : nearest(wins, a.p, Infinity);
    if (it) light(it, false);
  });
  const wins = PALACE_WINDOWS.map((w, i) => {
    const it = { i: i, w: w, gone: false, g: pal.el.querySelector('.pw[data-i="' + i + '"]'),
      halo: pal.el.querySelector('.pw-halo[data-i="' + i + '"]') };
    /* transparent >= 72 px hit button over the window (keyboard + direct taps) */
    it.el = makeItem('mg-win' + (w.type === 'round' ? ' mg-win--round' : ''), '', 'Ikkuna', HIT, HIT);
    it.el.__mg = it;
    it.hit = (p) => step({ it: it, p: p || { x: it.cx, y: it.cy } }, p);
    S.add(it.el);
    return it;
  });

  function layout() {
    pal.k = Math.min((S.W - 12) / PALACE_VB[0], (S.H - 8) / PALACE_VB[1]);
    const pw = PALACE_VB[0] * pal.k, ph = PALACE_VB[1] * pal.k;
    pal.x = (S.W - pw) / 2;
    pal.y = S.H - ph - 4;
    pal.el.style.width = pw.toFixed(1) + 'px';
    pal.el.style.height = ph.toFixed(1) + 'px';
    pal.el.style.transform = 'translate3d(' + pal.x.toFixed(1) + 'px,' + pal.y.toFixed(1) + 'px,0)';
    const ms = Math.round(Math.min(110, pal.y * 0.62, S.W * 0.26));
    moon.hidden = ms < 48;
    moon.style.width = moon.style.height = ms + 'px';
    moon.style.transform = 'translate3d(' + Math.round(S.W * 0.72 - ms / 2) + 'px,' + Math.round(pal.y * 0.42 - ms / 2) + 'px,0)';
    for (const it of wins) {
      const bw = Math.max(HIT, it.w.w * pal.k + 14), bh = Math.max(HIT, it.w.h * pal.k + 14);
      it.cx = pal.x + it.w.x * pal.k;
      it.cy = pal.y + it.w.y * pal.k;
      it.r = Math.min(bw, bh) / 2;
      it.el.style.width = bw.toFixed(1) + 'px';
      it.el.style.height = bh.toFixed(1) + 'px';
      it.el.style.setProperty('--ww', (it.w.w * pal.k).toFixed(1) + 'px'); /* window size for the hint ring */
      it.el.style.setProperty('--wh', (it.w.h * pal.k).toFixed(1) + 'px');
      it.el.style.transform = 'translate3d(' + (it.cx - bw / 2).toFixed(1) + 'px,' + (it.cy - bh / 2).toFixed(1) + 'px,0)';
    }
  }
  function unnudge() {
    idle = 0;
    if (nudged) { nudged.el.classList.remove('mg-nudge'); nudged = null; }
  }
  function light(it, quiet) {
    if (it.gone) return;
    unnudge();
    S.spend(it);
    if (it.g) it.g.classList.add('on');
    if (it.halo) it.halo.classList.add('on');
    it.el.setAttribute('aria-label', 'Ikkuna loistaa');
    const v = S.vp(it.cx, it.cy);
    FX.sparkle(v.x, v.y);
    if (!quiet) { snd('ding', S.score); S.point(); }
  }
  S.update = function (dt) {
    if (!S.active() || nudged) return;
    idle += dt;
    if (idle >= NUDGE) {
      /* the dark window closest to the bottom middle (easy to spot and reach) */
      nudged = nearest(wins, { x: S.W / 2, y: S.H }, Infinity);
      if (nudged) nudged.el.classList.add('mg-nudge');
    }
  };
  S.near = (p) => nearest(wins, p, Infinity);
  S.resize = layout;
  S.fillRest = function () {
    unnudge();
    const rest = wins.filter((it) => !it.gone);
    rest.forEach((it, i) => S.later(() => light(it, true), i * 130));
    if (rest.length) snd('sparkle');
    return rest.length ? rest.length * 130 + 250 : 0;
  };
  S.onComplete = function () {
    pal.el.classList.add('is-lit');
    snd('sparkle');
    /* sparkle the three crescents and the dome tops */
    [[200, 18], [65, 76], [335, 76], [200, 120], [65, 140], [335, 140]].forEach((p, i) => S.later(() => {
      const v = S.vp(pal.x + p[0] * pal.k, pal.y + p[1] * pal.k);
      FX.sparkle(v.x, v.y);
    }, 100 + i * 110));
  };
  layout();
}
