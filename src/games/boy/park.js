/* boy 5 – Pysäköi auto ruutuun! Top-down parking lot. A car drives in; drag it into the glowing spot
   (snaps with a click when close). 3 cars in sequence; a car dropped elsewhere just waits there. */
import { carTopSVG, lockSVG, CAR_COLORS } from './art.js';
import { put, honk, clamp } from './kit.js';

const CARS = 3;

export default {
  id: 'park',
  goal: CARS,
  start(S) {
    let L = null, spots = [], order = [], k = -1, cur = null, busy = true, ended = false, lockEl = null;
    const lot = S.el('div', 'bp-lot');
    const lane = S.el('div', 'bp-lane', '', lot);
    const parked = [];

    function layout() {
      const W = S.W, H = S.H, portrait = W < H * 0.9, wide = W > H * 1.7;
      const cols = portrait ? 3 : (wide ? 5 : 4), rows = wide ? 1 : 2;
      const top = 10, areaH = portrait ? H * 0.58 : (wide ? H * 0.5 : H * 0.62);
      const sw = Math.min((W - 20) / cols, (areaH / rows) / 1.35 * 1.0, 200);
      const sh = Math.min(sw * 1.42, areaH / rows - 8);
      const cw = Math.max(66, Math.min(sw * 0.7, sh / 1.6 * 0.86)), ch = cw * 1.6; /* >= 64 px target */
      const x0 = (W - sw * cols) / 2;
      L = { W, H, cols, rows, sw, sh, cw, ch, start: { x: W / 2, y: H - ch * 0.62 - 10 } };
      put(lot, W / 2, H / 2, W, H);
      put(lane, W / 2, (top + rows * (sh + 8) + H) / 2, W, H - (top + rows * (sh + 8)));
      if (!spots.length) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const el = S.el('div', 'bp-spot', '<b>P</b>', lot);
          spots.push({ el, r, c, x: 0, y: 0, taken: false });
        }
      }
      for (const s of spots) {
        s.x = x0 + sw * (s.c + 0.5);
        s.y = top + (sh + 8) * s.r + sh / 2;
        put(s.el, s.x, s.y, sw, sh);
      }
      for (const p of parked) put(p.el, p.spot.x, p.spot.y, cw, ch);
      if (cur && !cur.el.classList.contains('is-dragging')) {
        if (cur.home) put(cur.el, cur.home.x, cur.home.y, cw, ch);
        else put(cur.el, L.start.x, L.start.y, cw, ch);
      }
    }
    function pickOrder() {
      /* 3 targets spread out (corners first), 2 decoration cars elsewhere */
      const idx = spots.map((s, i) => i);
      const n = spots.length;
      const picks = n >= 6 && L.rows === 2 ? [0, 5, 2] : [0, n - 1, Math.floor(n / 2)];
      order = picks.map((i) => spots[i]);
      const rest = idx.filter((i) => picks.indexOf(i) < 0);
      for (let j = 0; j < 2 && rest.length; j++) {
        const i = rest.splice((Math.random() * rest.length) | 0, 1)[0], s = spots[i];
        s.taken = true;
        const el = S.el('div', 'bp-car bp-deco', carTopSVG(CAR_COLORS[4 + j]), lot);
        parked.push({ el, spot: s });
        put(el, s.x, s.y, L.cw, L.ch);
      }
    }
    function target() { return order[k]; }
    function nextCar() {
      if (ended) return;
      k++;
      if (k >= CARS) { allDone(); return; }
      const t = target();
      t.el.classList.add('target');
      const el = S.el('button', 'bp-car bp-mine drive-in', carTopSVG(CAR_COLORS[k % 3]), lot);
      el.type = 'button';
      el.setAttribute('aria-label', 'Auto');
      cur = { el, home: null };
      put(el, L.start.x, L.start.y, L.cw, L.ch);
      S.snd('whoosh');
      busy = true;
      S.later(() => { el.classList.remove('drive-in'); busy = false; showHint(); S.progress(); }, S.rm ? 150 : 900);
      /* the spot this car is heading for – null once it is parked / all spots are filled (a drag may still be
         running then, e.g. when the safety finish parked the cars): moves are ignored, the end just lets go */
      const mine = () => (!ended && cur && cur.el === el && k < CARS) ? target() || null : null;
      S.drag(el, {
        enabled: () => !busy && !!mine(),
        onStart() { S.snd('tap'); const t = mine(); if (t) t.el.classList.add('hot'); },
        onMove(p) {
          const t = mine();
          if (!t) return;
          const c = S.local(p.cx, p.cy);
          t.el.classList.toggle('near', S.dist(c, t) < L.sw * 0.9);
          el.style.rotate = clamp(p.e.movementX || 0, -12, 12) + 'deg';
        },
        onEnd(p) {
          el.style.rotate = '';
          const t = mine();
          if (!t) { for (const s of spots) s.el.classList.remove('hot', 'near'); S.clearDrag(el); return true; }
          const c = S.local(p.cx, p.cy);
          t.el.classList.remove('hot', 'near');
          if (S.dist(c, t) < Math.max(L.sw * 0.62, 56)) { park(el, t); return true; }
          if (c.x < 0 || c.y < 0 || c.x > L.W || c.y > L.H) return false;
          /* stays where it was dropped; continue from there */
          S.clearDrag(el);
          cur.home = c;
          put(el, c.x, c.y, L.cw, L.ch);
          S.snd('plop');
          return true;
        }
      });
    }
    function park(el, t) {
      busy = true;
      S.clearDrag(el);
      put(el, t.x, t.y, L.cw, L.ch);
      el.classList.add('parked', 'blink');
      t.el.classList.remove('target');
      t.el.classList.add('done');
      t.taken = true;
      parked.push({ el, spot: t });
      cur = null;
      S.snd('pop');
      S.snd('ding', k + 1);
      S.burst(t, null, 16);
      S.comic('Klik!', { x: t.x, y: t.y + L.sh * 0.45 });
      /* then lock it: tap the parked car -> beep beep, lights blink */
      lockEl = el;
      el.classList.add('lockme');
      if (!el.__lockTap) { el.__lockTap = true; S.tap(el, () => { if (lockEl === el && !busy) lock(); }); }
      S.later(() => { if (lockEl === el) { busy = false; showHint(); S.progress(); } }, 380);
    }
    function lock() {
      const el = lockEl;
      lockEl = null;
      busy = true;
      el.classList.remove('lockme', 'blink');
      el.classList.add('locked', 'blink2');
      S.el('div', 'bp-lock mg-pop-in', lockSVG(), el);
      honk(S);
      S.snd('sparkle');
      const t = parked[parked.length - 1].spot;
      S.sparkle(t);
      if (k < CARS - 1) { S.say('fx-beep'); S.point(); S.later(nextCar, 800); }
      else { S.say('fx-ready'); allDone(); S.point(); }
    }
    function allDone() {
      if (ended) return;
      ended = true;
      S.hideHint();
      for (const p of parked) p.el.classList.add('blink2');
      S.endWait = 1800; /* all cars blink + beep while the celebration runs */
    }
    function showHint() {
      if (busy) return;
      if (lockEl) { S.hint({ type: 'tap', at: lockEl }); return; }
      if (!cur) return;
      const t = target(), r = cur.el.getBoundingClientRect(), a = S.local(r.left + r.width / 2, r.top + r.height / 2);
      S.hint({ type: 'drag', at: a, to: t });
    }

    S.fillRest = () => {
      if (ended) return 0;
      busy = true;
      for (let j = Math.max(0, k); j < CARS; j++) {
        const t = order[j];
        if (!t || t.taken) continue;
        const el = (j === k && cur) ? cur.el : S.el('div', 'bp-car', carTopSVG(CAR_COLORS[j % 3]), lot);
        S.clearDrag(el);
        el.classList.remove('drive-in');
        el.classList.add('parked');
        put(el, t.x, t.y, L.cw, L.ch);
        t.el.classList.remove('target');
        t.el.classList.add('done');
        t.taken = true;
        parked.push({ el, spot: t });
      }
      k = CARS;
      cur = null;
      lockEl = null;
      allDone();
      honk(S);
      return 700;
    };
    S.resize = () => { layout(); };
    S.idleHint(showHint, 2400);
    S.endWait = 1500;

    layout();
    pickOrder();
    S.later(nextCar, 300);
  }
};
