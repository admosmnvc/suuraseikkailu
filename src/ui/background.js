/* Airy backdrop per theme: cream page with three big soft colour glows (CSS), ART.background(theme) along the
   bottom and a few soft floating shapes near the side edges (girl: bubbles, hearts, sparkles; boy: bubbles, stars,
   sparkles). 6 elements, transform animations only, paused while the page is hidden or on request (minigame),
   still with reduced motion. OWNER: ui agent. */
import ART from '../art.js';

/* [kind, x %, top %, size px, duration s, delay s] – fixed, so the scene looks the same on every load;
   near the side edges, so they never sit behind text */
const SHAPES = {
  girl: [['bubble', 3, 16, 34, 7, -1], ['spark', 93, 11, 22, 4.2, -2], ['heart', 94, 40, 24, 7.5, -4],
    ['bubble', 92, 64, 26, 8, -3], ['spark', 2, 50, 18, 4.8, -1.5], ['heart', 2, 74, 18, 8, -5]],
  boy: [['bubble', 3, 16, 34, 7, -1], ['star', 93, 11, 24, 5.2, -2], ['spark', 94, 40, 20, 4.4, -4],
    ['bubble', 92, 64, 26, 8, -3], ['star', 2, 50, 18, 5.8, -1.5], ['spark', 2, 74, 18, 4.6, -5]]
};

let root = null, theme = null;

function render() {
  const list = SHAPES[theme] || SHAPES.girl;
  root.innerHTML = '<div class="bg-scene">' + ART.background(theme) + '</div>' + list.map(([k, x, top, s, t, d]) =>
    '<span class="bg-pop bg-' + k + '" style="--x:' + x + '%;--top:' + top + '%;--s:' + s + 'px;--t:' + t + 's;--d:' + d + 's"></span>').join('');
}

export function initBackground(el) {
  root = el;
  if (!root) return { setTheme() {}, pause() {} };
  const sync = () => root.classList.toggle('paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    setTheme(t) { if (t === theme) return; theme = t; render(); },
    /* extra pause (an opaque minigame covers the background) */
    pause(on) { root.classList.toggle('held', !!on); }
  };
}
