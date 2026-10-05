/* Intro: a ~5 s children's-TV opening on every launch.
     0.0 s grey world (mosque on its hill, grey road, pale sky)
     0.6 s the car drives in (bouncing, wheels spinning), road + grass colour in behind it; the camel walks after it
     1.4 s the pony trots in and stops; colour blooms out from it over the whole scene, flowers + palms grow in
     1.7 s colour reaches the lower world: the rocket lifts off its pad a little (with its puffs), then hovers
     2.0 s stars pop in one by one with sparkles, clouds start drifting, the crown floats in
     2.6 s the logo: SUURA drops in letter by letter with squash & stretch, SEIKKAILU reveals below it
     3.8 s the logo sinks into the start button, which pops out with a springy bounce
   A tap anywhere skips to the final state; reduced motion starts there. The scene stays behind the picker.

   Sound effects (sounds(), in step with the CSS timeline) only if the device lets sound start without a tap
   (audio context.autoStart, decided within 0.5 s, before the first sound at 0.6 s): an engine hum + honk, hooves + a neigh, camel steps, the rocket's whoosh,
   a clink per star, a pop per logo letter, a boing for the button. Otherwise (iOS, a first visit) it stays
   silent; the start button unlocks audio as before. Effects switched off, reduced motion, a skip: no sounds.
   Voice cues (main.js speaks them, only when sound may start without a tap): 'title' as SUURA drops in (not after
   a skip), 'go' 3 s after the start button has appeared (main.js skips it once the button was tapped).

   Layers in #coverArt (same SVG, same viewBox, so they line up): .in-base (colour scenery), .in-grey (grey
   scenery, clipped away by the car's wipe), .in-bloom (colour scenery, revealed by a growing radial mask) and
   .in-chars (car, pony, clouds, stars, rocket, crown on top). Everything moves with CSS transforms on wrapper
   groups (the art's own transforms stay intact); positions are measured once from the art.
   ART.intro(orientation) is drawn in parallel: without it the cover art plays the colour bloom + logo only.
   OWNER: ui agent. */
import ART from '../art.js';
import { reducedMotion } from '../util.js';
import { $ } from './dom.js';
import SFX from '../audio/sfx.js';
import * as audio from '../audio/context.js';

const NS = 'http://www.w3.org/2000/svg';
const SCENERY = ['in-sky', 'in-hills', 'in-grass', 'in-road', 'in-mosque', 'in-flowers', 'in-palms'];
const CHARS = ['in-car', 'in-camel', 'in-pony', 'in-clouds', 'in-stars', 'in-rocket', 'in-crown'];
const LATE = ['in-flowers', 'in-palms']; /* not in the grey world: they grow in with the colour */
const FINAL_MS = 5000; /* after the button's pop (4.08 s + 0.8 s) */
const TITLE_MS = 2750;   /* the first letters of SUURA land */
const BUTTON_MS = 4080;  /* the start button pops out */
const GO_MS = 3000;      /* 'go' cue this long after the button appeared */

/* [ms from the start, sound] – times match app.css (car .6-1.45 s, camel 1-1.7 s, pony 1.4-2 s, rocket 1.7 s,
   stars 2 s + i * 140 ms, SUURA lands 2.91 s + i * 80 ms, SEIKKAILU 3.17 s + i * 55 ms, button 4.08 s) */
function sounds(nStars, nTop, nBot) {
  const out = [[600, () => SFX.vroom(0.85)], [1000, () => SFX.steps(4, 0.7)], [1400, () => SFX.hooves(6, 0.6)],
    [1450, () => SFX.honk()], [1700, () => SFX.whoosh()], [2000, () => SFX.neigh()], [4120, () => SFX.boing()]];
  for (let i = 0; i < nStars; i++) out.push([2080 + i * 140, () => SFX.ding(i)]);
  const top = [];
  for (let i = 0; i < nTop; i++) top.push(2910 + i * 80);
  for (let i = 0; i < nBot; i++) {
    const ms = 3170 + i * 55;
    if (!top.some((t) => Math.abs(t - ms) < 30)) out.push([ms, () => SFX.pop()]); /* two pops at once = one loud one */
  }
  top.forEach((ms) => out.push([ms, () => SFX.pop()]));
  return out;
}

let box = null, gate = null, state = 'idle', timer = 0, skippedAt = 0, orient = '', sfxTimers = [];
let cue = null, allowed = false, playAt = 0, buttonAt = 0, goTimer = 0;

/* the 'go' cue, once, GO_MS after the button appeared (needs: sound allowed, the button visible) */
function armGo() {
  if (!cue || !allowed || goTimer || state !== 'done') return;
  goTimer = setTimeout(() => cue('go'), Math.max(0, buttonAt + GO_MS - performance.now()));
}

const orientation = () => (innerWidth >= innerHeight ? 'landscape' : 'portrait');

