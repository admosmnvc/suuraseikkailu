/* core.js – minigame session framework v3. OWNER: games-core. Read src/games/CORE-NOTES.md.

   One shared overlay  <section class="mg" data-theme="girl|boy" data-game="boy-0">
                         <header class="mg-head"> rounded title pill + goal markers </header>
                         <div class="mg-arena"> soft rounded card the game draws into </div>
   and one session object S per game. No artificial pacing: every touch is answered in the same frame,
   the length (10–20 s) comes from the game's content. There is no failure.

   Lifecycle: start(S) -> the game reacts to gestures -> S.point() lights goal markers; reaching the goal
   (or S.finish()) starts the celebration (S.onComplete, success SFX, confetti, big praise word) and after
   S.endWait ms onDone() fires once. Safety: at TIME_LIMIT the game auto-finishes (S.fillRest may play a
   quick visual completion first), so onDone always comes by ~20 s. While the page is hidden the time
   limit pauses and a due onDone waits until the page is visible again. abort() removes everything
   (timers, rAF, listeners, gestures, DOM) and never calls onDone. */
import { reducedMotion, now } from '../util.js';
import { SFX } from '../audio/sfx.js';
import { FX } from '../fx.js';
import gestures from './gestures.js';
import { createHint } from './hint.js';
import { FX_IDS } from '../content/prompts.js';

export const TIME_LIMIT = 16500;  /* auto-finish (success) starts here */
const END_WAIT = 1500;            /* default celebration before onDone */
const FILL_MAX = 1100;            /* longest S.fillRest animation honoured */
export const WORDS = ['Hienoa!', 'Upeaa!', 'Super!', 'Huippua!', 'Jee!', 'Mahtavaa!'];
export const PALETTES = {
  girl: ['#FF7A9A', '#B9A4FF', '#FFD36E', '#8EE3C8', '#FFB3C7', '#FFC9A8'],
  boy: ['#5AB4FF', '#2F6BFF', '#FFD54A', '#FF9A3C', '#2EC4B6', '#FF5A5F']
};
export const INK = '#24324F';
const SAY_GAP = 2500;    /* S.say: at most one exclamation per 2.5 s */
const SAY_QUIET = 1500;  /* ... and none while the title prompt starts */

let root = null, titleEl = null, goalEl = null, arena = null, current = null;

