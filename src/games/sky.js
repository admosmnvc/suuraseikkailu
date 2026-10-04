/* 5 - Napauta taivasta! Tap anywhere in the aurora sky: a sparkle rocket rises from the ice palace and
   bursts into a sparkle firework. If nobody taps for a while, one goes up by itself (not counted).
   One rocket per STEP ms (extra taps wait their turn), so mashing still takes ~10 s. */
import { clamp, rand } from '../util.js';
import { FX } from '../fx.js';
import { snd } from './core.js';
import { skylineSVG } from './svg.js';

export const GOAL = 6;
const STEP = 1500; /* ms between two counted rockets */

export function game(S) {
  let inFlight = 0, idle = 0;
  const aur = document.createElement('div');
  aur.className = 'mg-aurora';
  aur.setAttribute('aria-hidden', 'true');
  aur.innerHTML = '<i></i><i></i><i></i>';
  S.add(aur);
  const d = document.createElement('div');
  d.innerHTML = skylineSVG();
  S.add(d.firstChild);

  function launch(p, real) {
    if (inFlight >= 3) return false;
    inFlight += 1;
    const to = S.vp(p.x, p.y), from = S.vp(clamp(p.x + rand(-40, 40), 12, S.W - 12), S.H + 12);
    const hue = rand(0, 360);
    let counted = true;
    const settle = () => { if (counted) { counted = false; inFlight = Math.max(0, inFlight - 1); } };
    S.later(settle, 1500); /* in case FX.clear() dropped the rocket */
    snd('whoosh');
    FX.rocket(from.x, from.y, to.x, to.y, () => {
      settle();
      if (S.dead) return;
      FX.firework(to.x, to.y, hue);
      snd('boom');
      if (real) S.point();
    });
    return true;
  }
  const step = S.paced(STEP, (p) => { idle = 0; launch({ x: clamp(p.x, 16, S.W - 16), y: clamp(p.y, 20, S.H - 110) }, true); });
  S.tap = function (p) { idle = 0; step(p, p); };
  S.update = function (dt) {
    if (!S.active()) return;
    idle += dt;
    if (idle >= 3) {
      idle = 0;
      launch({ x: rand(0.18, 0.82) * S.W, y: rand(0.12, 0.5) * S.H }, false);
    }
  };
}
