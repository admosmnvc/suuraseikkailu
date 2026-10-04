/* End-to-end suite for the built app (dist/). OWNER: integration.

     npm run build && node tools/e2e.cjs [distDir=dist] [--shots ../qa/screens] [--only flow-390x844,audio,...]

   Headless Chromium (Playwright from /opt/node-tools, CommonJS) with autoplay allowed and a fake microphone;
   dist/ is served by tools/pwa-serve.cjs (HTTP Range). Suites run in parallel, one browser context each:
     flow-<vp>  gate -> home -> every section through every step (Sanoin!, minigame, reward + Jatka, finale +
                sticker, Kotiin), step bubbles, review mode, Uudestaan, reload keeps progress, settings, reset
                with confirmation. 360x740 runs with prefers-reduced-motion.
     audio      Al-Fatiha step 7 chain: 001001..001007 then turn-all, in order, never overlapping;
                Kuuntele restarts from line 1; Sanoin! cuts playback within 150 ms; line chips.
     settings   short tap hint, long-press opens, name, sound tests, record/play/delete with the fake mic,
                slow 0.8, translit off, speech off (prompts silent, recitation plays), Escape.
     offline    service worker precache under a sub-path, server stopped + offline reload, playback.
     landscape  844x390 smoke (home, learn, game, reward, finale, settings).
     background app hidden during a minigame (simulated visibilitychange): onDone held, one reward, flow goes on.
   Every screen: documentElement.scrollWidth <= innerWidth, visible buttons >= 64 px (inside settings >= 44 px;
   settings controls under 64 px are listed), button labels inside their buttons, reward/finale buttons on screen
   without scrolling, screenshot to <shots>/<viewport>/. Console errors/warnings fail unless in ALLOW. Exit code 1 on any failure.

   The shared <audio> element is instrumented (play/playing/pause/ended + src, rate, highlighted line);
   blob: URLs are mapped back to their audio/... file. */
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
const SHOTS = path.resolve(opt('--shots', path.join(ROOT, '..', 'qa', 'screens')));
const ONLY = String(opt('--only', '') || '').split(',').filter(Boolean);
const DIST = path.resolve(argv[0] || path.join(ROOT, 'dist'));
const KEY = 'suuraseikkailu-v1';
const NAME = 'Aisha';
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

let SECS = [], PROMPTS = {};

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
  HTMLMediaElement.prototype.play = function () { watch(this); return op.apply(this, arguments); };
  /* 'stop' = pause() called on a playing element, logged synchronously with the src it was playing
     (the async 'pause' event may already see the next clip's src) */
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
    const act = el.getAttribute('data-act') || el.getAttribute('data-test') || el.getAttribute('data-every');
    const id = el.id && !/^(step|card)-/.test(el.id) ? '#' + el.id : '';
    const cls = Array.from(el.classList).filter((c) => !/^(jelly|pressed|boing|nudge|playing|current|done|is-|on$)/.test(c)).slice(0, 2).join('.');
    const txt = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '') + (act ? '[' + act + ']' : '') + (txt ? ' "' + txt + '"' : '');
  };
  document.querySelectorAll('button, a[href], summary, [role="button"], label.set-switch').forEach((el) => {
    if (el.closest('[hidden], [inert]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const game = !!el.closest('.mg');
    if (game && el.matches('.is-spent, .is-flying, .is-gone')) return; /* no longer a target */
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (game && (r.right <= 0 || r.bottom <= 0 || r.left >= iw || r.top >= ih)) return;
    /* layout size (a jelly button squashed mid-animation keeps its real hit size); games: drawn size */
    const w = game ? r.width : (el.offsetWidth || r.width), h = game ? r.height : (el.offsetHeight || r.height);
    targets.push({ d: desc(el), w: Math.round(w), h: Math.round(h), inSettings: !!el.closest('#settings'), game });
    /* label text must fit inside the button (no clipped "Uudestaa") */
    if (!game) {
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
  /* the reward / finale buttons must be on screen without scrolling */
  const offscreen = [];
  ['reward', 'finale'].forEach((id) => {
    const o = document.getElementById(id);
    if (!o || o.hidden) return;
    o.querySelectorAll('.ov-actions button').forEach((b) => {
      const q = b.getBoundingClientRect();
      if (q.top < 0 || q.bottom > ih + 0.5) offscreen.push(desc(b) + ' y ' + Math.round(q.top) + '-' + Math.round(q.bottom) + ' / ' + ih);
    });
  });
  return { sw: document.documentElement.scrollWidth, iw, ih, targets, clipped, offscreen };
}

function TARGETS() {
  const m = document.querySelector('section.mg');
  if (!m || m.hidden) return { open: false };
  const arena = m.querySelector('.mg-arena');
  const a = arena.getBoundingClientRect();
  const items = [];
  arena.querySelectorAll('.mg-item:not(.is-spent):not(.is-flying)').forEach((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x > a.left + 4 && x < a.right - 4 && y > a.top + 4 && y < a.bottom - 4) items.push({ x, y });
  });
  return { open: true, done: arena.classList.contains('is-done'), arena: { x: a.left, y: a.top, w: a.width, h: a.height }, items };
}

/* ---------- context + helpers ---------- */
async function newCtx(browser, base, suite, vp, extra = {}) {
  const context = await browser.newContext({
    viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1,
    reducedMotion: extra.rm ? 'reduce' : 'no-preference',
    permissions: extra.mic ? ['microphone'] : [],
    serviceWorkers: 'allow'
  });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const ctx = {
    suite, vp, tag: vp.join('x') + (extra.rm ? '-rm' : '') + (extra.tagSuffix || ''), context, page, base,
    console: [], failed: [], shot: 0, screens: [], small: new Map(), secondary: new Map(), games: [], t0: Date.now()
  };
  page.on('console', (m) => { const ty = m.type(); if (ty === 'error' || ty === 'warning') ctx.console.push(ty + ': ' + m.text()); });
  page.on('pageerror', (e) => ctx.console.push('pageerror: ' + (e && e.message)));
  page.on('requestfailed', (r) => ctx.failed.push(r.url() + ' ' + ((r.failure() || {}).errorText || '')));
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
const lsState = (ctx) => ctx.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const shown = (ctx, id) => ctx.page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);
/* After a screen change, the gate tap or a closing reward/finale the app ignores pointer clicks for 450 ms
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
    /* off screen, or scrolled under the sticky top bar / bottom action bar: scroll it to the middle, like a user */
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
  check(S, 'reward / finale buttons visible without scrolling', off.length === 0, off.slice(0, 4).join(' | ') || 'all');
  const small = Array.from(ctx.small.values());
  const bad = small.filter((s) => !EXCEPT.some(([re]) => re.test(s.d)));
  const exc = small.filter((s) => EXCEPT.some(([re]) => re.test(s.d)));
  ctx.exceptions = exc;
  check(S, 'tap targets >= 64 px (settings >= 44 px)', bad.length === 0,
    bad.length ? bad.map((s) => s.d + ' ' + s.w + 'x' + s.h + ' @' + s.screen).join(' | ') : (exc.length ? exc.length + ' listed exception(s)' : 'all') +
      (ctx.secondary.size ? ' · settings controls < 64 px: ' + Array.from(ctx.secondary).map(([d, m]) => d + ' ' + m + 'px').join(', ') : ''));
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
    await ctx.page.screenshot({ path: path.join(dir, 'zz-error-' + ctx.suite + '.png') });
  } catch (err) { /* ignore */ }
}

/* ---------- app helpers ---------- */
async function seed(ctx, state) {
  await ctx.page.goto(ctx.base);
  await ctx.page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, state]);
  await ctx.page.reload();
}