function ensureOverlay() {
  if (!document.body) return false;
  if (!root) {
    root = document.createElement('section');
    root.className = 'mg';
    root.hidden = true;
    root.setAttribute('aria-label', 'Minipeli');
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
    root.appendChild(head);
    root.appendChild(arena);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  if (!root.isConnected) document.body.appendChild(root);
  return true;
}

/* Sound effect by name, never throws. */
export function snd(name, arg) {
  try { const f = SFX[name]; if (typeof f === 'function') f.call(SFX, arg); } catch (e) { /* stay silent */ }
}

const STAR_D = 'M50 7C53 7 55 9 56.5 12.5L64 29 82 31.5C89 32.5 91.5 40 86.5 45L73.5 57.5 76.5 75.5C77.5 82.5 71 87 65 84L50 75.5 35 84C29 87 22.5 82.5 23.5 75.5L26.5 57.5 13.5 45C8.5 40 11 32.5 18 31.5L36 29 43.5 12.5C45 9 47 7 50 7Z';
const HEART_D = 'M50 88C24 70 8 55 8 35 8 20 19 10 32 10 40 10 46 14 50 21 54 14 60 10 68 10 81 10 92 20 92 35 92 55 76 70 50 88Z';
const MARK_C = { boy: ['#FFE68A', '#FFC21F'], girl: ['#FFB0C2', '#FF6F91'] };
let markId = 0;
function markerSVG(theme) {
  const id = 'mgm' + (++markId), c = MARK_C[theme] || MARK_C.girl, d = theme === 'boy' ? STAR_D : HEART_D;
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>' +
    '<path class="mk" d="' + d + '"/><path class="mk-on" d="' + d + '" fill="url(#' + id + ')"/>' +
    '<ellipse class="mk-hi" cx="38" cy="30" rx="10" ry="6" fill="#fff" transform="rotate(-25 38 30)"/></svg>';
}

function createSession(o) {
  const theme = o.theme === 'boy' ? 'boy' : 'girl';
  const S = { theme: theme, index: o.index, id: o.id, arena: arena, W: 0, H: 0, t: 0, rm: reducedMotion(),
    score: 0, goal: 0, done: false, dead: false, endWait: END_WAIT, autoFinish: true, colors: PALETTES[theme].slice(), ink: INK,
    update: null, resize: null, fillRest: null, onComplete: null, destroy: null };
  const timers = new Set(), offs = [], markers = [];
  let raf = 0, last = 0, ro = null, limitT = 0, endT = 0, lastFb = 0;
  let limitLeft = TIME_LIMIT, limitFrom = 0, doneWaiting = false;
  let idleFn = null, idleMs = 2500, idleT = 0, lastAct = 0, downs = 0;
  const hint = createHint(arena);
  const startT = now();
  let lastSay = -1e9;

  /* ---------- timers, listeners, DOM ---------- */
  S.later = function (fn, ms) {
    const id = setTimeout(() => { timers.delete(id); if (!S.dead) fn(); }, ms);
    timers.add(id);
    return id;
  };
  S.clear = function (id) { if (timers.has(id)) { clearTimeout(id); timers.delete(id); } };
  S.on = function (el, type, fn, opt) {
    el.addEventListener(type, fn, opt);
    offs.push(() => el.removeEventListener(type, fn, opt));
  };
  S.own = function (off) { if (typeof off === 'function') offs.push(off); return off; };
  S.active = () => !S.done && !S.dead;
  S.add = (el, parent) => { (parent || arena).appendChild(el); return el; };
  S.el = function (tag, cls, html, parent) {
    const el = document.createElement(tag || 'div');
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    if (parent !== null) (parent || arena).appendChild(el);
    return el;
  };
  S.vp = (x, y) => { const r = arena.getBoundingClientRect(); return { x: r.left + x, y: r.top + y }; };
  S.local = (cx, cy) => { const r = arena.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; };
  S.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  S.snd = snd;
  /* short voice exclamation ('fx-vroom', 'fx-go', … PROMPTS FX_IDS) through the app's say(); rate-limited:
     max 1 per 2.5 s and none in the first 1.5 s (the title prompt). Dropped silently when limited. -> played? */
  S.say = function (id) {
    if (S.dead || typeof o.say !== 'function' || FX_IDS.indexOf(id) < 0) return false;
    const t = now();
    if (t - startT < SAY_QUIET || t - lastSay < SAY_GAP) return false;
    lastSay = t;
    try { o.say(id); } catch (e) { /* speech is optional */ }
    return true;
  };

  /* ---------- gestures (auto-cleaned) ---------- */
  S.tap = (el, fn) => S.own(gestures.tap(el, (p) => { if (S.active()) fn(p); }));
  function gated(opt) { opt = opt || {}; return Object.assign({}, opt, { enabled: () => S.active() && (!opt.enabled || opt.enabled()) }); }
  S.drag = (el, opt) => S.own(gestures.drag(el, gated(opt)));
  S.rub = (el, opt) => S.own(gestures.rub(el, gated(opt)));
  S.hold = (el, opt) => S.own(gestures.hold(el, gated(opt)));
  S.clearDrag = gestures.clearDrag;

  /* instant squash/pop of an element (Web Animations: starts this frame, no reflow, composes via `scale`) */
  S.bump = function (el, k) {
    if (!el || !el.animate) return;
    k = k || 1;
    try {
      if (S.rm) el.animate([{ filter: 'brightness(1.35)' }, { filter: 'none' }], { duration: 220 });
      else el.animate([{ scale: String(1 - 0.16 * k) }, { scale: String(1 + 0.1 * k), offset: 0.45 }, { scale: '1' }], { duration: 260, easing: 'ease-out' });
    } catch (e) { /* old engine */ }
  };

  /* ---------- FX helpers in arena px ---------- */
  S.burst = function (at, colors, n) { const v = S.vp(at.x, at.y); FX.burst(v.x, v.y, colors || S.colors, n); };
  S.sparkle = function (at) { const v = S.vp(at.x, at.y); FX.sparkle(v.x, v.y); };
  /* praise word ("Hienoa!") in a soft pill at arena px; text defaults to a random cheer */
  S.comic = function (text, at, big) {
    if (S.dead) return null;
    at = at || { x: S.W / 2, y: S.H * 0.4 };
    const el = S.el('div', 'mg-comic' + (big ? ' mg-comic--big' : ''), '<b></b>');
    el.firstChild.textContent = text || WORDS[(Math.random() * WORDS.length) | 0];
    el.setAttribute('aria-hidden', 'true');
    /* centred on `at`, kept inside the arena (width estimated from the text: no layout read) */
    const len = el.firstChild.textContent.length, fs = big ? Math.min(38, Math.max(26, Math.min(S.W, S.H) * 0.07)) : Math.min(26, Math.max(18, Math.min(S.W, S.H) * 0.048));
    const w = len * fs * 0.58 + (big ? 60 : 36), h = fs * 1.3 + (big ? 22 : 14);
    el.style.width = Math.round(w) + 'px';
    el.style.height = Math.round(h) + 'px';
    el.style.left = Math.round(Math.min(Math.max(at.x - w / 2, 6), Math.max(6, S.W - w - 6))) + 'px';
    el.style.top = Math.round(Math.min(Math.max(at.y - h / 2, 6), Math.max(6, S.H - h - 6))) + 'px';
    S.later(() => { if (el.parentNode) el.parentNode.removeChild(el); }, big ? 1500 : 950);
    return el;
  };
  S.praise = S.comic;

  /* ---------- hints ---------- */
  S.hint = function (spec) { if (S.dead || S.done) return null; return hint.show(spec); };
  S.hideHint = () => hint.hide();
  S.idleHint = function (fn, ms) {
    idleFn = typeof fn === 'function' ? fn : null;
    idleMs = ms > 0 ? ms : 2500;
    S.progress();
  };
  S.progress = function () { lastAct = now(); armIdle(idleMs); };
  function armIdle(ms) {
    if (idleT) { clearTimeout(idleT); idleT = 0; }
    if (!idleFn || S.dead || S.done) return;
    idleT = setTimeout(idleCheck, ms);
  }
  function idleCheck() {
    idleT = 0;
    if (!idleFn || !S.active()) return;
    const left = idleMs - (now() - lastAct);
    if (downs > 0 || document.hidden) { armIdle(idleMs); return; }
    if (left > 30) { armIdle(left); return; }
    if (!hint.visible) { try { idleFn(); } catch (e) { /* hint is decoration */ } }
    /* stays visible until the next touch, which re-arms the timer */
  }

  /* ---------- goal + finish ---------- */
  S.setGoal = function (n) {
    S.goal = Math.max(0, Math.floor(n) || 0);
    goalEl.textContent = '';
    markers.length = 0;
    for (let i = 0; i < S.goal; i++) {
      const m = document.createElement('span');
      m.className = 'mg-mark' + (i < S.score ? ' on' : '');
      m.innerHTML = markerSVG(theme);
      goalEl.appendChild(m);
      markers.push(m);
    }
    goalEl.setAttribute('aria-label', 'Valmiina ' + Math.min(S.score, S.goal) + ' / ' + S.goal);
  };
  S.point = function (n) {
    if (!S.active()) return;
    const k = Math.max(1, Math.floor(n) || 1);
    for (let j = 0; j < k; j++) { S.score += 1; const m = markers[S.score - 1]; if (m) m.classList.add('on'); }
    goalEl.setAttribute('aria-label', 'Valmiina ' + Math.min(S.score, S.goal) + ' / ' + S.goal);
    S.progress();
    if (S.goal && S.score >= S.goal && S.autoFinish) finish();
  };
  S.finish = () => finish();

  function finish() {
    if (!S.active()) return;
    S.done = true;
    hint.hide();
    if (idleT) { clearTimeout(idleT); idleT = 0; }
    if (limitT) { clearTimeout(limitT); limitT = 0; }
    arena.classList.add('is-done');
    for (const m of markers) m.classList.add('on');
    goalEl.setAttribute('aria-label', 'Valmis!');
    if (S.onComplete) { try { S.onComplete(); } catch (e) { /* decoration only */ } }
    snd('success');
    FX.confetti(60);
    /* finale praise high up and compact, so the finished scene stays visible */
    S.later(() => S.comic(WORDS[(Math.random() * 4) | 0], { x: S.W / 2, y: Math.max(34, S.H * 0.13) }, true), 120);
    const wait = Math.max(600, Math.min(4000, +S.endWait || END_WAIT));
    endT = setTimeout(() => {
      endT = 0;
      if (S.dead) return;
      if (document.hidden) { doneWaiting = true; return; } /* hand over when the child can see it */
      done();
    }, wait);
  }
  function done() {
    doneWaiting = false;
    cleanup();
    if (typeof o.onDone === 'function') o.onDone();
  }
  function onVisibility() {
    if (S.dead) return;
    if (document.hidden) {
      if (limitT) { clearTimeout(limitT); limitT = 0; limitLeft = Math.max(0, limitLeft - (now() - limitFrom)); }
    } else {
      if (doneWaiting) { done(); return; }
      if (S.active() && !limitT && limitLeft >= 0) armLimit();
      S.progress();
    }
  }
  function armLimit() { limitFrom = now(); limitT = setTimeout(timeUp, limitLeft); }
  function timeUp() {
    limitT = 0;
    limitLeft = -1;
    if (!S.active()) return;
    let wait = 0;
    if (S.fillRest) { try { wait = +S.fillRest() || 0; } catch (e) { wait = 0; } }
    if (wait > 0) S.later(finish, Math.min(FILL_MAX, wait)); else finish();
  }

  /* ---------- input: every touch answers this frame ---------- */
  function onDownCapture(e) {
    if (S.dead) return;
    if (e.cancelable) e.preventDefault(); /* no selection / callout / ghost scroll */
    downs++;
    lastAct = now();
    hint.hide();
    if (S.active()) armIdle(idleMs);
  }
  function onDownBubble(e) {
    if (S.dead || e.__mgUsed) return;
    /* nobody used this touch (empty space, celebration): a small sparkle where it landed */
    const t = now();
    if (t - lastFb < 90) return;
    lastFb = t;
    FX.sparkle(e.clientX, e.clientY);
    if (!S.done) snd('tap');
  }
  function onUp() { downs = Math.max(0, downs - 1); lastAct = now(); }
  function onMove() { if (downs) lastAct = now(); }

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
    if (measure() && S.resize) { try { S.resize(ow, oh); } catch (e) { if (window.console) console.warn('MiniGames: resize', e); } }
  }
  function loop(ts) {
    raf = 0;
    if (S.dead) return;
    const dt = Math.min(50, Math.max(0, ts - last)) / 1000;
    last = ts;
    S.t += dt;
    if (S.update) { try { S.update(dt, S.t); } catch (e) { S.update = null; if (window.console) console.warn('MiniGames: update', e); } }
    raf = requestAnimationFrame(loop);
  }

  function cleanup() {
    S.dead = true;
    if (current === S) current = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (limitT) { clearTimeout(limitT); limitT = 0; }
    if (endT) { clearTimeout(endT); endT = 0; }
    if (idleT) { clearTimeout(idleT); idleT = 0; }
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    while (offs.length) { try { offs.pop()(); } catch (e) { /* ignore */ } }
    if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
    if (S.destroy) { try { S.destroy(); } catch (e) { /* ignore */ } }
    S.update = S.resize = S.fillRest = S.onComplete = S.destroy = null;
    idleFn = null;
    hint.hide();
    FX.setTheme(null);
    arena.textContent = '';
    arena.className = 'mg-arena';
    goalEl.textContent = '';
    goalEl.removeAttribute('aria-label');
    titleEl.textContent = '';
    root.removeAttribute('data-game');
    root.__mgForceHint = null;
    root.hidden = true;
  }
  S.abort = () => { if (!S.dead) cleanup(); };

  S.start = function (game) {
    titleEl.textContent = o.title || '';
    arena.textContent = '';
    arena.className = 'mg-arena';
    root.dataset.theme = theme;
    root.dataset.game = theme + '-' + o.index;
    root.hidden = false;
    FX.clear(); /* no leftover confetti from the previous screen floating over the game */
    FX.setTheme(theme);
    S.setGoal(game && game.goal ? game.goal : 0);
    measure();
    S.on(arena, 'pointerdown', onDownCapture, { capture: true, passive: false });
    S.on(arena, 'pointerdown', onDownBubble, { passive: true });
    S.on(window, 'pointerup', onUp, { capture: true, passive: true });
    S.on(window, 'pointercancel', onUp, { capture: true, passive: true });
    S.on(window, 'pointermove', onMove, { capture: true, passive: true });
    S.on(window, 'resize', onResize);
    S.on(document, 'visibilitychange', onVisibility);
    if (window.ResizeObserver) {
      try { ro = new ResizeObserver(onResize); ro.observe(arena); } catch (e) { ro = null; }
    }
    lastAct = now();
    /* test hook (tools/games-test.cjs): show the current idle hint right now */
    root.__mgForceHint = () => { if (idleFn && S.active()) { hint.hide(); try { idleFn(); } catch (e) { /* ignore */ } } return !!hint.visible; };
    try {
      if (!game || typeof game.start !== 'function') throw new Error('no start()');
      game.start(S);
    } catch (err) {
      if (window.console) console.warn('MiniGames: game ' + theme + '-' + o.index + ' failed to start', err);
      S.later(finish, 1200);
    }
    if (!document.hidden) armLimit();
    last = now();
    raf = requestAnimationFrame(loop);
  };
  return S;
}

/* Start a game: o = { theme, index, id, title, game: {goal?, start(S)}, onDone } -> S (or null without a body) */
export function startSession(o) {
  if (current) current.abort();
  current = null;
  if (!ensureOverlay()) return null;
  const S = createSession(o);
  current = S;
  S.start(o.game);
  return S;
}
