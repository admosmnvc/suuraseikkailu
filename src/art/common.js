/* Suuraseikkailu v3 – art/common.js: small utilities, geometry and the one injected stylesheet
   <style id="art-css">. OWNER: art agent. The soft look itself (palettes, gradients, shadows) lives in soft.js.

   Conventions (all art modules)
   - Pure functions returning SVG strings. The only DOM access is injectCSS(), once, from src/art.js.
   - Gradient / filter / clip ids come from uid(), so many copies on one page never clash.
   - Motifs take (c, id): c = colour mapper (soft.keep = full colour, soft.ghost = "not earned"), id = unique prefix.
   - Runtime state is CSS only: `.on` on `.pw` (mosque window), `.rp` (rocket part), `.slot` (reward socket/part). */

let counter = 0;
export function uid(prefix) {
  counter += 1;
  return 'art-' + prefix + '-' + counter;
}

// compact number formatting for path data
export function f(n) {
  const v = Math.round(n * 100) / 100;
  return v === 0 ? '0' : String(v);
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isHex(c) { return typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c); }

export function clampInt(v, lo, hi, dflt) {
  let n = Math.floor(Number(v));
  if (!isFinite(n)) n = dflt;
  return n < lo ? lo : (n > hi ? hi : n);
}

function hexRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// linear mix of two hex colours, t = 0..1 towards b
export function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + [0, 1, 2].map((i) => {
    const c = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
    return (c < 16 ? '0' : '') + c.toString(16);
  }).join('').toUpperCase();
}

export function themeOf(t) {
  if (t === 'boy' || t === 'girl') return t;
  try {
    const d = typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme');
    if (d === 'boy' || d === 'girl') return d;
  } catch (e) { /* no DOM */ }
  return 'girl';
}

export function svgOpen(name, vb, cls, extra) {
  return '<svg xmlns="http://www.w3.org/2000/svg" class="art art-' + name + (cls ? ' ' + esc(cls) : '') +
    '" viewBox="' + vb + '"' + (extra || '') + ' aria-hidden="true" focusable="false">';
}

/* ---------- geometry ---------- */

export function starPath(cx, cy, R, r, points, rotation) {
  const n = Math.max(2, Math.round(points || 5));
  const rot = rotation == null ? -Math.PI / 2 : rotation;
  if (r == null) r = R * 0.45;
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R, a = rot + i * Math.PI / n;
    d += (i ? 'L' : 'M') + f(cx + rad * Math.cos(a)) + ' ' + f(cy + rad * Math.sin(a));
  }
  return d + 'Z';
}

// four-point twinkle with concave sides
export function sparklePath(cx, cy, R) {
  const k = R * 0.18;
  return 'M' + f(cx) + ' ' + f(cy - R) +
    'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + R) + ' ' + f(cy) +
    'Q' + f(cx + k) + ' ' + f(cy + k) + ' ' + f(cx) + ' ' + f(cy + R) +
    'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' + f(cx - R) + ' ' + f(cy) +
    'Q' + f(cx - k) + ' ' + f(cy - k) + ' ' + f(cx) + ' ' + f(cy - R) + 'Z';
}

// crescent whose horns point towards angle `dir` (radians, -PI/2 = up)
export function crescentPath(cx, cy, R, dir, alpha, off) {
  const a = alpha == null ? 0.95 : alpha;
  const d = (off == null ? 0.4 : off) * R;
  const x1 = cx + R * Math.cos(dir + a), y1 = cy + R * Math.sin(dir + a);
  const x2 = cx + R * Math.cos(dir - a), y2 = cy + R * Math.sin(dir - a);
  const lx = R * Math.cos(a) - d, ly = R * Math.sin(a);
  const r = Math.sqrt(lx * lx + ly * ly);
  return 'M' + f(x1) + ' ' + f(y1) + 'A' + f(R) + ' ' + f(R) + ' 0 1 1 ' + f(x2) + ' ' + f(y2) +
    'A' + f(r) + ' ' + f(r) + ' 0 ' + (lx > 0 ? 1 : 0) + ' 0 ' + f(x1) + ' ' + f(y1) + 'Z';
}

