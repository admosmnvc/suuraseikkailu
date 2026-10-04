/* Minigame QA: runs every game 0..7 in Chromium, auto-taps targets like a (fast-ish) child,
   asserts onDone within 10-20 s, say('game-<i>') once, no console errors, no horizontal scroll,
   and saves mid-game + finish screenshots. Also (full run only):
   - mash: a child hammering the screen every 120 / 60 ms, on random spots and on targets (every tap
     snapped to the nearest live item), also during the end celebration: every game still takes 10-20 s
   - robustness: abort() mid-game leaves no timers / rAF / listeners / DOM and never calls onDone;
     play() twice in a row; resize + orientation change mid-game; page hidden mid-game (time limit
     pauses, onDone waits until visible)

   Usage (dev server must serve the project, e.g. `npx vite --host 127.0.0.1 --port 5104`):
     node tools/games-test.cjs [outDir] [--quick | --mash] [--only=0,3]
   env BASE=http://127.0.0.1:5104 */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:5104';
const OUT = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || 'qa-games');
const QUICK = process.argv.includes('--quick');
const MASH_ONLY = process.argv.includes('--mash');
const MIN_MS = 10000, MAX_MS = 20000;
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets(page) {
  return page.evaluate(() => {
    const arena = document.querySelector('.mg .mg-arena');
    if (!arena) return { arena: null, items: [] };
    const a = arena.getBoundingClientRect();
    const items = [];
    arena.querySelectorAll('.mg-item:not(.is-spent)').forEach((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x > a.left + 4 && x < a.right - 4 && y > a.top + 4 && y < a.bottom - 4) items.push({ x, y, w: r.width, h: r.height });
    });
    return { arena: { x: a.left, y: a.top, w: a.width, h: a.height }, items, done: arena.classList.contains('is-done') };
  });
}

/* run one game; tapEvery = ms between taps (0 = never tap) */
async function runGame(page, i, tag, tapEvery) {
  await page.evaluate((i) => { window.__res = null; window.__mgTest.FX.clear(); window.__mgTest.play(i).then((r) => { window.__res = r; }); }, i);
  const t0 = Date.now();
  let taps = 0, midShot = false, doneShot = false, res = null;
  while (Date.now() - t0 < 22000) {
    res = await page.evaluate(() => window.__res);
    if (res) break;
    const t = await targets(page);
    if (t.done && !doneShot) {
      doneShot = true;
      await sleep(350);
      await page.screenshot({ path: path.join(OUT, 'g' + i + '-' + tag + '-done.png') });
      continue;
    }
    if (tapEvery && t.arena && !t.done) {
      let p;
      if (t.items.length) {
        const it = t.items[(Math.random() * t.items.length) | 0];
        p = { x: it.x + (Math.random() - 0.5) * 10, y: it.y + (Math.random() - 0.5) * 10 };
      } else {
        p = { x: t.arena.x + t.arena.w * (0.15 + Math.random() * 0.7), y: t.arena.y + t.arena.h * (0.1 + Math.random() * 0.45) };
      }
      await page.mouse.click(p.x, p.y);
      taps++;
      if (taps === 3 && !midShot) {
        midShot = true;
        await sleep(260);
        await page.screenshot({ path: path.join(OUT, 'g' + i + '-' + tag + '-mid.png') });
      }
      await sleep(tapEvery);
    } else {
      if (!tapEvery && !midShot && Date.now() - t0 > 2500) {
        midShot = true;
        await page.screenshot({ path: path.join(OUT, 'g' + i + '-' + tag + '-idle.png') });
      }
      await sleep(150);
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const hidden = await page.evaluate(() => { const m = document.querySelector('.mg'); return !m || m.hidden; });
  return { i, tag, ms: res ? Math.round(res.ms) : null, said: res && res.said, taps, overflow, hidden };
}

async function suite(browser, vp, opts) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1,
    reducedMotion: opts.rm ? 'reduce' : 'no-preference', hasTouch: false });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(BASE + '/tools/games-test.html');
  await page.waitForFunction(() => window.__mgTest && window.__mgTest.MiniGames, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const info = await page.evaluate(() => ({ count: window.__mgTest.MiniGames.count, titles: window.__mgTest.MiniGames.titles }));
  const out = [];
  const list = opts.games || [0, 1, 2, 3, 4, 5, 6, 7];
  for (const i of list) {
    const tag = vp[0] + 'x' + vp[1] + (opts.rm ? '-rm' : '') + (opts.tap ? '' : '-idle');
    out.push(await runGame(page, i, tag, opts.tap ? opts.tap : 0));
    await sleep(400);
  }
  await ctx.close();
  return { vp, opts, info, out, errs };
}

