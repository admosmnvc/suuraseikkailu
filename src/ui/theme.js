/* Theme: <html data-theme="girl|boy"> from the playing child, and the browser bar colour to match.
   The cover shows both themes; while it is up the bar is neutral cream. OWNER: ui agent. */
import { THEMES } from '../content/prompts.js';

let current = null;

export function themeOf(child) { return child && THEMES.includes(child.theme) ? child.theme : 'girl'; }

export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : 'girl';
  current = t;
  document.documentElement.dataset.theme = t;
  syncBar();
}

export function currentTheme() { return current || 'girl'; }

/* meta theme-color: the theme's own page colour, cream while the cover / picker is up */
export function syncBar(cover) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const c = cover ? '#FFF8F1' : getComputedStyle(document.documentElement).getPropertyValue('--t-meta').trim();
  if (c) meta.setAttribute('content', c);
}
