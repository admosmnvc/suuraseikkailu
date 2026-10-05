/* End-to-end suite v3 for a built app. OWNER: ui agent.

     npx vite build --outDir ../build-v3-ui --emptyOutDir && node tools/e2e.cjs ../build-v3-ui [--shots ../qa/v3-ui/e2e] [--only flow-390x844,audio,...]

   Headless Chromium (Playwright from /opt/node-tools, CommonJS) with autoplay allowed and a fake microphone; the build
   is served by tools/pwa-serve.cjs (HTTP Range). Suites run in parallel, one browser context each:
     flow-<vp>  empty device: cover -> onboarding (Tyttö) -> girl home -> Shahada HELPPO, Al-Ikhlas KESKITASO,
                Al-Kawthar VAIKEA, every step (Sanoin!, minigame per the every setting, reward + gem when a line is
                complete, Jatka, finale + sticker, Kotiin) -> "+ Lisää lapsi" boy -> boy theme -> Al-Kawthar VAIKEA with
                rocket parts + rocket launch finale -> switch players -> reload keeps both -> long-press settings.
                360x740 runs with prefers-reduced-motion; 390x844 every step gets a game, the others every 2nd step.
     audio      VAIKEA Al-Fatiha step 7 chain order (level prompt, 001001..001007, turn-all), never overlapping, line
                highlight, Kuuntele restarts, Sanoin! cuts within 150 ms, line chips; HELPPO chunk audio (Shahada step
                5, Al-Fatiha step 6: full lines as line clips, then the partial line as ONE recitation prefix clip).
     settings   short tap hint, long-press opens, children list, sound tests, record/play/delete (fake mic), own
                recording in the lesson, switches (slow 0.8, translit off, speech off), default level, "Pelaa nyt",
                reset one child, delete the playing child -> picker, Escape.
     migrate    a v1/v2 save becomes the first child (girl, VAIKEA, progress, stars, settings kept).
     offline    service worker precache under a sub-path, server stopped + offline reload, playback.
     background app hidden during a minigame: onDone held, one reward, flow goes on.
     boygames   the boy's game turn seeded at 3, 4, 5: those games run (the flows reach boy-0..2).
     intro-sound    autoplay allowed: the intro starts Web Audio without a tap, its effects run in step with the
                    animation (car 0.6 s ... button 4.1 s), "intro-title" at the logo, "intro-go" 3 s after the button
                    when nobody taps; a skip stops them (the title then follows the start tap); effects / speech off.
     intro-silent   a second Chromium WITHOUT the autoplay flag (iOS / first visit): no AudioContext, effect or voice
                    before the tap, the intro plays + skips as usual, the start tap unlocks audio and says the title.
   Voice lines in the flows: onboarding "nice-name" (tap right away + after a 1.2 s pause, once per name), "welcome-new",
   picker name + "welcome-back" + time-of-day greeting, new child greeting + "welcome", "game-done" before the praise, finale Kotiin "bye".
   Every screen: no horizontal scroll, visible buttons >= 64 px (inside settings >= 44 px), labels inside their
   buttons, reward/finale buttons on screen without scrolling, screenshot to <shots>/<suite>/. Console errors /
   warnings and failed requests fail the suite. Exit code 1 on any failure. */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { serve } = require('./pwa-serve.cjs');

