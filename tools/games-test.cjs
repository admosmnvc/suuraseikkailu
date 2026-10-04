/* Minigame QA v3 (both themes, 6 games each) in Chromium.

   play   : a "child" bot plays every game through real pointer gestures (Playwright mouse, and CDP touch
            events in the 390x844 touch run). It follows the game's own hint glove: the core test hook
            .mg.__mgForceHint() shows the current idle hint at once, the bot reads its type (tap / drag / rub /
            hold) and position and performs that gesture at child pace. Asserts: onDone within 10–20 s,
            say(gameId) exactly once, overlay closed, no horizontal scroll, 0 console errors/warnings,
            every visible button in the arena >= 64 px in both dimensions (asserted for boy games).
            Viewports: 390x844, 390x844 touch, 1024x768, 360x740 reduced motion, 740x360.
   latency: for every first pointerdown of a gesture: time from the start of the pointerdown dispatch
            (window capture listener) to the first DOM mutation inside .mg (MutationObserver) or Web
            Animation started, and whether it happened before the next animation frame (= same frame).
            Assert: every touch changed something before the next frame and max <= 17 ms.
   idle   : nobody touches: the hint glove must appear, the game must still finish by 20 s.
   mash   : random taps + short swipes every 60 ms anywhere: still finishes <= 20 s, no errors.
   slow   : latency again with a 4x CPU throttle (CDP) and touch input, first 4 gestures of every game.
   robust : abort() mid-game -> timers / rAF / listeners back to baseline, overlay hidden and empty, onDone never;
            play() twice; resize/orientation mid-game; page hidden mid-game (time limit pauses) and during the
            celebration (onDone waits until visible).

   Usage (dev server: npx vite --host 127.0.0.1 --port 5204 --strictPort):
     node tools/games-test.cjs [outDir] [--themes=boy,girl] [--only=0,3] [--quick] [--suites=play,idle,mash,robust]
   env BASE=http://127.0.0.1:5204 */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:5204';
const args = process.argv.slice(2);
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || '../qa/v3-games');
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const QUICK = args.includes('--quick');
const THEMES = opt('themes', 'boy,girl').split(',');
const ONLY = opt('only', '') ? opt('only', '').split(',').map(Number) : [0, 1, 2, 3, 4, 5];
const SUITES = opt('suites', QUICK ? 'play' : 'play,idle,mash,robust,slow').split(',');
const MIN_MS = 10000, MAX_MS = 20000, FRAME_MS = 17;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* page instrumentation: latency probe + leak probe + hidden-page switch */
const INIT = `(() => {
  /* --- latency: pointerdown -> first visual change (DOM mutation in .mg or a new Web Animation) --- */
  const lat = window.__lat = [];
  let pend = null;
  const mo = new MutationObserver(() => {
    if (pend && pend.tMut == null) pend.tMut = performance.now();
  });
  const startMO = () => { const m = document.querySelector('.mg'); if (m && !m.__mo) { m.__mo = 1; mo.observe(m, { subtree: true, attributes: true, childList: true, characterData: true }); } };
  window.addEventListener('pointerdown', (e) => {
    startMO();
    if (!e.target || !e.target.closest || !e.target.closest('.mg-arena')) return;
    const anims = document.getAnimations ? document.getAnimations().length : 0;
    const p = pend = { t0: performance.now(), tMut: null, anims, type: e.pointerType };
    requestAnimationFrame(() => {
      const tf = performance.now();
      const animNew = document.getAnimations ? document.getAnimations().length > p.anims : false;
      lat.push({ ms: p.tMut != null ? +(p.tMut - p.t0).toFixed(2) : null, sameFrame: p.tMut != null || animNew, anim: animNew, frame: +(tf - p.t0).toFixed(2), type: p.type });
      if (pend === p) pend = null;
    });
  }, { capture: true });
  /* --- leaks --- */
  const live = new Set(), rafs = new Set(), lis = new Map();
  const st = window.setTimeout, ct = window.clearTimeout, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setTimeout = function (fn, ms) { const a = [].slice.call(arguments, 2); let id = 0;
    id = st.call(window, function () { live.delete(id); if (typeof fn === 'function') fn.apply(this, a); }, ms); live.add(id); return id; };
  window.clearTimeout = function (id) { live.delete(id); return ct.call(window, id); };
  window.requestAnimationFrame = function (fn) { let id = 0; id = ra.call(window, (t) => { rafs.delete(id); fn(t); }); rafs.add(id); return id; };
  window.cancelAnimationFrame = function (id) { rafs.delete(id); return ca.call(window, id); };
  const ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
  const fid = new WeakMap(); let n = 0;
  const key = (t, type, fn, o) => { if (!fid.has(fn)) fid.set(fn, ++n); if (!fid.has(t)) fid.set(t, ++n);
    return fid.get(t) + '|' + type + '|' + fid.get(fn) + '|' + !!(o === true || (o && o.capture)); };
  EventTarget.prototype.addEventListener = function (type, fn, o) { if (fn) lis.set(key(this, type, fn, o), this); return ael.call(this, type, fn, o); };
  EventTarget.prototype.removeEventListener = function (type, fn, o) { if (fn) lis.delete(key(this, type, fn, o)); return rel.call(this, type, fn, o); };
  const ours = (t) => t === window || t === document || (t && t.closest && !!t.closest('.mg'));
  window.__probe = () => { let l = 0; lis.forEach((t) => { if (ours(t)) l++; }); return { timeouts: live.size, rafs: rafs.size, listeners: l }; };
  window.__setHidden = (h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  };
})();`;

