/* Girl minigames QA (OWNER: games-girl). Plays every girl game with child-like automated gestures (rub, drag,
   tap, one wrong drop) in Chromium and checks:
     - onDone arrives 10–20 s after start, say('game-girl-<i>') once
     - pointerdown -> first visual change inside the game stage happens in the same task, before the next frame
       (latency = mutation time - event.timeStamp, must be <= 17 ms)
     - no console errors / warnings, no horizontal scroll, overlay hidden after onDone
     - idle run (390x844 only, unless --quick): an idle hint glove appears, the game auto-finishes by ~20 s
   Viewports: 390x844, 1024x768, 360x740 (reduced motion), 740x360. Screenshots: mid + done per game/viewport.

   Usage (dev server must serve the project): npx vite --host 127.0.0.1 --port 5205
     node tools/games-girl-test.cjs [outDir=../qa/v3-games-girl] [--quick] [--only=0,3] [--vp=390x844]
   env BASE=http://127.0.0.1:5205 */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:5205';
const OUT = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'qa', 'v3-games-girl'));
const QUICK = process.argv.includes('--quick');
const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean).map(Number);
const VPONLY = (process.argv.find((a) => a.startsWith('--vp=')) || '').slice(5);
const GAMES = ONLY.length ? ONLY : [0, 1, 2, 3, 4, 5];
const VPS = [
  { w: 390, h: 844, rm: false }, { w: 1024, h: 768, rm: false }, { w: 360, h: 740, rm: true }, { w: 740, h: 360, rm: false }
].filter((v) => !VPONLY || VPONLY === v.w + 'x' + v.h);
const MIN_MS = 10000, MAX_MS = 20000, LAT_MAX = 17;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/* centres of matching elements (viewport px) */
function centers(page, sel) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, id: e.dataset ? (e.dataset.id || e.dataset.kind || '') : '' };
  }), sel);
}
const count = (page, sel) => page.evaluate((sel) => document.querySelectorAll(sel).length, sel);
const finished = (page) => page.evaluate(() => !!window.__res || !!document.querySelector('.mg-arena.is-done'));

async function tap(page, p) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(60); await page.mouse.up(); }
async function drag(page, a, b, ms) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const n = Math.max(6, Math.round(ms / 20));
  for (let i = 1; i <= n; i++) { const p = lerp(a, b, i / n); await page.mouse.move(p.x, p.y); await sleep(20); }
  await sleep(40);
  await page.mouse.up();
}
/* scrub around c until done() or maxMs; speed ~ a child brushing (about 450 px/s) */
async function scrub(page, c, amp, done, maxMs) {
  await page.mouse.move(c.x - amp, c.y);
  await page.mouse.down();
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < maxMs) {
    const ph = (k % 16) / 16, x = c.x + Math.sin(ph * Math.PI * 2) * amp, y = c.y + Math.cos(ph * Math.PI * 4) * amp * 0.25;
    await page.mouse.move(x, y);
    await sleep(18);
    if (++k % 8 === 0 && await done()) break;
  }
  await page.mouse.up();
}