function artFor(o) {
  if (typeof ART.intro === 'function') {
    try { const s = ART.intro(o); if (typeof s === 'string' && s) return s; } catch (e) { /* fall back */ }
  }
  return ART.cover();
}

/* scenery copies: ids become data-in (ids stay unique; the chars layer keeps the real ones) */
const asCopy = (svg) => svg.replace(/ id="(in-[a-z-]+)"/g, ' data-in="$1"');

function wrap(el, cls) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', cls);
  el.parentNode.insertBefore(g, el);
  g.appendChild(el);
  return g;
}

/* screen rect of an element as % of the box */
function pct(el, b) {
  const r = el.getBoundingClientRect();
  return { l: (r.left - b.left) / b.width * 100, r: (r.right - b.left) / b.width * 100, t: (r.top - b.top) / b.height * 100,
    b: (r.bottom - b.top) / b.height * 100, cx: (r.left + r.width / 2 - b.left) / b.width * 100, cy: (r.top + r.height / 2 - b.top) / b.height * 100 };
}

/* user units per screen px of an svg (CSS px on SVG elements are user units) */
function unitsPerPx(svg) {
  try { const m = svg.getScreenCTM(); return m && m.a ? 1 / m.a : 1; } catch (e) { return 1; }
}

function build() {
  orient = orientation();
  const art = artFor(orient);
  box.innerHTML = '<div class="intro" id="intro">' +
    '<div class="in-layer in-scene in-base">' + asCopy(art) + '</div>' +
    '<div class="in-layer in-scene in-grey">' + asCopy(artFor(orient)) + '</div>' +
    '<div class="in-layer in-scene in-bloom">' + asCopy(artFor(orient)) + '</div>' +
    '<div class="in-layer in-chars">' + artFor(orient) + '</div>' +
    '<div class="in-sparks" aria-hidden="true"></div></div>';
  const intro = $('intro'), chars = intro.querySelector('.in-chars');
  SCENERY.forEach((id) => { const el = chars.querySelector('#' + id); if (el) el.style.display = 'none'; });
  intro.querySelectorAll('.in-scene').forEach((layer) => CHARS.concat(layer.classList.contains('in-grey') ? LATE : []).forEach((id) => {
    const el = layer.querySelector('[data-in="' + id + '"]');
    if (el) el.style.display = 'none';
  }));
  const b = box.getBoundingClientRect();
  const svg = chars.querySelector('svg');
  const k = svg ? unitsPerPx(svg) : 1;
  const base = intro.querySelector('.in-base');
  /* ground band (wipe) and the car */
  const ground = ['in-road', 'in-grass'].map((id) => base.querySelector('[data-in="' + id + '"]')).filter(Boolean);
  const gy = ground.length ? Math.min(...ground.map((el) => pct(el, b).t)) : 62;
  intro.style.setProperty('--gy', gy.toFixed(1) + '%');
  const car = chars.querySelector('#in-car');
  let wx = 40;
  if (car) {
    const p = pct(car, b);
    wx = Math.max(0, Math.min(100, p.cx));
    const drive = wrap(wrap(car, 'in-bob'), 'in-drive');
    drive.style.setProperty('--dx', (-(p.r / 100 * b.width + 24) * k).toFixed(1) + 'px');
    chars.querySelectorAll('.in-wheel').forEach((w) => wrap(w, 'in-spin'));
  }
  intro.style.setProperty('--wx', wx.toFixed(1) + '%');
  /* walkers come in from their nearer side: the camel along the road (legs swinging), the pony on the hill;
     the colour blooms out from where the pony stops */
  const walkIn = (el, walk, bob) => {
    const p = pct(el, b);
    const dist = p.cx > 50 ? (100 - p.l) / 100 * b.width + 24 : -(p.r / 100 * b.width + 24);
    wrap(wrap(el, bob), walk).style.setProperty('--dx', (dist * k).toFixed(1) + 'px');
    return p;
  };
  const camel = chars.querySelector('#in-camel');
  if (camel) {
    walkIn(camel, 'in-walk', 'in-sway-walk');
    chars.querySelectorAll('#in-camel .in-leg').forEach((l, i) => wrap(l, 'in-step' + (i % 2 ? ' in-step-b' : '')));
  }
  const pony = chars.querySelector('#in-pony');
  let bx = 50, by = 50;
  if (pony) { const p = walkIn(pony, 'in-trot', 'in-hop'); bx = p.cx; by = p.cy; }
  /* bloom: a soft circle centred on the pony that grows until it covers the farthest corner */
  const px = bx / 100 * b.width, py = by / 100 * b.height;
  const far = Math.max(Math.hypot(px, py), Math.hypot(b.width - px, py), Math.hypot(px, b.height - py), Math.hypot(b.width - px, b.height - py));
  intro.style.setProperty('--bpx', px.toFixed(0) + 'px');
  intro.style.setProperty('--bpy', py.toFixed(0) + 'px');
  intro.style.setProperty('--bs', (far * 2 / 0.68).toFixed(0) + 'px');
  /* stars one by one (+ a sparkle each), rocket and crown, clouds drifting */
  const sparks = intro.querySelector('.in-sparks');
  let html = '';
  chars.querySelectorAll('.in-star').forEach((s, i) => {
    const g = wrap(s, 'in-pop');
    g.style.setProperty('--d', (2000 + i * 140) + 'ms');
    const p = pct(s, b);
    html += '<i style="left:' + p.cx.toFixed(1) + '%;top:' + p.cy.toFixed(1) + '%;--d:' + (2080 + i * 140) + 'ms"></i>';
  });
  sparks.innerHTML = html;
  ['in-rocket', 'in-crown'].forEach((id, i) => {
    const el = chars.querySelector('#' + id);
    if (el) wrap(el, 'in-arrive in-arrive-' + i);
  });
  chars.querySelectorAll('.in-cloud').forEach((c, i) => {
    const g = wrap(c, 'in-drift');
    g.style.setProperty('--t', (9 + (i % 3) * 3) + 's');
    g.style.setProperty('--d', -(i * 2.3).toFixed(1) + 's');
  });
  /* flowers pop and palms grow in with the colour (in both colour copies), then the palms sway */
  intro.querySelectorAll('.in-bloom .in-flower, .in-base .in-flower').forEach((f, i) => {
    wrap(f, 'in-pop').style.setProperty('--d', (1900 + (i % 7) * 90) + 'ms');
  });
  intro.querySelectorAll('.in-bloom .in-palm, .in-base .in-palm').forEach((p, i) => {
    wrap(wrap(p, 'in-sway'), 'in-grow').style.setProperty('--d', (1850 + (i % 4) * 120) + 'ms');
  });
}

