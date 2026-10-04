/* Frost background: soft gradient (CSS), rising translucent bubbles, floating snowflakes, twinkles and the
   ice palace silhouette at the bottom. 22 elements, transform/opacity animations only, paused while the
   page is hidden (and on request, e.g. during a minigame), static with reduced motion. OWNER: ui agent. */
import ART from '../art.js';

const BUBBLES = 8, FLAKES = 7, TWINKLES = 6;
const TWINKLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 0C13 7.5 16.5 11 24 12C16.5 13 13 16.5 12 24C11 16.5 7.5 13 0 12C7.5 11 11 7.5 12 0Z"/></svg>';

/* Deterministic pseudo-random numbers: the scene looks the same on every load. */
function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function item(cls, vars, html) {
  const style = Object.keys(vars).map((k) => '--' + k + ':' + vars[k]).join(';');
  return '<span class="' + cls + '" style="' + style + '">' + (html || '') + '</span>';
}

export function initBackground(root) {
  if (!root) return { pause() {} };
  const r = rng(7);
  let html = '';
  for (let i = 0; i < BUBBLES; i++) {
    const s = Math.round(26 + r() * 64);
    html += item('bg-bubble', {
      x: ((i + 0.15 + r() * 0.7) * (100 / BUBBLES)).toFixed(1) + '%',
      s: s + 'px',
      t: (16 + r() * 14).toFixed(1) + 's',
      d: (-r() * 30).toFixed(1) + 's',
      sway: Math.round(-30 + r() * 60) + 'px',
      y: Math.round(12 + r() * 70)
    });
  }
  const flake = ART.snowflake('bg-flake-art');
  for (let i = 0; i < FLAKES; i++) {
    html += item('bg-flake', {
      x: ((i + 0.1 + r() * 0.8) * (100 / FLAKES)).toFixed(1) + '%',
      s: Math.round(16 + r() * 22) + 'px',
      t: (20 + r() * 16).toFixed(1) + 's',
      d: (-r() * 36).toFixed(1) + 's',
      sway: Math.round(-40 + r() * 80) + 'px',
      y: Math.round(8 + r() * 62)
    }, flake);
  }
  for (let i = 0; i < TWINKLES; i++) {
    html += item('bg-twinkle', {
      x: (4 + r() * 92).toFixed(1) + '%',
      top: (6 + r() * 58).toFixed(1) + '%',
      s: Math.round(10 + r() * 12) + 'px',
      t: (2.8 + r() * 2.4).toFixed(1) + 's',
      d: (-r() * 5).toFixed(1) + 's'
    }, TWINKLE_SVG);
  }
  html += '<div class="bg-palace">' + ART.palaceSilhouette() + '</div>';
  root.innerHTML = html;

  const sync = () => root.classList.toggle('paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    /* extra pause (e.g. an opaque minigame covers the background) */
    pause(on) { root.classList.toggle('held', !!on); }
  };
}