async function gate(ctx, expectWelcome) {
  await W(ctx, () => { const g = document.getElementById('gate'); return g && !g.hidden && document.getElementById('gateLabel').textContent === 'Aloita'; });
  await ctx.page.evaluate(() => document.fonts && document.fonts.ready);
  if (!ctx.gateShot) { ctx.gateShot = true; await screen(ctx, 'gate'); }
  const from = await alen(ctx);
  await tap(ctx, '#gateBtn');
  await W(ctx, () => document.getElementById('gate').hidden && !document.getElementById('home').hidden);
  await sleep(SETTLE_MS);
  return expectWelcome ? waitEvent(ctx, from, 'playing', 'fi/welcome.mp3', 6000) : true;
}

const homeInfo = (ctx) => ctx.page.evaluate(() => ({
  greeting: document.getElementById('greeting').textContent,
  cards: Array.from(document.querySelectorAll('#secGrid .sec-card')).map((c) => ({ id: c.dataset.id, done: c.classList.contains('done') })),
  album: document.getElementById('albumCount').textContent,
  palace: document.getElementById('palaceCount').textContent,
  stars: +document.querySelector('#homeStars .stars-num').textContent
}));
const stepInfo = (ctx) => ctx.page.evaluate(() => {
  const s = Array.from(document.querySelectorAll('#steps .step'));
  return { count: s.length, enabled: s.filter((b) => !b.disabled).length, done: s.filter((b) => b.classList.contains('done')).length,
    current: s.findIndex((b) => b.classList.contains('current')) + 1 };
});
const learnInfo = (ctx) => ctx.page.evaluate(() => {
  const lines = Array.from(document.querySelectorAll('#lines .line'));
  return { lines: lines.length, newOnLast: !!(lines.length && lines[lines.length - 1].querySelector('.badge-new')),
    anyNew: !!document.querySelector('#lines .badge-new'),
    title: document.getElementById('instrTitle').textContent, sub: document.getElementById('instrSub').textContent };
});
const rewardInfo = (ctx) => ctx.page.evaluate(() => ({
  heading: document.getElementById('rewardTitle').textContent, gem: document.getElementById('rewardGem').textContent,
  next: document.getElementById('rewardNext').textContent,
  slots: document.querySelectorAll('#rewardCrown .crown-slot').length, on: document.querySelectorAll('#rewardCrown .crown-slot.on').length
}));
const finaleInfo = (ctx) => ctx.page.evaluate(() => {
  const st = document.getElementById('finaleSticker');
  return { text: document.getElementById('finaleText').textContent, sticker: !!document.querySelector('#finaleArt .finale-sticker svg'),
    stickerText: st.hidden ? '' : st.textContent, plus: document.getElementById('finalePlus').textContent,
    bonus: !!document.querySelector('#finaleArt .finale-bonus') };
});
const waitLearn = (ctx, k, N, ms) => W(ctx, (a) => !document.getElementById('learn').hidden &&
  document.getElementById('instrSub').textContent === 'Vaihe ' + a[0] + '/' + a[1], [k, N], ms).then(() => sleep(SETTLE_MS));

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