async function openPage(browser, vp, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1,
    reducedMotion: o.rm ? 'reduce' : 'no-preference', hasTouch: !!o.touch, isMobile: !!o.touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.addInitScript(INIT);
  await page.goto(BASE + '/tools/games-test.html');
  await page.waitForFunction(() => window.__mgTest && window.__mgTest.MiniGames, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => { const F = window.__mgTest.FX; F.sparkle(1, 1); F.clear(); });
  const cdp = o.touch ? await ctx.newCDPSession(page) : null;
  return { ctx, page, errs, cdp };
}

/* ---------- input: mouse or CDP touch ---------- */
function input(page, cdp) {
  let tp = null;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  return {
    async down(x, y) { if (cdp) { tp = [x, y]; await touch('touchStart', x, y); } else { await page.mouse.move(x, y); await page.mouse.down(); } },
    async move(x, y) { if (cdp) { tp = [x, y]; await touch('touchMove', x, y); } else await page.mouse.move(x, y); },
    async up() { if (cdp) await touch('touchEnd', tp ? tp[0] : 0, tp ? tp[1] : 0); else await page.mouse.up(); },
    async tap(x, y) { await this.down(x, y); await sleep(50); await this.up(); }
  };
}

/* current hint (forced now) in viewport px, or { none } / null when the game is closed */
const readHint = (page) => page.evaluate(() => {
  const r = document.querySelector('.mg');
  if (!r || r.hidden) return null;
  const done = !!r.querySelector('.mg-arena.is-done');
  if (!done && r.__mgForceHint) r.__mgForceHint();
  const el = r.querySelector('.mg-hint');
  if (!el) return { none: 1, done };
  const a = r.querySelector('.mg-arena').getBoundingClientRect(), cs = getComputedStyle(el);
  return { type: (el.className.match(/mg-hint--(\w+)/) || [])[1], x: a.left + parseFloat(el.style.left), y: a.top + parseFloat(el.style.top),
    dx: parseFloat(el.style.getPropertyValue('--dx')) || 0, dy: parseFloat(el.style.getPropertyValue('--dy')) || 0,
    rx: parseFloat(cs.getPropertyValue('--rx')) || 34, done };
});

async function gesture(io, h) {
  if (h.type === 'drag') {
    await io.down(h.x, h.y); await sleep(90);
    const n = 16;
    for (let k = 1; k <= n; k++) { await io.move(h.x + h.dx * k / n, h.y + h.dy * k / n); await sleep(32); }
    await sleep(60); await io.up();
  } else if (h.type === 'rub') {
    await io.down(h.x, h.y);
    for (let k = 0; k < 22; k++) {
      const tx = h.x + (k % 2 ? 1 : -1) * h.rx * 1.6, ty = h.y + ((k >> 1) % 3 - 1) * 22;
      for (let j = 1; j <= 3; j++) await io.move(h.x + (tx - h.x) * j / 3, ty);
      await sleep(28);
    }
    await io.up();
  } else if (h.type === 'hold') {
    await io.down(h.x, h.y); await sleep(1500); await io.up();
  } else {
    await io.tap(h.x, h.y);
  }
}

