/* Praise pop: a big clean rounded word ("Hienoa!", "Upeaa!") with a soft glow that springs up from a button,
   plus a small confetti puff. Callers pass the rect of a button in the action bar / an overlay card, so it never
   covers the Arabic. Reduced motion: the word shows still for a moment, no confetti. OWNER: ui agent. */
import { FX } from '../fx.js';
import { reducedMotion } from '../util.js';

export const WORDS = ['Hienoa!', 'Upeaa!', 'Mahtavaa!', 'Jee!', 'Super!', 'Huippua!'];

export function randomWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

/* the theme's colours for confetti */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  return ['--t1', '--t2', '--t3', '--t4'].map((v) => cs.getPropertyValue(v).trim()).filter(Boolean).concat(['#FFFFFF']);
}

/* Word centred on rect r (DOMRect). */
export function popPraise(r, word) {
  if (!r || !document.body) return;
  const el = document.createElement('div');
  el.className = 'praise-pop';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = word;
  el.style.left = Math.round(r.left + r.width / 2) + 'px';
  el.style.top = Math.round(r.top + r.height / 2) + 'px';
  document.body.appendChild(el);
  const kill = () => el.remove();
  el.addEventListener('animationend', kill);
  setTimeout(kill, 1500);
  if (!reducedMotion()) { try { FX.burst(r.left + r.width / 2, r.top + r.height / 2, themeColors(), 16); } catch (e) { /* optional */ } }
}