/* Plays the open minigame like a child: taps live items until the overlay closes. */
async function playGame(ctx, from) {
  const page = ctx.page;
  await page.waitForSelector('section.mg:not([hidden])', { timeout: 6000 });
  const info = await page.evaluate(() => {
    const m = document.querySelector('section.mg');
    const c = Array.from(m.classList).find((x) => /^mg--g\d+$/.test(x));
    return { idx: c ? +c.slice(5) : -1, title: (m.querySelector('.mg-title') || {}).textContent || '' };
  });
  const first = !ctx.games.some((g) => g.idx === info.idx);
  const t0 = Date.now();
  let taps = 0, shot = !first;
  while (Date.now() - t0 < 30000) {
    const t = await page.evaluate(TARGETS);
    if (!t.open) break;
    if (t.arena && !t.done) {
      let p;
      if (t.items.length) {
        const it = t.items[(Math.random() * t.items.length) | 0];
        p = { x: it.x + (Math.random() - 0.5) * 8, y: it.y + (Math.random() - 0.5) * 8 };
      } else {
        p = { x: t.arena.x + t.arena.w * (0.2 + Math.random() * 0.6), y: t.arena.y + t.arena.h * (0.15 + Math.random() * 0.5) };
      }
      await page.mouse.click(p.x, p.y);
      taps++;
      if (!shot && taps === 3) { shot = true; await screen(ctx, 'game-' + info.idx, 200); }
      await sleep(380);
    } else await sleep(150);
  }
  const closed = !(await page.evaluate(TARGETS)).open;
  const said = await ctx.page.evaluate((a) => window.__audio.log.slice(a[0]).some((e) => e.type === 'playing' && e.src === a[1]), [from, 'fi/game-' + info.idx + '.mp3']);
  const g = Object.assign(info, { ms: Date.now() - t0, taps, closed, said });
  if (!said) g.audio = (await alog(ctx, from)).map((e) => e.t + ':' + e.type + ':' + e.src).join(' ');
  ctx.games.push(g);
  return g;
}

function gameChecks(ctx, speechOn = true) {
  const S = ctx.suite, gs = ctx.games;
  if (!gs.length) return;
  const bad = gs.filter((g) => g.idx < 0 || g.title !== PROMPTS['game-' + g.idx] || !g.closed || g.ms > 22000 || (speechOn && !g.said));
  check(S, 'minigames: ' + gs.length + ' played, indexes ' + Array.from(new Set(gs.map((g) => g.idx))).sort().join(','),
    bad.length === 0,
    (bad.length ? 'BAD ' + bad.map((g) => JSON.stringify(g)).join(' ') + ' · ' : '') +
    'title = PROMPTS game-i, say() plays fi/game-i.mp3, ' + Math.min(...gs.map((g) => g.ms)) + '-' + Math.max(...gs.map((g) => g.ms)) + ' ms each');
}