const gid = (theme, i) => 'game-' + theme + '-' + i;
async function startGame(page, theme, i) {
  await page.evaluate(([t, i]) => { window.__res = null; window.__mgTest.FX.clear(); window.__mgTest.play(t, i).then((r) => { window.__res = r; }); }, [theme, i]);
}
async function closedState(page) {
  return page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, hidden: (() => { const m = document.querySelector('.mg'); return !m || m.hidden; })() }));
}

/* child bot: follow hints at child pace */
async function playGame(page, io, theme, i, tag, pause) {
  await page.evaluate(() => { window.__lat.length = 0; });
  await startGame(page, theme, i);
  const t0 = Date.now();
  let acts = 0, midShot = false, doneShot = false, res = null, types = {}, minTarget = { m: Infinity, who: '' };
  while (Date.now() - t0 < 24000) {
    res = await page.evaluate(() => window.__res);
    if (res) break;
    const h = await readHint(page);
    if (!h) { await sleep(100); continue; }
    if (h.done) {
      if (!doneShot) { doneShot = true; await sleep(250); await page.screenshot({ path: path.join(OUT, theme + i + '-' + tag + '-done.png') }); }
      await sleep(150); continue;
    }
    if (h.none) { await sleep(150); continue; }
    types[h.type] = (types[h.type] || 0) + 1;
    acts++;
    /* smallest visible touch target (buttons in the arena; transforms included) */
    const mt = await page.evaluate(() => {
      const a = document.querySelector('.mg .mg-arena');
      let m = Infinity, who = '';
      if (a) a.querySelectorAll('button').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || getComputedStyle(b).visibility === 'hidden') return;
        const v = Math.min(r.width, r.height);
        if (v < m) { m = v; who = b.className; }
      });
      return { m, who };
    });
    if (mt.m < minTarget.m) minTarget = mt;
    if (acts === 1) { await sleep(650); await page.screenshot({ path: path.join(OUT, theme + i + '-' + tag + '-hint.png') }); }
    await gesture(io, h);
    if (acts === 2 && !midShot) { midShot = true; await sleep(120); await page.screenshot({ path: path.join(OUT, theme + i + '-' + tag + '-mid.png') }); }
    await sleep(pause);
  }
  await sleep(80);
  const lat = await page.evaluate(() => window.__lat.slice());
  const c = await closedState(page);
  return { theme, i, tag, ms: res ? Math.round(res.ms) : null, said: res && res.said, sayCount: res && res.sayCount, acts, types, lat, overflow: c.overflow, hidden: c.hidden, minTarget };
}

async function playSuite(browser, vp, o) {
  const { ctx, page, errs, cdp } = await openPage(browser, vp, o);
  const io = input(page, cdp);
  /* a touch whose click lands after the overlay closed must not start a test-page game */
  await page.evaluate(() => { const g = document.getElementById('lists'); if (g) g.inert = true; });
  const tag = vp.join('x') + (o.rm ? '-rm' : '') + (o.touch ? '-touch' : '');
  const out = [];
  for (const theme of THEMES) for (const i of ONLY) { out.push(await playGame(page, io, theme, i, tag, o.pause || 650)); await sleep(300); }
  await ctx.close();
  return { label: 'play ' + tag, out, errs, kind: 'play' };
}

async function idleSuite(browser, vp) {
  const { ctx, page, errs } = await openPage(browser, vp, {});
  const out = [], checks = [];
  for (const theme of THEMES) for (const i of ONLY) {
    await startGame(page, theme, i);
    const t0 = Date.now();
    let sawHint = false, res = null;
    while (Date.now() - t0 < 23000) {
      res = await page.evaluate(() => window.__res);
      if (res) break;
      if (!sawHint && await page.evaluate(() => !!document.querySelector('.mg .mg-hint'))) {
        sawHint = true;
        await sleep(450);
        await page.screenshot({ path: path.join(OUT, theme + i + '-idle-hint.png') });
      }
      await sleep(200);
    }
    const c = await closedState(page);
    checks.push({ ok: !!res && res.ms <= MAX_MS && sawHint && c.hidden, msg: 'idle ' + theme + ' ' + i + ': hint ' + sawHint + ', onDone ' + (res ? (res.ms / 1000).toFixed(1) + ' s' : 'none') });
    await sleep(300);
  }
  await ctx.close();
  return { label: 'idle (no touches) ' + vp.join('x'), out, checks, errs };
}

