/* 4 - Kerää hedelmät koriin! Tap a fruit (date, grapes, pomegranate, fig, olives) and it flies in an arc
   into the glittering basket, which squishes happily. One fruit per STEP ms (a fruit tapped early waits its
   turn), so mashing still takes ~9 s. Reduced motion: the fruit fades into the basket. */
import { clamp, rand, shuffle } from '../util.js';
import { FX } from '../fx.js';
import { makeItem, detach, nearest, freeSpot, snd } from './core.js';
import { FRUITS, FRUIT_FI, fruitSVG, basketBackSVG, basketFrontSVG } from './svg.js';

export const GOAL = 6;
const PILE_POS = [[10, 24], [62, 24], [36, 20], [22, 11], [50, 11], [36, 3]];
const STEP = 1200; /* ms between two picked fruits */

export function game(S) {
  const list = [], flying = [], kinds = shuffle(FRUITS.slice());
  let kn = 0, inBasket = 0, lastSpot = null;
  const step = S.paced(STEP, (a) => {
    const f = (a.it && !a.it.gone) ? a.it : nearest(list, a.p, 28);
    if (f) pick(f);
  });
  const bk = { el: document.createElement('div'), x: 0, y: 0, w: 0, h: 0, bt: -1 };
  bk.el.className = 'mg-basket';
  bk.el.innerHTML = basketBackSVG() + '<div class="mg-pile"></div>' + basketFrontSVG();
  const pile = bk.el.querySelector('.mg-pile');
  S.add(bk.el);

  const fsize = () => Math.round(clamp(Math.min(S.W, S.H) * 0.22, 76, 116));
  function placeBasket() {
    let sx = 1, sy = 1;
    if (bk.bt >= 0) {
      const k = bk.bt, a = Math.sin(k * 22) * Math.exp(-k * 7) * (S.rm ? 0 : 1);
      sx = 1 + 0.07 * a; sy = 1 - 0.12 * a;
    }
    bk.el.style.transform = 'translate3d(' + bk.x.toFixed(1) + 'px,' + bk.y.toFixed(1) + 'px,0) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  }
  function layoutBasket() {
    bk.w = Math.round(Math.min(S.W * 0.52, 250, (S.H * 0.45) / 0.7));
    bk.h = Math.round(bk.w * 0.7);
    bk.x = (S.W - bk.w) / 2;
    bk.y = S.H - bk.h - 10;
    bk.el.style.width = bk.w + 'px';
    bk.el.style.height = bk.h + 'px';
    placeBasket();
  }
  function region(s) {
    const y1 = Math.min(S.H * 0.6, bk.y - 6) - s;
    return { x0: 8, x1: S.W - s - 8, y0: 8, y1: Math.max(8, y1) };
  }
  function put(f) {
    f.cx = f.x + f.w / 2; f.cy = f.y + f.h / 2; f.r = f.w * 0.45;
    f.el.style.transform = 'translate3d(' + f.x.toFixed(1) + 'px,' + f.y.toFixed(1) + 'px,0)';
  }
  function spawn() {
    if (!S.active()) return;
    const s = fsize(), R = region(s), kind = kinds[kn++ % kinds.length];
    if (kn % kinds.length === 0) shuffle(kinds);
    const p = freeSpot(lastSpot ? list.concat([lastSpot]) : list, s, s, R.x0, R.x1, R.y0, R.y1);
    const f = { kind: kind, x: p.x, y: p.y, w: s, h: s, gone: false };
    f.el = makeItem('mg-fruit mg-in', fruitSVG(kind), FRUIT_FI[kind], s, s);
    f.el.__mg = f;
    f.hit = (p) => step({ it: f, p: p || { x: f.cx, y: f.cy } }, p);
    S.add(f.el);
    list.push(f);
    put(f);
  }
  function pick(f) {
    if (f.gone || !S.active()) return;
    S.spend(f);
    lastSpot = { x: f.x, y: f.y, w: f.w, h: f.h, gone: false };
    const k = list.indexOf(f);
    if (k >= 0) list.splice(k, 1);
    f.el.classList.remove('mg-in');
    snd('tap');
    if (S.rm) {
      f.el.classList.add('is-gone');
      S.later(() => land(f), 240);
    } else {
      f.fx0 = f.x; f.fy0 = f.y; f.ft = 0; f.dur = 0.55;
      f.spin = rand(-160, 160);
      f.arc = clamp(S.H * 0.16, 50, 140);
      f.el.classList.add('is-flying');
      flying.push(f);
    }
    S.later(spawn, 850);
  }
  function land(f) {
    detach(f.el);
    const pos = PILE_POS[inBasket % PILE_POS.length];
    inBasket += 1;
    const i = document.createElement('i');
    i.style.left = pos[0] + '%';
    i.style.top = pos[1] + '%';
    i.innerHTML = fruitSVG(f.kind);
    pile.appendChild(i);
    bk.bt = 0;
    snd('plop');
    const v = S.vp(bk.x + bk.w / 2, bk.y + bk.h * 0.35);
    FX.sparkle(v.x, v.y);
    S.point();
  }
  S.update = function (dt) {
    for (let j = flying.length - 1; j >= 0; j--) {
      const f = flying[j];
      f.ft += dt;
      const q = Math.min(1, f.ft / f.dur), e = q * (2 - q);
      const tx = bk.x + bk.w / 2 - f.w / 2, ty = bk.y + bk.h * 0.32 - f.h / 2;
      const x = f.fx0 + (tx - f.fx0) * e;
      const y = f.fy0 + (ty - f.fy0) * e - f.arc * 4 * q * (1 - q);
      const sc = 1 - 0.55 * q;
      f.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + (f.spin * q).toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      if (q >= 1) { flying.splice(j, 1); land(f); }
    }
    if (bk.bt >= 0) {
      bk.bt += dt;
      if (bk.bt > 0.6) bk.bt = -1;
      placeBasket();
    }
  };
  S.near = (p) => nearest(list, p, 28);
  S.resize = function () {
    layoutBasket();
    for (const f of list) {
      const R = region(f.w);
      f.x = clamp(f.x, R.x0, Math.max(R.x0, R.x1));
      f.y = clamp(f.y, R.y0, Math.max(R.y0, R.y1));
      put(f);
    }
  };
  layoutBasket();
  for (let n = 0; n < 5; n++) spawn();
}