/* child hammering the arena every `every` ms (also through the end celebration):
   mode 'spots' = random spots, 'targets' = a random spot snapped to the nearest live item */
async function runMash(page, i, every, mode) {
  await page.evaluate((i) => { window.__res = null; window.__mgTest.FX.clear(); window.__mgTest.play(i).then((r) => { window.__res = r; }); }, i);
  const t0 = Date.now();
  let res = null, taps = 0, doneAt = 0, shot = false;
  while (Date.now() - t0 < 22000) {
    res = await page.evaluate(() => window.__res);
    if (res) break;
    const t = await targets(page);
    if (t.done && !doneAt) doneAt = Date.now();
    if (doneAt && !shot && Date.now() - doneAt > 700 && every === 120 && mode === 'targets') { /* celebration: taps still sparkle */
      shot = true;
      await page.screenshot({ path: path.join(OUT, 'g' + i + '-mash-' + page.viewportSize().width + 'x' + page.viewportSize().height + '-celebrate.png') });
    }
    if (t.arena) {
      let x = t.arena.x + Math.random() * t.arena.w, y = t.arena.y + Math.random() * t.arena.h;
      if (mode === 'targets' && t.items.length) {
        let bd = Infinity;
        for (const it of t.items) { const d = Math.hypot(it.x - x, it.y - y); if (d < bd) { bd = d; x = it.x; y = it.y; } }
      }
      await page.mouse.click(x, y);
      taps++;
    }
    await sleep(every);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const hidden = await page.evaluate(() => { const m = document.querySelector('.mg'); return !m || m.hidden; });
  return { i, tag: 'mash', ms: res ? Math.round(res.ms) : null, said: res && res.said, taps, overflow, hidden };
}
/* variants: [[everyMs, 'targets' | 'spots'], ...] run one after another on one page */
async function mashSuite(browser, vp, variants, rm, games) {
  const { page, ctx, errs } = await openPage(browser, vp, rm);
  /* a tap racing onDone lands on the test page below: keep its game buttons from starting another game */
  await page.evaluate(() => { const g = document.getElementById('grid'); if (g) g.inert = true; });
  const out = [];
  for (const [every, mode] of variants) {
    for (const i of games || [0, 1, 2, 3, 4, 5, 6, 7]) { out.push(Object.assign(await runMash(page, i, every, mode), { tag: mode + '/' + every + 'ms' })); await sleep(300); }
  }
  await ctx.close();
  return { vp, opts: { rm, label: 'mash ' + variants.map((v) => v[1] + '/' + v[0] + 'ms').join(' + ') }, info: { count: 8, titles: new Array(8) }, out, errs };
}

/* counts live timeouts, animation frames and event listeners (window, document, the .mg overlay) */
const PROBE = `(() => {
  const live = new Set(), rafs = new Set(), lis = new Map();
  const st = window.setTimeout, ct = window.clearTimeout, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setTimeout = function (fn, ms) { const a = [].slice.call(arguments, 2); let id = 0;
    id = st.call(window, function () { live.delete(id); if (typeof fn === 'function') fn.apply(this, a); }, ms); live.add(id); return id; };
  window.clearTimeout = function (id) { live.delete(id); return ct.call(window, id); };
  window.requestAnimationFrame = function (fn) { let id = 0; id = ra.call(window, (t) => { rafs.delete(id); fn(t); }); rafs.add(id); return id; };
  window.cancelAnimationFrame = function (id) { rafs.delete(id); return ca.call(window, id); };
  const ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
  const fid = new WeakMap(); let n = 0;
  const key = (t, type, fn, opt) => { if (!fid.has(fn)) fid.set(fn, ++n); if (!fid.has(t)) fid.set(t, ++n);
    return fid.get(t) + '|' + type + '|' + fid.get(fn) + '|' + !!(opt === true || (opt && opt.capture)); };
  EventTarget.prototype.addEventListener = function (type, fn, opt) { if (fn) lis.set(key(this, type, fn, opt), this); return ael.call(this, type, fn, opt); };
  EventTarget.prototype.removeEventListener = function (type, fn, opt) { if (fn) lis.delete(key(this, type, fn, opt)); return rel.call(this, type, fn, opt); };
  const ours = (t) => t === window || t === document || (t && t.closest && !!t.closest('.mg'));
  window.__probe = () => { let l = 0; lis.forEach((t) => { if (ours(t)) l++; }); return { timeouts: live.size, rafs: rafs.size, listeners: l }; };
  window.__setHidden = (h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  };
})();`;

async function openPage(browser, vp, rm) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1, reducedMotion: rm ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.addInitScript(PROBE);
  await page.goto(BASE + '/tools/games-test.html');
  await page.waitForFunction(() => window.__mgTest && window.__mgTest.MiniGames, null, { timeout: 15000 });
  await page.evaluate(() => { const F = window.__mgTest.FX; F.sparkle(1, 1); F.clear(); }); /* FX canvas + its listeners exist from here on */
  return { ctx, page, errs };
}
/* start game i on the page; done count + say ids are kept in window.__g */
const startG = (page, i) => page.evaluate((i) => {
  const g = window.__g = { done: 0, said: [], t0: performance.now(), tDone: 0 };
  g.h = window.__mgTest.MiniGames.play({ index: i, say: (id) => g.said.push(id), onDone: () => { g.done++; g.tDone = performance.now() - g.t0; } });
}, i);
const domState = (page) => page.evaluate(() => {
  const m = document.querySelector('.mg'), a = m && m.querySelector('.mg-arena'), r = a && a.getBoundingClientRect();
  const items = a ? [...a.querySelectorAll('.mg-item:not(.is-spent):not(.is-flying)')].map((e) => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }) : [];
  return { overlays: document.querySelectorAll('.mg').length, hidden: !m || m.hidden, cls: m ? m.className : '', arenaKids: a ? a.childElementCount : -1,
    goalKids: m ? m.querySelector('.mg-goal').childElementCount : -1, title: m ? m.querySelector('.mg-title').textContent : '',
    arena: r ? [r.left, r.top, r.right, r.bottom] : null, items, overflow: document.documentElement.scrollWidth - window.innerWidth };
});

