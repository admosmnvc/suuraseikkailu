/* 1 - Napauta lumihiutaleita! Big crystal snowflakes drift down and spin slowly; tap to sparkle them away. */
import { clamp } from '../util.js';
import { FX } from '../fx.js';
import { snd } from './core.js';
import { floaters } from './floaters.js';
import { snowflakeSVG } from './svg.js';

export const GOAL = 8;
const TINTS = ['#6CC4F0', '#9C8CF2', '#5FC9DC', '#F08CC8', '#7FA8F8'];

export function game(S) {
  const t0 = (Math.random() * TINTS.length) | 0;
  floaters(S, {
    dir: 1, max: () => clamp(Math.round(S.W / 110), 5, 8), aspect: 1, cyFrac: 0.5, cls: 'mg-flake', label: 'Lumihiutale',
    size: () => Math.round(clamp(S.W * 0.22, 80, 120)),
    art: (n) => { const c = TINTS[(t0 + n) % TINTS.length]; return { html: snowflakeSVG(c), color: c }; },
    initial: S.W > 700 ? [0.0, 0.2, 0.4, 0.58] : [0.02, 0.26, 0.5], cross: [7, 9], every: [0.85, 1.2], sway: true, spin: true,
    onHit: (it, v) => {
      FX.sparkle(v.x, v.y);
      snd('ding', S.score);
    }
  });
}