function setState(s) {
  state = s;
  const intro = $('intro');
  if (intro) intro.dataset.state = s;
  gate.dataset.intro = s;
  if (s === 'done') {
    clearTimeout(timer);
    timer = 0;
    sfxTimers.forEach(clearTimeout);
    sfxTimers = [];
    /* the button: popped out at BUTTON_MS (intro played on), or shows now (a skip / reduced motion) */
    if (!buttonAt) { const now = performance.now(), at = playAt + BUTTON_MS; buttonAt = playAt && now >= at ? at : now; }
    armGo();
    /* the colour scenery alone from here on: drop the reveal copies */
    if (intro) intro.querySelectorAll('.in-grey, .in-bloom, .in-sparks').forEach((el) => el.remove());
  }
}

/* box: #coverArt (scene), gateEl: #gate (logo + start button) */
export function initIntro(boxEl, gateEl) {
  box = boxEl;
  gate = gateEl;
  /* a tap anywhere during the intro jumps to the end (the same tap never presses the button) */
  gate.addEventListener('pointerdown', (e) => {
    if (state !== 'play' || gate.dataset.mode !== 'start' || e.button > 0) return;
    skippedAt = Date.now();
    setState('done');
  }, true);
  /* a new orientation gets its own composition (final state) */
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (state !== 'idle' && orientation() !== orient && box.firstElementChild) { build(); setState('done'); } }, 200);
  });
}

/* o.sfx: effects are on in settings; o.cue(name): speaks the 'title' / 'go' cue (null: speech off) */
export function playIntro(o = {}) {
  build();
  cue = typeof o.cue === 'function' ? o.cue : null;
  const t0 = performance.now();
  if (reducedMotion()) setState('done');
  else {
    playAt = t0;
    setState('play');
    timer = setTimeout(() => setState('done'), FINAL_MS);
  }
  if (!o.sfx && !cue) return;
  /* the silent media probe alone can take > 150 ms on a busy device; sounds stay on the animation's clock (t0) */
  audio.autoStart(500).then((ok) => {
    if (!ok || document.hidden) return;
    allowed = true;
    armGo();
    if (state !== 'play') return;
    const late = performance.now() - t0;
    const list = [];
    if (o.sfx) {
      const stars = box.querySelectorAll('.in-chars .in-star').length;
      const top = gate.querySelectorAll('.logo-top i').length, bot = gate.querySelectorAll('.logo-bot i').length;
      list.push(...sounds(stars, top, bot));
    }
    if (cue) list.push([TITLE_MS, () => cue('title')]);
    list.forEach(([ms, fn]) => {
      if (ms >= late) sfxTimers.push(setTimeout(() => { if (state === 'play') fn(); }, ms - late));
    });
  }, () => {});
}

/* true while the intro still runs, or right after a skip tap (that tap's click must not start the app) */
export function introBusy() { return state === 'play' || Date.now() - skippedAt < 450; }
