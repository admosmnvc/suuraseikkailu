/* 2 - Poksauta kuplat! Iridescent soap bubbles drift and bounce; tap to pop, a new one appears. */
import { TAU, clamp, rand } from '../util.js';
import { FX } from '../fx.js';
import { makeItem, detach, nearest, freeSpot, snd } from './core.js';

export const GOAL = 10;
const STEP = 850; /* ms between two pops: unnoticed at a child's pace, keeps mashing from ending the game in ~5 s */
const BUBBLE_FX = ['#7FD3F2', '#C8B6FF', '#FF9FD6', '#BFE6FF'];

export function game(S) {
  const list = [];
  const step = S.paced(STEP, (a) => {
    const b = (a.it && !a.it.gone) ? a.it : nearest(list, a.p, 24);
    if (b) pop(b);
  });
  const scale = () => clamp(Math.min(S.W, S.H) / 390, 1, 1.4);
  function drop(b) { const k = list.indexOf(b); if (k >= 0) list.splice(k, 1); detach(b.el); }
  function place(b) {
    let sx = 1, sy = 1;
    if (!S.rm) { const q = Math.sin(S.t * b.wf + b.ph) * 0.035; sx = 1 + q; sy = 1 - q; }
    b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2; b.r = b.w / 2;
    b.el.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px,0) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  }
  function spawn() {
    if (!S.active()) return;
    let s = Math.round(rand(72, 112) * scale());
    s = Math.min(s, Math.max(64, Math.min(S.W, S.H) - 8));
    const p = freeSpot(list, s, s, 0, S.W - s, 0, S.H - s);
    const a = rand(0, TAU), sp = S.rm ? 0 : rand(22, 46);
    const b = { x: p.x, y: p.y, w: s, h: s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ph: rand(0, TAU), wf: rand(2, 3.2), gone: false };
    b.el = makeItem('mg-bubble mg-in', '<span class="mg-skin"><i></i></span>', 'Kupla', s, s);
    b.el.style.setProperty('--hue', String(Math.round(rand(-30, 30))));
    b.el.__mg = b;
    b.hit = (p) => step({ it: b, p: p || { x: b.cx, y: b.cy } }, p);
    S.add(b.el);
    list.push(b);
    place(b);
  }
  function pop(b) {
    if (b.gone || !S.active()) return;
    S.spend(b);
    const v = S.vp(b.cx, b.cy);
    FX.burst(v.x, v.y, BUBBLE_FX, 18);
    snd('pop');
    b.el.classList.remove('mg-in');
    b.el.classList.add('is-gone');
    S.later(() => drop(b), 260);
    S.later(spawn, 380);
    S.point();
  }
  S.update = function (dt) {
    for (const b of list) {
      if (b.gone) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const mx = Math.max(0, S.W - b.w), my = Math.max(0, S.H - b.h);
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } else if (b.x > mx) { b.x = mx; b.vx = -Math.abs(b.vx); }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } else if (b.y > my) { b.y = my; b.vy = -Math.abs(b.vy); }
      place(b);
    }
  };
  S.near = (p) => nearest(list, p, 24);
  S.resize = function () {
    for (const b of list) {
      b.x = clamp(b.x, 0, Math.max(0, S.W - b.w));
      b.y = clamp(b.y, 0, Math.max(0, S.H - b.h));
      place(b);
    }
  };
  for (let i = 0; i < 7; i++) spawn();
}
