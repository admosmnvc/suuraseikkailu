/* Suuraseikkailu v3 – art/icons.js: friendly rounded 24x24 UI icons in currentColor.
   Soft duotone: a round-capped line plus a light tint fill (currentColor at 22 %). OWNER: art agent.
   Names: CONTRACTS "Art API v3" + extras (star-fill, heart, flag, sparkle, snowflake). */
import { esc, f, starPath, sparklePath, heartPath } from './common.js';

const SW = 2.3;
const SK = (w) => ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="' + (w || SW) + '"';
const TINT = ' fill="currentColor" fill-opacity=".22" stroke="none"';
const FILL = ' fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="2"';
const DOT = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 1.4) + '" fill="currentColor"/>';
const duo = (d, w) => '<path d="' + d + '"' + TINT + '/><path d="' + d + '"' + SK(w) + '/>';

function gearOutline() {
  const cx = 12, cy = 12, ro = 9.6, ri = 7.4, n = 8, step = Math.PI * 2 / n;
  const pt = (r, a) => f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    const a0 = a - 0.28 * step, a1 = a - 0.14 * step, a2 = a + 0.14 * step, a3 = a + 0.28 * step, nx = a + step - 0.28 * step;
    d += (i ? 'L' : 'M') + pt(ri, a0) + 'L' + pt(ro, a1) + 'A' + ro + ' ' + ro + ' 0 0 1 ' + pt(ro, a2) +
      'L' + pt(ri, a3) + 'A' + ri + ' ' + ri + ' 0 0 1 ' + pt(ri, nx);
  }
  return d + 'Z';
}

function flakeD(cx, cy, L) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3, ux = Math.cos(a), uy = Math.sin(a);
    d += 'M' + f(cx) + ' ' + f(cy) + 'L' + f(cx + ux * L) + ' ' + f(cy + uy * L);
    const px = cx + ux * L * 0.58, py = cy + uy * L * 0.58;
    for (let s = -1; s <= 1; s += 2) {
      const ba = a + s * 0.85;
      d += 'M' + f(px) + ' ' + f(py) + 'L' + f(px + Math.cos(ba) * L * 0.32) + ' ' + f(py + Math.sin(ba) * L * 0.32);
    }
  }
  return d;
}

const STAR = starPath(12, 12.8, 9.6, 4.6, 5);

