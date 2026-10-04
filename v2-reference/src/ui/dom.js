/* Small DOM helpers shared by the ui modules. OWNER: ui agent. */
import { mix, hexToRgb, reducedMotion } from '../util.js';

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Calls fn and swallows errors from modules that are optional for the flow (FX, SFX...). */
export function safe(fn) {
  try { return fn(); } catch (e) { return undefined; }
}

/* Section colour as CSS variables: --c, --c-rgb, --c-soft, --c-tint (light, for surfaces), --c-deep (accents). */
export function secVars(el, hex) {
  const c = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#9A7BFF';
  el.style.setProperty('--c', c);
  el.style.setProperty('--c-rgb', hexToRgb(c).join(','));
  el.style.setProperty('--c-soft', mix(c, '#ffffff', 0.5));
  el.style.setProperty('--c-tint', mix(c, '#ffffff', 0.84));
  el.style.setProperty('--c-deep', mix(c, '#23306B', 0.5));
}

export function focusEl(el) {
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* ignore */ } }
}

/* Restarts a one-shot CSS animation class. */
export function replayClass(el, cls) {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

let toastTimer = 0;
export function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
export function hideToast() {
  const t = $('toast');
  clearTimeout(toastTimer);
  if (t) t.classList.remove('show');
}

/* Center of an element in viewport coordinates. */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}