async function mashSuite(browser, vp, o) {
  const { ctx, page, errs, cdp } = await openPage(browser, vp, o || {});
  const io = input(page, cdp);
  await page.evaluate(() => { const g = document.getElementById('lists'); if (g) g.inert = true; });
  const checks = [];
  for (const theme of THEMES) for (const i of ONLY) {
    await startGame(page, theme, i);
    const t0 = Date.now();
    let res = null, n = 0;
    while (Date.now() - t0 < 23000) {
      res = await page.evaluate(() => window.__res);
      if (res) break;
      const a = await page.evaluate(() => { const r = document.querySelector('.mg .mg-arena'); if (!r) return null; const b = r.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      if (a) {
        const x = a[0] + Math.random() * a[2], y = a[1] + Math.random() * a[3];
        if (n % 3 === 2) { await io.down(x, y); await io.move(x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160); await io.up(); }
        else await io.tap(x, y);
        n++;
      }
      await sleep(60);
    }
    const c = await closedState(page);
    checks.push({ ok: !!res && res.ms <= MAX_MS && c.hidden && c.overflow <= 0 && res.sayCount === 1, msg: 'mash ' + theme + ' ' + i + ' (' + n + ' touches): onDone ' + (res ? (res.ms / 1000).toFixed(1) + ' s' : 'none') });
    await sleep(300);
  }
  await ctx.close();
  return { label: 'mash ' + vp.join('x') + (o && o.touch ? ' touch' : ''), out: [], checks, errs };
}

/* latency on a slow phone: CDP 4x CPU throttle, touch input, first 4 gestures of every game */
async function slowSuite(browser) {
  const { ctx, page, errs, cdp } = await openPage(browser, [390, 844], { touch: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const io = input(page, cdp);
  const out = [];
  for (const theme of THEMES) for (const i of ONLY) {
    await page.evaluate(() => { window.__lat.length = 0; });
    await startGame(page, theme, i);
    let acts = 0;
    for (let k = 0; k < 40 && acts < 4; k++) {
      const h = await readHint(page);
      if (!h || h.done) break;
      if (h.none) { await sleep(200); continue; }
      await gesture(io, h); acts++;
      await sleep(400);
    }
    const lat = await page.evaluate(() => window.__lat.slice());
    out.push({ theme, i, lat });
    await page.evaluate(() => { if (window.__mgGame) window.__mgGame.abort(); });
    await sleep(200);
  }
  await ctx.close();
  return { label: 'latency 4x CPU throttle 390x844 touch', out: [], lat: out, errs };
}

const domState = (page) => page.evaluate(() => {
  const m = document.querySelector('.mg'), a = m && m.querySelector('.mg-arena'), r = a && a.getBoundingClientRect();
  return { overlays: document.querySelectorAll('.mg').length, hidden: !m || m.hidden, game: m ? m.getAttribute('data-game') : null, arenaKids: a ? a.childElementCount : -1,
    goalKids: m ? m.querySelector('.mg-goal').childElementCount : -1, title: m ? m.querySelector('.mg-title').textContent : '',
    arena: r ? [r.left, r.top, r.right, r.bottom] : null, overflow: document.documentElement.scrollWidth - window.innerWidth,
    canvases: document.querySelectorAll('canvas').length };
});

async function robustSuite(browser) {
  const checks = [];
  const ok = (cond, msg) => checks.push({ ok: !!cond, msg });
  const { ctx, page, errs } = await openPage(browser, [390, 844], {});
  const io = input(page, null);
  const startG = (theme, i) => page.evaluate(([t, i]) => {
    const g = window.__g = { done: 0, said: [], t0: performance.now(), tDone: 0 };
    g.h = window.__mgTest.MiniGames.play({ theme: t, index: i, say: (id) => g.said.push(id), onDone: () => { g.done++; g.tDone = performance.now() - g.t0; } });
  }, [theme, i]);
  const act = async () => { const h = await readHint(page); if (h && !h.none && !h.done) await gesture(io, h); };

  /* 1. abort mid-game (warm-up first: the overlay and FX canvas are created once and kept) */
  await startG('boy', 0); await sleep(200); await page.evaluate(() => { window.__g.h.abort(); window.__mgTest.FX.clear(); });
  for (const theme of THEMES) for (const i of ONLY) {
    const base = await page.evaluate(() => window.__probe());
    await startG(theme, i);
    await sleep(1600); await act(); await sleep(150); await act(); await sleep(200);
    await page.evaluate(() => { window.__g.h.abort(); window.__mgTest.FX.clear(); });
    await sleep(80);
    const p = await page.evaluate(() => window.__probe()), d = await domState(page);
    ok(p.timeouts === base.timeouts && p.rafs === base.rafs && p.listeners === base.listeners,
      'abort ' + theme + ' ' + i + ': timers/rAF/listeners back to baseline ' + JSON.stringify(base) + ' -> ' + JSON.stringify(p));
    ok(d.hidden && d.arenaKids === 0 && d.goalKids === 0 && d.title === '' && d.overlays === 1 && !d.game, 'abort ' + theme + ' ' + i + ': overlay hidden and empty');
    await sleep(1200);
    ok((await page.evaluate(() => window.__g.done)) === 0, 'abort ' + theme + ' ' + i + ': onDone never fires');
  }

  /* 2. play twice: the first is replaced, its stale abort() is harmless, only the second finishes */
  await page.evaluate(() => {
    const T = window.__mgTest.MiniGames, g = window.__g2 = { d1: 0, d2: 0, s: [] };
    g.h1 = T.play({ theme: 'girl', index: 0, say: (id) => g.s.push(id), onDone: () => g.d1++ });
    g.h2 = T.play({ theme: 'boy', index: 3, say: (id) => g.s.push(id), onDone: () => g.d2++ });
    g.h1.abort();
  });
  let d = await domState(page);
  ok(d.overlays === 1 && !d.hidden && d.game === 'boy-3' && d.title === 'Vihreä valo, kaasua!', 'play twice: one overlay showing boy-3 (' + d.game + ', "' + d.title + '")');
  await page.waitForFunction(() => window.__g2.d2 === 1, null, { timeout: 22000 }).catch(() => {});
  const g2 = await page.evaluate(() => ({ d1: window.__g2.d1, d2: window.__g2.d2, s: window.__g2.s }));
  ok(g2.d1 === 0 && g2.d2 === 1 && g2.s.join() === 'game-girl-0,game-boy-3', 'play twice: onDone only for the second ' + JSON.stringify(g2));

  /* 3. resize / orientation change mid-game: no errors, no horizontal scroll, game still finishes once */
  for (const theme of THEMES) for (const i of ONLY) {
    await page.setViewportSize({ width: 390, height: 844 });
    await startG(theme, i);
    await sleep(1500);
    await act();
    for (const vp of [[740, 360], [1024, 768], [360, 740]]) {
      await page.setViewportSize({ width: vp[0], height: vp[1] });
      await sleep(500);
      d = await domState(page);
      ok(!d.hidden && d.overflow <= 0 && d.arena && d.arena[2] <= vp[0] + 1 && d.arena[3] <= vp[1] + 1, 'resize ' + theme + ' ' + i + ' -> ' + vp.join('x') + ': overflow ' + d.overflow);
      if (vp[0] === 1024) await page.screenshot({ path: path.join(OUT, theme + i + '-resized-1024x768.png') });
      await act();
    }
    for (let k = 0; k < 14; k++) { if (await page.evaluate(() => window.__g.done)) break; await act(); await sleep(300); }
    await page.waitForFunction(() => window.__g.done === 1, null, { timeout: 22000 }).catch(() => {});
    ok((await page.evaluate(() => window.__g.done)) === 1, 'resize ' + theme + ' ' + i + ': game still finishes once');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  /* 4a. page hidden mid-game: the time limit pauses (17.5 s limit + 6 s hidden + fill + celebration) */
  await startG('boy', 3);
  await sleep(1000);
  await page.evaluate(() => window.__setHidden(true));
  await sleep(6000);
  const h1 = await page.evaluate(() => window.__g.done);
  await page.evaluate(() => window.__setHidden(false));
  await page.waitForFunction(() => window.__g.done === 1, null, { timeout: 30000 }).catch(() => {});
  const ta = await page.evaluate(() => ({ done: window.__g.done, t: Math.round(window.__g.tDone) }));
  ok(h1 === 0 && ta.done === 1 && ta.t >= 22500 && ta.t <= 27500, 'hidden 6 s mid-game (no touches): time limit paused, auto-finish after ' + (ta.t / 1000).toFixed(1) + ' s');
  /* 4b. page hidden during the celebration: onDone waits until visible */
  await startG('boy', 0);
  for (let k = 0; k < 40; k++) { if (await page.evaluate(() => !!document.querySelector('.mg-arena.is-done'))) break; await act(); await sleep(250); }
  await page.waitForFunction(() => document.querySelector('.mg-arena.is-done'), null, { timeout: 22000 }).catch(() => {});
  await page.evaluate(() => window.__setHidden(true));
  await sleep(3000);
  const hh = await page.evaluate(() => window.__g.done);
  await page.evaluate(() => window.__setHidden(false));
  await sleep(200);
  const hv = await page.evaluate(() => window.__g.done);
  ok(hh === 0 && hv === 1, 'hidden during celebration: onDone held (' + hh + ') then delivered on return (' + hv + ')');

  /* 4c. a drag still running when the game ends (safety finish parks the cars): no errors, finishes once */
  if (THEMES.includes('boy')) {
    const e0 = errs.length;
    await startG('boy', 5);
    await sleep(1500);
    const c = await page.evaluate(() => { const b = document.querySelector('.mg .bp-mine'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    if (c) {
      await page.mouse.move(c[0], c[1]); await page.mouse.down();
      for (let t = 0; t < 40 && !(await page.evaluate(() => window.__g.done)); t++) { await page.mouse.move(c[0] + (t % 2 ? 40 : -40), c[1] - 30); await sleep(500); }
      await page.mouse.move(c[0], c[1] - 60); await page.mouse.up();
    }
    await page.waitForFunction(() => window.__g.done === 1, null, { timeout: 25000 }).catch(() => {});
    const dd = await page.evaluate(() => window.__g.done);
    ok(c && dd === 1 && errs.length === e0, 'park: drag held through the safety finish -> finishes once, no errors (' + (errs.slice(e0).join(' | ') || 'none') + ')');
  }

  /* 5. API */
  const api = await page.evaluate(() => { const M = window.__mgTest.MiniGames; return { cb: M.count('boy'), cg: M.count('girl'), tb: M.titles('boy'), tg: M.titles('girl') }; });
  ok(api.cb === 6 && api.cg === 6 && api.tb.length === 6 && api.tg.length === 6 && api.tb.every(Boolean) && api.tg.every(Boolean), 'API: count 6/6, titles ' + api.tb.join(' | ') + ' // ' + api.tg.join(' | '));
  await ctx.close();
  return { label: 'robustness 390x844', out: [], checks, errs };
}

function latStats(list) {
  const v = list.filter((l) => l.ms != null).map((l) => l.ms).sort((a, b) => a - b);
  const miss = list.filter((l) => !l.sameFrame).length;
  const q = (p) => v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
  return { n: list.length, miss, anim: list.filter((l) => l.ms == null && l.anim).length, med: q(0.5), p95: q(0.95), max: v.length ? v[v.length - 1] : null };
}

(async () => {
  const browser = await chromium.launch();
  const jobs = [];
  if (SUITES.includes('play')) {
    jobs.push(playSuite(browser, [390, 844], {}));
    jobs.push(playSuite(browser, [390, 844], { touch: true }));
    if (!QUICK) {
      jobs.push(playSuite(browser, [1024, 768], {}));
      jobs.push(playSuite(browser, [360, 740], { rm: true }));
      jobs.push(playSuite(browser, [740, 360], {}));
    }
  }
  const first = await Promise.all(jobs);
  const second = [];
  if (SUITES.includes('idle')) second.push(idleSuite(browser, [390, 844]));
  if (SUITES.includes('mash')) { second.push(mashSuite(browser, [390, 844], {})); second.push(mashSuite(browser, [740, 360], { touch: true })); }
  if (SUITES.includes('robust')) second.push(robustSuite(browser));
  if (SUITES.includes('slow')) second.push(slowSuite(browser));
  const results = first.concat(await Promise.all(second));
  await browser.close();

  let fail = 0;
  const allLat = [], slowLat = [];
  for (const r of results) {
    console.log('== ' + r.label);
    for (const g of r.out) {
      const lat = latStats(g.lat);
      allLat.push(...g.lat);
      const okT = g.ms != null && g.ms >= MIN_MS && g.ms <= MAX_MS;
      const okL = lat.n > 0 && lat.miss === 0 && (lat.max == null || lat.max <= FRAME_MS);
      /* touch targets >= 64 px: asserted for the boy games (girl games use their own stage, reported only) */
      const okS = g.theme !== 'boy' || !(g.minTarget.m < 64);
      const ok = okT && okL && okS && g.said === gid(g.theme, g.i) && g.sayCount === 1 && g.overflow <= 0 && g.hidden;
      if (!ok) fail++;
      console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + g.theme + ' ' + g.i + ': ' + (g.ms == null ? 'no onDone' : (g.ms / 1000).toFixed(1) + ' s') +
        ', ' + g.acts + ' gestures ' + JSON.stringify(g.types) + ', say ' + g.said + ' x' + g.sayCount + ', overflow ' + g.overflow + ', closed ' + g.hidden +
        ', latency ms med ' + lat.med + ' max ' + lat.max + ' (' + lat.n + ' touches, ' + lat.miss + ' not same frame' + (lat.anim ? ', ' + lat.anim + ' anim-only' : '') + ')' +
        ', min target ' + (isFinite(g.minTarget.m) ? Math.round(g.minTarget.m) + ' px' + (g.minTarget.m < 64 ? ' (' + g.minTarget.who + ')' : '') : '-'));
    }
    for (const c of r.checks || []) { if (!c.ok) fail++; console.log('  ' + (c.ok ? 'ok  ' : 'FAIL') + ' ' + c.msg); }
    for (const g of r.lat || []) {
      const l = latStats(g.lat), ok = l.n > 0 && l.miss === 0;
      if (!ok) fail++;
      console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + g.theme + ' ' + g.i + ': latency ms med ' + l.med + ' max ' + l.max + ' (' + l.n + ' touches, ' + l.miss + ' not same frame)');
      slowLat.push(...g.lat);
    }
    const errs = r.errs.filter((e) => !/\[vite\]/.test(e));
    if (errs.length) { fail++; console.log('  console:', errs.slice(0, 12)); }
  }
  console.log('\n== onDone (s)              ' + THEMES.map((t) => ONLY.map((i) => (t[0] + i).padStart(5)).join(' ')).join(' '));
  for (const r of results) {
    if (!r.out.length) continue;
    const row = THEMES.map((t) => ONLY.map((i) => { const g = r.out.find((x) => x.theme === t && x.i === i); return g && g.ms != null ? (g.ms / 1000).toFixed(1).padStart(5) : ' none'; }).join(' ')).join(' ');
    console.log('   ' + r.label.padEnd(24) + row);
  }
  const L = latStats(allLat);
  console.log('\n== latency pointerdown -> first visual change: ' + L.n + ' touches, median ' + L.med + ' ms, p95 ' + L.p95 + ' ms, max ' + L.max + ' ms, ' + L.miss + ' not in the same frame');
  if (slowLat.length) { const S4 = latStats(slowLat); console.log('== latency with 4x CPU throttle (touch): ' + S4.n + ' touches, median ' + S4.med + ' ms, p95 ' + S4.p95 + ' ms, max ' + S4.max + ' ms, ' + S4.miss + ' not in the same frame'); }
  console.log(fail ? 'FAILURES: ' + fail : 'ALL OK');
  process.exit(fail ? 1 : 0);
})();
