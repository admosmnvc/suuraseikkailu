/* Shared engine for items drifting across the arena: rising balloons (dir -1), falling snowflakes (dir +1).
   One pop per STEP ms: a tap that comes early sparkles at once and pops its item (or the nearest one if it
   drifted away) when the gap is over, so mashing still takes ~10 s.
   Reduced motion: items fade in at free spots and stay still until tapped. */
import { TAU, clamp, rand } from '../util.js';
import { makeItem, detach, nearest, freeSpot } from './core.js';

const STEP = 1100; /* ms between two pops */

/* o: { dir, max (number or fn), aspect, cyFrac, cls, label, size(), art(n) -> {html,color}, initial: [fy...], cross: [s,s],
        every: [s,s], sway, spin, onHit(it, viewportPoint) }
   initial: start positions as fractions of the arena height (spread over the screen at start). */
export function floaters(S, o) {
  const list = [];
  let spawnIn = o.every[0], lastLane = -1, n = 0;
  const alive = () => list.reduce((c, it) => c + (it.gone ? 0 : 1), 0);
  const maxAlive = () => (typeof o.max === 'function' ? o.max() : o.max);
  const step = S.paced(STEP, (a) => {
    const it = (a.it && !a.it.gone) ? a.it : nearest(list, a.p, Infinity);
    if (it) hit(it);
  });

  function drop(it) {
    const k = list.indexOf(it);
    if (k >= 0) list.splice(k, 1);
    detach(it.el);
  }
  function place(it) {
    let x = it.x, r = it.rot;
    if (it.amp) { const a = S.t * it.f + it.ph; x += Math.sin(a) * it.amp; r = Math.cos(a) * 4.5; }
    it.cx = x + it.w / 2; it.cy = it.y + it.h * o.cyFrac; it.r = it.w * 0.5;
    it.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + it.y.toFixed(1) + 'px,0) rotate(' + r.toFixed(1) + 'deg)';
  }
  function hit(it) {
    if (it.gone || !S.active()) return;
    S.spend(it);
    o.onHit(it, S.vp(it.cx, it.cy));
    it.el.classList.add('is-gone');
    S.later(() => drop(it), 260);
    S.point();
  }
  function spawn(fy) {
    const w = o.size(), h = Math.round(w * o.aspect);
    let x, y;
    if (S.rm) {
      const p = freeSpot(list, w, h, 6, S.W - w - 6, 6, S.H - h - 6);
      x = p.x; y = p.y;
    } else {
      const lanes = Math.max(2, Math.floor((S.W - 8) / (w * 0.95)));
      let lane = (Math.random() * lanes) | 0;
      if (lane === lastLane) lane = (lane + 1 + ((Math.random() * (lanes - 1)) | 0)) % lanes;
      lastLane = lane;
      const span = Math.max(0, S.W - w - 16);
      x = clamp(8 + (lane / (lanes - 1)) * span + rand(-6, 6), 4, Math.max(4, S.W - w - 4));
      y = (fy != null) ? fy * S.H : (o.dir < 0 ? S.H + rand(2, 24) : -h - rand(2, 24));
    }
    const art = o.art(n++);
    const it = { x: x, y: y, w: w, h: h, c: art.color, gone: false,
      v: S.rm ? 0 : (S.H + h) / rand(o.cross[0], o.cross[1]),
      amp: (o.sway && !S.rm) ? rand(8, 15) : 0, f: rand(1.0, 1.6), ph: rand(0, TAU),
      rot: o.spin ? rand(-30, 30) : 0, vr: (o.spin && !S.rm) ? rand(18, 36) * (Math.random() < 0.5 ? -1 : 1) : 0 };
    it.el = makeItem(o.cls + (S.rm ? ' mg-in' : ''), art.html, o.label, w, h);
    it.el.__mg = it;
    it.hit = (p) => step({ it: it, p: p || { x: it.cx, y: it.cy } }, p);
    S.add(it.el);
    list.push(it);
    place(it);
  }
  S.update = function (dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.gone) continue;
      it.y += o.dir * it.v * dt;
      it.rot += it.vr * dt;
      if ((o.dir < 0 && it.y + it.h < -2) || (o.dir > 0 && it.y > S.H + 2)) { it.gone = true; drop(it); continue; }
      place(it);
    }
    if (S.active()) {
      const cnt = alive(), mx = maxAlive();
      /* never leave the sky (almost) empty: hurry the next one when only a couple are left */
      if (cnt < Math.min(3, mx)) spawnIn = Math.min(spawnIn, 0.3);
      spawnIn -= dt;
      if (spawnIn <= 0 && cnt < mx) { spawn(null); spawnIn = rand(o.every[0], o.every[1]); }
    }
  };
  S.near = (p) => nearest(list, p, 28);
  S.resize = function () {
    for (const it of list) {
      it.x = clamp(it.x, 4, Math.max(4, S.W - it.w - 4));
      if (S.rm) it.y = clamp(it.y, 4, Math.max(4, S.H - it.h - 4));
      place(it);
    }
  };
  for (const fy of o.initial) spawn(fy);
}