/* ---------- suites ---------- */
async function suiteFlow(browser, base, vp, rm) {
  const ctx = await newCtx(browser, base, 'flow-' + vp.join('x') + (rm ? '-rm' : ''), vp, { rm });
  const S = ctx.suite;
  try {
    await seed(ctx, { name: NAME });
    check(S, 'gate "Aloita" -> home, welcome prompt plays', await gate(ctx, true));
    let h = await homeInfo(ctx);
    check(S, 'home: section cards, greeting with name, nothing done', h.cards.length === SECS.length && h.greeting === 'Hei, ' + NAME + '!' &&
      h.cards.every((c) => !c.done) && h.album === '0/' + (SECS.length + 1) && h.stars === 0, JSON.stringify(h));
    await screen(ctx, 'home');
    if (rm) {
      const still = await ctx.page.evaluate(() => ({
        mq: matchMedia('(prefers-reduced-motion: reduce)').matches,
        bg: getComputedStyle(document.querySelector('.bg-bubble')).animationName
      }));
      check(S, 'reduced motion: media query on, background still', still.mq && still.bg === 'none', JSON.stringify(still));
    }
    let stars = 0, rewards = 0, rewardBad = [], learnBad = [];
    for (const [si, sec] of SECS.entries()) {
      await tap(ctx, '#card-' + sec.id);
      await waitLearn(ctx, 1, sec.N);
      const st = await stepInfo(ctx);
      check(S, sec.id + ': step bubbles 1 open, ' + (sec.N - 1) + ' locked', st.count === sec.N && st.enabled === 1 && st.current === 1, JSON.stringify(st));
      for (let k = 1; k <= sec.N; k++) {
        await waitLearn(ctx, k, sec.N);
        const li = await learnInfo(ctx);
        if (li.lines !== k || !li.newOnLast) learnBad.push(sec.id + ' k' + k + ' ' + JSON.stringify(li));
        if (k === 1 || k === sec.N) await screen(ctx, 'learn-' + sec.id + '-' + k);
        if (sec.id === 'fatiha' && k === 3) {
          await tap(ctx, '#step-1');
          await waitLearn(ctx, 1, sec.N);
          const l1 = await learnInfo(ctx);
          await tap(ctx, '#step-3');
          await waitLearn(ctx, 3, sec.N);
          const st3 = await stepInfo(ctx);
          check(S, 'step bubbles: tap 1 then 3 switches step; done steps marked', l1.lines === 1 && st3.done === 2 && st3.enabled === 3 && st3.current === 3,
            JSON.stringify({ l1: l1.lines, st3 }));
        }
        const from = await alen(ctx);
        await tap(ctx, '#saidBtn');
        if (k < sec.N) {
          await playGame(ctx, from);
          await waitShown(ctx, 'reward', 8000);
          stars += 1; rewards++;
          if (k === 1) {
            const landed = await tryW(ctx, (k) => document.querySelectorAll('#rewardCrown .crown-slot.on').length >= k, k, 3000);
            if (!landed) rewardBad.push(sec.id + ' k1 gem did not land');
            await screen(ctx, 'reward-' + sec.id, 0);
          }
          const rw = await rewardInfo(ctx);
          const nextWant = k + 1 >= sec.N ? 'Seuraavaksi: koko ' + sec.name : 'Seuraavaksi: rivit 1–' + (k + 1);
          if (!rw.heading.endsWith(', ' + NAME + '!') || rw.slots !== sec.N || rw.next !== nextWant || rw.gem !== PROMPTS.gem) {
            rewardBad.push(sec.id + ' k' + k + ' ' + JSON.stringify(rw));
          }
          await sleep(900);
          await tap(ctx, '#rewardGo');
          await waitHidden(ctx, 'reward');
        } else {
          await waitShown(ctx, 'finale', 8000);
          stars += 3;
          const last = si === SECS.length - 1;
          const fi = await finaleInfo(ctx);
          check(S, sec.id + ': finale + sticker' + (last ? ' + palace bonus' : '') + ', +3 tähteä', fi.sticker && fi.stickerText === PROMPTS.sticker &&
            fi.plus === '+3 tähteä' && fi.bonus === last && fi.text === PROMPTS['finale-' + sec.id], JSON.stringify(fi));
          await screen(ctx, 'finale-' + sec.id);
          await sleep(500);
          await tap(ctx, '#finaleHome');
          await waitShown(ctx, 'home');
          h = await homeInfo(ctx);
          const ls = await lsState(ctx);
          check(S, sec.id + ': Kotiin -> home, card done, sticker in album, saved', h.cards[si].done && h.album === (si + 1 + (last ? 1 : 0)) + '/' + (SECS.length + 1) &&
            ls.progress[sec.id] === sec.N && ls.done[sec.id] === true, JSON.stringify({ album: h.album, ls: ls.progress[sec.id], done: ls.done }));
        }
      }
    }
    check(S, 'learn screens: k lines shown at step k, "UUSI" on the newest', learnBad.length === 0, learnBad.join(' | ') || 'all ' + SECS.reduce((n, s) => n + s.N, 0) + ' steps');
    check(S, rewards + ' rewards: praise + name, crown sockets, gem lands, next text', rewardBad.length === 0, rewardBad.slice(0, 3).join(' | ') || 'ok');
    gameChecks(ctx);
    h = await homeInfo(ctx);
    check(S, 'all done: stars ' + stars + ', album full, palace lit', h.stars === stars && h.cards.every((c) => c.done) && h.palace === 'Palatsi loistaa!',
      JSON.stringify(h));
    await screen(ctx, 'home-done', 1200);

    /* review mode on a finished section + Uudestaan */
    const rv = SECS.find((s) => s.id === 'ikhlas') || SECS[SECS.length - 1];
    await tap(ctx, '#card-' + rv.id);
    await waitLearn(ctx, rv.N, rv.N);
    const rli = await learnInfo(ctx), rst = await stepInfo(ctx);
    check(S, 'review mode: whole ' + rv.id + ', all bubbles open, no "UUSI"', rli.title === 'Sano koko ' + rv.name && !rli.anyNew && rli.lines === rv.N && rst.enabled === rv.N,
      JSON.stringify({ rli, rst }));
    await screen(ctx, 'review-' + rv.id);
    await tap(ctx, '#saidBtn');
    await waitShown(ctx, 'finale', 8000);
    const rf = await finaleInfo(ctx);
    stars += 1;
    check(S, 'review finale: +1 tähti, no new sticker', rf.plus === '+1 tähti' && !rf.stickerText, JSON.stringify(rf));
    await screen(ctx, 'finale-review');
    await sleep(500);
    let from = await alen(ctx);
    await tap(ctx, '#finaleAgain');
    await waitLearn(ctx, 1, rv.N);
    const again = await waitEvent(ctx, from, 'playing', rv.lines[0].audio.replace(/^audio\//, ''), 6000);
    check(S, 'Uudestaan -> step 1 of the same section, chain starts', again && (await learnInfo(ctx)).lines === 1);
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');
    check(S, 'Kotiin (top bar) -> home', !(await shown(ctx, 'learn')));

    /* reload keeps progress */
    await ctx.page.reload();
    const g2 = await gate(ctx, true);
    h = await homeInfo(ctx);
    check(S, 'reload keeps progress (stars ' + stars + ', all done, album full)', g2 && h.stars === stars && h.cards.every((c) => c.done) &&
      h.album === (SECS.length + 1) + '/' + (SECS.length + 1), JSON.stringify(h));

    /* settings (long-press) + reset with confirmation */
    check(S, 'long-press opens settings', await openSettings(ctx));
    await screen(ctx, 'settings');
    await ctx.page.evaluate(() => { const b = document.querySelector('#settings .set-body'); b.scrollTop = b.scrollHeight; });
    await screen(ctx, 'settings-bottom');
    await tap(ctx, '#settings [data-act="reset"]');
    const conf = await tryW(ctx, () => !document.getElementById('setResetConfirm').hidden, null, 3000);
    await tap(ctx, '#settings [data-act="resetno"]');
    const peru = await tryW(ctx, () => document.getElementById('setResetConfirm').hidden, null, 3000);
    const kept = (await lsState(ctx)).stars === stars;
    await tap(ctx, '#settings [data-act="reset"]');
    await tryW(ctx, () => !document.getElementById('setResetConfirm').hidden, null, 3000);
    await screen(ctx, 'settings-reset-confirm', 200);
    await tap(ctx, '#settings [data-act="resetyes"]');
    const msg = await tryW(ctx, () => /nollattiin/.test(document.querySelector('#settings [data-reset-msg]').textContent), null, 3000);
    check(S, 'reset: confirm shown, Peru keeps progress, Kyllä resets', conf && peru && kept && msg, JSON.stringify({ conf, peru, kept, msg }));
    check(S, 'close button closes settings', await closeSettings(ctx));
    h = await homeInfo(ctx);
    const ls = await lsState(ctx);
    const zero = (x) => x.stars === 0 && x.cards.every((c) => !c.done) && x.album === '0/' + (SECS.length + 1);
    check(S, 'after reset: home shows zero progress, name kept', zero(h) && ls.name === NAME && Object.values(ls.progress).every((v) => v === 0), JSON.stringify({ h, ls }));
    await ctx.page.reload();
    await gate(ctx, true);
    check(S, 'reset survives reload', zero(await homeInfo(ctx)));
    await screen(ctx, 'home-after-reset');
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

async function suiteAudio(browser, base) {
  const ctx = await newCtx(browser, base, 'audio', [390, 844], { tagSuffix: '-audio' });
  const S = ctx.suite;
  try {
    const fat = SECS.find((s) => s.id === 'fatiha');
    const files = fat.lines.map((l) => l.audio.replace(/^audio\//, ''));
    await seed(ctx, { progress: { fatiha: fat.N - 1 } });
    check(S, 'gate unlock -> welcome prompt plays on the shared element', await gate(ctx, true));
    let from = await alen(ctx);
    const d0 = await ctx.page.evaluate(() => [window.__audio.decodes, window.__audio.speaks]);
    await tap(ctx, '#card-fatiha');
    await waitLearn(ctx, fat.N, fat.N);
    const done = await waitEvent(ctx, from, 'ended', 'fi/turn-all.mp3', 120000);
    const log = await alog(ctx, from);
    const pl = plays(log);
    const want = files.concat(['fi/turn-all.mp3']);
    check(S, 'Al-Fatiha step 7 chain order: ' + want.map((f) => f.replace(/\.mp3$/, '')).join(' > '), done && JSON.stringify(pl.map((e) => e.src)) === JSON.stringify(want),
      pl.map((e) => e.src).join(','));
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
      (overlaps.length ? 'overlap at ' + overlaps.join(',') + ' · ' : '') + 'gaps ' + Math.min(...gaps) + '-' + Math.max(...gaps) + ' ms, total ' +
      ((pl.length ? log.filter((e) => e.type === 'ended').pop().t - pl[0].t : 0) / 1000).toFixed(1) + ' s, elements ' + els.size);
    const hl = pl.map((e, i) => (i < files.length ? e.active === 'line-' + i : e.active === null));
    check(S, 'chain: line i highlighted while it plays, none during "your turn"', hl.every(Boolean), pl.map((e) => e.active).join(','));
    check(S, 'chain end: Sanoin! pulses (nudge)', await ctx.page.evaluate(() => document.getElementById('saidBtn').classList.contains('nudge')));
    await screen(ctx, 'learn-fatiha-7-after-chain');

    /* Kuuntele restarts from line 1 */
    from = await alen(ctx);
    await tap(ctx, '#listenBtn');
    await waitEvent(ctx, from, 'playing', files[2], 30000);
    const from2 = await alen(ctx);
    await tap(ctx, '#listenBtn');
    await waitEvent(ctx, from2, 'playing', files[0], 6000);
    const l2 = await alog(ctx, from2);
    const p2 = plays(l2);
    check(S, 'Kuuntele mid-chain (line 3) restarts from line 1', p2.length && p2[0].src === files[0] && l2.some((e) => e.type === 'stop' && e.src === files[2] && e.t <= p2[0].t),
      p2.map((e) => e.src).join(','));

    /* Sanoin! cuts playback */
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
      /* dt = tap -> pause() on the playing element (the audible cut); the 'pause' event is a queued task
         that can come later while the page renders the next state */
      return { dt: c && s ? s.t - c.t : null, pauseEvent: c && p ? p.t - c.t : null, src: s && s.src, after: later.filter((e) => e.type === 'playing' && /^\d{6}\.mp3$/.test(e.src)).length, paused: A.els[0].paused };
    }, from3);
    check(S, 'Sanoin! cuts recitation within 150 ms', cut.dt !== null && cut.dt < 150 && cut.pauseEvent !== null && cut.pauseEvent < 1000 &&
      cut.src === files[1] && cut.after === 0, JSON.stringify(cut));
    await waitShown(ctx, 'finale', 8000);
    await screen(ctx, 'finale-fatiha');
    await sleep(500);
    await tap(ctx, '#finaleHome');
    await waitShown(ctx, 'home');

    /* line chips */
    await tap(ctx, '#card-fatiha');
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
    await screen(ctx, 'learn-meaning');
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

async function suiteSettings(browser, base) {
  const ctx = await newCtx(browser, base, 'settings', [390, 844], { mic: true, tagSuffix: '-settings' });
  const S = ctx.suite;
  try {
    await ctx.page.goto(base);
    await gate(ctx, true);
    /* short tap. Under the parallel load the browser can process pointerup late; a tap that the page itself
       saw as held >= 800 ms is a long press and is retried (the measured hold is in the detail) */
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
    await screen(ctx, 'settings');

    await ctx.page.fill('#setName', NAME);
    const named = await tryW(ctx, (n) => document.getElementById('greeting').textContent === 'Hei, ' + n + '!', NAME, 3000);
    check(S, 'name field: greeting + saved', named && (await lsState(ctx)).name === NAME);

    for (const [kind, re] of [['recitation', /MP3: OK/], ['sfx', /AudioContext: running/], ['fi', /Suomi-MP3: OK/], ['ar', /Shahada-MP3: OK/]]) {
      await tap(ctx, '#settings [data-test="' + kind + '"]');
      await tryW(ctx, () => { const r = document.querySelector('#settings .test-result'); return r && !r.hidden && !/Soitetaan/.test(r.textContent); }, null, 20000);
      const txt = await ctx.page.evaluate(() => document.querySelector('#settings .test-result').textContent);
      check(S, 'sound test "' + kind + '" shows status', re.test(txt), txt);
    }
    const diag = await ctx.page.evaluate(() => document.querySelector('#settings .diag').textContent.replace(/\s+/g, ' ').trim());
    check(S, 'diagnostics list shows MP3 + AudioContext state', /MP3.*OK/.test(diag) && /AudioContext.*running/.test(diag), diag);
    await screen(ctx, 'settings-test');

    /* record / play / delete with the fake microphone */
    const row = '#settings .rec-row[data-id="shahada-1"]';
    await tap(ctx, row + ' [data-act="rec"]');
    const live = await tryW(ctx, (r) => { const l = document.querySelector(r + ' .rec-live'); return l && !l.hidden; }, row, 6000);
    await sleep(1600);
    await screen(ctx, 'settings-recording', 0);
    await tap(ctx, row + ' [data-act="stoprec"]');
    const saved = await tryW(ctx, (r) => document.querySelector(r + ' .rec-status').textContent === 'Oma ääni' && !document.querySelector(r + ' [data-act="del"]').hidden, row, 8000);
    check(S, 'record with fake mic: live meter, saved as "Oma ääni"', live && saved,
      await ctx.page.evaluate((r) => document.querySelector(r + ' .rec-status').textContent + ' / ' + document.querySelector(r + ' .rec-msg').textContent, row));
    let from = await alen(ctx);
    await tap(ctx, row + ' [data-act="play"]');
    const pl = await waitEvent(ctx, from, 'playing', 'blob(audio/*', 6000);
    const end = await waitEvent(ctx, from, 'ended', 'blob(audio/*', 10000);
    check(S, 'Kuuntele plays the recording', pl && end, (await alog(ctx, from)).map((e) => e.type + ':' + e.src).join(','));
    await screen(ctx, 'settings-recorded');
    await closeSettings(ctx);
    from = await alen(ctx);
    await tap(ctx, '#card-shahada');
    await waitLearn(ctx, 1, 2);
    const own = await waitEvent(ctx, from, 'playing', 'blob(audio/*', 6000);
    check(S, 'own recording replaces Shahada line 1 in the lesson', own, plays(await alog(ctx, from)).map((e) => e.src).join(','));
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');
    await openSettings(ctx);
    await tap(ctx, row + ' [data-act="del"]');
    const cf = await tryW(ctx, (r) => !document.querySelector(r + ' .rec-confirm').hidden, row, 3000);
    await tap(ctx, row + ' [data-act="delyes"]');
    const gone = await tryW(ctx, (r) => document.querySelector(r + ' .rec-status').textContent === 'Valmis ääni' && document.querySelector(r + ' [data-act="del"]').hidden, row, 6000);
    check(S, 'delete recording: confirm, back to "Valmis ääni"', cf && gone);

    /* switches */
    const sw = [await setSwitch(ctx, 'slow', true), await setSwitch(ctx, 'translit', false), await setSwitch(ctx, 'speech', false)];
    const ls = await lsState(ctx);
    check(S, 'switches slow on / translit off / speech off saved', sw.every(Boolean) && ls.slow === true && ls.translit === false && ls.speech === false, JSON.stringify(sw));
    await ctx.page.keyboard.press('Escape');
    check(S, 'Escape closes settings', await tryW(ctx, () => document.getElementById('settings').hidden, null, 3000));

    from = await alen(ctx);
    await tap(ctx, '#card-fatiha');
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
    await playGame(ctx, from);
    await waitShown(ctx, 'reward', 8000);
    await sleep(1500);
    lg = await alog(ctx, from);
    const rh = await rewardInfo(ctx);
    check(S, 'speech off: game title + praise silent, text still shown', !lg.some((e) => e.type === 'playing' && e.src.startsWith('fi/')) && rh.heading.includes(NAME),
      plays(lg).map((e) => e.src).join(',') + ' heading=' + rh.heading);
    await sleep(300);
    await tap(ctx, '#rewardGo');
    await waitLearn(ctx, 2, 7);
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');

    await openSettings(ctx);
    await setSwitch(ctx, 'slow', false); await setSwitch(ctx, 'translit', true); await setSwitch(ctx, 'speech', true);
    await closeSettings(ctx);
    from = await alen(ctx);
    await tap(ctx, '#card-fatiha');
    await waitLearn(ctx, 2, 7);
    await waitEvent(ctx, from, 'playing', '001001.mp3', 8000);
    lg = await alog(ctx, from);
    const r1 = lg.find((e) => e.type === 'playing' && e.src === '001001.mp3');
    const trv = await ctx.page.evaluate(() => Array.from(document.querySelectorAll('#lines .tr')).filter((e) => e.getClientRects().length).length);
    check(S, 'switches back: rate 1.0, transliteration visible', r1 && r1.rate === 1 && trv > 0, JSON.stringify({ rate: r1 && r1.rate, trv }));
    await tap(ctx, '#homeBtn');
    gameChecks(ctx, false);
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* App goes to the background during a minigame: the game holds onDone while hidden, the flow gives exactly
   one reward when the app is visible again and goes on normally. */
async function suiteBackground(browser, base) {
  const ctx = await newCtx(browser, base, 'background', [390, 844], { tagSuffix: '-background' });
  const S = ctx.suite, page = ctx.page;
  try {
    await seed(ctx, { name: NAME });
    await gate(ctx, true);
    await tap(ctx, '#card-shahada');
    await waitLearn(ctx, 1, 2);
    await tap(ctx, '#saidBtn');
    await page.waitForSelector('section.mg:not([hidden])', { timeout: 6000 });
    await page.evaluate(() => window.__setHidden(true));
    await sleep(2500);
    const midHidden = await page.evaluate(() => !document.querySelector('section.mg').hidden && document.getElementById('reward').hidden);
    await page.evaluate(() => window.__setHidden(false));
    /* tap until the game is complete, then leave the app before its celebration hands over */
    const t0 = Date.now();
    let done = false;
    while (!done && Date.now() - t0 < 25000) {
      const t = await page.evaluate(TARGETS);
      if (!t.open) break;
      if (t.done) { done = true; break; }
      const it = t.items[0] || { x: t.arena.x + t.arena.w / 2, y: t.arena.y + t.arena.h / 3 };
      await page.mouse.click(it.x, it.y);
      await sleep(380);
    }
    await page.evaluate(() => window.__setHidden(true));
    await sleep(3000);
    const held = await page.evaluate(() => ({ game: !document.querySelector('section.mg').hidden, reward: !document.getElementById('reward').hidden,
      stars: +document.querySelector('#learnStars .stars-num').textContent }));
    await page.evaluate(() => window.__setHidden(false));
    const reward = await tryW(ctx, () => !document.getElementById('reward').hidden && document.querySelector('section.mg').hidden, null, 4000);
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
    check(S, 'flow goes on: Jatka -> step 2 -> Sanoin! -> finale', fin && (await lsState(ctx)).stars === 4);
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
  const ctx = await newCtx(browser, srv.url, 'offline', [390, 844], { tagSuffix: '-offline' });
  const S = ctx.suite;
  try {
    const want = JSON.parse(/const FILES = (\[[\s\S]*?\]);/.exec(fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8'))[1]).length;
    await ctx.page.goto(srv.url);
    const sw = await waitForSW(ctx.page);
    check(S, 'service worker active under a sub-path, every file precached', sw && sw.state === 'activated' && sw.controlled && sw.cached >= want,
      JSON.stringify(sw) + ' want ' + want);
    await srv.close();
    await ctx.context.setOffline(true);
    await ctx.page.reload();
    check(S, 'offline reload: gate -> home, welcome prompt plays', await gate(ctx, true));
    const from = await alen(ctx);
    await tap(ctx, '#card-shahada');
    const ok = await waitEvent(ctx, from, 'playing', 'shahada-1.mp3', 8000);
    check(S, 'offline: Shahada line plays from the cache', ok, plays(await alog(ctx, from)).map((e) => e.src).join(','));
    await screen(ctx, 'offline-learn');
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

async function suiteLandscape(browser, base) {
  const ctx = await newCtx(browser, base, 'landscape-844x390', [844, 390]);
  const S = ctx.suite;
  try {
    await seed(ctx, { name: NAME, progress: { fatiha: 2, kawthar: 3 } });
    await gate(ctx, true);
    await screen(ctx, 'home');
    await tap(ctx, '#card-fatiha');
    await waitLearn(ctx, 3, 7);
    await screen(ctx, 'learn-fatiha-3');
    let from = await alen(ctx);
    await tap(ctx, '#saidBtn');
    await playGame(ctx, from);
    await waitShown(ctx, 'reward', 8000);
    await screen(ctx, 'reward', 1500);
    await sleep(300);
    await tap(ctx, '#rewardGo');
    await waitLearn(ctx, 4, 7);
    await tap(ctx, '#homeBtn');
    await waitShown(ctx, 'home');
    await tap(ctx, '#card-kawthar');
    await waitLearn(ctx, 4, 4);
    await screen(ctx, 'learn-kawthar-4');
    await tap(ctx, '#saidBtn');
    await waitShown(ctx, 'finale', 8000);
    await screen(ctx, 'finale-kawthar');
    await sleep(500);
    await tap(ctx, '#finaleHome');
    await waitShown(ctx, 'home');
    check(S, 'landscape: learn, game, reward, finale, Kotiin', true);
    check(S, 'landscape: long-press opens settings', await openSettings(ctx));
    await screen(ctx, 'settings');
    await closeSettings(ctx);
    gameChecks(ctx);
  } catch (e) { await crash(ctx, e); }
  await finish(ctx);
  return ctx;
}

/* ---------- main ---------- */
async function main() {
  const t0 = Date.now();
  if (!fs.existsSync(path.join(DIST, 'index.html')) || !fs.existsSync(path.join(DIST, 'sw.js'))) {
    console.error('No build in ' + DIST + ' (index.html + sw.js). Run: npm run build');
    process.exit(2);
  }
  const data = (await import(pathToFileURL(path.join(ROOT, 'src', 'content', 'data.js')).href)).default;
  PROMPTS = (await import(pathToFileURL(path.join(ROOT, 'src', 'content', 'prompts.js')).href)).PROMPTS;
  SECS = data.sections.map((s) => ({ id: s.id, name: s.name, N: s.lines.length, lines: s.lines }));
  if (!ONLY.length) fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const srv = await serve({ dir: DIST, port: 0, base: '/' });
  const browser = await chromium.launch({ args: FLAGS });
  const want = (n) => !ONLY.length || ONLY.some((o) => n.startsWith(o));
  const jobs = [];
  for (const [vp, rm] of [[[390, 844], false], [[360, 740], true], [[768, 1024], false], [[1024, 768], false]]) {
    const n = 'flow-' + vp.join('x') + (rm ? '-rm' : '');
    if (want(n)) jobs.push(suiteFlow(browser, srv.url, vp, rm));
  }
  if (want('audio')) jobs.push(suiteAudio(browser, srv.url));
  if (want('settings')) jobs.push(suiteSettings(browser, srv.url));
  if (want('offline')) jobs.push(suiteOffline(browser));
  if (want('background')) jobs.push(suiteBackground(browser, srv.url));
  if (want('landscape')) jobs.push(suiteLandscape(browser, srv.url));
  const ctxs = await Promise.all(jobs);
  await browser.close();
  await srv.close();

  /* all 8 minigame indexes across the run */
  const idx = new Set();
  ctxs.forEach((c) => c.games.forEach((g) => idx.add(g.idx)));
  if (!ONLY.length) check('all', 'all 8 minigame indexes exercised', [0, 1, 2, 3, 4, 5, 6, 7].every((i) => idx.has(i)), Array.from(idx).sort().join(','));

  /* table */
  const w1 = Math.max(...results.map((r) => r.suite.length)), w2 = Math.min(78, Math.max(...results.map((r) => r.name.length)));
  console.log('\n' + 'SUITE'.padEnd(w1) + '  ' + 'CHECK'.padEnd(w2) + '  RESULT  DETAIL');
  console.log('-'.repeat(w1 + w2 + 20));
  for (const r of results) {
    console.log(r.suite.padEnd(w1) + '  ' + r.name.padEnd(w2) + '  ' + (r.ok ? 'PASS  ' : 'FAIL  ') + '  ' + r.detail.slice(0, 260));
  }
  const exc = [];
  ctxs.forEach((c) => (c.exceptions || []).forEach((e) => exc.push(c.suite + ': ' + e.d + ' ' + e.w + 'x' + e.h)));
  if (exc.length) {
    console.log('\nTap-target exceptions (listed in EXCEPT):');
    EXCEPT.forEach(([re, why]) => console.log('  ' + re + ' – ' + why));
    exc.forEach((e) => console.log('  ' + e));
  }
  console.log('\nSuite times: ' + ctxs.map((c) => c.suite + ' ' + (c.ms / 1000).toFixed(0) + ' s').join(', '));
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + (failed ? 'FAIL' : 'PASS') + ': ' + (results.length - failed) + '/' + results.length + ' checks passed in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' +
    ' · screenshots: ' + SHOTS);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