async function robustSuite(browser) {
  const checks = [];
  const ok = (cond, msg) => checks.push({ ok: !!cond, msg });
  const { ctx, page, errs } = await openPage(browser, [390, 844], false);
  const arenaTap = async () => { const d = await domState(page); if (d.arena) await page.mouse.click((d.arena[0] + d.arena[2]) / 2, (d.arena[1] + d.arena[3]) / 2); };

  /* 1. abort() mid-game, every game. Warm-up first: the shared overlay (and its one contextmenu listener) is created once and kept */
  await startG(page, 0); await sleep(200); await page.evaluate(() => { window.__g.h.abort(); window.__mgTest.FX.clear(); });
  for (let i = 0; i < 8; i++) {
    const base = await page.evaluate(() => window.__probe());
    await startG(page, i);
    await sleep(900); await arenaTap(); await sleep(120); await arenaTap(); await arenaTap(); await sleep(250);
    await page.evaluate(() => { window.__g.h.abort(); window.__mgTest.FX.clear(); });
    await sleep(60);
    const p = await page.evaluate(() => window.__probe()), d = await domState(page);
    ok(p.timeouts === base.timeouts && p.rafs === base.rafs && p.listeners === base.listeners,
      'abort g' + i + ': timers/rAF/listeners back to baseline ' + JSON.stringify(base) + ' -> ' + JSON.stringify(p));
    ok(d.hidden && d.arenaKids === 0 && d.goalKids === 0 && d.title === '' && d.overlays === 1 && !/mg--g/.test(d.cls), 'abort g' + i + ': overlay hidden and empty');
    await sleep(1400);
    ok((await page.evaluate(() => window.__g.done)) === 0, 'abort g' + i + ': onDone never fires');
  }

  /* 2. play() twice in a row: the first is replaced, its stale abort() is harmless, only the second finishes */
  await page.evaluate(() => {
    const T = window.__mgTest.MiniGames, g = window.__g2 = { d1: 0, d2: 0, s: [] };
    g.h1 = T.play({ index: 0, say: (id) => g.s.push(id), onDone: () => g.d1++ });
    g.h2 = T.play({ index: 7, say: (id) => g.s.push(id), onDone: () => g.d2++ });
    g.h1.abort();
  });
  let d = await domState(page);
  ok(d.overlays === 1 && !d.hidden && /mg--g7/.test(d.cls) && !/mg--g0/.test(d.cls) && d.title === 'Sytytä palatsin valot!', 'play twice: one overlay showing game 7');
  for (let k = 0; k < 9; k++) { await arenaTap(); await sleep(700); }
  await page.waitForFunction(() => window.__g2.d2 === 1, null, { timeout: 21000 }).catch(() => {});
  const g2 = await page.evaluate(() => ({ d1: window.__g2.d1, d2: window.__g2.d2, s: window.__g2.s }));
  ok(g2.d1 === 0 && g2.d2 === 1 && g2.s.join() === 'game-0,game-7', 'play twice: onDone only for the second ' + JSON.stringify(g2));

  /* 3. resize / orientation change mid-game: items stay inside the arena, no horizontal scroll, game still ends */
  for (let i = 0; i < 8; i++) {
    await page.setViewportSize({ width: 390, height: 844 });
    await startG(page, i);
    await sleep(1200);
    for (const vp of [[740, 360], [1024, 768], [360, 740]]) {
      await page.setViewportSize({ width: vp[0], height: vp[1] });
      /* resize events / ResizeObserver run with the next rendered frame, which can lag under load: poll up to 2.5 s */
      let out = [];
      for (const t1 = Date.now(); Date.now() - t1 < 2500;) {
        await sleep(250);
        d = await domState(page);
        out = d.items.filter((c) => c[0] < d.arena[0] - 1 || c[0] > d.arena[2] + 1 || (i > 1 && (c[1] < d.arena[1] - 1 || c[1] > d.arena[3] + 1)));
        if (!out.length) break;
      }
      ok(!d.hidden && out.length === 0 && d.overflow <= 0, 'resize g' + i + ' -> ' + vp.join('x') + ': ' + d.items.length + ' items inside arena, overflow ' + d.overflow + (out.length ? ' OUTSIDE ' + JSON.stringify(out) : ''));
    }
    for (let k = 0; k < 10; k++) { const t = await targets(page); if (t.done || !t.arena) break;
      const it = t.items[0]; await page.mouse.click(it ? it.x : t.arena.x + t.arena.w / 2, it ? it.y : t.arena.y + t.arena.h / 3); await sleep(800); }
    await page.waitForFunction(() => window.__g.done === 1, null, { timeout: 21000 }).catch(() => {});
    ok((await page.evaluate(() => window.__g.done)) === 1, 'resize g' + i + ': game still finishes once');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  /* 4a. page hidden mid-game: the time limit pauses */
  await startG(page, 3);
  await sleep(1000);
  await page.evaluate(() => window.__setHidden(true));
  await sleep(6000);
  const h1 = await page.evaluate(() => window.__g.done);
  await page.evaluate(() => window.__setHidden(false));
  await page.waitForFunction(() => window.__g.done === 1, null, { timeout: 25000 }).catch(() => {});
  const ta = await page.evaluate(() => ({ done: window.__g.done, t: Math.round(window.__g.tDone) }));
  ok(h1 === 0 && ta.done === 1 && ta.t >= 22000 && ta.t <= 27000, 'hidden 6 s mid-game: time limit paused, auto-finish after ' + (ta.t / 1000).toFixed(1) + ' s (16 s + 6 s hidden + fill)');
  /* 4b. page hidden during the end celebration: onDone waits until visible */
  await startG(page, 5);
  await page.waitForFunction(() => document.querySelector('.mg-arena.is-done'), null, { timeout: 20000 });
  await page.evaluate(() => window.__setHidden(true));
  await sleep(2500);
  const h2 = await page.evaluate(() => window.__g.done);
  await page.evaluate(() => window.__setHidden(false));
  await sleep(150);
  const h3 = await page.evaluate(() => window.__g.done);
  ok(h2 === 0 && h3 === 1, 'hidden during celebration: onDone held (' + h2 + ') then delivered on return (' + h3 + ')');

  await ctx.close();
  return { vp: [390, 844], opts: { label: 'robustness' }, info: { count: 8, titles: new Array(8) }, out: [], checks, errs };
}

/* FX on the light page: finale show + confetti screenshots (no assertions besides console errors) */
async function fxShots(browser, vp, rm) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, reducedMotion: rm ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(BASE + '/tools/games-test.html');
  await page.waitForFunction(() => window.__mgTest && window.__mgTest.FX, null, { timeout: 15000 });
  const tag = vp[0] + 'x' + vp[1] + (rm ? '-rm' : '');
  await page.evaluate(() => window.__mgTest.FX.show(5000));
  await sleep(1600);
  await page.screenshot({ path: path.join(OUT, 'fx-show-' + tag + '-a.png') });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'fx-show-' + tag + '-b.png') });
  await sleep(2600);
  await page.evaluate(() => { const F = window.__mgTest.FX; F.clear(); F.confetti(70); F.burst(innerWidth * 0.3, innerHeight * 0.4); F.sparkle(innerWidth * 0.7, innerHeight * 0.4); });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, 'fx-confetti-' + tag + '.png') });
  await ctx.close();
  return { vp, opts: { fx: true, rm }, info: { count: 8, titles: new Array(8) }, out: [], errs };
}