/* ---------- one bot per game: plays like a deliberate 4-6-year-old ---------- */
const BOTS = [
  async function brush(page, shot) {
    for (let n = 0; n < 12 && !(await finished(page)); n++) { /* until every lock is smooth (slow CPU: more strokes) */
      const locks = await centers(page, '.gp-lock:not(.is-done)');
      if (!locks.length) break;
      const c = locks[0];
      await scrub(page, c, 30, async () => (await count(page, '.gp-lock:not(.is-done)')) < locks.length, 3000);
      if (n === 2) await shot('mid');
      await sleep(420);
    }
    await page.waitForSelector('.gp-treat', { timeout: 3000 }).catch(() => {});
    await sleep(900);
    for (let k = 0; k < 2; k++) { /* two treats */
      const t = await centers(page, '.gp-treat:not(.is-picked):not(.is-gone)');
      if (t.length) await tap(page, t[(Math.random() * t.length) | 0]);
      await sleep(800);
    }
  },
  async function feed(page, shot) {
    const WANT = { carrot: 'bunny', strawberry: 'bunny', apple: 'pony', hay: 'pony', fish: 'kitten', milk: 'kitten' };
    let wrongDone = false, n = 0;
    while (n < 6 && !(await finished(page))) {
      const foods = await centers(page, '.gf-food:not(.is-eaten)');
      const animals = await centers(page, '.gf-animal');
      if (!foods.length) { await sleep(200); continue; }
      const f = foods[0];
      if (!wrongDone) { /* one wrong drop: bounces back with a giggle */
        wrongDone = true;
        const wrong = animals.find((a) => a.id !== WANT[f.id]);
        await drag(page, f, wrong, 420);
        await sleep(700);
        continue;
      }
      const a = animals.find((q) => q.id === WANT[f.id]);
      if (n === 3) { await tap(page, f); } /* a tap also feeds */
      else await drag(page, f, { x: a.x, y: a.y }, 480);
      n++;
      if (n === 2) await shot('mid');
      await sleep(n === 3 ? 1150 : 650);
    }
  },
  async function bath(page, shot) {
    for (let n = 0; n < 4 && !(await finished(page)); n++) {
      const spots = await centers(page, '.gd-spot:not(.is-foam)');
      if (!spots.length) break;
      await scrub(page, spots[0], 26, async () => (await count(page, '.gd-spot:not(.is-foam)')) < spots.length, 4000);
      await sleep(380);
    }
    await shot('mid');
    await page.waitForSelector('.gd-shower.is-ready', { timeout: 3000 }).catch(() => {});
    await sleep(500);
    const sh = await centers(page, '.gd-shower');
    if (sh.length) await tap(page, sh[0]);
    await page.waitForSelector('.gd-towel:not(.is-away)', { timeout: 4000 }).catch(() => {});
    await sleep(400);
    for (let n = 0; n < 4 && !(await finished(page)); n++) {
      const spots = await centers(page, '.gd-spot:not(.is-fluff)');
      if (!spots.length) break;
      await scrub(page, spots[0], 26, async () => (await count(page, '.gd-spot:not(.is-fluff)')) < spots.length, 4000);
      await sleep(380);
    }
  },
  async function cake(page, shot) {
    const cake = (await centers(page, '.gk-cake'))[0];
    const targets = [[-0.28, 0.25], [0.2, -0.38], [0.3, 0.28], [-0.2, -0.38], [0, 0.18], [-0.05, -0.1], [0.12, 0.32]];
    for (let n = 0; n < 7 && !(await finished(page)); n++) {
      const slots = await centers(page, '.gk-slot');
      const s = slots[n % slots.length];
      if (n === 4) await tap(page, s); /* tap = hops onto a free spot */
      else {
        const t = targets[n];
        await drag(page, s, { x: cake.x + t[0] * cake.w, y: cake.y + t[1] * cake.h }, 520);
      }
      if (n === 3) await shot('mid');
      await sleep(820);
    }
  },
  async function meadow(page, shot) {
    for (let n = 0; n < 6 && !(await finished(page)); n++) {
      const spots = await page.evaluate(() => [...document.querySelectorAll('.gm-spot')].map((e) => {
        const m = e.querySelector('.gm-mound').getBoundingClientRect();
        return { x: m.left + m.width / 2, y: m.top + m.height / 2, seed: e.classList.contains('is-seed'), bloom: e.classList.contains('is-bloom') };
      }));
      const sp = spots.find((q) => !q.bloom);
      if (!sp) break;
      if (!sp.seed) { await tap(page, sp); await sleep(520); }
      if (n === 1 || n === 4) { /* water with the can */
        const can = (await centers(page, '.gm-can'))[0];
        await drag(page, { x: can.x - 10, y: can.y }, { x: sp.x + 40, y: sp.y - 120 }, 640);
      } else await tap(page, sp);
      if (n === 3) await shot('mid');
      await sleep(820);
    }
  },
  async function mosque(page, shot) {
    for (let n = 0; n < 10 && !(await finished(page)); n++) {
      const w = await page.evaluate(() => [...document.querySelectorAll('.gc-win:not(.on)')].map((e) => {
        const r = e.querySelector('.gc-lit').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }));
      if (!w.length) break;
      await tap(page, w[(Math.random() * w.length) | 0]);
      if (n === 4) await shot('mid');
      await sleep(820);
    }
    await sleep(700);
    const star = await page.evaluate(() => { const r = document.querySelector('.gc-star').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await tap(page, star);
    await sleep(600);
    const a = await page.evaluate(() => { const r = document.querySelector('.mg-arena').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await tap(page, { x: a.x + a.w * 0.3, y: a.y + a.h * 0.25 }); /* celebration tap = extra firework */
  }
];

async function openPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: vp.rm ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(BASE + '/tools/games-girl-test.html');
  await page.waitForFunction(() => window.__gg && window.__gg.MiniGames, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => { document.getElementById('grid').inert = true; }); /* stray taps after onDone */
  return { ctx, page, errs };
}

async function runGame(page, i, tag) {
  await page.evaluate((i) => { window.__res = null; window.__gg.lat.length = 0; window.__gg.play(i).then((r) => { window.__res = r; }); }, i);
  const t0 = Date.now();
  await page.waitForSelector('.gg-stage', { timeout: 3000 });
  await sleep(1200); /* the child listens to the title for a moment */
  let shotDone = false;
  const shot = async (k) => { await sleep(200); await page.screenshot({ path: path.join(OUT, 'g' + i + '-' + tag + '-' + k + '.png') }); };
  const bot = BOTS[i](page, shot).catch((e) => ({ botError: e.message }));
  let res = null;
  while (Date.now() - t0 < 24000) {
    res = await page.evaluate(() => window.__res);
    if (res) break;
    if (!shotDone && await page.evaluate(() => !!document.querySelector('.mg-arena.is-done'))) { shotDone = true; await sleep(450); await shot('done'); }
    await sleep(120);
  }
  const b = await bot;
  const lat = await page.evaluate(() => window.__gg.lat.slice());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const hidden = await page.evaluate(() => { const m = document.querySelector('.mg'); return !m || m.hidden; });
  const ms = lat.filter((l) => l.ms != null).map((l) => l.ms);
  return { i, tag, ms: res ? Math.round(res.ms) : null, said: res && res.said, overflow, hidden, botError: b && b.botError,
    downs: lat.length, noChange: lat.filter((l) => l.ms == null || !l.beforeFrame).length,
    latMax: ms.length ? +Math.max(...ms).toFixed(1) : null, latMed: ms.length ? +ms.sort((a, c) => a - c)[ms.length >> 1].toFixed(1) : null,
    handlerMax: lat.length ? +Math.max(...lat.map((l) => l.handler || 0)).toFixed(1) : null };
}

async function runIdle(page, i, tag) {
  await page.evaluate((i) => { window.__res = null; window.__gg.play(i).then((r) => { window.__res = r; }); }, i);
  const t0 = Date.now();
  let hint = false, shot = false, res = null;
  while (Date.now() - t0 < 23000) {
    res = await page.evaluate(() => window.__res);
    if (res) break;
    const vis = await page.evaluate(() => !!document.querySelector('.mg-hint'));
    if (vis && Date.now() - t0 > 3500) {
      hint = true;
      if (!shot) { shot = true; await sleep(500); await page.screenshot({ path: path.join(OUT, 'g' + i + '-' + tag + '-idlehint.png') }); }
    }
    await sleep(250);
  }
  return { i, tag: tag + '-idle', ms: res ? Math.round(res.ms) : null, said: res && res.said, idleHint: hint };
}

(async () => {
  const browser = await chromium.launch();
  const rows = [], fails = [], allErrs = [];
  for (const vp of VPS) {
    const tag = vp.w + 'x' + vp.h + (vp.rm ? '-rm' : '');
    const { ctx, page, errs } = await openPage(browser, vp);
    for (const i of GAMES) {
      const r = await runGame(page, i, tag);
      rows.push(r);
      const bad = [];
      if (r.ms == null || r.ms < MIN_MS || r.ms > MAX_MS) bad.push('time ' + r.ms);
      if (r.said !== 'game-girl-' + i) bad.push('say ' + r.said);
      if (r.overflow > 0) bad.push('overflow ' + r.overflow);
      if (!r.hidden) bad.push('overlay visible');
      if (r.noChange) bad.push(r.noChange + ' touches without same-frame change');
      if (r.latMax != null && r.latMax > LAT_MAX) bad.push('latency ' + r.latMax + ' ms');
      if (r.botError) bad.push('bot: ' + r.botError);
      if (bad.length) fails.push(tag + ' g' + i + ': ' + bad.join(', '));
      console.log(tag, 'g' + i, (r.ms / 1000).toFixed(1) + 's', 'downs', r.downs, 'lat max/med', r.latMax + '/' + r.latMed + ' ms', bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      await sleep(300);
    }
    if (!QUICK && vp.w === 390) {
      for (const i of GAMES) {
        const r = await runIdle(page, i, tag);
        rows.push(r);
        const bad = [];
        if (r.ms == null || r.ms > 21000) bad.push('idle finish ' + r.ms);
        if (!r.idleHint) bad.push('no idle hint');
        if (bad.length) fails.push(tag + ' idle g' + i + ': ' + bad.join(', '));
        console.log(tag, 'idle g' + i, (r.ms / 1000).toFixed(1) + 's', 'hint', r.idleHint, bad.length ? 'FAIL ' + bad.join('; ') : 'ok');
      }
    }
    if (errs.length) { allErrs.push(...errs.map((e) => tag + ' ' + e)); fails.push(tag + ': ' + errs.length + ' console errors'); }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ rows, fails, errors: allErrs }, null, 1));
  if (allErrs.length) console.log('console:\n  ' + allErrs.slice(0, 20).join('\n  '));
  console.log(fails.length ? 'FAILURES:\n  ' + fails.join('\n  ') : 'ALL OK (' + rows.length + ' runs)');
  process.exit(fails.length ? 1 : 0);
})();
