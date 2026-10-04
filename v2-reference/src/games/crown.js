/* 6 - Koristele kruunu! A big crown with six empty sockets; six glossy gems bob below it.
   Tapping a gem (or anywhere: the nearest gem is used) flies it in an arc into the next empty socket,
   where it lands with a clink and a sparkle. Done when the crown is full.
   One gem per STEP ms (extra taps wait their turn), so mashing still takes ~10 s. If nobody has tapped
   for a moment, one gem hops softly as a hint. Reduced motion: the gem fades out below and fades in on the crown. */
import { TAU, clamp, rand, shuffle } from '../util.js';
import { FX } from '../fx.js';
import { makeItem, detach, nearest, snd } from './core.js';
import { crownSVG, gemSVG, GEM_CUTS, GEM_COLORS, CROWN_SOCKETS, CROWN_VB } from './svg.js';

export const GOAL = CROWN_SOCKETS.length; /* 6 */
const FLY = 0.72; /* flight seconds */
const SET_SCALE = 1.32; /* a set gem is a little bigger than its socket well */
const STEP = 1500;  /* ms between two gems */
const NUDGE = 2.6;  /* s without a tap before a gem hops as a hint */

export function game(S) {
  const crown = { el: document.createElement('div'), x: 0, y: 0, w: 0, h: 0 };
  crown.el.className = 'mg-crown';
  crown.el.innerHTML = crownSVG();
  S.add(crown.el);

  /* socket overlays: a hint ring (pulses on the next socket) that later holds the set gem */
  const socks = CROWN_SOCKETS.map((s) => {
    const el = document.createElement('span');
    el.className = 'mg-sock';
    const d = s.r * 2 * SET_SCALE;
    el.style.left = ((s.x - d / 2) / CROWN_VB[0] * 100) + '%';
    el.style.top = ((s.y - d / 2) / CROWN_VB[1] * 100) + '%';
    el.style.width = (d / CROWN_VB[0] * 100) + '%';
    el.style.height = (d / CROWN_VB[1] * 100) + '%';
    crown.el.appendChild(el);
    return el;
  });
  let reserved = 0;
  const hint = () => socks.forEach((el, i) => el.classList.toggle('next', i === reserved));

  /* six gems, every cut and colour once, in random slots */
  const cuts = shuffle(GEM_CUTS.slice()), colors = shuffle(GEM_COLORS.slice()), slots = shuffle([0, 1, 2, 3, 4, 5]);
  const gems = [], flying = [];
  let idle = 0, nudged = null;
  const step = S.paced(STEP, (a) => {
    const it = (a.it && !a.it.gone) ? a.it : nearest(gems, a.p, Infinity);
    if (it) take(it);
  });
  for (let i = 0; i < GOAL; i++) {
    const it = { cut: cuts[i], color: colors[i], slot: slots[i], gone: false, x: 0, y: 0, w: 0, h: 0,
      ph: rand(0, TAU), f: rand(1.4, 2.1), jx: rand(-0.12, 0.12), jy: rand(-0.12, 0.12) };
    it.html = gemSVG(it.cut, it.color);
    it.el = makeItem('mg-gemitem mg-in', it.html + '<span class="mg-twinkle"></span>', 'Jalokivi', 80, 80);
    it.el.style.setProperty('--tw', (-rand(0, 2)).toFixed(2) + 's');
    it.el.__mg = it;
    it.hit = (p) => step({ it: it, p: p || { x: it.cx, y: it.cy } }, p);
    S.add(it.el);
    gems.push(it);
  }

  function socketPoint(i) {
    const s = CROWN_SOCKETS[i], k = crown.w / CROWN_VB[0];
    return { x: crown.x + s.x * k, y: crown.y + s.y * k, d: s.r * 2 * SET_SCALE * k };
  }
  let wide = false;
  function layout() {
    const ar = CROWN_VB[0] / CROWN_VB[1];
    /* wide, short arena (landscape phone): crown on the left half, gems on the right - the crown stays big */
    wide = S.W > S.H * 1.6;
    if (wide) {
      crown.w = Math.round(Math.min(S.W * 0.5 - 16, 480, (S.H - 16) * ar));
      crown.h = Math.round(crown.w / ar);
      crown.x = Math.round(Math.max(8, S.W * 0.25 - crown.w / 2));
      crown.y = Math.round((S.H - crown.h) / 2);
    } else {
      crown.w = Math.round(Math.min(S.W * 0.94, 480, S.H * 0.46 * ar));
      crown.h = Math.round(crown.w / ar);
      crown.x = Math.round((S.W - crown.w) / 2);
      crown.y = Math.round(clamp(S.H * 0.03, 4, 24));
    }
    crown.el.style.width = crown.w + 'px';
    crown.el.style.height = crown.h + 'px';
    crown.el.style.transform = 'translate3d(' + crown.x + 'px,' + crown.y + 'px,0)';
    /* gem grid below (or beside) the crown: pick the column count giving the roomiest cells */
    const ax = wide ? crown.x + crown.w + 12 : 6, ay = wide ? 6 : crown.y + crown.h + 10;
    const aw = wide ? S.W - ax - 6 : S.W - 12, ah = Math.max(80, S.H - ay - 8);
    let best = null;
    for (const cols of [2, 3, 6]) {
      const rows = Math.ceil(GOAL / cols), cw = aw / cols, ch = ah / rows, m = Math.min(cw, ch);
      if (!best || m > best.m) best = { cols: cols, cw: cw, ch: ch, m: m };
    }
    const size = Math.round(clamp(best.m * 0.74, 68, 112));
    for (const it of gems) {
      if (it.gone) continue;
      const c = it.slot % best.cols, r = Math.floor(it.slot / best.cols);
      const sx = Math.max(0, best.cw - size) / 2, sy = Math.max(0, best.ch - size) / 2;
      it.w = it.h = size;
      it.x = ax + c * best.cw + (best.cw - size) / 2 + it.jx * sx;
      it.y = ay + r * best.ch + (best.ch - size) / 2 + it.jy * sy;
      it.el.style.width = it.el.style.height = size + 'px';
      place(it);
    }
  }
  function place(it) {
    let dy = 0, rot = 0;
    if (!S.rm) { const a = S.t * it.f + it.ph; dy = Math.sin(a) * 6; rot = Math.sin(a * 0.8 + 1) * 6; }
    it.cx = it.x + it.w / 2; it.cy = it.y + dy + it.h / 2; it.r = it.w * 0.5;
    it.el.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,' + (it.y + dy).toFixed(1) + 'px,0) rotate(' + rot.toFixed(1) + 'deg)';
  }

  function take(it) {
    if (it.gone || !S.active() || reserved >= GOAL) return;
    fly(it);
  }
  function unnudge() {
    idle = 0;
    if (nudged) { nudged.el.classList.remove('mg-nudge'); nudged = null; }
  }
  function fly(it) {
    unnudge();
    S.spend(it);
    it.sock = reserved++;
    hint();
    snd('tap');
    it.el.classList.remove('mg-in');
    if (S.rm) {
      it.el.classList.add('is-gone');
      S.later(() => land(it), 220);
      return;
    }
    it.el.classList.add('is-flying');
    it.x0 = it.x; it.y0 = it.cy - it.h / 2; it.ft = 0;
    it.side = it.cx < S.W / 2 ? -1 : 1;
    flying.push(it);
  }
  function land(it) {
    detach(it.el);
    const el = socks[it.sock];
    el.classList.remove('next');
    el.classList.add('filled');
    el.innerHTML = it.html;
    const p = socketPoint(it.sock), v = S.vp(p.x, p.y);
    FX.sparkle(v.x, v.y);
    if (!it.quiet) snd('ding', it.sock); /* time-up fill-in lands quietly: one sparkle sound covers it */
    S.point();
  }
  S.update = function (dt) {
    for (const it of gems) if (!it.gone) place(it);
    if (S.active() && !nudged && !flying.length) {
      idle += dt;
      if (idle >= NUDGE) { nudged = gems.find((g) => !g.gone) || null; if (nudged) nudged.el.classList.add('mg-nudge'); }
    }
    for (let j = flying.length - 1; j >= 0; j--) {
      const it = flying[j];
      it.ft += dt;
      const q = Math.min(1, it.ft / FLY), e = q * q * (3 - 2 * q);
      const p1 = socketPoint(it.sock);
      const x0 = it.x0 + it.w / 2, y0 = it.y0 + it.h / 2;
      /* quadratic arc: up and slightly outward, then down into the socket (wide layout: a plain upward arc) */
      const cx = (x0 + p1.x) / 2 + (wide ? 0 : it.side * S.W * 0.14), cy = Math.min(y0, p1.y) - S.H * (wide ? 0.22 : 0.06);
      const x = (1 - e) * (1 - e) * x0 + 2 * e * (1 - e) * cx + e * e * p1.x;
      const y = (1 - e) * (1 - e) * y0 + 2 * e * (1 - e) * cy + e * e * p1.y;
      const sc = 1 + (p1.d / it.w - 1) * e;
      it.el.style.transform = 'translate3d(' + (x - it.w / 2).toFixed(1) + 'px,' + (y - it.h / 2).toFixed(1) + 'px,0) rotate(' +
        (it.side * 360 * e).toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      if (q >= 1) { flying.splice(j, 1); land(it); }
    }
  };
  S.near = (p) => nearest(gems, p, Infinity);
  S.resize = layout;
  S.fillRest = function () {
    const rest = gems.filter((it) => !it.gone);
    if (rest.length) snd('sparkle');
    rest.forEach((it, i) => S.later(() => { if (!it.gone && reserved < GOAL) { it.quiet = true; fly(it); } }, i * 110));
    return rest.length ? rest.length * 110 + FLY * 1000 + 150 : 0;
  };
  S.onComplete = function () {
    crown.el.classList.add('is-full');
    snd('sparkle');
    CROWN_SOCKETS.forEach((s, i) => S.later(() => {
      const p = socketPoint(i), v = S.vp(p.x, p.y);
      FX.sparkle(v.x, v.y);
    }, 120 + i * 90));
    const top = S.vp(crown.x + crown.w / 2, crown.y + crown.h * 0.07);
    FX.sparkle(top.x, top.y);
  };
  layout();
  hint();
}
