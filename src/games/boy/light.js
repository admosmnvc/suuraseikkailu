/* boy 3 – Vihreä valo, kaasua! Traffic light red -> yellow -> green. On green tap the big GAS pedal:
   the car zooms down the street to the next light (4 lights). Tapping on red/yellow is fine: the pedal
   squashes, the light wiggles and a bubble says "ODOTA!". Tapping the car honks. */
import { carSideSVG, wheelSVG, lightSVG, pedalSVG, CAR_COLORS } from './art.js';
import { put, honk, clamp, eyesFollow } from './kit.js';

const ROUNDS = 4;
const RED_MS = [950, 1250], YELLOW_MS = 650, DRIVE_MS = 1150;

/* soft pastel skyline tile (seamless when repeated): a few rounded buildings + round trees */
function cityTile(w, h, seed) {
  let s = '<defs><linearGradient id="blt' + seed + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FD9A8"/><stop offset="1" stop-color="#3FBF86"/></linearGradient></defs>';
  let x = 14, i = seed;
  const cols = ['#CFE6FF', '#FFE9A8', '#FFD9C2', '#C6F0EA', '#DCD6FF', '#BFE0FF'];
  while (x < w - 40) {
    const bw = 74 + ((i * 37) % 44), bh = h * (0.36 + ((i * 53) % 30) / 100), c = cols[i % cols.length], y = h - bh;
    s += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + (bh + 20) + '" rx="18" fill="' + c + '"/>';
    s += '<rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="' + (bw * 0.28) + '" height="' + (bh - 12) + '" rx="10" fill="#fff" opacity=".35"/>';
    for (let wy = y + 22; wy < h - 30; wy += 34) for (let wx = x + 18; wx < x + bw - 24; wx += 26) {
      s += '<rect x="' + wx + '" y="' + wy + '" width="12" height="16" rx="5" fill="#fff" opacity=".8"/>';
    }
    if (i % 2 === 0) {
      const tx = x + bw + 10;
      s += '<rect x="' + (tx - 3) + '" y="' + (h - 34) + '" width="6" height="34" rx="3" fill="#B98A62"/><circle cx="' + tx + '" cy="' + (h - 44) + '" r="20" fill="url(#blt' + seed + ')"/>' +
        '<circle cx="' + (tx - 7) + '" cy="' + (h - 52) + '" r="6" fill="#fff" opacity=".35"/>';
    }
    x += bw + 30; i++;
  }
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none" aria-hidden="true">' + s + '</svg>';
}

