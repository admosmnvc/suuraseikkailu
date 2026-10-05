/* boy 4 – Aja kilpaa ja kerää tähdet! Top-down race road scrolling down. The car follows the finger
   left/right at once (touch anywhere = the car jumps under the finger). Stars = points; cones just bounce
   aside (no fail). 8 stars -> checkered finish line -> the car zooms off. */
import { carTopSVG, starSVG, coneSVG, checkerSVG, CAR_COLORS } from './art.js';
import { put, clamp } from './kit.js';

const GOAL = 8;

export default {
  id: 'race',
  goal: GOAL,
  start(S) {
    let streak = 0, missed = false, L = null, carX = 0, tilt = 0, lastX = 0, spawnIn = 0.5, n = 0, got = 0, things = [], line = null, ended = false, scroll = 0, zoomT = -1, lastLane = 1;
    const grass = S.el('div', 'br-grass');
    const bushL = S.el('div', 'br-bush'), bushR = S.el('div', 'br-bush');
    const road = S.el('div', 'br-road');
    const kerbL = S.el('div', 'br-kerb br-kerb-l', '', road);
    const kerbR = S.el('div', 'br-kerb br-kerb-r', '', road);
    const div1 = S.el('div', 'br-div', '', road);
    const div2 = S.el('div', 'br-div', '', road);
    const layer = S.el('div', 'br-layer');
    const car = S.el('div', 'br-car', carTopSVG(CAR_COLORS[0]));
    const zone = S.el('div', 'br-zone');

    function layout() {
      const W = S.W, H = S.H;
      const RW = Math.min(W * 0.84, H * 1.25, 560), lane = RW / 3;
      const cw = Math.min(lane * 0.62, H * 0.3 / 1.6), ch = cw * 1.6;
      L = { W, H, RW, lane, cw, ch, x0: (W - RW) / 2, carY: H - ch * 0.62 - 8, speed: H / 1.8, size: clamp(lane * 0.56, 48, 110) };
      put(grass, W / 2, H / 2, W, H);
      const side = (W - RW) / 2;
      for (const b of [bushL, bushR]) { b.style.width = Math.max(0, side - 4) + 'px'; b.style.height = (H + 160) + 'px'; }
      bushL.style.left = '0px'; bushR.style.left = (W - side + 4) + 'px';
      bushL.hidden = bushR.hidden = side < 28;
      put(road, W / 2, H / 2, RW, H);
      for (const k of [kerbL, kerbR]) { k.style.height = (H + 80) + 'px'; }
      div1.style.left = (lane - 5) + 'px'; div2.style.left = (lane * 2 - 5) + 'px';
      for (const d of [div1, div2]) d.style.height = (H + 100) + 'px';
      put(layer, W / 2, H / 2, W, H);
      put(zone, W / 2, H / 2, W, H);
      car.style.width = Math.round(cw) + 'px'; car.style.height = Math.round(ch) + 'px';
      if (!carX) carX = laneX(1);
      carX = clamp(carX, L.x0 + cw * 0.6, L.x0 + RW - cw * 0.6);
      for (const t of things) { t.el.style.width = t.el.style.height = Math.round(L.size) + 'px'; }
      placeCar();
    }
    const laneX = (i) => L.x0 + L.lane * (i + 0.5);
    function laneOf(x) { return clamp(Math.floor((x - L.x0) / L.lane), 0, 2); }
    function placeCar() {
      const y = zoomT >= 0 ? L.carY - zoomT * zoomT * (L.H + L.ch) * 1.2 : L.carY;
      car.style.translate = (carX - L.cw / 2).toFixed(1) + 'px ' + (y - L.ch / 2).toFixed(1) + 'px';
      car.style.rotate = tilt.toFixed(1) + 'deg';
    }
    function steer(p) {
      const a = S.local(p.x, p.y);
      const nx = clamp(a.x, L.x0 + L.cw * 0.6, L.x0 + L.RW - L.cw * 0.6);
      tilt = clamp((nx - carX) * 0.5, -14, 14);
      carX = nx;
      placeCar(); /* same frame as the touch */
    }
    function spawn() {
      n++;
      /* stars mostly; every 2nd star comes in the car's lane so a passive child still collects */
      const star = n % 4 !== 3 || got >= GOAL;
      let lane;
      if (star) lane = (n % 2 === 0 || missed) ? laneOf(carX) : ((Math.random() * 3) | 0);
      if (star) missed = false;
      else { lane = (laneOf(carX) + 1 + ((Math.random() * 2) | 0)) % 3; }
      if (!star && lane === lastLane) lane = (lane + 1) % 3;
      lastLane = lane;
      const el = S.el('div', star ? 'br-star' : 'br-cone', star ? starSVG() : coneSVG(), layer);
      el.style.width = el.style.height = Math.round(L.size) + 'px';
      things.push({ el, star, lane, x: laneX(lane), y: -L.size, vx: 0, vr: 0, r: 0, hit: false });
    }
    function nextStar() {
      let best = null;
      for (const t of things) if (t.star && !t.hit && t.y < L.carY - L.ch * 0.4 && (!best || t.y > best.y)) best = t;
      return best;
    }
    function showHint() {
      if (ended) return;
      const t = nextStar();
      const to = t ? t.x : laneX((laneOf(carX) + 1) % 3);
      if (Math.abs(to - carX) < L.lane * 0.4) S.hint({ type: 'tap', at: { x: to, y: L.carY - L.ch * 0.1 } });
      else S.hint({ type: 'drag', at: { x: carX, y: L.carY }, to: { x: to, y: L.carY } });
    }
    function collect(t) {
      t.hit = true;
      got++;
      streak++;
      if (streak === 3 && got < GOAL) S.say('fx-yay');
      S.snd('ding', got);
      S.burst({ x: t.x, y: t.y }, ['#FFD54A', '#FFFFFF', '#FF9A3C'], 14);
      t.el.classList.add('got');
      S.later(() => t.el.remove(), 260);
      S.point();
      if (got === 3 || got === 6) S.comic(null, { x: t.x, y: t.y - 60 });
      if (got >= GOAL) startLine();
    }
    function bump(t) {
      t.hit = true;
      t.vx = (t.x < carX ? -1 : 1) * (420 + Math.random() * 200);
      t.vr = (Math.random() < 0.5 ? -1 : 1) * 720;
      S.snd('plop');
      S.bump(car, 0.4);
    }
    function startLine() {
      if (line) return;
      line = { el: S.el('div', 'br-line', checkerSVG(), layer), y: -40 };
      line.el.style.width = L.RW + 'px';
      line.el.style.left = L.x0 + 'px';
      S.comic('Maali!', { x: L.W / 2, y: L.H * 0.3 });
    }

    S.drag(zone, { follow: false, enabled: () => !ended && zoomT < 0, onStart: (p) => { steer(p); S.snd('tap'); }, onMove: steer, onEnd: () => { tilt = 0; placeCar(); } });

    S.update = (dt) => {
      if (!L) return;
      const sp = L.speed * (line ? 1.25 : 1);
      scroll += sp * dt;
      div1.style.translate = div2.style.translate = '0 ' + (scroll % 100 - 100).toFixed(1) + 'px';
      kerbL.style.translate = kerbR.style.translate = '0 ' + (scroll % 80 - 80).toFixed(1) + 'px';
      bushL.style.translate = bushR.style.translate = '0 ' + (scroll % 150 - 150).toFixed(1) + 'px';
      if (tilt) { tilt *= Math.pow(0.02, dt); if (Math.abs(tilt) < 0.3) tilt = 0; placeCar(); }
      if (!line && !ended) {
        spawnIn -= dt;
        if (spawnIn <= 0) { spawnIn = 0.66; spawn(); }
      }
      for (let i = things.length - 1; i >= 0; i--) {
        const t = things[i];
        t.y += sp * dt;
        if (t.vx) { t.x += t.vx * dt; t.r += t.vr * dt; }
        if (!t.hit && Math.abs(t.y - L.carY) < L.ch * 0.55 + L.size * 0.35 && Math.abs(t.x - carX) < L.lane * (t.star ? 0.7 : 0.5)) {
          if (t.star) collect(t); else bump(t);
        }
        if (t.y > L.H + L.size || t.x < -L.size * 2 || t.x > L.W + L.size * 2) { if (t.star && !t.hit) { missed = true; streak = 0; } t.el.remove(); things.splice(i, 1); continue; }
        if (!(t.star && t.hit)) t.el.style.translate = (t.x - L.size / 2).toFixed(1) + 'px ' + (t.y - L.size / 2).toFixed(1) + 'px';
        if (t.r) t.el.style.rotate = t.r.toFixed(0) + 'deg';
      }
      if (line) {
        line.y += sp * dt;
        line.el.style.translate = '0 ' + line.y.toFixed(1) + 'px';
        if (line.y > L.carY - L.ch * 0.5 && zoomT < 0) { zoomT = 0; S.snd('whoosh'); S.say('fx-vroom'); S.hideHint(); }
      }
      if (zoomT >= 0) {
        zoomT += dt * 1.6;
        placeCar();
        if (zoomT >= 0.7 && !ended) { ended = true; S.finish(); }
      }
    };
    S.fillRest = () => { if (!line) { got = GOAL; startLine(); line.y = L.carY - L.ch; } return 1000; };
    S.resize = () => { layout(); };
    S.idleHint(showHint, 2200);
    S.endWait = 1500;
    S.autoFinish = false; /* the outro calls S.finish() */

    layout();
    S.later(showHint, 900);
  }
};