// map a path written in a 100x100 box with "x,y" pairs to centre (cx, cy) and width `size`
export function mapPath(d, cx, cy, size) {
  const s = size / 100;
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (m, x, y) => f(cx + (x - 50) * s) + ' ' + f(cy + (y - 50) * s));
}

const HEART = 'M50,90 C22,70 6,54 6,33 C6,18 18,8 31,8 C40,8 46,13 50,21 C54,13 60,8 69,8 C82,8 94,18 94,33 C94,54 78,70 50,90 Z';
export function heartPath(cx, cy, size) { return mapPath(HEART, cx, cy, size); }

// onion dome standing on y = base
export function onionPath(cx, base, hw, h) {
  const n = hw * 0.78;
  return 'M' + f(cx - n) + ' ' + f(base) +
    'C' + f(cx - hw * 1.45) + ' ' + f(base - h * 0.28) + ' ' + f(cx - hw * 0.5) + ' ' + f(base - h * 0.72) + ' ' + f(cx) + ' ' + f(base - h) +
    'C' + f(cx + hw * 0.5) + ' ' + f(base - h * 0.72) + ' ' + f(cx + hw * 1.45) + ' ' + f(base - h * 0.28) + ' ' + f(cx + n) + ' ' + f(base) + 'Z';
}

// round-topped arch window / door
export function archPath(cx, top, w, bottom) {
  const hw = w / 2, r = Math.min(hw, (bottom - top));
  return 'M' + f(cx - hw) + ' ' + f(bottom) + 'V' + f(top + r) +
    'A' + f(hw) + ' ' + f(r) + ' 0 0 1 ' + f(cx + hw) + ' ' + f(top + r) + 'V' + f(bottom) + 'Z';
}

export function rectPath(x, y, w, h) {
  return 'M' + f(x) + ' ' + f(y) + 'h' + f(w) + 'v' + f(h) + 'h' + f(-w) + 'Z';
}

