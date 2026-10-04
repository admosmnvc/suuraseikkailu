/* 0 - Puhkaise ilmapallot! Ice-pastel glittering balloons rise; tap to pop. */
import { clamp, mix } from '../util.js';
import { FX } from '../fx.js';
import { snd } from './core.js';
import { floaters } from './floaters.js';
import { balloonSVG } from './svg.js';

export const GOAL = 8;
/* ice blue, lilac, rose, aqua, periwinkle, lavender pink, pearl */
const COLORS = ['#8FD0FF', '#BFA8FF', '#FFA6D8', '#7FE0E0', '#9DB4FF', '#E3B5FF', '#D6E6FA'];

export function game(S) {
  const c0 = (Math.random() * COLORS.length) | 0;
  floaters(S, {
    dir: -1, max: () => clamp(Math.round(S.W / 130), 5, 8), aspect: 1.7, cyFrac: 0.318, cls: 'mg-balloon', label: 'Ilmapallo',
    size: () => Math.round(clamp((window.innerWidth || S.W) * 0.2, 72, 108)),
    art: (n) => { const c = COLORS[(c0 + n) % COLORS.length]; return { html: balloonSVG(c), color: c }; },
    initial: S.W > 700 ? [0.06, 0.26, 0.46, 0.66, 0.86] : [0.08, 0.34, 0.6, 0.86], cross: [6.5, 8.5], every: [0.7, 1.05], sway: true, spin: false,
    onHit: (it, v) => {
      FX.burst(v.x, v.y, [mix(it.c, '#2F6FE0', 0.15), '#FFFFFF', it.c], 22);
      snd('pop');
    }
  });
}