export default {
  id: 'light',
  goal: ROUNDS,
  start(S) {
    let state = 'red', round = 0, L = null, cam = 0, drive = null, waitT = 0, lastWait = 0, cur = 0, ended = false;
    const city = S.el('div', 'bl-city');
    const road = S.el('div', 'bl-road');
    const dashes = S.el('div', 'bl-dashes', '', road);
    const lights = [0, 1].map(() => { const el = S.el('div', 'bl-light', lightSVG()); return { el, wx: 0 }; });
    const car = S.el('button', 'bl-car');
    car.type = 'button';
    car.setAttribute('aria-label', 'Auto');
    const carIn = S.el('div', 'bl-car-in', '', car);
    S.el('div', 'bw-wheel bw-w1 bl-wh', wheelSVG('normal', true), carIn);
    S.el('div', 'bw-wheel bw-w2 bl-wh', wheelSVG('normal', true), carIn);
    S.el('div', 'bw-body', carSideSVG({ color: CAR_COLORS[0] }), carIn);
    S.el('div', 'bl-speed', '<i></i><i></i><i></i>', car);
    const pedal = S.el('button', 'bl-pedal', pedalSVG() + '<b>Kaasu</b>');
    pedal.type = 'button';
    pedal.setAttribute('aria-label', 'Kaasupoljin');

    function layout() {
      const W = S.W, H = S.H, portrait = W < H;
      const top = H * (portrait ? 0.62 : 0.6);
      const cw = portrait ? Math.min(W * 0.62, 340) : Math.min(W * 0.42, H * 0.46 * 400 / 230, 470);
      const ch = cw * 230 / 400;
      const lh = portrait ? Math.min(H * 0.4, W * 0.9) : Math.min(H * 0.62, 340), lw = lh * 100 / 250;
      const ps = clamp(Math.min(W, H) * (portrait ? 0.34 : 0.36), 100, 170);
      L = { W, H, top, cw, ch, lh, lw, ps, portrait, D: W * 1.15,
        car: { x: portrait ? W * 0.3 : W * 0.24, y: top + (H - top) * 0.42 - ch * 0.42 },
        light: { x: portrait ? W * 0.8 : W * 0.58, y: top - lh / 2 + lh * 0.06 },
        pedal: portrait ? { x: W - ps * 0.62, y: H - ps * 0.68 } : { x: W - ps * 0.62, y: H - ps * 0.7 } };
      put(city, W / 2, top / 2 + 2, W, top + 4);
      put(road, W / 2, (top + H) / 2, W, H - top);
      put(car, L.car.x, L.car.y, cw, ch);
      put(pedal, L.pedal.x, L.pedal.y, ps, ps * 1.25);
      city.innerHTML = '';
      const th = Math.round(top + 4), tw = 640;
      city.style.setProperty('--tw', tw + 'px');
      for (let i = 0; i < Math.ceil(W / tw) + 1; i++) city.insertAdjacentHTML('beforeend', cityTile(tw, th, 3 + (i % 2) * 0)); /* same tile: seamless */
      for (const l of lights) { l.el.style.width = Math.round(lw) + 'px'; l.el.style.height = Math.round(lh) + 'px'; l.el.style.top = Math.round(L.light.y - lh / 2) + 'px'; }
      if (!drive) { lights[cur].wx = cam + L.light.x; lights[1 - cur].wx = cam + L.light.x + L.D; }
      paint();
    }
    function paint() {
      const W = L.W;
      for (const l of lights) {
        const x = l.wx - cam;
        l.el.style.translate = (x - L.lw / 2).toFixed(1) + 'px 0';
        l.el.style.visibility = x < -L.lw || x > W + L.lw ? 'hidden' : 'visible';
      }
      const tw = 640;
      city.style.translate = (-(cam * 0.5 % tw)).toFixed(1) + 'px 0';
      dashes.style.translate = (-(cam % 96)).toFixed(1) + 'px 0';
    }
    function setLight(i, st) {
      const el = lights[i].el;
      el.classList.remove('red', 'yellow', 'green');
      el.classList.add(st);
    }
    function setState(st) {
      if (ended || (round >= ROUNDS && st !== 'red')) return;
      state = st;
      setLight(cur, st);
      pedal.classList.toggle('go', st === 'green');
      if (st === 'red') {
        S.later(() => setState('yellow'), RED_MS[0] + Math.random() * (RED_MS[1] - RED_MS[0]));
      } else if (st === 'yellow') {
        S.snd('tap');
        S.later(() => setState('green'), YELLOW_MS);
      } else if (st === 'green') {
        S.snd('ding', round);
        S.comic('Aja!', { x: L.light.x - L.lw * 1.3, y: L.light.y - L.lh * 0.2 });
        if (round === 0) showHint();
        S.progress();
      }
    }
    function showHint() { if (state === 'green') S.hint({ type: 'tap', at: L.pedal }); }

    S.tap(pedal, () => {
      if (state === 'green') {
        state = 'drive';
        pedal.classList.remove('go');
        round++;
        S.point();
        S.snd('whoosh');
        S.bump(pedal, 0.6);
        car.classList.add('zoom');
        drive = { t: 0, from: cam, to: cam + L.D };
        if (round >= ROUNDS) S.later(finishGame, 600); /* praise while the car speeds away */
        return;
      }
      if (state === 'drive') return;
      /* red / yellow: nothing bad – wiggle + "odota" */
      S.snd('tap');
      const el = lights[cur].el;
      if (el.animate && !S.rm) el.animate([{ rotate: '0deg' }, { rotate: '-6deg' }, { rotate: '6deg' }, { rotate: '0deg' }], { duration: 320 });
      else S.bump(el, 0.3);
      if (carIn.animate && !S.rm) carIn.animate([{ translate: '0 0' }, { translate: '-3px 1px' }, { translate: '3px -1px' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 260 });
      const t = performance.now();
      if (t - lastWait > 900) { lastWait = t; S.comic('Odota!', { x: L.light.x - L.lw * 1.3, y: L.light.y - L.lh * 0.2 }); }
    });
    S.tap(car, () => { honk(S); S.bump(carIn, 0.5); });

    S.update = (dt) => {
      if (!drive) return;
      drive.t += dt * 1000;
      const q = Math.min(1, drive.t / DRIVE_MS), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
      cam = drive.from + (drive.to - drive.from) * e;
      if (round >= ROUNDS) car.style.translate = (Math.max(0, q - 0.35) * L.W * 1.6).toFixed(0) + 'px 0';
      paint();
      if (q >= 1) {
        drive = null;
        car.classList.remove('zoom');
        if (round >= ROUNDS) { finishGame(); return; }
        /* the light we passed goes ahead; the new one is red */
        lights[cur].wx = lights[1 - cur].wx + L.D;
        cur = 1 - cur;
        setState('red');
      }
    };
    function finishGame() {
      if (ended) return;
      ended = true;
      state = 'done';
      S.finish();
    }

    S.fillRest = () => {
      if (ended) return 0;
      state = 'drive';
      round = ROUNDS;
      car.classList.add('zoom');
      drive = { t: 0, from: cam, to: cam + L.D };
      return 1100;
    };
    S.resize = () => { layout(); };
    eyesFollow(S, carIn);
    S.idleHint(showHint, 2400);
    S.endWait = 1500;
    S.autoFinish = false; /* the outro calls S.finish() */

    layout();
    setLight(1, 'red');
    setState('red');
  }
};
