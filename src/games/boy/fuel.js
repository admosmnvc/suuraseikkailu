/* boy 2 – Tankkaa auto täyteen! Tap the tank flap open, drag the pump nozzle into the tank, then HOLD:
   the big gauge fills with glug sounds (release / hold again any time). Full -> nozzle back, honk, the car zooms off. */
import { carSideSVG, wheelSVG, pumpSVG, nozzleSVG, CAR_COLORS } from './art.js';
import { put, honk, clamp, eyesFollow } from './kit.js';

const FILL_MS = 5200;   /* holding time from empty to full */
const FLAP = { x: 66, y: 128 }; /* tank flap in car units (car 400 x 230) */

export default {
  id: 'fuel',
  goal: 6,
  start(S) {
    let phase = 'intro', L = null, level = 0, pts = 0, glugT = 0, ended = false;
    const island = S.el('div', 'bf-island');
    const pump = S.el('div', 'bf-pump', pumpSVG());
    const litres = S.el('div', 'bf-litres', '0', pump);
    const hose = S.el('div', 'bf-hose', '<svg aria-hidden="true"><path class="bf-hose-o" d=""/><path class="bf-hose-i" d=""/></svg>');
    const hoseO = hose.querySelector('.bf-hose-o'), hoseI = hose.querySelector('.bf-hose-i'), hoseSvg = hose.querySelector('svg');
    const car = S.el('div', 'bf-car');
    const carIn = S.el('div', 'bf-car-in', '', car);
    S.el('div', 'bw-wheel bw-w1', wheelSVG('normal', true), carIn);
    S.el('div', 'bw-wheel bw-w2', wheelSVG('normal', true), carIn);
    S.el('div', 'bw-body', carSideSVG({ color: CAR_COLORS[2] }), carIn);
    const flap = S.el('button', 'bf-flap', '<i></i>', carIn);
    flap.type = 'button';
    flap.setAttribute('aria-label', 'Tankin luukku');
    const ring = S.el('div', 'bf-ring');
    const zone = S.el('div', 'bf-zone');
    const nozzle = S.el('button', 'bf-nozzle', nozzleSVG());
    nozzle.type = 'button';
    nozzle.setAttribute('aria-label', 'Tankkauspistooli');
    const gauge = S.el('div', 'bf-gauge', '<div class="bf-drop"></div><div class="bf-track"><div class="bf-fill"></div><i></i><i></i><i></i></div>');
    const fill = gauge.querySelector('.bf-fill');

    function layout() {
      const W = S.W, H = S.H, portrait = W < H;
      const G = H * (portrait ? 0.9 : 0.93);
      const cw = portrait ? Math.min(W * 0.86, H * 0.42 * 400 / 230) : Math.min(W * 0.56, H * 0.6 * 400 / 230, 620);
      const ch = cw * 230 / 400, k = cw / 400;
      const cx = portrait ? W * 0.55 : W * 0.63, cy = G - ch / 2;
      const ph = portrait ? Math.min(H * 0.34, W * 0.7) : Math.min(H * 0.74, W * 0.42);
      const pw = ph * 120 / 220;
      const pcx = portrait ? pw * 0.5 + W * 0.05 : Math.max(pw * 0.55 + 10, cx - cw / 2 - pw * 0.75);
      const pBottom = portrait ? G - ch * 1.02 : G;
      const nw = clamp(Math.min(W, H) * 0.3, 108, 160), nh = nw * 80 / 120; /* nh >= 72: target >= 64 px both ways */
      L = { W, H, G, cw, ch, k, cx, cy, pw, ph, pcx, pBottom, nw, nh, portrait,
        flap: { x: cx - cw / 2 + FLAP.x * k, y: cy - ch / 2 + FLAP.y * k },
        holster: { x: pcx + pw * 0.62 + nw * 0.32, y: pBottom - ph * 0.56 } };
      put(car, cx, cy, cw, ch);
      put(pump, pcx, pBottom - ph / 2, pw, ph);
      put(island, pcx, pBottom + 8, pw * 1.5, 22);
      island.hidden = !portrait;
      put(ring, L.flap.x, L.flap.y, 84, 84);
      put(zone, W / 2, H / 2, W, H);
      const gw = portrait ? W * 0.84 : Math.min(W * 0.5, 420);
      put(gauge, portrait ? W / 2 : cx, portrait ? H * 0.1 : Math.max(36, cy - ch / 2 - 34), gw, 58);
      hoseSvg.setAttribute('width', W); hoseSvg.setAttribute('height', H);
      placeNozzle();
    }
    /* nozzle centre for its state */
    function nozzleHome() { return L.holster; }
    function nozzleInTank() { return { x: L.flap.x - L.nw * (118 / 120 - 0.5) + 4, y: L.flap.y - L.nh * (26 / 80 - 0.5) }; }
    function placeNozzle() {
      const at = phase === 'fill' || phase === 'full' ? nozzleInTank() : nozzleHome();
      put(nozzle, at.x, at.y, L.nw, L.nh);
      drawHose(at.x, at.y);
    }
    function drawHose(nx, ny) {
      const sx = L.pcx + L.pw * 0.4, sy = L.pBottom - L.ph * 0.18;   /* hose leaves the pump side */
      const ex = nx - L.nw * 0.36, ey = ny + L.nh * 0.42;              /* nozzle grip end */
      const sag = Math.max(40, Math.hypot(ex - sx, ey - sy) * 0.45);
      const d = 'M' + sx.toFixed(0) + ' ' + sy.toFixed(0) + 'C' + (sx + 30).toFixed(0) + ' ' + (sy + sag).toFixed(0) + ' ' +
        (ex - 20).toFixed(0) + ' ' + (ey + sag).toFixed(0) + ' ' + ex.toFixed(0) + ' ' + ey.toFixed(0);
      hoseO.setAttribute('d', d); hoseI.setAttribute('d', d);
    }
    function showHint() {
      if (phase === 'flap') S.hint({ type: 'tap', at: L.flap });
      else if (phase === 'drag') S.hint({ type: 'drag', at: nozzleHome(), to: nozzleInTank() });
      else if (phase === 'fill') S.hint({ type: 'hold', at: nozzleInTank() });
    }
    function setLevel(v) {
      level = Math.min(1, v);
      fill.style.transform = 'scaleX(' + level.toFixed(3) + ')';
      litres.textContent = String(Math.round(level * 40));
      while (pts - 2 < 4 && level >= [0.25, 0.5, 0.75, 1][pts - 2]) { pts++; S.point(); if (pts === 4) S.say('fx-yay'); }
    }

    S.tap(flap, () => {
      if (phase !== 'flap') return;
      phase = 'drag';
      flap.classList.add('open');
      ring.classList.add('tank');
      S.snd('pop');
      S.bump(carIn, 0.2);
      S.burst(L.flap, null, 10);
      pts++; S.point();
      S.later(showHint, 300);
    });

    S.drag(nozzle, {
      enabled: () => phase === 'drag',
      onStart() { S.snd('tap'); },
      onMove(p) { const c = S.local(p.cx, p.cy); drawHose(c.x, c.y); },
      onEnd(p) {
        const c = S.local(p.cx, p.cy), tip = { x: c.x + L.nw * (118 / 120 - 0.5), y: c.y + L.nh * (26 / 80 - 0.5) };
        if (S.dist(tip, L.flap) > Math.max(90, L.nw * 0.9) && S.dist(c, L.flap) > Math.max(100, L.nw)) {
          const h = nozzleHome(); drawHose(h.x, h.y);
          return false;
        }
        phase = 'fill';
        S.clearDrag(nozzle);
        placeNozzle();
        nozzle.classList.add('in');
        zone.classList.add('on');
        ring.hidden = true;
        S.snd('ding', 2);
        S.snd('pop');
        S.comic('Kiinni!', { x: L.flap.x + 40, y: L.flap.y - 70 });
        pts++; S.point();
        S.later(showHint, 350);
        return true;
      }
    });

    const holdOpts = {
      enabled: () => phase === 'fill',
      onStart() { nozzle.classList.add('pour'); gauge.classList.add('flow'); S.snd('plop'); glugT = 0; },
      onHold(ms, dt) {
        if (phase !== 'fill') return;
        setLevel(level + dt / FILL_MS);
        glugT += dt;
        if (glugT > 300) { glugT = 0; S.snd('plop'); S.progress(); }
        if (level >= 1) full();
      },
      onRelease() { nozzle.classList.remove('pour'); gauge.classList.remove('flow'); }
    };
    S.hold(nozzle, holdOpts);
    S.hold(zone, holdOpts);

    function full() {
      if (ended) return;
      ended = true;
      phase = 'full';
      zone.classList.remove('on');
      S.hideHint();
      nozzle.classList.remove('pour', 'in');
      gauge.classList.remove('flow');
      gauge.classList.add('full');
      setLevel(1);
      S.snd('ding', 4);
      S.comic('Täynnä!', { x: L.portrait ? S.W / 2 : L.cx, y: L.portrait ? S.H * 0.22 : L.cy - L.ch * 0.7 });
      S.later(() => {
        phase = 'away';
        nozzle.classList.add('home');
        placeNozzle();
        flap.classList.remove('open');
        car.classList.add('happy');
        honk(S);
        S.say('fx-beep');
        carIn.classList.add('bounce');
      }, 450);
      S.later(() => S.finish(), 900);                                        /* praise while the car honks and bounces */
      S.later(() => { car.classList.add('drive'); S.snd('whoosh'); }, 2000);  /* then it drives off */
    }

    S.fillRest = () => { if (!ended) { phase = 'fill'; setLevel(1); full(); } return 1200; };
    S.resize = () => { layout(); };
    eyesFollow(S, carIn);
    S.idleHint(showHint, 2400);
    S.endWait = 1700;
    S.autoFinish = false; /* the outro calls S.finish() */

    layout();
    setLevel(0);
    S.later(() => { phase = 'flap'; showHint(); S.progress(); }, 450);
  }
};