function loadPlaywright() {
  for (const t of [process.env.PLAYWRIGHT, '/opt/node-tools/node_modules/playwright', 'playwright']) {
    if (!t) continue;
    try { return require(t); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT=/path/to/node_modules/playwright');
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
function opt(name, def) { const i = argv.indexOf(name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; }
const SHOTS = path.resolve(opt('--shots', path.join(ROOT, '..', 'qa', 'v3-ui', 'e2e')));
const ONLY = String(opt('--only', '') || '').split(',').filter(Boolean);
const DIST = path.resolve(argv[0] || path.join(ROOT, 'dist'));
const KEY = 'suuraseikkailu-v3';
const OLD_KEY = 'suuraseikkailu-v1';
const GIRL = 'Aisha', BOY = 'Omar';
const FLAGS = ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

/* Console messages that are allowed: [regex, reason]. Everything else (error, warning, pageerror) fails. */
const ALLOW = [];
/* Buttons allowed under the size rule: [regex on the descriptor, reason]. They are listed with sizes. */
const EXCEPT = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(suite, name, ok, detail) {
  results.push({ suite, name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  return !!ok;
}

let SECS = [], PROMPTS = {}, unitsOf = null;

/* ---------- page instrumentation (runs before the app in every document) ---------- */
function instrument() {
  const T = () => Math.round(performance.now());
  const A = { log: [], clicks: [], decodes: 0, speaks: 0, els: [] };
  window.__audio = A;
  const tags = new WeakMap(), blobSrc = new Map();
  const ob = Response.prototype.blob;
  Response.prototype.blob = function () {
    const u = this.url;
    return ob.call(this).then((b) => { try { tags.set(b, u); } catch (e) { /* ignore */ } return b; });
  };
  const oc = URL.createObjectURL;
  URL.createObjectURL = function (o) {
    const u = oc.call(URL, o);
    try { blobSrc.set(u, tags.get(o) || ('blob(' + ((o && o.type) || '?') + ')')); } catch (e) { /* ignore */ }
    return u;
  };
  const name = (s) => {
    s = String(s || '');
    if (!s) return '';
    if (s.startsWith('data:')) return 'silent';
    if (s.startsWith('blob:')) s = blobSrc.get(s) || 'blob?';
    const m = /\/audio\/([^?#]+)/.exec(s);
    return m ? decodeURIComponent(m[1]) : s;
  };
  function watch(el) {
    if (el.__e2e != null) return;
    el.__e2e = A.els.length;
    A.els.push(el);
    ['play', 'playing', 'pause', 'ended', 'error'].forEach((type) => el.addEventListener(type, () => {
      const act = document.querySelector('#lines .line.active');
      A.log.push({ t: T(), type, src: name(el.src), rate: el.playbackRate, pp: el.preservesPitch, el: el.__e2e, active: act ? act.id : null });
    }));
  }
  const op = HTMLMediaElement.prototype.play;
  /* A.probe: outcomes of silent data: plays (the app's autoplay probe, the unlock in a tap): 'ok' or the error name */
  A.probe = [];
  HTMLMediaElement.prototype.play = function () {
    watch(this);
    const p = op.apply(this, arguments);
    if (p && p.then && String(this.src).startsWith('data:')) p.then(() => A.probe.push('ok'), (e) => A.probe.push(e && e.name));
    return p;
  };
  /* 'stop' = pause() called on a playing element, logged synchronously with the src it was playing */
  const opa = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () {
    if (this.__e2e != null && !this.paused) A.log.push({ t: T(), type: 'stop', src: name(this.src), el: this.__e2e });
    return opa.apply(this, arguments);
  };
  /* simulated app switch: document.hidden + visibilitychange (headless pages are always visible) */
  window.__setHidden = (h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  A.ptr = [];
  ['pointerdown', 'pointerup'].forEach((type) => document.addEventListener(type, (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    A.ptr.push({ t: T(), type, id: b ? b.id : '' });
  }, true));
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button,label') : null;
    A.clicks.push({ t: T(), id: b ? (b.id || b.getAttribute('data-act') || b.getAttribute('data-test') || b.className) : '' });
  }, true);
  /* Web Audio: contexts created (and whether a tap had happened), source node starts (sound effects) */
  A.ac = []; A.src = [];
  if (window.AudioContext) {
    window.AudioContext = new Proxy(window.AudioContext, { construct(t, args) {
      const c = Reflect.construct(t, args);
      A.ac.push({ t: T(), tapped: navigator.userActivation ? navigator.userActivation.hasBeenActive : null, c });
      return c;
    } });
  }
  if (window.AudioScheduledSourceNode) {
    const ost = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function () { A.src.push(T()); return ost.apply(this, arguments); };
  }
  /* intro clock: when #gate's data-intro turns 'play' / 'done' */
  document.addEventListener('DOMContentLoaded', () => {
    const g = document.getElementById('gate');
    if (!g) return;
    const note = () => { const v = g.dataset.intro; if (v === 'play' && A.introAt == null) A.introAt = T(); if (v === 'done' && A.introDone == null) A.introDone = T(); };
    note();
    new MutationObserver(note).observe(g, { attributes: true, attributeFilter: ['data-intro'] });
  });
  if (window.BaseAudioContext) {
    const od = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function () { A.decodes++; return od.apply(this, arguments); };
  }
  if (window.speechSynthesis) {
    const os = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function (u) { A.speaks++; return os(u); };
  }
}

/* ---------- in-page probes ---------- */
function MEASURE() {
  const iw = window.innerWidth, ih = window.innerHeight;
  const targets = [], clipped = [];
  const desc = (el) => {
    const act = el.getAttribute('data-act') || el.getAttribute('data-kact') || el.getAttribute('data-test') || el.getAttribute('data-every') || el.getAttribute('data-level');
    const id = el.id && !/^(step|card|kid)-/.test(el.id) ? '#' + el.id : '';
    const cls = Array.from(el.classList).filter((c) => !/^(jelly|pressed|boing|nudge|playing|current|done|selected|is-|on$)/.test(c)).slice(0, 2).join('.');
    const txt = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '') + (act ? '[' + act + ']' : '') + (txt ? ' "' + txt + '"' : '');
  };
  document.querySelectorAll('button, a[href], summary, [role="button"], label.set-switch, input[type="text"]').forEach((el) => {
    if (el.closest('[hidden], [inert]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const game = !!el.closest('.mg');
    if (game && el.matches('.is-spent, .is-flying, .is-gone, [disabled]')) return; /* no longer a target */
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (game && (r.right <= 0 || r.bottom <= 0 || r.left >= iw || r.top >= ih)) return;
    /* inside a scrolling step row only the bubbles in view count */
    if (el.closest('.steps.many') && (r.right <= 0 || r.left >= iw)) return;
    const w = game ? r.width : (el.offsetWidth || r.width), h = game ? r.height : (el.offsetHeight || r.height);
    targets.push({ d: desc(el), w: Math.round(w), h: Math.round(h), inSettings: !!el.closest('#settings'), game });
    if (!game && el.tagName !== 'INPUT') {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n, minL = Infinity, maxR = -Infinity;
      while ((n = tw.nextNode())) {
        if (!n.nodeValue.trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) { if (q.width) { minL = Math.min(minL, q.left); maxR = Math.max(maxR, q.right); } }
      }
      if (maxR > r.right + 1 || minL < r.left - 1) clipped.push(desc(el) + ' text runs ' + Math.round(Math.max(maxR - r.right, r.left - minL)) + 'px outside a ' + Math.round(r.width) + 'px button');
    }
  });
  const offscreen = [];
  ['reward', 'finale', 'levelPick'].forEach((id) => {
    const o = document.getElementById(id);
    if (!o || o.hidden) return;
    o.querySelectorAll('.ov-actions button, .level-opt').forEach((b) => {
      const q = b.getBoundingClientRect();
      if (q.top < 0 || q.bottom > ih + 0.5) offscreen.push(desc(b) + ' y ' + Math.round(q.top) + '-' + Math.round(q.bottom) + ' / ' + ih);
    });
  });
  return { sw: document.documentElement.scrollWidth, iw, ih, targets, clipped, offscreen };
}

function ARENA() {
  const m = document.querySelector('section.mg');
  if (!m || m.hidden) return { open: false };
  const arena = m.querySelector('.mg-arena');
  const a = arena.getBoundingClientRect();
  const items = [];
  arena.querySelectorAll('button, [role="button"], .mg-item').forEach((el) => {
    if (el.matches('.is-spent, .is-flying, .is-gone, [disabled]')) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (r.width > 8 && x > a.left + 4 && x < a.right - 4 && y > a.top + 4 && y < a.bottom - 4) items.push({ x, y });
  });
  return { open: true, done: arena.classList.contains('is-done'), arena: { x: a.left, y: a.top, w: a.width, h: a.height }, items,
    game: m.dataset.game || '', title: ((m.querySelector('.mg-title') || {}).textContent || '').trim() };
}

/* ---------- context + helpers ---------- */
async function newCtx(browser, base, suite, vp, extra = {}) {
  const context = await browser.newContext({
    viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1,
    reducedMotion: extra.rm ? 'reduce' : 'no-preference',
    permissions: extra.mic ? ['microphone'] : [],
    serviceWorkers: extra.sw ? 'allow' : 'block'
  });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const ctx = {
    suite, vp, tag: suite, context, page, base,
    console: [], failed: [], shot: 0, screens: [], small: new Map(), secondary: new Map(), games: [], t0: Date.now()
  };
  page.on('console', (m) => {
    const ty = m.type();
    if ((ty === 'error' || ty === 'warning') && !/Service Worker registration blocked by Playwright/.test(m.text())) ctx.console.push(ty + ': ' + m.text());
  });
  page.on('pageerror', (e) => ctx.console.push('pageerror: ' + (e && e.message) + ' @ ' + String((e && e.stack) || '').split('\n').slice(1, 3).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')));
  /* net::ERR_ABORTED = a preload cut by the suite's own reload / navigation, not a failure */
  page.on('response', (r) => { if (r.status() >= 400) ctx.console.push('http ' + r.status() + ': ' + r.url().replace(/^https?:\/\/[^/]+\//, '')); });
  page.on('requestfailed', (r) => { const t = (r.failure() || {}).errorText || ''; if (!/ERR_ABORTED/.test(t)) ctx.failed.push(r.url() + ' ' + t); });
  return ctx;
}

const W = (ctx, fn, arg, ms = 15000) => ctx.page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const tryW = (ctx, fn, arg, ms) => W(ctx, fn, arg, ms).then(() => true, () => false);
const alen = (ctx) => ctx.page.evaluate(() => window.__audio.log.length);
const alog = (ctx, from = 0) => ctx.page.evaluate((f) => window.__audio.log.slice(f), from);
const plays = (log) => {
  const out = [];
  for (const e of log) if (e.type === 'playing' && e.src !== 'silent' && (!out.length || out[out.length - 1].src !== e.src)) out.push(e);
  return out;
};
/* src ending in '*' = prefix */
function waitEvent(ctx, from, type, src, ms = 15000) {
  return tryW(ctx, ({ from, type, src }) => window.__audio.log.slice(from).some((e) => e.type === type &&
    (src.endsWith('*') ? e.src.startsWith(src.slice(0, -1)) : e.src === src)), { from, type, src }, ms);
}
/* the fi/ prompts played since `from`, in order (ids without fi/ and .mp3) */
const fiPlays = (log) => plays(log).filter((e) => e.src.startsWith('fi/')).map((e) => e.src.slice(3).replace(/\.mp3$/, ''));
/* want appears in got in this order (other prompts may sit between) */
const inOrder = (got, want) => { let i = 0; for (const g of got) if (g === want[i]) i++; return i === want.length; };
const GREETS = ['greet-morning', 'greet-day', 'greet-evening'];
const greetNow = () => { const h = new Date().getHours(); return h >= 5 && h < 10 ? 'greet-morning' : h >= 10 && h < 17 ? 'greet-day' : 'greet-evening'; };
/* waits until `last` has played, then the prompt list since `from` */
async function promptsUntil(ctx, from, last, ms = 9000) {
  await waitEvent(ctx, from, 'playing', 'fi/' + last + '.mp3', ms);
  return fiPlays(await alog(ctx, from));
}
const lsStore = (ctx) => ctx.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const shown = (ctx, id) => ctx.page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);
/* After a screen change, the cover tap or a closing overlay the app ignores pointer clicks for 450 ms
   (a fast double tap must not reach the layer below), so the helpers that wait for those changes settle first. */
const SETTLE_MS = 520;
const waitShown = (ctx, id, ms) => W(ctx, (i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id, ms).then(() => sleep(SETTLE_MS));
const waitHidden = (ctx, id, ms) => W(ctx, (i) => { const e = document.getElementById(i); return !e || e.hidden; }, id, ms).then(() => sleep(SETTLE_MS));

/* Real mouse tap at the element's centre (scrolled into view first); fails if something covers it. */
async function center(ctx, sel) {
  const b = await ctx.page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { err: 'missing' };
    const probe = () => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { r, x, y, top: document.elementFromPoint(x, y) };
    };
    let { r, x, y, top } = probe();
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth || !top || !(top === el || el.contains(top))) {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      ({ r, x, y, top } = probe());
    }
    return { x, y, hit: !!top && (top === el || el.contains(top)), top: top ? (top.id || String(top.className.baseVal != null ? top.className.baseVal : top.className)) : null };
  }, sel);
  if (b.err) throw new Error('tap ' + sel + ': ' + b.err);
  if (!b.hit) throw new Error('tap ' + sel + ': covered by ' + b.top);
  return b;
}
async function tap(ctx, sel) {
  const b = await center(ctx, sel);
  await ctx.page.mouse.click(b.x, b.y, { delay: 40 });
}
async function longPress(ctx, sel, ms = 1000) {
  const b = await center(ctx, sel);
  await ctx.page.mouse.move(b.x, b.y);
  await ctx.page.mouse.down();
  await sleep(ms);
  await ctx.page.mouse.up();
}

/* Overflow + tap targets + screenshot of the current screen. */
async function screen(ctx, label, settle = 350) {
  await sleep(settle);
  const m = await ctx.page.evaluate(MEASURE);
  ctx.screens.push({ label, sw: m.sw, iw: m.iw, clipped: m.clipped, offscreen: m.offscreen });
  for (const t of m.targets) {
    const min = Math.min(t.w, t.h), need = t.inSettings ? 44 : 64;
    if (t.inSettings && min < 64) ctx.secondary.set(t.d.replace(/ ".*$/, ''), Math.min(ctx.secondary.get(t.d.replace(/ ".*$/, '')) || 99, min));
    if (min >= need) continue;
    const prev = ctx.small.get(t.d);
    if (!prev || min < prev.min) ctx.small.set(t.d, { d: t.d, w: t.w, h: t.h, min, need, screen: label, game: t.game });
  }
  const dir = path.join(SHOTS, ctx.tag);
  fs.mkdirSync(dir, { recursive: true });
  await ctx.page.screenshot({ path: path.join(dir, String(++ctx.shot).padStart(2, '0') + '-' + label + '.png') });
}

async function finish(ctx) {
  const S = ctx.suite;
  const over = ctx.screens.filter((s) => s.sw > s.iw);
  check(S, 'no horizontal scroll on ' + ctx.screens.length + ' screens', ctx.screens.length > 0 && over.length === 0,
    over.map((s) => s.label + ' ' + s.sw + '>' + s.iw).join(', ') || 'max scrollWidth = innerWidth ' + ctx.vp[0]);
  const clip = ctx.screens.filter((s) => s.clipped.length).map((s) => s.label + ': ' + s.clipped.join(', '));
  check(S, 'button labels fit inside their buttons', clip.length === 0, clip.slice(0, 4).join(' | ') || 'all');
  const off = ctx.screens.filter((s) => s.offscreen.length).map((s) => s.label + ': ' + s.offscreen.join(', '));
  check(S, 'reward / finale / level buttons visible without scrolling', off.length === 0, off.slice(0, 4).join(' | ') || 'all');
  const small = Array.from(ctx.small.values());
  const ui = small.filter((s) => !s.game && !EXCEPT.some(([re]) => re.test(s.d)));
  const games = small.filter((s) => s.game);
  check(S, 'ui tap targets >= 64 px (settings >= 44 px)', ui.length === 0,
    ui.length ? ui.map((s) => s.d + ' ' + s.w + 'x' + s.h + ' @' + s.screen).join(' | ') :
      'all' + (ctx.secondary.size ? ' · settings controls < 64 px: ' + Array.from(ctx.secondary).map(([d, m]) => d + ' ' + m + 'px').join(', ') : ''));
  if (ctx.games.length) {
    check(S, 'minigame tap targets >= 64 px (games agents)', games.length === 0, games.map((s) => s.d + ' ' + s.w + 'x' + s.h + ' @' + s.screen).join(' | ') || 'all');
  }
  const msgs = ctx.console.filter((m) => !ALLOW.some(([re]) => re.test(m)));
  check(S, 'console: no errors / warnings', msgs.length === 0, msgs.slice(0, 6).join(' | ') || 'clean');
  check(S, 'no failed requests', ctx.failed.length === 0, ctx.failed.slice(0, 4).join(' | ') || 'none');
  try { await ctx.context.close(); } catch (e) { /* ignore */ }
  ctx.ms = Date.now() - ctx.t0;
}

async function crash(ctx, e) {
  check(ctx.suite, 'suite ran to the end', false, String(e && e.message || e).split('\n')[0]);
  try {
    const dir = path.join(SHOTS, ctx.tag);
    fs.mkdirSync(dir, { recursive: true });
    await ctx.page.screenshot({ path: path.join(dir, 'zz-error.png') });
  } catch (err) { /* ignore */ }
}

/* ---------- app helpers ---------- */
const kid = (id, name, theme, extra) => Object.assign({ id, name, theme, level: 'easy', levelBySection: {},
  progress: { shahada: 0, fatiha: 0, ikhlas: 0, kawthar: 0 }, steps: {}, done: {}, stars: 0, game: 0 }, extra);
const store = (children, settings, activeId) => ({ version: 3, children, activeId: activeId || (children[0] && children[0].id) || null,
  settings: Object.assign({ speech: true, slow: false, translit: true, sfx: true, every: 1 }, settings) });

async function seed(ctx, st, key = KEY) {
  await ctx.page.goto(ctx.base);
  await ctx.page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(s)); }, [key, st]);
  await ctx.page.reload();
}

/* The intro on the first screen: o.watch = let it run to the end (checks length + scene parts), otherwise a tap
   (on the button's spot, the worst case) skips it. Reduced motion starts at the final state. */
async function intro(ctx, o = {}) {
  const S = ctx.suite, page = ctx.page;
  await W(ctx, () => { const g = document.getElementById('gate'); return g && !g.hidden && g.dataset.mode === 'start' && g.dataset.intro !== 'idle'; });
  const st = await page.evaluate(() => ({ intro: document.getElementById('gate').dataset.intro, rm: matchMedia('(prefers-reduced-motion: reduce)').matches,
    parts: ['in-mosque', 'in-road', 'in-car', 'in-camel', 'in-pony', 'in-stars', 'in-rocket', 'in-crown'].filter((id) => document.querySelector('#coverArt #' + id + ', #coverArt [data-in="' + id + '"]')),
    font: document.fonts.check('800 40px Sniglet') }));
  if (st.rm) {
    if (o.quiet) return;
    await sleep(700);
    const snd = await page.evaluate(() => ({ ac: window.__audio.ac.length, src: window.__audio.src.length }));
    check(S, 'intro: reduced motion starts at the final state, no intro effects', st.intro === 'done' && !snd.src, JSON.stringify(Object.assign(st, snd)));
    return;
  }
  if (st.intro === 'done') { if (!o.quiet) check(S, 'intro: still running when checked', false, JSON.stringify(st)); return; }
  if (o.watch) {
    const t0 = Date.now();
    await screen(ctx, 'intro-start', 0);
    await W(ctx, () => document.querySelector('.intro-logo') && getComputedStyle(document.querySelector('.intro-logo')).display !== 'none' &&
      document.querySelector('.logo-bot i:last-child').getAnimations().some((a) => a.playState === 'finished' || a.currentTime > 450), null, 8000).catch(() => {});
    await screen(ctx, 'intro-logo', 0);
    const done = await tryW(ctx, () => document.getElementById('gate').dataset.intro === 'done', null, 8000);
    const ms = Date.now() - t0;
    check(S, 'intro: plays by itself (~5 s) to the final state, scene parts + Sniglet present', done && ms < 7000 && st.intro === 'play' && st.font &&
      ['in-mosque', 'in-road', 'in-car', 'in-pony'].every((id) => st.parts.includes(id)), JSON.stringify(Object.assign(st, { ms })));
    return;
  }
  const b = await page.evaluate(() => { const r = document.getElementById('gateBtn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(b.x, b.y, { delay: 40 });
  const skipped = await tryW(ctx, () => document.getElementById('gate').dataset.intro === 'done', null, 1500);
  await sleep(120);
  const still = await page.evaluate(() => !document.getElementById('gate').hidden && document.getElementById('who').hidden);
  if (!o.quiet) check(S, 'intro: a tap skips to the final state and does not start the app', st.intro === 'play' && skipped && still, JSON.stringify({ st, skipped, still }));
  await sleep(500);
}

/* the cover: tap "Aloita Suuraseikkailu" -> picker / onboarding; 'cover' + 'who' / 'ask-theme' prompts play */
async function cover(ctx, view, o = {}) {
  await W(ctx, () => { const g = document.getElementById('gate'); return g && !g.hidden && g.dataset.mode === 'start'; });
  await ctx.page.evaluate(() => document.fonts && document.fonts.ready);
  await intro(ctx, o.intro || { quiet: true });
  if (!ctx.coverShot) { ctx.coverShot = true; await screen(ctx, 'cover', 500); }
  const from = await alen(ctx);
  await tap(ctx, '#gateBtn');
  await W(ctx, (v) => document.getElementById('gate').hidden && !document.getElementById('who').hidden && document.getElementById('who').dataset.view === v, view);
  await sleep(SETTLE_MS);
  return waitEvent(ctx, from, 'playing', 'fi/' + (view === 'pick' ? 'who' : 'ask-theme') + '.mp3', 8000);
}

async function pickKid(ctx, id) {
  await tap(ctx, '#pk-' + id);
  await W(ctx, () => document.getElementById('who').hidden && !document.getElementById('home').hidden);
  await sleep(SETTLE_MS);
}

const homeInfo = (ctx) => ctx.page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  greeting: document.getElementById('greeting').textContent,
  name: document.getElementById('whoName').textContent,
  cards: Array.from(document.querySelectorAll('#secGrid .sec-card')).map((c) => ({ id: c.dataset.id, done: c.classList.contains('done') })),
  album: document.getElementById('albumCount').textContent,
  prog: document.getElementById('progCount').textContent,
  progTitle: document.getElementById('progTitle').textContent,
  progArt: !!document.querySelector('#progArt .art-progress-' + document.documentElement.dataset.theme),
  stars: +document.querySelector('#homeStars .stars-num').textContent
}));
const stepInfo = (ctx) => ctx.page.evaluate(() => {
  const s = Array.from(document.querySelectorAll('#steps .step'));
  return { count: s.length, enabled: s.filter((b) => !b.disabled).length, done: s.filter((b) => b.classList.contains('done')).length,
    current: s.findIndex((b) => b.classList.contains('current')) + 1 };
});
const learnInfo = (ctx) => ctx.page.evaluate(() => {
  const lines = Array.from(document.querySelectorAll('#lines .line'));
  const last = lines[lines.length - 1];
  return { lines: lines.length, newOnLast: !!(last && last.querySelector('.badge-new')), anyNew: !!document.querySelector('#lines .badge-new'),
    partial: document.getElementById('lines').dataset.partial, newWords: document.querySelectorAll('#lines .w.new').length,
    later: document.querySelectorAll('#lines .w.later').length, level: document.getElementById('levelName').textContent,
    title: document.getElementById('instrTitle').textContent, sub: document.getElementById('instrSub').textContent };
});
const rewardInfo = (ctx) => ctx.page.evaluate(() => ({
  heading: document.getElementById('rewardTitle').textContent, gem: document.getElementById('rewardGem').textContent,
  next: document.getElementById('rewardNext').textContent, theme: document.getElementById('rewardArt').dataset.theme,
  slots: document.querySelectorAll('#rewardArt .slot').length, on: document.querySelectorAll('#rewardArt .slot.on').length
}));
const finaleInfo = (ctx) => ctx.page.evaluate(() => {
  const st = document.getElementById('finaleSticker');
  return { text: document.getElementById('finaleText').textContent, sticker: !!document.querySelector('#finaleArt .finale-sticker svg'),
    stickerText: st.hidden ? '' : st.textContent, plus: document.getElementById('finalePlus').textContent,
    bonus: !!document.querySelector('#finaleArt .finale-bonus'), theme: document.getElementById('finaleArt').dataset.theme };
});
const waitLearn = (ctx, k, S, ms) => W(ctx, (a) => !document.getElementById('learn').hidden &&
  document.getElementById('instrSub').textContent === 'Vaihe ' + a[0] + '/' + a[1], [k, S], ms).then(() => sleep(SETTLE_MS));

/* section card -> level choice (preselected `pre`) -> level -> learn step k */
async function openSec(ctx, secId, level, pre) {
  await tap(ctx, '#card-' + secId);
  await waitShown(ctx, 'levelPick');
  const sel = await ctx.page.evaluate(() => (document.querySelector('#levelList .level-opt[aria-pressed="true"]') || {}).id || '');
  if (!ctx.levelShot) { ctx.levelShot = true; await screen(ctx, 'level-' + secId, 0); }
  const from = await alen(ctx);
  await tap(ctx, '#lvl-' + level);
  await waitHidden(ctx, 'levelPick');
  const said = await waitEvent(ctx, from, 'playing', 'fi/level-' + level + '.mp3', 6000);
  return { pre: sel === 'lvl-' + pre, sel, said, from };
}

async function openSettings(ctx) {
  await longPress(ctx, '#parentBtn', 1000);
  return tryW(ctx, () => { const s = document.getElementById('settings'); return s && !s.hidden && document.documentElement.classList.contains('settings-open'); }, null, 4000);
}
async function closeSettings(ctx) {
  await tap(ctx, '#settings .set-close');
  return tryW(ctx, () => document.getElementById('settings').hidden, null, 4000);
}
async function setSwitch(ctx, key, val) {
  const sel = '#settings input[data-key="' + key + '"]';
  const cur = await ctx.page.evaluate((s) => document.querySelector(s).checked, sel);
  if (cur !== val) await tap(ctx, '#settings label.set-switch:has(input[data-key="' + key + '"])');
  return tryW(ctx, (a) => document.querySelector(a[0]).checked === a[1], [sel, val], 3000);
}

/* Plays the open minigame like a child: presses, rubs and drags on live items (or the arena) until it closes. */
async function playGame(ctx, from, theme) {
  const page = ctx.page;
  await page.waitForSelector('section.mg:not([hidden])', { timeout: 8000 });
  const info = await page.evaluate(ARENA);
  const first = !ctx.games.some((g) => g.game === info.game);
  const t0 = Date.now();
  let moves = 0, shot = !first;
  while (Date.now() - t0 < 30000) {
    const t = await page.evaluate(ARENA);
    if (!t.open) break;
    if (!t.done) {
      const it = t.items.length ? t.items[(Math.random() * t.items.length) | 0] : { x: t.arena.x + t.arena.w * (0.2 + Math.random() * 0.6), y: t.arena.y + t.arena.h * (0.2 + Math.random() * 0.6) };
      const to = { x: t.arena.x + t.arena.w * (0.15 + Math.random() * 0.7), y: t.arena.y + t.arena.h * (0.15 + Math.random() * 0.7) };
      await page.mouse.move(it.x, it.y);
      await page.mouse.down();
      for (let i = 1; i <= 5; i++) await page.mouse.move(it.x + Math.sin(i * 1.7) * 40, it.y + Math.cos(i * 1.7) * 30);
      if (moves % 2) for (let i = 1; i <= 4; i++) await page.mouse.move(it.x + (to.x - it.x) * i / 4, it.y + (to.y - it.y) * i / 4);
      await page.mouse.up();
      moves++;
      if (!shot && moves === 3) { shot = true; await screen(ctx, 'game-' + info.game, 150); }
      await sleep(90);
    } else await sleep(150);
  }
  const closed = !(await page.evaluate(ARENA)).open;
  const want = 'fi/game-' + info.game + '.mp3';
  const said = await ctx.page.evaluate((a) => window.__audio.log.slice(a[0]).some((e) => e.type === 'playing' && e.src === a[1]), [from, want]);
  const g = Object.assign(info, { theme, ms: Date.now() - t0, moves, closed, said, items: undefined, arena: undefined });
  ctx.games.push(g);
  return g;
}

function gameChecks(ctx, speechOn = true) {
  const S = ctx.suite, gs = ctx.games;
  if (!gs.length) return;
  if (speechOn && gs.some((g) => g.doneSaid !== undefined)) {
    /* every 2nd step: always; every step: may skip only right after a game that said it (< 30 s apart) */
    const gd = gs.filter((g) => g.doneSaid !== undefined).map((g) => g.doneSaid);
    const ok = gd.length > 0 && gd.every((v, i) => v === true || (ctx.every === 1 && i > 0 && gd[i - 1] === true));
    check(S, '"game-done" before the reward praise' + (ctx.every === 1 ? ' (every other game when they come fast)' : ' after every game'), ok,
      gd.map((v) => (v ? 'y' : '-')).join(''));
  }
  const bad = gs.filter((g) => !g.game.startsWith(g.theme + '-') || g.title !== PROMPTS['game-' + g.game] || !g.closed || g.ms > 25000 || (speechOn && !g.said));
  check(S, 'minigames: ' + gs.length + ' played (' + Array.from(new Set(gs.map((g) => g.game))).sort().join(',') + ')', bad.length === 0,
    (bad.length ? 'BAD ' + bad.map((g) => JSON.stringify(g)).join(' ') + ' · ' : '') +
    'theme of the child, title = PROMPTS game-<theme>-i, say() plays it, ' + Math.min(...gs.map((g) => g.ms)) + '-' + Math.max(...gs.map((g) => g.ms)) + ' ms each');
}

/* One whole section at a level: every step, games per `every`, rewards, finale, Kotiin. Returns stars earned. */
async function runSection(ctx, sec, level, every, theme, name, pre) {
  const S = ctx.suite, units = unitsOf(sec.raw, level), U = units.length;
  const o = await openSec(ctx, sec.id, level, pre);
  check(S, sec.id + ' ' + level + ': level choice (' + (pre || '-') + ' preselected) + level prompt', (!pre || o.pre) && o.said, JSON.stringify(o));
  await waitLearn(ctx, 1, U);
  const st = await stepInfo(ctx);
  check(S, sec.id + ' ' + level + ': ' + U + ' step bubbles, 1 open', st.count === U && st.enabled === 1 && st.current === 1, JSON.stringify(st));
  let stars = 0;
  const bad = [], rbad = [];
  let lastPraise = '';
  const shotK = new Set([1, units.findIndex((u) => !u.last) + 1, U]);
  for (let k = 1; k <= U; k++) {
    await waitLearn(ctx, k, U);
    const u = units[k - 1], li = await learnInfo(ctx);
    const partial = !u.last && level !== 'hard';
    if (li.lines !== u.line + 1 || !li.newOnLast || (li.partial !== (partial ? String(u.line) : '')) || (level !== 'hard' && li.newWords !== u.to - u.from + 1)) {
      bad.push('k' + k + ' ' + JSON.stringify(li));
    }
    if (shotK.has(k)) await screen(ctx, 'learn-' + sec.id + '-' + level + '-' + k);
    const from = await alen(ctx);
    await tap(ctx, '#saidBtn');
    if (k < U) {
      const gamed = every === 1 || k % 2 === 0;
      if (gamed) await playGame(ctx, from, theme);
      await waitShown(ctx, 'reward', 9000);
      if (gamed) {
        /* 'game-done' (when said) comes before the praise */
        await waitEvent(ctx, from, 'playing', 'fi/praise-*', 6000);
        const got = fiPlays(await alog(ctx, from));
        const gi = got.indexOf('game-done'), pi = got.findIndex((x) => x.startsWith('praise-'));
        ctx.games[ctx.games.length - 1].doneSaid = gi >= 0 && pi > gi ? true : gi < 0 && pi >= 0 ? false : 'bad:' + got.join(',');
      }
      stars++;
      const rw = await rewardInfo(ctx);
      const praise = rw.heading.replace(/, [^,]*!$/, '');
      if (praise === lastPraise) rbad.push(sec.id + ' k' + k + ' same praise twice in a row: ' + praise);
      lastPraise = praise;
      const piece = theme === 'boy' ? PROMPTS['rocket-part'] : PROMPTS.gem;
      const nextWant = k + 1 >= U ? 'Seuraavaksi: koko ' + sec.name : level === 'hard' ? 'Seuraavaksi: rivit 1–' + (k + 1) : 'Seuraavaksi: vaihe ' + (k + 1) + '/' + U;
      if (u.last) {
        const landed = await tryW(ctx, (n) => document.querySelectorAll('#rewardArt .slot.on').length >= n, u.line + 1, 3500);
        if (!landed) rbad.push(sec.id + ' k' + k + ' piece did not land');
      }
      if (!ctx.rewardShot || (u.last && !ctx.rewardPieceShot)) {
        if (u.last) ctx.rewardPieceShot = true;
        ctx.rewardShot = true;
        await screen(ctx, 'reward-' + sec.id + '-' + k, 0);
      }
      if (!rw.heading.endsWith(', ' + name + '!') || rw.slots !== sec.N || rw.next !== nextWant || rw.gem !== (u.last ? piece : '') || rw.theme !== theme) {
        rbad.push(sec.id + ' k' + k + ' ' + JSON.stringify(rw));
      }
      await sleep(900);
      await tap(ctx, '#rewardGo');
      await waitHidden(ctx, 'reward');
    } else {
      await waitShown(ctx, 'finale', 9000);
      stars += 3;
      const fi = await finaleInfo(ctx);
      let launch = true;
      if (theme === 'boy') {
        const said = await waitEvent(ctx, from, 'playing', 'fi/rocket-launch.mp3', 6000);
        await screen(ctx, 'finale-' + sec.id + '-countdown', 600);
        const flew = await tryW(ctx, () => document.querySelector('#finaleArt.launched .fin-stickers') && (matchMedia('(prefers-reduced-motion: reduce)').matches ||
          !!document.querySelector('#finaleArt .fin-rocket-pic.art-launch')), null, 7000);
        launch = said && flew;
        check(S, sec.id + ': boy finale: "rocket-launch" + countdown + rocket launch, then the sticker', launch, JSON.stringify({ said, flew }));
      }
      check(S, sec.id + ' ' + level + ': finale + sticker, +3 tähteä', fi.sticker && fi.stickerText === PROMPTS.sticker &&
        fi.plus === '+3 tähteä' && fi.text === PROMPTS['finale-' + sec.id] && fi.theme === theme, JSON.stringify(fi));
      await screen(ctx, 'finale-' + sec.id, theme === 'boy' ? 300 : 900);
      await sleep(400);
      const fromBye = await alen(ctx);
      await tap(ctx, '#finaleHome');
      await waitShown(ctx, 'home');
      if (!(await waitEvent(ctx, fromBye, 'playing', 'fi/bye.mp3', 4000))) rbad.push(sec.id + ' Kotiin from the finale: no "bye"');
    }
  }
  check(S, sec.id + ' ' + level + ': step k shows the touched lines, newest unit marked', bad.length === 0, bad.slice(0, 3).join(' | ') || U + ' steps');
  check(S, sec.id + ' ' + level + ': ' + (U - 1) + ' rewards: praise (no repeat) + name, slots per line, piece lands, next text; finale Kotiin says "bye"', rbad.length === 0, rbad.slice(0, 3).join(' | ') || 'ok');
  const ls = await lsStore(ctx);
  const me = ls.children.find((c) => c.name === name);
  check(S, sec.id + ' ' + level + ': saved (progress ' + sec.N + ', done' + (level === 'hard' ? '' : ', steps ' + U) + ', level remembered)',
    me.progress[sec.id] === sec.N && me.done[sec.id] === true && me.levelBySection[sec.id] === level && (level === 'hard' || me.steps[sec.id][level] === U), JSON.stringify(me));
  return stars;
}

/* ---------- suites ---------- */
async function suiteFlow(browser, base, vp, rm) {
  const ctx = await newCtx(browser, base, 'flow-' + vp.join('x') + (rm ? '-rm' : ''), vp, { rm });
  const S = ctx.suite;
  const every = vp[0] === 390 ? 1 : 2;
  ctx.every = every;
  try {
    await seed(ctx, store([], { every }));
    check(S, 'empty device: intro -> start -> onboarding, "ask-theme" plays', await cover(ctx, 'new', { intro: { watch: vp[0] === 390 } }));
    await screen(ctx, 'onboarding');
    await tap(ctx, '#pickGirl');
    const noName = await tryW(ctx, () => /nimi/.test(document.getElementById('newMsg').textContent) && !document.getElementById('who').hidden, null, 2000);
    check(S, 'onboarding: Tyttö without a name asks for the name', noName);
    await ctx.page.fill('#newName', GIRL);
    const fromNew = await alen(ctx);
    await tap(ctx, '#pickGirl');
    await W(ctx, () => document.getElementById('who').hidden && !document.getElementById('home').hidden);
    const said = await promptsUntil(ctx, fromNew, 'welcome');
    check(S, 'new child: "nice-name" -> "welcome-new" -> ' + greetNow() + ' -> "welcome"', inOrder(said, ['nice-name', 'welcome-new', greetNow(), 'welcome']) &&
      said.filter((x) => x === 'nice-name').length === 1, said.join(','));
    await sleep(SETTLE_MS);
    let h = await homeInfo(ctx);
    let ls = await lsStore(ctx);
    const girlId = ls.children[0] && ls.children[0].id;
    check(S, 'girl created: girl theme home, greeting, mosque, nothing done', h.theme === 'girl' && h.greeting === 'Hei, ' + GIRL + '!' && h.progArt && h.progTitle === 'Moskeija' &&
      h.cards.length === SECS.length && h.cards.every((c) => !c.done) && h.album === '0/' + (SECS.length + 1) && h.stars === 0 &&
      ls.children.length === 1 && ls.children[0].theme === 'girl' && ls.activeId === girlId, JSON.stringify(h));
    await screen(ctx, 'home-girl');
    if (rm) {
      const still = await ctx.page.evaluate(() => ({ mq: matchMedia('(prefers-reduced-motion: reduce)').matches, bg: getComputedStyle(document.querySelector('.bg-pop')).animationName }));
      check(S, 'reduced motion: media query on, background still', still.mq && still.bg === 'none', JSON.stringify(still));
    }
    const sec = (id) => SECS.find((s) => s.id === id);
    let stars = 0;
    stars += await runSection(ctx, sec('shahada'), 'easy', every, 'girl', GIRL, 'easy');
    stars += await runSection(ctx, sec('ikhlas'), 'medium', every, 'girl', GIRL, 'easy');
    stars += await runSection(ctx, sec('kawthar'), 'hard', every, 'girl', GIRL, 'easy');
    h = await homeInfo(ctx);
    const lines = ['shahada', 'ikhlas', 'kawthar'].reduce((n, id) => n + sec(id).N, 0);
    check(S, 'girl home: stars ' + stars + ', 3 cards done, 3 stickers, mosque ' + lines + '/' + SECS.reduce((n, s) => n + s.N, 0),
      h.stars === stars && h.cards.filter((c) => c.done).length === 3 && h.album === '3/' + (SECS.length + 1) && h.prog.startsWith(lines + '/'), JSON.stringify(h));
    await screen(ctx, 'home-girl-done', 1500);

    /* a second child: the boy */
    await tap(ctx, '#whoBtn');
    await waitShown(ctx, 'who');
    await screen(ctx, 'picker-from-home');
    await tap(ctx, '#pkAdd');
    await W(ctx, () => document.getElementById('who').dataset.view === 'new');
    await sleep(SETTLE_MS);
    const fromName = await alen(ctx);
    await ctx.page.fill('#newName', BOY);
    const praised = await waitEvent(ctx, fromName, 'playing', 'fi/nice-name.mp3', 3000);
    const msg = await ctx.page.evaluate(() => document.getElementById('newMsg').textContent);
    check(S, 'onboarding: name typed + 1.2 s pause -> "nice-name" (spoken + shown)', praised && msg === PROMPTS['nice-name'], msg);
    await sleep(1500);
    const fromBoy = await alen(ctx);
    await tap(ctx, '#pickBoy');
    await W(ctx, () => document.getElementById('who').hidden && !document.getElementById('home').hidden);
    const saidB = await promptsUntil(ctx, fromBoy, 'welcome');
    check(S, 'same name not praised twice: "welcome-new" -> greeting -> "welcome"', inOrder(saidB, ['welcome-new', greetNow(), 'welcome']) && !saidB.includes('nice-name'), saidB.join(','));
    await sleep(SETTLE_MS);
    h = await homeInfo(ctx);
    ls = await lsStore(ctx);
    const boyId = (ls.children.find((c) => c.name === BOY) || {}).id;
    check(S, 'boy added: boy theme home, rocket picture, own zero progress', h.theme === 'boy' && h.greeting === 'Hei, ' + BOY + '!' && h.progTitle === 'Raketti' && h.progArt &&
      h.stars === 0 && h.cards.every((c) => !c.done) && ls.children.length === 2 && ls.activeId === boyId, JSON.stringify(h));
    await screen(ctx, 'home-boy');
    const boyStars = await runSection(ctx, sec('kawthar'), 'hard', every, 'boy', BOY, 'easy');

    /* switch players */
    await tap(ctx, '#whoBtn');
    await waitShown(ctx, 'who');
    const cards = await ctx.page.evaluate(() => Array.from(document.querySelectorAll('#whoGrid .pk-card')).map((c) => c.id + ':' + (c.dataset.theme || '')));
    await screen(ctx, 'picker-two');
    const fromPick = await alen(ctx);
    await pickKid(ctx, girlId);
    const saidP = await promptsUntil(ctx, fromPick, greetNow()).then(async (x) => { await sleep(1200); return fiPlays(await alog(ctx, fromPick)); });
    check(S, 'picker: name, "welcome-back" -> ' + greetNow() + ' (no "welcome")', inOrder(saidP, ['welcome-back', greetNow()]) && !saidP.includes('welcome') &&
      saidP.filter((x) => GREETS.includes(x)).length === 1, saidP.join(','));
    h = await homeInfo(ctx);
    check(S, 'picker: 2 child cards + add; switch back to the girl keeps her theme and stars', cards.length === 3 && cards.includes('pk-' + boyId + ':boy') &&
      cards.includes('pk-' + girlId + ':girl') && h.theme === 'girl' && h.stars === stars && h.name === GIRL, JSON.stringify({ cards, h }));

    /* reload keeps both */
    await ctx.page.reload();
    check(S, 'reload: intro (tap skips) -> start -> picker ("who")', await cover(ctx, 'pick', { intro: {} }));
    await pickKid(ctx, boyId);
    h = await homeInfo(ctx);
    check(S, 'reload keeps the boy (stars ' + boyStars + ', Al-Kawthar done, boy theme)', h.theme === 'boy' && h.stars === boyStars && h.cards.find((c) => c.id === 'kawthar').done, JSON.stringify(h));
    gameChecks(ctx);
    check(S, 'long-press opens settings', await openSettings(ctx));
    await screen(ctx, 'settings');
    check(S, 'settings close button closes', await closeSettings(ctx));
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

async function suiteAudio(browser, base) {
  const ctx = await newCtx(browser, base, 'audio', [390, 844]);
  const S = ctx.suite;
  try {
    const fat = SECS.find((s) => s.id === 'fatiha');
    const files = fat.lines.map((l) => l.audio.replace(/^audio\//, ''));
    await seed(ctx, store([kid('a', GIRL, 'girl', { level: 'hard', progress: { shahada: 0, fatiha: fat.N - 1, ikhlas: 0, kawthar: 0 } })]));
    await cover(ctx, 'pick');
    await pickKid(ctx, 'a');
    const d0 = await ctx.page.evaluate(() => [window.__audio.decodes, window.__audio.speaks]);
    const o = await openSec(ctx, 'fatiha', 'hard', 'hard');
    await waitLearn(ctx, fat.N, fat.N);
    const done = await waitEvent(ctx, o.from, 'ended', 'fi/turn-all.mp3', 120000);
    const log = await alog(ctx, o.from);
    const pl = plays(log);
    const want = ['fi/level-hard.mp3'].concat(files, ['fi/turn-all.mp3']);
    check(S, 'VAIKEA Al-Fatiha step 7 order: level-hard > ' + files.map((f) => f.replace(/\.mp3$/, '')).join(' > ') + ' > turn-all',
      done && JSON.stringify(pl.map((e) => e.src)) === JSON.stringify(want), pl.map((e) => e.src).join(','));
    const overlaps = [], gaps = [];
    for (let i = 0; i < pl.length - 1; i++) {
      const end = log.find((e) => e.t >= pl[i].t && e.type === 'ended' && e.src === pl[i].src);
      const between = log.filter((e) => e.t > pl[i].t && end && e.t < end.t && (e.type === 'playing' || e.type === 'play') && e.src !== pl[i].src);
      if (!end || end.t > pl[i + 1].t || between.length) overlaps.push(pl[i].src);
      else gaps.push(pl[i + 1].t - end.t);
    }
    const els = new Set(log.filter((e) => e.src !== 'silent').map((e) => e.el));
    const d1 = await ctx.page.evaluate(() => [window.__audio.decodes, window.__audio.speaks]);
    check(S, 'chain: each clip ends before the next starts, one element, no Web Audio / speech', overlaps.length === 0 && els.size === 1 && d1[0] === d0[0] && d1[1] === d0[1],
      (overlaps.length ? 'overlap at ' + overlaps.join(',') + ' · ' : '') + 'gaps ' + Math.min(...gaps) + '-' + Math.max(...gaps) + ' ms, elements ' + els.size);
    const hl = pl.slice(1).map((e, i) => (i < files.length ? e.active === 'line-' + i : e.active === null));
    check(S, 'chain: line i highlighted while it plays, none during "your turn"', hl.every(Boolean), pl.map((e) => e.active).join(','));
    check(S, 'chain end: Sanoin! pulses (nudge)', await ctx.page.evaluate(() => document.getElementById('saidBtn').classList.contains('nudge')));
    await screen(ctx, 'learn-fatiha-7-after-chain');

    let from = await alen(ctx);
    await tap(ctx, '#listenBtn');
    await waitEvent(ctx, from, 'playing', files[2], 30000);
    const from2 = await alen(ctx);
    await tap(ctx, '#listenBtn');
    await waitEvent(ctx, from2, 'playing', files[0], 6000);
    const l2 = await alog(ctx, from2);
    const p2 = plays(l2);
    check(S, 'Kuuntele mid-chain (line 3) restarts from line 1', p2.length && p2[0].src === files[0] && l2.some((e) => e.type === 'stop' && e.src === files[2] && e.t <= p2[0].t),
      p2.map((e) => e.src).join(','));

    await waitEvent(ctx, from2, 'playing', files[1], 20000);
    const from3 = await alen(ctx);
    await tap(ctx, '#saidBtn');
    await sleep(600);
    const cut = await ctx.page.evaluate((f) => {
      const A = window.__audio;
      const c = A.clicks.filter((x) => x.id === 'saidBtn').pop();
      const later = A.log.slice(f);
      const p = later.find((e) => e.type === 'pause' && c && e.t >= c.t);
      const s = later.find((e) => e.type === 'stop' && c && e.t >= c.t);
      return { dt: c && s ? s.t - c.t : null, pauseEvent: c && p ? p.t - c.t : null, src: s && s.src, after: later.filter((e) => e.type === 'playing' && /^\d{6}\.mp3$/.test(e.src)).length };
    }, from3);
    check(S, 'Sanoin! cuts recitation within 150 ms', cut.dt !== null && cut.dt < 150 && cut.pauseEvent !== null && cut.pauseEvent < 1000 &&
      cut.src === files[1] && cut.after === 0, JSON.stringify(cut));
    await waitShown(ctx, 'finale', 8000);
    await sleep(500);
    await tap(ctx, '#finaleHome');
    await waitShown(ctx, 'home');

    await openSec(ctx, 'fatiha', 'hard', 'hard');
    await waitLearn(ctx, fat.N, fat.N);
    await sleep(400);
    from = await alen(ctx);
    await tap(ctx, '#lines [data-act="one"][data-i="2"]');
    const one = await waitEvent(ctx, from, 'ended', files[2], 15000);
    await sleep(700);
    const p3 = plays(await alog(ctx, from));
    check(S, '"Kuuntele tämä" plays only that line', one && p3.length === 1 && p3[0].src === files[2] && p3[0].active === 'line-2', p3.map((e) => e.src).join(','));
    from = await alen(ctx);
    await tap(ctx, '#lines [data-act="mean"][data-i="0"]');
    const mean = await waitEvent(ctx, from, 'playing', 'fi/mean-fatiha-0.mp3', 6000);
    const marked = await ctx.page.evaluate(() => document.getElementById('fi-0').classList.contains('speaking'));
    check(S, '"Mitä tämä tarkoittaa?" plays the meaning, marks the Finnish line', mean && marked);
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');

    /* HELPPO: full lines as line clips, then the partial line as ONE prefix clip (Quran: Mishary, Shahada: human voice) */
    const cases = [
      { id: 'shahada', steps: 4, prog: 1, k: 5, want: ['shahada-1.mp3', 'cut/shahada-2_w1.mp3'] },
      { id: 'fatiha', steps: 5, prog: 1, k: 6, want: ['001001.mp3', 'cut/001_002_w2.mp3'] }
    ];
    for (const c of cases) {
      await seed(ctx, store([kid('a', GIRL, 'girl', { progress: { shahada: c.id === 'shahada' ? c.prog : 0, fatiha: c.id === 'fatiha' ? c.prog : 0, ikhlas: 0, kawthar: 0 }, steps: { [c.id]: { easy: c.steps } } })]));
      await cover(ctx, 'pick');
      await pickKid(ctx, 'a');
      const oc = await openSec(ctx, c.id, 'easy', 'easy');
      const U = unitsOf(SECS.find((s) => s.id === c.id).raw, 'easy').length;
      await waitLearn(ctx, c.k, U);
      const ok = await waitEvent(ctx, oc.from, 'ended', 'fi/turn-all.mp3', 40000);
      const lg = await alog(ctx, oc.from);
      const got = plays(lg).map((e) => e.src);
      const wantAll = ['fi/level-easy.mp3'].concat(c.want, ['fi/turn-all.mp3']);
      const hl = plays(lg).filter((e) => c.want.includes(e.src)).map((e) => e.active);
      check(S, 'HELPPO ' + c.id + ' step ' + c.k + ': ' + wantAll.join(' > ') + ', line cards lit', ok && JSON.stringify(got) === JSON.stringify(wantAll) && hl.every(Boolean),
        got.join(',') + ' lit ' + hl.join(','));
      await screen(ctx, 'learn-' + c.id + '-easy-' + c.k);
    }
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

async function suiteSettings(browser, base) {
  const ctx = await newCtx(browser, base, 'settings', [390, 844], { mic: true });
  const S = ctx.suite;
  try {
    await seed(ctx, store([kid('a', GIRL, 'girl', { level: 'hard', stars: 4, progress: { shahada: 1, fatiha: 0, ikhlas: 0, kawthar: 0 } }), kid('b', BOY, 'boy', { stars: 2 })]));
    await cover(ctx, 'pick');
    await pickKid(ctx, 'a');
    let hint = false, held = 0;
    for (let i = 0; i < 3 && !hint; i++) {
      const p0 = await ctx.page.evaluate(() => window.__audio.ptr.length);
      await tap(ctx, '#parentBtn');
      hint = await tryW(ctx, () => { const t = document.getElementById('toast'); return t.classList.contains('show') && /Pidä painettuna/.test(t.textContent); }, null, 3000) &&
        !(await shown(ctx, 'settings'));
      held = await ctx.page.evaluate((f) => { const p = window.__audio.ptr.slice(f).filter((e) => e.id === 'parentBtn'); return p.length >= 2 ? p[p.length - 1].t - p[0].t : -1; }, p0);
      if (hint || held < 800) break;
      await closeSettings(ctx);
    }
    check(S, 'short tap on Vanhemmille shows the hold hint, settings stay closed', hint, 'held ' + held + ' ms');
    check(S, 'long-press (800 ms) opens settings', await openSettings(ctx));
    const kids = await ctx.page.evaluate(() => Array.from(document.querySelectorAll('#settings [data-kid]')).map((k) => k.dataset.kid + (k.classList.contains('is-active') ? '*' : '')));
    check(S, 'Lapset: both children listed, the playing one marked', kids.join(',') === 'a*,b', kids.join(','));
    await screen(ctx, 'settings');

    for (const [kind, re] of [['recitation', /MP3: OK/], ['sfx', /AudioContext: running/], ['fi', /Suomi-MP3: OK/], ['ar', /Shahada-MP3: OK/]]) {
      await tap(ctx, '#settings [data-test="' + kind + '"]');
      await tryW(ctx, () => { const r = document.querySelector('#settings .test-result'); return r && !r.hidden && !/Soitetaan/.test(r.textContent); }, null, 20000);
      const txt = await ctx.page.evaluate(() => document.querySelector('#settings .test-result').textContent);
      check(S, 'sound test "' + kind + '" shows status', re.test(txt), txt);
    }

    const row = '#settings .rec-row[data-id="shahada-1"]';
    await tap(ctx, row + ' [data-act="rec"]');
    const live = await tryW(ctx, (r) => { const l = document.querySelector(r + ' .rec-live'); return l && !l.hidden; }, row, 6000);
    await sleep(1600);
    await tap(ctx, row + ' [data-act="stoprec"]');
    const saved = await tryW(ctx, (r) => document.querySelector(r + ' .rec-status').textContent === 'Oma ääni' && !document.querySelector(r + ' [data-act="del"]').hidden, row, 8000);
    check(S, 'record with fake mic: live meter, saved as "Oma ääni"', live && saved,
      await ctx.page.evaluate((r) => document.querySelector(r + ' .rec-status').textContent + ' / ' + document.querySelector(r + ' .rec-msg').textContent, row));
    let from = await alen(ctx);
    await tap(ctx, row + ' [data-act="play"]');
    const pl = await waitEvent(ctx, from, 'playing', 'blob(audio/*', 6000);
    const end = await waitEvent(ctx, from, 'ended', 'blob(audio/*', 10000);
    check(S, 'Kuuntele plays the recording', pl && end, (await alog(ctx, from)).map((e) => e.type + ':' + e.src).join(','));
    await closeSettings(ctx);
    const o = await openSec(ctx, 'shahada', 'hard', 'hard');
    await waitLearn(ctx, 2, 2);
    const own = await waitEvent(ctx, o.from, 'playing', 'blob(audio/*', 8000);
    check(S, 'own recording replaces Shahada line 1 in the lesson', own, plays(await alog(ctx, o.from)).map((e) => e.src).join(','));
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');
    await openSettings(ctx);
    await tap(ctx, row + ' [data-act="del"]');
    const cf = await tryW(ctx, (r) => !document.querySelector(r + ' .rec-confirm').hidden, row, 3000);
    await tap(ctx, row + ' [data-act="delyes"]');
    const gone = await tryW(ctx, (r) => document.querySelector(r + ' .rec-status').textContent === 'Valmis ääni' && document.querySelector(r + ' [data-act="del"]').hidden, row, 6000);
    check(S, 'delete recording: confirm, back to "Valmis ääni"', cf && gone);

    const sw = [await setSwitch(ctx, 'slow', true), await setSwitch(ctx, 'translit', false), await setSwitch(ctx, 'speech', false)];
    let ls = await lsStore(ctx);
    check(S, 'switches slow on / translit off / speech off saved', sw.every(Boolean) && ls.settings.slow === true && ls.settings.translit === false && ls.settings.speech === false, JSON.stringify(sw));
    await ctx.page.keyboard.press('Escape');
    check(S, 'Escape closes settings', await tryW(ctx, () => document.getElementById('settings').hidden, null, 3000));

    from = await alen(ctx);
    await tap(ctx, '#card-fatiha');
    await waitShown(ctx, 'levelPick');
    await tap(ctx, '#lvl-hard');
    await waitLearn(ctx, 1, 7);
    const ended = await waitEvent(ctx, from, 'ended', '001001.mp3', 20000);
    const cap = await tryW(ctx, (t) => { const c = document.getElementById('caption'); return c.classList.contains('show') && c.textContent.includes(t); }, PROMPTS['turn-1'], 3000);
    await sleep(800);
    let lg = await alog(ctx, from);
    const rec1 = lg.find((e) => e.type === 'playing' && e.src === '001001.mp3');
    check(S, 'slow mode: recitation playbackRate 0.8, preservesPitch', ended && rec1 && rec1.rate === 0.8 && rec1.pp === true, rec1 && JSON.stringify({ rate: rec1.rate, pp: rec1.pp }));
    check(S, 'speech off: recitation plays, "your turn" silent but shown as caption', ended && cap && !lg.some((e) => e.type === 'playing' && e.src.startsWith('fi/')),
      plays(lg).map((e) => e.src).join(',') + ' caption=' + cap);
    const tr = await ctx.page.evaluate(() => ({ cls: document.documentElement.classList.contains('no-translit'),
      vis: Array.from(document.querySelectorAll('#lines .tr')).filter((e) => e.getClientRects().length).length, n: document.querySelectorAll('#lines .tr').length }));
    check(S, 'translit off hides transliteration', tr.cls && tr.n > 0 && tr.vis === 0, JSON.stringify(tr));
    await screen(ctx, 'learn-slow-notranslit');
    from = await alen(ctx);
    await tap(ctx, '#saidBtn');
    await playGame(ctx, from, 'girl');
    await waitShown(ctx, 'reward', 9000);
    await sleep(1500);
    lg = await alog(ctx, from);
    const rh = await rewardInfo(ctx);
    check(S, 'speech off: game title + praise silent, text still shown', !lg.some((e) => e.type === 'playing' && e.src.startsWith('fi/')) && rh.heading.includes(GIRL),
      plays(lg).map((e) => e.src).join(',') + ' heading=' + rh.heading);
    await sleep(300);
    await tap(ctx, '#rewardGo');
    await waitLearn(ctx, 2, 7);
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');

    await openSettings(ctx);
    await setSwitch(ctx, 'slow', false); await setSwitch(ctx, 'translit', true); await setSwitch(ctx, 'speech', true);
    /* children: default level, "Pelaa nyt", reset, delete the playing child */
    await tap(ctx, '#settings [data-kid="b"] [data-kact="level"][data-v="medium"]');
    const lvl = await tryW(ctx, (k) => { const s = JSON.parse(localStorage.getItem(k)); return s.children.find((c) => c.id === 'b').level === 'medium'; }, KEY, 3000);
    check(S, 'default level of a child is saved', lvl);
    await tap(ctx, '#settings [data-kid="b"] [data-kact="play"]');
    const swapped = await tryW(ctx, (n) => document.documentElement.dataset.theme === 'boy' && document.getElementById('greeting').textContent === 'Hei, ' + n + '!', BOY, 3000);
    const closed = await tryW(ctx, () => document.getElementById('settings').hidden, null, 3000);
    check(S, '"Pelaa nyt" switches the app to that child (boy theme, home) and closes the sheet', swapped && closed);
    await screen(ctx, 'home-after-pelaa-nyt');
    await openSettings(ctx);
    await tap(ctx, '#settings [data-kid="a"] [data-kact="reset"]');
    await tryW(ctx, () => !!document.querySelector('#settings [data-kid="a"] [data-kact="resetyes"]'), null, 3000);
    await screen(ctx, 'settings-reset-confirm', 200);
    await tap(ctx, '#settings [data-kid="a"] [data-kact="resetyes"]');
    const reset = await tryW(ctx, (k) => { const s = JSON.parse(localStorage.getItem(k)); const a = s.children.find((c) => c.id === 'a'); return a.stars === 0 && a.progress.fatiha === 0 && a.name; }, KEY, 3000);
    check(S, 'reset one child: stars + progress 0, name kept', reset);
    await tap(ctx, '#settings [data-kid="b"] [data-kact="del"]');
    await tryW(ctx, () => !!document.querySelector('#settings [data-kid="b"] [data-kact="delyes"]'), null, 3000);
    await tap(ctx, '#settings [data-kid="b"] [data-kact="delyes"]');
    await tryW(ctx, () => !document.querySelector('#settings [data-kid="b"]'), null, 3000);
    await closeSettings(ctx);
    const pick = await tryW(ctx, () => document.getElementById('settings').hidden && !document.getElementById('who').hidden && document.querySelectorAll('#whoGrid .pk-card:not(.pk-add)').length === 1 &&
      document.getElementById('whoClose').hidden, null, 3000);
    check(S, 'deleting the playing child -> picker with the others (no close)', pick);
    await screen(ctx, 'picker-after-delete');
    await pickKid(ctx, 'a');
    ls = await lsStore(ctx);
    check(S, 'pick the remaining child: home, saved', (await homeInfo(ctx)).name === GIRL && ls.children.length === 1 && ls.activeId === 'a');
    gameChecks(ctx, false);
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* v1/v2 save (one child) -> the first child */
async function suiteMigrate(browser, base) {
  const ctx = await newCtx(browser, base, 'migrate', [390, 844]);
  const S = ctx.suite;
  try {
    await seed(ctx, { progress: { shahada: 2, fatiha: 3, ikhlas: 0, kawthar: 0 }, done: { shahada: true }, stars: 9, name: GIRL, speech: true, slow: false, translit: false, sfx: true, every: 2, game: 3 }, OLD_KEY);
    await cover(ctx, 'pick');
    const cards = await ctx.page.evaluate(() => Array.from(document.querySelectorAll('#whoGrid .pk-card:not(.pk-add)')).map((c) => c.querySelector('.pk-name').textContent + ':' + c.dataset.theme));
    await screen(ctx, 'picker-migrated');
    const id = await ctx.page.evaluate(() => document.querySelector('#whoGrid .pk-card:not(.pk-add)').dataset.id);
    await pickKid(ctx, id);
    const h = await homeInfo(ctx);
    const ls = await lsStore(ctx);
    const c = ls.children[0];
    check(S, 'v2 save -> one girl child with progress, stars, VAIKEA; settings kept', cards.join() === GIRL + ':girl' && h.theme === 'girl' && h.stars === 9 &&
      h.cards.find((x) => x.id === 'shahada').done && c.progress.fatiha === 3 && c.level === 'hard' && ls.settings.every === 2 && ls.settings.translit === false &&
      (await ctx.page.evaluate(() => document.documentElement.classList.contains('no-translit'))), JSON.stringify({ cards, h, c, s: ls.settings }));
    const o = await openSec(ctx, 'fatiha', 'hard', 'hard');
    await waitLearn(ctx, 4, 7);
    check(S, 'migrated VAIKEA resumes Al-Fatiha at step 4', o.pre);
    await screen(ctx, 'learn-migrated');
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* App goes to the background during a minigame: the game holds onDone while hidden, the flow gives exactly
   one reward when the app is visible again and goes on normally. */
async function suiteBackground(browser, base) {
  const ctx = await newCtx(browser, base, 'background', [390, 844]);
  const S = ctx.suite, page = ctx.page;
  try {
    await seed(ctx, store([kid('a', GIRL, 'girl', { level: 'hard' })]));
    await cover(ctx, 'pick');
    await pickKid(ctx, 'a');
    await openSec(ctx, 'shahada', 'hard', 'hard');
    await waitLearn(ctx, 1, 2);
    await tap(ctx, '#saidBtn');
    await page.waitForSelector('section.mg:not([hidden])', { timeout: 6000 });
    await page.evaluate(() => window.__setHidden(true));
    await sleep(2500);
    const midHidden = await page.evaluate(() => !document.querySelector('section.mg').hidden && document.getElementById('reward').hidden);
    await page.evaluate(() => window.__setHidden(false));
    const t0 = Date.now();
    let done = false;
    while (!done && Date.now() - t0 < 30000) {
      const t = await page.evaluate(ARENA);
      if (!t.open) break;
      if (t.done) { done = true; break; }
      const it = t.items[0] || { x: t.arena.x + t.arena.w / 2, y: t.arena.y + t.arena.h / 2 };
      await page.mouse.move(it.x, it.y); await page.mouse.down();
      for (let i = 1; i <= 5; i++) await page.mouse.move(it.x + Math.sin(i) * 40, it.y + Math.cos(i) * 30);
      await page.mouse.up();
      await sleep(80);
    }
    await page.evaluate(() => window.__setHidden(true));
    await sleep(3000);
    const held = await page.evaluate(() => ({ game: !document.querySelector('section.mg').hidden, reward: !document.getElementById('reward').hidden,
      stars: +document.querySelector('#learnStars .stars-num').textContent }));
    await page.evaluate(() => window.__setHidden(false));
    const reward = await tryW(ctx, () => !document.getElementById('reward').hidden && document.querySelector('section.mg').hidden, null, 5000);
    await sleep(2000);
    const after = await page.evaluate(() => ({ stars: +document.querySelector('#learnStars .stars-num').textContent, gate: !document.getElementById('gate').hidden }));
    check(S, 'hidden mid-game: game waits, no reward while hidden', midHidden);
    check(S, 'game done while hidden: onDone held, no reward, no star yet', done && held.game && !held.reward && held.stars === 0, JSON.stringify({ done, held }));
    check(S, 'visible again: exactly one reward (+1 star), no gate', reward && after.stars === 1 && !after.gate, JSON.stringify(after));
    await screen(ctx, 'reward-after-background');
    await tap(ctx, '#rewardGo');
    await waitLearn(ctx, 2, 2);
    await tap(ctx, '#saidBtn');
    const fin = await tryW(ctx, () => !document.getElementById('finale').hidden, null, 8000);
    check(S, 'flow goes on: Jatka -> step 2 -> Sanoin! -> finale', fin && (await lsStore(ctx)).children[0].stars === 4);
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* intro clock + Web Audio record of the current document */
const introAudio = (ctx) => ctx.page.evaluate(() => {
  const A = window.__audio, at = A.introAt;
  return { at, done: A.introDone, probe: A.probe.slice(), ac: A.ac.map((a) => ({ t: a.t - at, tapped: a.tapped, state: a.c.state })), src: A.src.map((t) => t - at) };
});

/* fi/ prompts of the current document with their time on the intro clock: [[id, ms], ...] */
const fiTimed = (ctx) => ctx.page.evaluate(() => {
  const A = window.__audio;
  return A.log.filter((e) => e.type === 'playing' && e.src.startsWith('fi/')).map((e) => [e.src.slice(3).replace(/\.mp3$/, ''), Math.round(e.t - A.introAt)]);
});
/* the cover tap -> the prompts until the picker / onboarding prompt */
async function coverSaid(ctx, view) {
  const from = await alen(ctx);
  const ok = await cover(ctx, view);
  return { ok, said: fiPlays(await alog(ctx, from)) };
}

/* Autoplay allowed (an installed PWA, a site used often): the intro's effects play without a tap, in step. */
async function suiteIntroSound(browser, base) {
  const ctx = await newCtx(browser, base, 'intro-sound', [390, 844]);
  const S = ctx.suite, page = ctx.page;
  try {
    await seed(ctx, store([]));
    await W(ctx, () => window.__audio.introDone != null, null, 9000);
    const a = await introAudio(ctx);
    const inIntro = a.src.filter((t) => t >= 0 && t <= a.done - a.at);
    check(S, 'sound path: AudioContext created + running before any tap', a.probe[0] === 'ok' && a.ac.length === 1 && a.ac[0].tapped === false && a.ac[0].state === 'running' && a.ac[0].t < 600,
      JSON.stringify({ probe: a.probe, ac: a.ac }));
    check(S, 'sound path: effects in step with the intro (car ~0.6 s ... button boing ~4.1 s)', inIntro.length >= 30 &&
      inIntro[0] >= 550 && inIntro[0] <= 800 && inIntro[inIntro.length - 1] >= 4050 && inIntro[inIntro.length - 1] <= 4400,
      JSON.stringify({ starts: inIntro.length, first: inIntro[0], last: inIntro[inIntro.length - 1], doneAt: a.done - a.at }));
    const ft = await fiTimed(ctx);
    const title = ft.find(([id]) => id === 'intro-title');
    check(S, 'sound path: "intro-title" as the logo drops in (~2.75 s)', !!title && title[1] >= 2600 && title[1] <= 3500, JSON.stringify(ft));
    const c1 = await coverSaid(ctx, 'new');
    check(S, 'sound path: start tap -> "cover" + "ask-theme" (title already said)', c1.ok && inOrder(c1.said, ['cover', 'ask-theme']) && !c1.said.includes('intro-title'), c1.said.join(','));
    /* a skip in the middle (after the honk): no further intro sounds */
    await page.reload();
    await W(ctx, () => window.__audio.introAt != null && performance.now() - window.__audio.introAt > 1550, null, 8000);
    const b = await page.evaluate(() => { const r = document.getElementById('gateBtn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const skipAt = await page.evaluate(() => performance.now() - window.__audio.introAt);
    await page.mouse.click(b.x, b.y, { delay: 40 });
    await sleep(2800);
    const k = await introAudio(ctx);
    const before = k.src.filter((t) => t < skipAt).length, after = k.src.filter((t) => t > skipAt + 120);
    check(S, 'sound path: a tap mid-intro skips and stops the remaining effects', before > 0 && after.length === 0 && k.done != null && k.done - k.at < 2200,
      JSON.stringify({ skipAt: Math.round(skipAt), before, after: after.slice(0, 5), doneAt: k.done - k.at }));
    const c2 = await coverSaid(ctx, 'new');
    check(S, 'sound path: skipped before the title -> the start tap says "intro-title", "ask-theme" (no "cover")', c2.ok && inOrder(c2.said, ['intro-title', 'ask-theme']) && !c2.said.includes('cover'), c2.said.join(','));
    /* nobody taps: 'intro-go' once, ~3 s after the button popped out (4.08 s) */
    await page.reload();
    await W(ctx, () => window.__audio.introAt != null && performance.now() - window.__audio.introAt > 8600, null, 12000);
    const fg = await fiTimed(ctx);
    const go = fg.filter(([id]) => id === 'intro-go');
    check(S, 'sound path: no tap -> "intro-go" once ~3 s after the button appeared', go.length === 1 && go[0][1] >= 6900 && go[0][1] <= 7900, JSON.stringify(fg));
    const c3 = await coverSaid(ctx, 'new');
    check(S, 'sound path: start after "intro-go" -> onboarding prompts', c3.ok && !c3.said.includes('intro-title'), c3.said.join(','));
    /* effects switched off in settings: no effect (the voice cue still speaks) */
    await seed(ctx, store([], { sfx: false }));
    await W(ctx, () => window.__audio.introAt != null && performance.now() - window.__audio.introAt > 3600, null, 8000);
    const off = await introAudio(ctx), offSaid = (await fiTimed(ctx)).map(([id]) => id);
    check(S, 'effects off: no intro effects, "intro-title" still spoken', off.src.length === 0 && offSaid.includes('intro-title'), JSON.stringify({ src: off.src.length, said: offSaid }));
    /* speech and effects off: no context before the tap at all */
    await seed(ctx, store([], { sfx: false, speech: false }));
    await W(ctx, () => window.__audio.introAt != null && performance.now() - window.__audio.introAt > 3600, null, 8000);
    const mute = await introAudio(ctx);
    check(S, 'speech + effects off: intro silent, no AudioContext before the tap', mute.ac.length === 0 && mute.src.length === 0 && !mute.probe.length, JSON.stringify(mute));
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* No autoplay (iOS, a first visit): the intro stays silent, nothing breaks, the start tap unlocks audio. */
async function suiteIntroSilent(browser, base) {
  const ctx = await newCtx(browser, base, 'intro-silent', [390, 844]);
  const S = ctx.suite, page = ctx.page;
  try {
    await seed(ctx, store([]));
    await W(ctx, () => window.__audio.introDone != null && performance.now() - window.__audio.introAt > 7900, null, 12000);
    const a = await introAudio(ctx), early = await fiTimed(ctx);
    check(S, 'silent path: no voice before the tap (no "intro-title", no "intro-go")', early.length === 0, JSON.stringify(early));
    check(S, 'silent path: the browser refuses the app\'s silent autoplay probe (no tap yet)', a.probe[0] === 'NotAllowedError', JSON.stringify(a.probe));
    check(S, 'silent path: intro plays to the end with no AudioContext and no effect', a.ac.length === 0 && a.src.length === 0 && a.done - a.at > 4500 && a.done - a.at < 6500,
      JSON.stringify(Object.assign(a, { doneAt: a.done - a.at })));
    const c1 = await coverSaid(ctx, 'new');
    check(S, 'silent path: start tap -> "intro-title", "ask-theme" (no "cover")', c1.ok && inOrder(c1.said, ['intro-title', 'ask-theme']) && !c1.said.includes('cover'), c1.said.join(','));
    const u = await introAudio(ctx);
    check(S, 'silent path: the start tap creates + runs the AudioContext', u.ac.length === 1 && u.ac[0].tapped === true && u.ac[0].state === 'running', JSON.stringify(u.ac));
    await page.reload();
    await intro(ctx, {});
    const r = await introAudio(ctx);
    check(S, 'silent path: after a reload + skip still no AudioContext before the start tap', r.ac.length === 0 && r.src.length === 0, JSON.stringify(r));
    check(S, 'silent path: start after a skip -> onboarding', await cover(ctx, 'new'));
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* The boy's later games: game turn seeded at 3, 4, 5 -> Shahada VAIKEA step 1 -> that game -> reward. */
async function suiteBoyGames(browser, base) {
  const ctx = await newCtx(browser, base, 'boygames', [390, 844]);
  const S = ctx.suite;
  try {
    for (const g of [3, 4, 5]) {
      await seed(ctx, store([kid('b', BOY, 'boy', { level: 'hard', game: g })]));
      await cover(ctx, 'pick');
      await pickKid(ctx, 'b');
      await openSec(ctx, 'shahada', 'hard', 'hard');
      await waitLearn(ctx, 1, 2);
      const from = await alen(ctx);
      await tap(ctx, '#saidBtn');
      const p = await playGame(ctx, from, 'boy');
      await waitShown(ctx, 'reward', 9000);
      const rw = await rewardInfo(ctx);
      check(S, 'boy game ' + g + ' -> rocket reward', p.game === 'boy-' + g && rw.theme === 'boy' && rw.gem === PROMPTS['rocket-part'], JSON.stringify({ game: p.game, rw }));
      if (g === 3) await screen(ctx, 'reward-boy', 1200);
    }
    gameChecks(ctx);
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

async function waitForSW(page, timeout = 30000) {
  return page.evaluate((timeout) => Promise.race([
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
      const w = reg.active;
      if (w.state !== 'activated') await new Promise((r) => w.addEventListener('statechange', () => w.state === 'activated' && r()));
      const names = await caches.keys();
      let n = 0;
      for (const k of names) n += (await (await caches.open(k)).keys()).length;
      return { scope: reg.scope, state: w.state, controlled: !!navigator.serviceWorker.controller, cached: n };
    })(),
    new Promise((r) => setTimeout(() => r(null), timeout))
  ]), timeout);
}

async function suiteOffline(browser) {
  const srv = await serve({ dir: DIST, port: 0, base: '/sub/suuraseikkailu/' });
  const ctx = await newCtx(browser, srv.url, 'offline', [390, 844], { sw: true });
  const S = ctx.suite;
  try {
    const want = JSON.parse(/const FILES = (\[[\s\S]*?\]);/.exec(fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8'))[1]).length;
    await ctx.page.goto(srv.url);
    await ctx.page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, store([kid('a', GIRL, 'girl', { level: 'hard' })])]);
    const sw = await waitForSW(ctx.page);
    check(S, 'service worker active under a sub-path, every file precached', sw && sw.state === 'activated' && sw.controlled && sw.cached >= want,
      JSON.stringify(sw) + ' want ' + want);
    await srv.close();
    await ctx.context.setOffline(true);
    await ctx.page.reload();
    check(S, 'offline reload: cover -> picker, "who" plays', await cover(ctx, 'pick'));
    await pickKid(ctx, 'a');
    const o = await openSec(ctx, 'shahada', 'hard', 'hard');
    const ok = await waitEvent(ctx, o.from, 'playing', 'shahada-1.mp3', 8000);
    check(S, 'offline: Shahada line plays from the cache', ok, plays(await alog(ctx, o.from)).map((e) => e.src).join(','));
    await screen(ctx, 'offline-learn');
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* ---------- main ---------- */
async function main() {
  const t0 = Date.now();
  if (!fs.existsSync(path.join(DIST, 'index.html')) || !fs.existsSync(path.join(DIST, 'sw.js'))) {
    console.error('No build in ' + DIST + ' (index.html + sw.js). Build first: npx vite build --outDir <dir>');
    process.exit(2);
  }
  const imp = (p) => import(pathToFileURL(path.join(ROOT, 'src', p)).href);
  const data = (await imp('content/data.js')).default;
  PROMPTS = (await imp('content/prompts.js')).PROMPTS;
  unitsOf = (await imp('ui/units.js')).unitsOf;
  SECS = data.sections.map((s) => ({ id: s.id, name: s.name, N: s.lines.length, lines: s.lines, raw: s }));
  if (!ONLY.length) fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const srv = await serve({ dir: DIST, port: 0, base: '/' });
  const browser = await chromium.launch({ args: FLAGS });
  const want = (n) => !ONLY.length || ONLY.some((o) => n.startsWith(o));
  const jobs = [];
  for (const [vp, rm] of [[[390, 844], false], [[360, 740], true], [[768, 1024], false], [[1024, 768], false], [[844, 390], false]]) {
    const n = 'flow-' + vp.join('x') + (rm ? '-rm' : '');
    if (want(n)) jobs.push(suiteFlow(browser, srv.url, vp, rm));
  }
  if (want('audio')) jobs.push(suiteAudio(browser, srv.url));
  if (want('settings')) jobs.push(suiteSettings(browser, srv.url));
  if (want('migrate')) jobs.push(suiteMigrate(browser, srv.url));
  if (want('offline')) jobs.push(suiteOffline(browser));
  if (want('background')) jobs.push(suiteBackground(browser, srv.url));
  if (want('boygames')) jobs.push(suiteBoyGames(browser, srv.url));
  if (want('intro-sound')) jobs.push(suiteIntroSound(browser, srv.url));
  /* the silent path needs the browser's default autoplay policy */
  const quiet = want('intro-silent') ? await chromium.launch({ args: FLAGS.filter((f) => !/autoplay/.test(f)) }) : null;
  if (quiet) jobs.push(suiteIntroSilent(quiet, srv.url));
  const ctxs = await Promise.all(jobs);
  if (quiet) await quiet.close();
  await browser.close();
  await srv.close();

  const games = new Set();
  ctxs.forEach((c) => c.games.forEach((g) => games.add(g.game)));
  if (!ONLY.length) {
    const all = ['girl', 'boy'].flatMap((t) => [0, 1, 2, 3, 4, 5].map((i) => t + '-' + i));
    check('all', 'all 12 minigames exercised across the run', all.every((g) => games.has(g)), Array.from(games).sort().join(','));
  }

  const w1 = Math.max(...results.map((r) => r.suite.length)), w2 = Math.min(78, Math.max(...results.map((r) => r.name.length)));
  console.log('\n' + 'SUITE'.padEnd(w1) + '  ' + 'CHECK'.padEnd(w2) + '  RESULT  DETAIL');
  console.log('-'.repeat(w1 + w2 + 20));
  for (const r of results) {
    console.log(r.suite.padEnd(w1) + '  ' + r.name.padEnd(w2) + '  ' + (r.ok ? 'PASS  ' : 'FAIL  ') + '  ' + r.detail.slice(0, 300));
  }
  console.log('\nSuite times: ' + ctxs.map((c) => c.suite + ' ' + (c.ms / 1000).toFixed(0) + ' s').join(', '));
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + (failed ? 'FAIL' : 'PASS') + ': ' + (results.length - failed) + '/' + results.length + ' checks passed in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' +
    ' · screenshots: ' + SHOTS);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