(async () => {
  const browser = await chromium.launch();
  const only = ONLY ? ONLY.split(',').map(Number) : null;
  const jobs = MASH_ONLY ? [] : [
    suite(browser, [390, 844], { tap: 650, games: only }),
    suite(browser, [1024, 768], { tap: 650, games: only })
  ];
  if (!QUICK) {
    jobs.push(mashSuite(browser, [390, 844], [[120, 'targets'], [60, 'targets']], false, only));
    jobs.push(mashSuite(browser, [390, 844], [[120, 'spots'], [60, 'spots']], false, only));
    jobs.push(mashSuite(browser, [1024, 768], [[120, 'targets'], [60, 'spots']], false, only));
    jobs.push(mashSuite(browser, [360, 740], [[60, 'targets'], [120, 'spots']], true, only));
    jobs.push(mashSuite(browser, [768, 1024], [[60, 'targets']], false, only));
    jobs.push(mashSuite(browser, [740, 360], [[120, 'targets'], [60, 'spots']], false, only));
  }
  if (!QUICK && !MASH_ONLY) {
    jobs.push(suite(browser, [360, 740], { tap: 900, rm: true, games: only }));
    jobs.push(suite(browser, [768, 1024], { tap: 650, games: only }));
    jobs.push(suite(browser, [740, 360], { tap: 650, games: only }));
    jobs.push(suite(browser, [390, 844], { tap: 0, games: only }));
    jobs.push(robustSuite(browser));
    jobs.push(fxShots(browser, [390, 844], false));
    jobs.push(fxShots(browser, [1024, 768], true));
  }
  const results = await Promise.all(jobs);
  let fail = 0;
  for (const r of results) {
    console.log('== ' + r.vp.join('x') + (r.opts.rm ? ' reduced-motion' : '') + (r.opts.label ? ' ' + r.opts.label : (r.opts.fx ? ' FX shots' : (r.opts.tap ? ' tap/' + r.opts.tap + 'ms' : ' no taps'))));
    if (r.info.count !== 8 || r.info.titles.length !== 8) { fail++; console.log('  FAIL count/titles', r.info); }
    for (const g of r.out) {
      const ok = g.ms != null && g.ms <= MAX_MS && g.ms >= MIN_MS && g.said === 'game-' + g.i && g.overflow <= 0 && g.hidden;
      if (!ok) fail++;
      console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' game ' + g.i + (g.tag === 'mash' || /ms$/.test(g.tag) ? ' [' + g.tag + ']' : '') + ': ' + (g.ms == null ? 'no onDone' : (g.ms / 1000).toFixed(1) + ' s') +
        ', taps ' + g.taps + ', say ' + g.said + ', overflow ' + g.overflow + ', closed ' + g.hidden);
    }
    for (const c of r.checks || []) { if (!c.ok) fail++; console.log('  ' + (c.ok ? 'ok  ' : 'FAIL') + ' ' + c.msg); }
    const errs = r.errs.filter((e) => !/\[vite\]/.test(e));
    if (errs.length) { fail++; console.log('  console:', errs); }
  }
  await browser.close();
  /* durations table (s): one row per run kind, one column per game */
  console.log('\n== onDone (s)          g0    g1    g2    g3    g4    g5    g6    g7');
  for (const r of results) {
    const rows = new Map();
    for (const g of r.out) {
      const key = r.vp.join('x') + (r.opts.rm ? ' rm' : '') + ' ' + (/ms$/.test(g.tag) ? g.tag : (r.opts.tap ? 'tap/' + r.opts.tap + 'ms' : 'no taps'));
      if (!rows.has(key)) rows.set(key, new Array(8).fill('  -  '));
      rows.get(key)[g.i] = g.ms == null ? ' none' : (g.ms / 1000).toFixed(1).padStart(5);
    }
    rows.forEach((v, k) => console.log('   ' + k.padEnd(22) + v.join(' ')));
  }
  console.log(fail ? 'FAILURES: ' + fail : 'ALL OK');
  process.exit(fail ? 1 : 0);
})();
