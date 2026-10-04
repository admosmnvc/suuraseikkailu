/* Shared small helpers (ported from v1 games.js). */
export const TAU = Math.PI * 2;
export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
let motionMQ = null;
try { motionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { motionMQ = null; }
export function reducedMotion() { return !!(motionMQ && motionMQ.matches); }
export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(hex, toHex, amt) {
  const a = hexToRgb(hex), b = hexToRgb(toHex);
  let s = '#';
  for (let i = 0; i < 3; i++) {
    const v = Math.round(a[i] + (b[i] - a[i]) * amt);
    s += (v < 16 ? '0' : '') + v.toString(16);
  }
  return s;
}
export function shade(hex, amt) { return amt < 0 ? mix(hex, '#000000', -amt) : mix(hex, '#ffffff', amt); }
