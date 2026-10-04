/* Minigame framework: one shared overlay (title + goal gems + arena) and a session object per game.

   A game is a function game(S) that builds its items inside S.arena and may set these hooks:
     S.update(dt, t)   per animation frame while the session lives
     S.resize(oldW, oldH)   arena size changed (S.W / S.H already updated)
     S.tap(p)          tap on empty arena space (p = arena coordinates)
     S.near(p)         return the item to hit for a tap that missed every item (forgiving taps)
     S.fillRest()      time is up: visually complete the game, return ms to wait before finishing
     S.onComplete()    goal reached (or time up): small game-specific celebration
     S.destroy()       extra cleanup
   Items are { el, cx, cy, r, gone, hit(p) }; el is a .mg-item button with el.__mg = item.
   S.point() counts one goal step; reaching S.goal finishes with a success (there is no failure).
   S.paced(gap, fn) wraps a tap action so a child hammering the screen still gets a calm ~10 s game.
   MIN_MS floor: a goal reached early keeps the celebration going (taps still sparkle) so onDone never fires before ~10.5 s.
   At TIME_LIMIT the game always auto-completes as a success; with fillRest + celebration onDone fires at ~17.5-19 s.
   While the page is hidden the time limit is paused and onDone waits until the page is visible again. */
import { rand, now, reducedMotion } from '../util.js';
import { SFX } from '../audio/sfx.js';
import { FX } from '../fx.js';
import { PROMPTS, gameId } from '../content/prompts.js';
import { goalGemSVG, sparkD, SVG0 } from './svg.js';

export const TIME_LIMIT = 16000;   /* auto-complete (success) starts here */
const END_WAIT = 1300;             /* celebration before onDone */
const MIN_MS = 10500;              /* shortest game, whatever the tapping: onDone waits at least this long from start */
const MARKER_COLORS = ['#7FD3F2', '#9A7BFF', '#FF8BC8', '#4A86FF', '#33C3D6', '#B45FE0'];

let root = null, titleEl = null, goalEl = null, arena = null, current = null;

/* static frosty decoration: a few small white sparkles behind the arena (no bubbles: they would look tappable) */
function decoHTML() {
  const spots = [[6, 22, 16], [92, 14, 20], [14, 62, 12], [88, 54, 14], [50, 30, 10], [72, 84, 14], [24, 88, 12], [95, 78, 10], [36, 46, 8], [64, 66, 9]];
  let s = '';
  for (const p of spots) {
    s += '<span class="mg-spark" style="left:' + p[0] + '%;top:' + p[1] + '%;width:' + p[2] + 'px;height:' + p[2] + 'px">' +
      '<svg viewBox="0 0 24 24"' + SVG0 + '><path d="' + sparkD(12, 12, 12) + '"/></svg></span>';
  }
  return s;
}