const ICONS = {
  home: duo('M4.6 10.4 12 4l7.4 6.4v8.4a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8z') +
    '<path d="M10 20.6v-3.8a2 2 0 0 1 4 0v3.8"' + SK() + '/>',
  play: '<path d="M8 5.6v12.8a1.3 1.3 0 0 0 2 1.1l10-6.4a1.3 1.3 0 0 0 0-2.2L10 4.5a1.3 1.3 0 0 0-2 1.1z"' + FILL + '/>',
  star: duo(STAR),
  'star-fill': '<path d="' + STAR + '"' + FILL + '/>',
  speech: duo('M6.2 4h11.6a3 3 0 0 1 3 3v6.8a3 3 0 0 1-3 3h-5.6l-4.4 3.4c-.5.4-1.2 0-1.2-.6V16.8h-.4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z') +
    DOT(8.4, 10.4) + DOT(12, 10.4) + DOT(15.6, 10.4),
  gear: duo(gearOutline(), 2.1) + '<circle cx="12" cy="12" r="2.8"' + SK(2.1) + '/>',
  close: '<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"' + SK(2.7) + '/>',
  check: '<path d="M5 12.6l4.6 4.6L19 7.6"' + SK(2.8) + '/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"' + SK() + '/><path d="M3.8 4v4.8h4.8"' + SK() + '/>',
  back: '<path d="M19 12H5.6M11.4 5.8 5.2 12l6.2 6.2"' + SK(2.6) + '/>',
  sound: duo('M4.4 9.2h2.8l4.4-3.8a.8.8 0 0 1 1.3.6v12a.8.8 0 0 1-1.3.6l-4.4-3.8H4.4a1.2 1.2 0 0 1-1.2-1.2v-3.2a1.2 1.2 0 0 1 1.2-1.2z') +
    '<path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.4a8 8 0 0 1 0 11.2"' + SK() + '/>',
  mic: duo('M12 3.2a3 3 0 0 1 3 3v5.4a3 3 0 0 1-6 0V6.2a3 3 0 0 1 3-3z') +
    '<path d="M6 11.4a6 6 0 0 0 12 0M12 17.4v3.2M9 20.8h6"' + SK() + '/>',
  stop: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="3"' + FILL + '/>',
  trash: '<path d="M4.4 6.8h15.2M9.4 6.8V5.2a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6"' + SK() + '/>' +
    duo('M6.4 6.8l.8 12a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8l.8-12z') + '<path d="M10.2 10.8v5.6M13.8 10.8v5.6"' + SK(2) + '/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"' + SK(2.8) + '/>',
  // profile = a name badge with a star (no human figure anywhere in the app)
  user: duo('M6 6.2h12a3 3 0 0 1 3 3v8.4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9.2a3 3 0 0 1 3-3z') +
    '<path d="M10 6.2V4.4a2 2 0 0 1 4 0v1.8"' + SK(2) + '/>' +
    '<path d="' + starPath(8.6, 13.6, 3.2, 1.5, 5) + '" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>' +
    '<path d="M13.8 12.2h3.6M13.8 15.4h2.6"' + SK(2) + '/>',
  edit: duo('M15.4 4.6a2.2 2.2 0 0 1 3.1 0l.9.9a2.2 2.2 0 0 1 0 3.1L9 19l-4.4.9.9-4.4z') + '<path d="M13.6 6.4l4 4"' + SK(2) + '/>',
  crown: duo('M4.4 17.4 3.4 8.8l4.8 3.6L12 6.4l3.8 6 4.8-3.6-1 8.6z') + '<path d="M5 20.6h14"' + SK() + '/>' +
    DOT(3.4, 6.6, 1.5) + DOT(12, 3.8, 1.5) + DOT(20.6, 6.6, 1.5),
  gem: duo('M7.4 4.4h9.2l4.2 5.1L12 20 3.2 9.5z') + '<path d="M3.6 9.5h16.8M10 4.6 8.6 9.5 12 19.4l3.4-9.9-1.4-4.9"' + SK(1.6) + '/>',
  rocket: duo('M14.6 4.4c2.3-1 4.4-1 5.4-.4.6 1 .6 3.1-.4 5.4-1 2.5-3.5 5.2-6.6 7.1l-3.5-3.5c1.9-3.1 4.6-5.6 7.1-6.6z', 2.1) +
    '<circle cx="15.6" cy="8.4" r="1.6" fill="currentColor"/>' +
    '<path d="M9.6 9.8 6 9.6l-2 2.4 4 1.1M14.2 14.4l.2 3.6-2.4 2-1.1-4"' + SK(2) + '/>' +
    '<path d="M6.6 16.2c-1.3.6-2 1.8-2.2 3.4 1.6-.2 2.8-.9 3.4-2.2"' + SK(2) + '/>',
  car: duo('M3.2 15.4v-2.2c0-.9.6-1.6 1.5-1.8l3-.6 2.4-3c.4-.5 1-.8 1.6-.8h3.4c.7 0 1.3.3 1.7.9l1.9 2.9 1.5.4c.8.2 1.4 1 1.4 1.8v2.4c0 .5-.4.9-.9.9H4.1c-.5 0-.9-.4-.9-.9z', 2.1) +
    '<circle cx="7.6" cy="16.2" r="2.4" fill="currentColor"/><circle cx="16.4" cy="16.2" r="2.4" fill="currentColor"/>',
  lock: duo('M6.8 10.6h10.4a2.4 2.4 0 0 1 2.4 2.4v5.4a2.4 2.4 0 0 1-2.4 2.4H6.8a2.4 2.4 0 0 1-2.4-2.4V13a2.4 2.4 0 0 1 2.4-2.4z') +
    '<path d="M8 10.6V7.8a4 4 0 0 1 8 0v2.8"' + SK() + '/>' + '<path d="M12 14.6v2"' + SK(2.6) + '/>',
  heart: duo(heartPath(12, 12.4, 18.4)),
  flag: '<path d="M5.4 20.8V4"' + SK(2.4) + '/>' + duo('M5.4 4.6c2.9-1.5 5.3 1.3 8.2 0 2.1-1 3.8-1 5.4-.2v8.8c-1.6-.8-3.3-.8-5.4.2-2.9 1.3-5.3-1.5-8.2 0z', 2),
  snowflake: '<path d="' + flakeD(12, 12, 9.2) + '"' + SK(2) + '/>',
  sparkle: '<path d="' + sparklePath(10.4, 10, 7) + '"' + TINT + '/><path d="' + sparklePath(10.4, 10, 7) + '"' + SK(2) + '/>' +
    '<path d="' + sparklePath(18.2, 17.6, 3) + '" fill="currentColor"/>' + DOT(5.2, 19, 1.3)
};

export const ICON_NAMES = Object.keys(ICONS);

export function icon(name, className) {
  const body = ICONS[name] || '';
  const cls = 'icon' + (className ? ' ' + esc(className) : '');
  return '<svg xmlns="http://www.w3.org/2000/svg" class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
}
