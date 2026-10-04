/* Touch feedback for everything with class "jelly": squash on press, bounce back on release,
   a tiny sparkle at the finger and SFX.tap(). Reduced motion: no squash, bounce or sparkle. OWNER: ui agent. */
import { SFX } from '../audio/sfx.js';
import { reducedMotion } from '../util.js';

const POOL = 4;
let sparks = [], next = 0;

function spark(x, y) {
  if (!sparks.length) {
    for (let i = 0; i < POOL; i++) {
      const s = document.createElement('span');
      s.className = 'tap-spark';
      s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<i></i><i></i><i></i>';
      document.body.appendChild(s);
      sparks.push(s);
    }
  }
  const s = sparks[next++ % POOL];
  s.classList.remove('go');
  s.style.left = x + 'px';
  s.style.top = y + 'px';
  s.style.setProperty('--rot', Math.round(Math.random() * 90) + 'deg');
  void s.offsetWidth;
  s.classList.add('go');
}

export function initPress() {
  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !e.target || !e.target.closest) return;
    const el = e.target.closest('.jelly');
    if (!el || el.disabled) return;
    try { SFX.tap(); } catch (err) { /* sound is optional */ }
    if (reducedMotion()) return;
    el.classList.remove('boing');
    el.classList.add('pressed');
    spark(e.clientX, e.clientY);
    const release = () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      el.classList.remove('pressed');
      void el.offsetWidth;
      el.classList.add('boing');
    };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
  }, { passive: true, capture: true });
  const done = (e) => { if (e.animationName === 'jelly-boing' && e.target.classList) e.target.classList.remove('boing'); };
  document.addEventListener('animationend', done);
  document.addEventListener('animationcancel', done); /* e.g. the element got hidden mid-bounce */
}