function ensureOverlay() {
  if (!document.body) return false;
  if (!root) {
    root = document.createElement('section');
    root.className = 'mg';
    root.hidden = true;
    const deco = document.createElement('div');
    deco.className = 'mg-deco';
    deco.setAttribute('aria-hidden', 'true');
    deco.innerHTML = decoHTML();
    const head = document.createElement('header');
    head.className = 'mg-head';
    titleEl = document.createElement('h2');
    titleEl.className = 'mg-title';
    titleEl.setAttribute('aria-live', 'polite');
    goalEl = document.createElement('div');
    goalEl.className = 'mg-goal';
    goalEl.setAttribute('role', 'img');
    head.appendChild(titleEl);
    head.appendChild(goalEl);
    arena = document.createElement('div');
    arena.className = 'mg-arena';
    root.appendChild(deco);
    root.appendChild(head);
    root.appendChild(arena);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  if (!root.isConnected) document.body.appendChild(root);
  return true;
}

/* Sound effect by name, never throws (the audio module is optional for game logic). */
export function snd(name, arg) {
  try { const f = SFX[name]; if (typeof f === 'function') f.call(SFX, arg); } catch (e) { /* stay silent */ }
}

export function makeItem(cls, html, label, w, h) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'mg-item ' + cls;
  el.setAttribute('aria-label', label);
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.innerHTML = html;
  return el;
}
export function detach(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

/* nearest live item within `slack` px of the tap edge (forgiving taps); slack Infinity = any tap */
export function nearest(list, p, slack) {
  let best = null, bd = slack;
  for (const it of list) {
    if (it.gone || it.cx == null) continue;
    const dx = it.cx - p.x, dy = it.cy - p.y, d = Math.sqrt(dx * dx + dy * dy) - it.r;
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

/* random spot inside the box that keeps away from live items (best of 40 tries) */
export function freeSpot(list, w, h, x0, x1, y0, y1) {
  let best = { x: x0, y: y0 }, bestD = -Infinity;
  x1 = Math.max(x0, x1); y1 = Math.max(y0, y1);
  for (let k = 0; k < 40; k++) {
    const x = rand(x0, x1), y = rand(y0, y1), cx = x + w / 2, cy = y + h / 2;
    let md = Infinity;
    for (const it of list) {
      if (it.gone) continue;
      const dx = it.x + it.w / 2 - cx, dy = it.y + it.h / 2 - cy;
      md = Math.min(md, Math.sqrt(dx * dx + dy * dy) - (it.w + w) / 2);
    }
    if (md > bestD) { bestD = md; best = { x: x, y: y }; }
    if (md > 12) break;
  }
  return best;
}

function createSession(index, goal, onDone) {
  const S = { index: index, goal: goal, score: 0, done: false, dead: false, W: 0, H: 0, t: 0, rm: reducedMotion(),
    arena: arena, update: null, resize: null, tap: null, near: null, fillRest: null, onComplete: null, destroy: null };
  const timers = [], offs = [], markers = [];
  let raf = 0, last = 0, ro = null, limitT = 0, endT = 0, startT = 0, lastSpark = 0;
  let limitLeft = TIME_LIMIT, limitFrom = 0, doneWaiting = false;

  S.later = function (fn, ms) {
    const id = setTimeout(() => {
      const k = timers.indexOf(id);
      if (k >= 0) timers.splice(k, 1);
      if (!S.dead) fn();
    }, ms);
    timers.push(id);
    return id;
  };
  S.on = function (el, type, fn, opt) {
    el.addEventListener(type, fn, opt);
    offs.push(() => el.removeEventListener(type, fn, opt));
  };
  S.active = () => !S.done && !S.dead;
  /* Steady pace for tap actions: fn(arg) runs at most once per `gap` ms. A tap that comes early is kept
     (the newest one wins) and runs as soon as the gap is over; it gets a small sparkle right away, so every
     tap is answered and none is "wrong". Without this, mashing finished tap-anywhere games in 2-3 s. */
  S.paced = function (gap, fn) {
    let next = 0, pend = null, tid = 0, lastSpark = 0;
    function run(a) { next = now() + gap; fn(a); }
    return function (a, p) {
      if (!S.active()) return;
      const t = now();
      if (!tid && t >= next) { run(a); return; }
      pend = a;
      if (p && t - lastSpark > 220) { lastSpark = t; const v = S.vp(p.x, p.y); FX.sparkle(v.x, v.y); }
      if (!tid) tid = S.later(() => { tid = 0; const q = pend; pend = null; if (S.active()) run(q); }, Math.max(0, next - t));
    };
  };
  S.add = (el) => { arena.appendChild(el); return el; };
  /* arena <-> viewport coordinates (FX works in viewport coordinates) */
  S.vp = (x, y) => { const r = arena.getBoundingClientRect(); return { x: r.left + x, y: r.top + y }; };
  S.local = (cx, cy) => { const r = arena.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; };
  /* item can no longer be tapped (also tells automated tests to skip it) */
  S.spend = (it) => {
    it.gone = true;
    if (it.el) { it.el.classList.add('is-spent'); it.el.setAttribute('tabindex', '-1'); }
  };
  S.point = function () {
    if (!S.active()) return;
    S.score += 1;
    lightMarker(S.score - 1);
    goalEl.setAttribute('aria-label', 'Valmiina ' + S.score + ' / ' + S.goal);
    if (S.score >= S.goal) finish();
  };

  function lightMarker(i) { const m = markers[i]; if (m) m.classList.add('on'); }
  function measure() {
    let w = arena.clientWidth, h = arena.clientHeight;
    if (!w || !h) { w = window.innerWidth || 390; h = Math.max(240, (window.innerHeight || 700) - 130); }
    const changed = w !== S.W || h !== S.H;
    S.W = w; S.H = h;
    return changed;
  }
  function onResize() {
    if (S.dead) return;
    const ow = S.W, oh = S.H;
    if (measure() && S.resize) S.resize(ow, oh);
  }
  function loop(ts) {
    raf = 0;
    if (S.dead) return;
    const dt = Math.min(50, Math.max(0, ts - last)) / 1000;
    last = ts;
    S.t += dt;
    if (S.update) S.update(dt, S.t);
    raf = requestAnimationFrame(loop);
  }
  function itemOf(target) {
    const el = target && target.closest ? target.closest('.mg-item') : null;
    return (el && el.__mg && !el.__mg.gone) ? el.__mg : null;
  }
  function onDown(e) {
    if (S.dead) return;
    if (e.cancelable) e.preventDefault();
    if (e.button > 0) return;
    if (S.done) { /* celebration: every tap still sparkles where it lands */
      const t = now();
      if (t - lastSpark > 220) { lastSpark = t; FX.sparkle(e.clientX, e.clientY); }
      return;
    }
    const p = S.local(e.clientX, e.clientY);
    let it = itemOf(e.target);
    if (it) { it.hit(p); return; }
    if (S.tap) { S.tap(p); return; }
    if (S.near) { it = S.near(p); if (it) it.hit(p); }
  }
  function onClick(e) { /* keyboard activation (Enter / Space) */
    if (!S.active() || e.detail !== 0) return;
    const it = itemOf(e.target);
    if (!it) return;
    const r = e.target.closest('.mg-item').getBoundingClientRect();
    it.hit(S.local(r.left + r.width / 2, r.top + r.height / 2));
  }

  function finish() {
    if (!S.active()) return;
    S.done = true;
    arena.classList.add('is-done');
    if (limitT) { clearTimeout(limitT); limitT = 0; }
    for (let i = 0; i < markers.length; i++) lightMarker(i);
    goalEl.setAttribute('aria-label', 'Valmis!');
    if (S.onComplete) { try { S.onComplete(); } catch (e) { /* decoration only */ } }
    snd('success');
    FX.confetti(70);
    endT = setTimeout(() => {
      endT = 0;
      if (S.dead) return;
      if (document.hidden) { doneWaiting = true; return; } /* hand over when the child can see it */
      done();
    }, Math.max(END_WAIT, MIN_MS - (now() - startT)));
  }
  function done() {
    doneWaiting = false;
    cleanup();
    if (typeof onDone === 'function') onDone();
  }
  /* page hidden (app in background, screen locked): pause the time limit, hold onDone */
  function onVisibility() {
    if (S.dead) return;
    if (document.hidden) {
      if (limitT) { clearTimeout(limitT); limitT = 0; limitLeft = Math.max(0, limitLeft - (now() - limitFrom)); }
    } else {
      if (doneWaiting) { done(); return; }
      if (S.active() && !limitT && limitLeft >= 0) armLimit();
    }
  }
  function armLimit() {
    limitFrom = now();
    limitT = setTimeout(timeUp, limitLeft);
  }
  function timeUp() {
    limitT = 0;
    limitLeft = -1; /* fired: never re-armed */
    if (!S.active()) return;
    let wait = 0;
    if (S.fillRest) { try { wait = +S.fillRest() || 0; } catch (e) { wait = 0; } }
    if (wait > 0) S.later(finish, wait); else finish();
  }
  function cleanup() {
    S.dead = true;
    if (current === S) current = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (limitT) { clearTimeout(limitT); limitT = 0; }
    if (endT) { clearTimeout(endT); endT = 0; }
    while (timers.length) clearTimeout(timers.pop());
    while (offs.length) { try { offs.pop()(); } catch (e) { /* ignore */ } }
    if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
    if (S.destroy) { try { S.destroy(); } catch (e) { /* ignore */ } }
    S.update = S.resize = S.tap = S.near = S.fillRest = S.onComplete = S.destroy = null;
    arena.textContent = '';
    arena.classList.remove('is-done');
    goalEl.textContent = '';
    goalEl.removeAttribute('aria-label');
    titleEl.textContent = '';
    root.classList.remove('mg--g' + index);
    root.hidden = true;
  }
  S.abort = () => { if (!S.dead) cleanup(); };

  S.start = function (game) {
    startT = now();
    titleEl.textContent = PROMPTS[gameId(index)] || '';
    goalEl.textContent = '';
    for (let i = 0; i < S.goal; i++) {
      const m = document.createElement('span');
      m.className = 'mg-gem';
      m.innerHTML = goalGemSVG(MARKER_COLORS[i % MARKER_COLORS.length]);
      goalEl.appendChild(m);
      markers.push(m);
    }
    goalEl.setAttribute('aria-label', 'Valmiina 0 / ' + S.goal);
    arena.textContent = '';
    arena.classList.remove('is-done');
    root.classList.add('mg--g' + index);
    root.hidden = false;
    measure();
    S.on(arena, 'pointerdown', onDown, { passive: false });
    S.on(arena, 'click', onClick);
    S.on(window, 'resize', onResize);
    S.on(document, 'visibilitychange', onVisibility);
    if (window.ResizeObserver) {
      try { ro = new ResizeObserver(onResize); ro.observe(arena); } catch (e) { ro = null; }
    }
    try { game(S); } catch (err) {
      if (window.console) console.warn('MiniGames: game ' + index + ' failed to start', err);
      S.later(finish, 1200);
    }
    if (!document.hidden) armLimit();
    last = now();
    raf = requestAnimationFrame(loop);
  };
  return S;
}

/* Start game `index` (already normalised) with `goal` steps; returns the session. */
export function startSession(index, goal, game, onDone) {
  if (current) current.abort();
  current = null;
  if (!ensureOverlay()) return null;
  const S = createSession(index, goal, onDone);
  current = S;
  S.start(game);
  return S;
}