// smooth closed blob: radius r(θ) = R·(1 + amp·cos(nθ)), sampled finely (rosette badge, soft burst)
export function wavyCircle(cx, cy, R, n, amp, steps) {
  const k = steps || 120;
  let d = '';
  for (let i = 0; i < k; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / k, r = R * (1 + amp * Math.cos(n * a));
    d += (i ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
  }
  return d + 'Z';
}

const DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function arabicDigits(n) {
  return String(n == null ? '' : n).replace(/[0-9]/g, (d) => DIGITS.charAt(+d));
}

/* ---------- CSS (injected once by src/art.js) ----------
   :where() keeps default sizing at zero specificity so any caller class wins.
   Transitions run only when a class changes (the ui adds `.on` to the newest part); the first render is static. */

const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
export const CSS =
  ':where(.icon){width:1em;height:1em;display:inline-block;flex-shrink:0;vertical-align:-0.15em}' +
  ':where(.art){display:block;width:100%;height:100%;overflow:visible}' +
  ':where(.ayah){display:inline-block;width:1.15em;height:1.15em;vertical-align:middle;margin-inline-start:.12em;line-height:1}' +
  '.ayah svg{width:100%;height:100%;display:block;overflow:visible}' +
  '.art-ayah-ring{stroke:#B9A4FF}[data-theme="boy"] .art-ayah-ring{stroke:#5AB4FF}' +
  /* mosque windows (svg keeps the class art-castle): warm glow fades in, a sparkle springs up */
  '.art-castle .pw .art-pw-lit{opacity:0;transition:opacity .45s ease}' +
  '.art-castle .pw.on .art-pw-lit{opacity:1}' +
  '.art-castle .pw .art-pw-star{transform-box:fill-box;transform-origin:center;transform:scale(0) rotate(-60deg);transition:transform .6s ' + SPRING + ' .1s}' +
  '.art-castle .pw.on .art-pw-star{transform:scale(1) rotate(0deg)}' +
  '.art-castle .pw.on .art-pw-glow{animation:art-breathe 3.2s ease-in-out infinite alternate;animation-delay:var(--art-d,0s)}' +
  /* rocket parts + reward slots: spring in from slightly above */
  '.art-rp-in,.art-slot-in{transform-box:fill-box;transform-origin:50% 60%;transition:transform .55s ' + SPRING + ',opacity .2s ease}' +
  '.rp:not(.on)>.art-rp-in,.slot:not(.on)>.art-slot-in{opacity:0;transform:translateY(-14px) scale(.5)}' +
  '.art-slot-spark{transform-box:fill-box;transform-origin:center;transition:transform .6s ' + SPRING + ' .12s,opacity .3s ease .12s}' +
  '.slot:not(.on)>.art-slot-spark{opacity:0;transform:scale(.3)}' +
  /* finished: glow / flame / smoke (class at render time, :has() when the last part is switched on live) */
  '.art-done-fx{opacity:0;transition:opacity .5s ease}' +
  '.art-complete .art-done-fx{opacity:1}' +
  '.art-progress-boy:not(:has(.rp:not(.on))) .art-done-fx,.art-progress-girl:not(:has(.pw:not(.on))) .art-done-fx,' +
  '.art-reward:not(:has(.slot:not(.on))) .art-done-fx{opacity:1}' +
  '.art-flame{transform-box:fill-box;transform-origin:50% 0;animation:art-flicker .35s ease-in-out infinite alternate}' +
  '.art-complete .art-ship,.art-progress-boy:not(:has(.rp:not(.on))) .art-ship{animation:art-hover 1.8s ease-in-out infinite alternate}' +
  '.art-launch .art-ship.art-ship.art-ship.art-ship{animation:art-launch 2.4s cubic-bezier(.55,0,.8,.35) forwards}' +
  '.art-puff{transform-box:fill-box;transform-origin:center;animation:art-puff 2.2s ease-in-out infinite alternate;animation-delay:var(--art-d,0s)}' +
  /* gentle life */
  '.art-tw{transform-box:fill-box;transform-origin:center;animation:art-tw 3s ease-in-out infinite;animation-delay:var(--art-d,0s)}' +
  '.art-float{animation:art-float 3.6s ease-in-out infinite alternate;animation-delay:var(--art-d,0s)}' +
  '.art-spin{transform-box:fill-box;transform-origin:center;animation:art-spin 1.4s linear infinite}' +
  /* cover: two compositions, one per orientation */
  '.art-cover .art-cv-l{display:none}' +
  '@media (orientation: landscape){.art-cover .art-cv-l{display:inline}.art-cover .art-cv-p{display:none}}' +
  '@keyframes art-flicker{from{transform:scaleY(.9)}to{transform:scaleY(1.08)}}' +
  '@keyframes art-hover{from{transform:translateY(0)}to{transform:translateY(-4px)}}' +
  '@keyframes art-launch{0%{transform:translateY(0)}15%{transform:translateY(3px)}100%{transform:translateY(-440px)}}' +
  '@keyframes art-puff{from{transform:scale(.92)}to{transform:scale(1.06)}}' +
  '@keyframes art-tw{0%,100%{transform:scale(.7);opacity:.65}50%{transform:scale(1.05);opacity:1}}' +
  '@keyframes art-float{from{transform:translateY(-4px)}to{transform:translateY(4px)}}' +
  '@keyframes art-spin{to{transform:rotate(360deg)}}' +
  '@keyframes art-breathe{from{opacity:.65}to{opacity:1}}' +
  '@media (prefers-reduced-motion: reduce){' +
  '.art-flame,.art-ship,.art-puff,.art-tw,.art-float,.art-spin,.art-pw-glow{animation:none!important}' +
  '.art-launch .art-ship.art-ship.art-ship.art-ship.art-ship{animation:none!important;opacity:0;transition:opacity .4s}' +
  '.art-rp-in,.art-slot-in,.art-slot-spark,.art-pw-lit,.art-pw-star,.art-done-fx{transition:none!important}}';

export function injectCSS() {
  if (typeof document === 'undefined' || !document || !document.createElement) return;
  if (document.getElementById && document.getElementById('art-css')) return;
  const st = document.createElement('style');
  st.id = 'art-css';
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}
