/* Settings sheet checks + screenshots (dev tool, not part of the app).
   Needs the Vite dev server:  npx vite --host 127.0.0.1 --port 5102
   Run:  node tools/settings-shots.cjs [outDir] [baseUrl]
   Uses Chromium's fake microphone, so recording start/stop/save/play/delete runs for real. */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || 'qa-settings');
const BASE = process.argv[3] || 'http://127.0.0.1:5102';
const URL = BASE + '/tools/settings-test.html';
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(ok, msg) { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; }

async function page(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: !!opts.touch, reducedMotion: 'reduce' });
  if (opts.grantMic !== false) await ctx.grantPermissions(['microphone'], { origin: BASE });
  if (opts.initScript) await ctx.addInitScript(opts.initScript);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await pg.goto(URL);
  await pg.waitForFunction(() => window.__t);
  await pg.evaluate(() => document.fonts.ready);
  return { ctx, pg, errs };
}

async function noHScroll(pg, label) {
  const r = await pg.evaluate(() => {
    const b = document.querySelector('.set-body');
    return { doc: document.documentElement.scrollWidth - innerWidth, body: b ? b.scrollWidth - b.clientWidth : 0 };
  });
  check(r.doc <= 0 && r.body <= 0, label + ': no horizontal scroll (doc ' + r.doc + ', sheet ' + r.body + ')');
}

async function minSizes(pg, label) {
  const bad = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('#settings button, #settings summary, #settings .set-switch, #settings input').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return; /* not rendered (hidden / closed details) */
      const min = el.matches('.set-close, .set-seg button, .tbtn, .sbtn-stop, .set-switch') ? 64 : 48;
      if (r.height < min - 0.5) out.push((el.className || el.tagName) + ' ' + Math.round(r.height));
    });
    return out;
  });
  check(!bad.length, label + ': hit targets >= 48 px (primary >= 64) ' + (bad.length ? JSON.stringify(bad) : ''));
}

async function fullShot(pg, file) {
  /* expand the scroll container so one screenshot shows the whole sheet */
  await pg.evaluate(() => {
    const s = document.querySelector('.set-sheet'), b = document.querySelector('.set-body');
    document.querySelector('#settings').style.position = 'absolute';
    document.querySelector('#settings').style.height = (b.scrollHeight + 160) + 'px';
    s.style.maxHeight = 'none';
  });
  await pg.screenshot({ path: path.join(OUT, file), fullPage: true });
  await pg.evaluate(() => {
    document.querySelector('#settings').style.cssText = '';
    document.querySelector('.set-sheet').style.maxHeight = '';
  });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

  for (const vp of [{ width: 360, height: 740 }, { width: 1024, height: 768 }]) {
    const tag = vp.width + 'x' + vp.height;
    const { ctx, pg, errs } = await page(browser, vp);
    await pg.click('#openBtn');
    await pg.waitForSelector('.set-sheet');
    check(await pg.evaluate(() => window.__t.settings.isSettingsOpen()), tag + ': opens');
    check(await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('set-sheet')), tag + ': focus moves into the sheet');
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(OUT, tag + '-open.png') });
    await noHScroll(pg, tag);
    await minSizes(pg, tag);

    if (vp.width === 360) {
      /* name: trims, live save, onChange */
      await pg.fill('#setName', '  Sara   Amina ');
      let st = await pg.evaluate(() => ({ name: window.__t.state.name, log: window.__t.log.slice() }));
      check(st.name === 'Sara Amina' && st.log.includes('change:name') && st.log.includes('save'), 'name trimmed + saved + onChange: ' + JSON.stringify(st.name));
      await pg.fill('#setName', 'x'.repeat(40));
      check((await pg.evaluate(() => window.__t.state.name.length)) === 24, 'name maxlength 24');
      await pg.fill('#setName', 'Amina');

      /* switches */
      for (const key of ['speech', 'slow', 'translit', 'sfx']) {
        const before = await pg.evaluate((k) => window.__t.state[k], key);
        await pg.locator('.set-switch-input[data-key="' + key + '"]').click({ force: true });
        const after = await pg.evaluate((k) => ({ v: window.__t.state[k], last: window.__t.log[window.__t.log.length - 1] }), key);
        check(after.v === !before && after.last === 'change:' + key, 'switch ' + key + ' toggles + onChange');
      }
      /* every */
      await pg.click('[data-every="2"]');
      st = await pg.evaluate(() => ({ every: window.__t.state.every, p: document.querySelector('[data-every="2"]').getAttribute('aria-pressed'), last: window.__t.log[window.__t.log.length - 1] }));
      check(st.every === 2 && st.p === 'true' && st.last === 'change:every', 'every=2 + aria-pressed + onChange');
      await pg.screenshot({ path: path.join(OUT, tag + '-toggled.png') });
      await pg.click('[data-every="1"]');

      /* reset confirm flow */
      await pg.locator('[data-act="reset"]').scrollIntoViewIfNeeded();
      await pg.click('[data-act="reset"]');
      check(await pg.isVisible('#setResetConfirm'), 'reset asks for confirmation');
      await pg.locator('#setResetConfirm').scrollIntoViewIfNeeded();
      await pg.screenshot({ path: path.join(OUT, tag + '-reset-confirm.png') });
      await pg.click('[data-act="resetno"]');
      check(!(await pg.isVisible('#setResetConfirm')) && !(await pg.evaluate(() => window.__t.log.includes('reset'))), 'Peru cancels reset');
      await pg.click('[data-act="reset"]');
      await pg.click('[data-act="resetyes"]');
      st = await pg.evaluate(() => ({ log: window.__t.log.slice(), stars: window.__t.state.stars, msg: document.querySelector('[data-reset-msg]').textContent }));
      check(st.log.includes('reset') && st.stars === 0 && /nollattiin/.test(st.msg), 'Kyllä, nollaa calls onReset');

      /* sound test panel */
      await pg.locator('[data-test="sfx"]').scrollIntoViewIfNeeded();
      await pg.click('[data-test="sfx"]');
      await pg.waitForFunction(() => { const r = document.querySelector('.test-result'); return r && !r.hidden && r.dataset.tone !== 'wait'; }, null, { timeout: 8000 }).catch(() => {});
      check(/Efekti:/.test(await pg.textContent('.test-result')), 'test Efekti shows detail: ' + (await pg.textContent('.test-result')));
      await pg.click('[data-test="recitation"]');
      await pg.waitForFunction(() => document.querySelector('.test-result').dataset.tone !== 'wait', null, { timeout: 20000 }).catch(() => {});
      check(/Resitaatio:/.test(await pg.textContent('.test-result')), 'test Resitaatio shows detail: ' + (await pg.textContent('.test-result')));
      await pg.click('[data-test="fi"]');
      await pg.waitForFunction(() => document.querySelector('.test-result').dataset.tone !== 'wait', null, { timeout: 20000 }).catch(() => {});
      check(/Suomen puhe:/.test(await pg.textContent('.test-result')), 'test Suomen puhe: ' + (await pg.textContent('.test-result')));
      const diag = await pg.$$eval('.diag li', (els) => els.map((e) => e.textContent));
      check(diag.length >= 5, 'diagnostics list: ' + JSON.stringify(diag));
      await pg.locator('.set-card-test').scrollIntoViewIfNeeded();
      await pg.screenshot({ path: path.join(OUT, tag + '-test.png') });

      /* recording: start -> recording UI -> stop+save -> status -> play -> delete */
      const row = '.rec-row[data-id="shahada-1"]';
      await pg.locator(row).scrollIntoViewIfNeeded();
      await pg.click(row + ' [data-act="rec"]');
      await pg.waitForSelector(row + ' .rec-live:not([hidden])', { timeout: 5000 }).catch(() => {});
      check(await pg.isVisible(row + ' [data-act="stoprec"]'), 'recording shows Lopeta');
      check(await pg.evaluate(() => document.querySelector('.rec-row[data-id="praise-1"] [data-act="rec"]').disabled), 'other rows locked while recording');
      await pg.waitForTimeout(1600);
      check(/[1-9] s/.test(await pg.textContent(row + ' .rec-sec')), 'elapsed seconds tick: ' + (await pg.textContent(row + ' .rec-sec')));
      await pg.screenshot({ path: path.join(OUT, tag + '-recording.png') });
      await pg.click(row + ' [data-act="stoprec"]');
      await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', row, { timeout: 8000 }).catch(() => {});
      st = await pg.evaluate((r) => ({ st: document.querySelector(r).dataset.st, status: document.querySelector(r + ' .rec-status').textContent,
        del: !document.querySelector(r + ' [data-act="del"]').hidden, msg: document.querySelector(r + ' .rec-msg').textContent }), row);
      check(st.st === 'own' && st.status === 'Oma ääni' && st.del, 'saved: status Oma ääni + delete visible (' + st.msg + ')');
      check(await pg.evaluate(() => (window.__t.engine.diagnostics().recordings || []).includes('shahada-1')), 'engine.refreshRecordings() picked the recording up');
      await pg.screenshot({ path: path.join(OUT, tag + '-saved.png') });
      await pg.click(row + ' [data-act="play"]');
      await pg.waitForTimeout(300);
      check(await pg.evaluate((r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), row), 'Kuuntele -> playing state');
      await pg.waitForFunction((r) => !document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), row, { timeout: 8000 }).catch(() => {});
      check(!(await pg.evaluate((r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), row)), 'playback finished and button reset');
      await pg.click(row + ' [data-act="del"]');
      check(await pg.isVisible(row + ' .rec-confirm'), 'delete asks for confirmation');
      await pg.screenshot({ path: path.join(OUT, tag + '-delete-confirm.png') });
      await pg.click(row + ' [data-act="delyes"]');
      await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'file', row, { timeout: 5000 }).catch(() => {});
      check((await pg.textContent(row + ' .rec-status')) === 'Valmis ääni', 'deleted: back to Valmis ääni');
      check(await pg.evaluate(() => (window.__t.engine.diagnostics().recordings || []).indexOf('shahada-1') < 0), 'engine forgot the deleted recording');
      /* 15 s auto-stop saves the take by itself */
      const row2 = '.rec-row[data-id="turn-1"]';
      await pg.locator(row2).scrollIntoViewIfNeeded();
      await pg.click(row2 + ' [data-act="rec"]');
      await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', row2, { timeout: 22000 }).catch(() => {});
      st = await pg.evaluate((r) => ({ st: document.querySelector(r).dataset.st, msg: document.querySelector(r + ' .rec-msg').textContent, live: !document.querySelector(r + ' .rec-live').hidden }), row2);
      check(st.st === 'own' && /täynnä/.test(st.msg) && !st.live, 'auto-stop at 15 s saves: ' + st.msg);
      await pg.click(row2 + ' [data-act="del"]');
      await pg.click(row2 + ' [data-act="delyes"]');
      await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'file', row2, { timeout: 5000 }).catch(() => {});
      /* name row: no file -> "Ei ääntä", Kuuntele disabled */
      check(await pg.evaluate(() => { const r = document.querySelector('.rec-row[data-id="name"]'); return r.dataset.st === 'none' && r.querySelector('[data-act="play"]').disabled; }), 'name row: Ei ääntä + Kuuntele disabled');

      /* open the long groups + tips for the full screenshot */
      await pg.evaluate(() => document.querySelectorAll('.set-details').forEach((d) => { d.open = true; }));
      await noHScroll(pg, tag + ' (all details open)');
      await minSizes(pg, tag + ' (all details open)');
      await fullShot(pg, tag + '-full.png');

      /* Escape closes + focus returns to the opener */
      await pg.keyboard.press('Escape');
      check(!(await pg.evaluate(() => window.__t.settings.isSettingsOpen())) && await pg.isHidden('#settings'), 'Escape closes');
      check(await pg.evaluate(() => document.activeElement && document.activeElement.id === 'openBtn'), 'focus back on opener');
      /* backdrop tap closes */
      await pg.click('#openBtn');
      await pg.mouse.click(4, 4);
      check(!(await pg.evaluate(() => window.__t.settings.isSettingsOpen())), 'backdrop tap closes');
      /* close button */
      await pg.click('#openBtn');
      await pg.click('.set-close');
      check(!(await pg.evaluate(() => window.__t.settings.isSettingsOpen())), 'close button closes');
      /* Tab stays inside */
      await pg.click('#openBtn');
      let inside = true;
      for (let i = 0; i < 60; i++) {
        await pg.keyboard.press('Tab');
        if (!(await pg.evaluate(() => document.querySelector('#settings').contains(document.activeElement)))) { inside = false; break; }
      }
      check(inside, 'Tab focus stays inside the sheet');
      await pg.keyboard.press('Escape');
    } else {
      await pg.evaluate(() => document.querySelectorAll('.set-details').forEach((d) => { d.open = true; }));
      await noHScroll(pg, tag + ' (all details open)');
      await fullShot(pg, tag + '-full.png');
    }
    check(!errs.length, tag + ': no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  /* mic permission denied -> friendly message */
  {
    const { ctx, pg, errs } = await page(browser, { width: 390, height: 844 }, {
      initScript: () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); }
    });
    await pg.click('#openBtn');
    const row = '.rec-row[data-id="shahada-2"]';
    await pg.locator(row).scrollIntoViewIfNeeded();
    await pg.click(row + ' [data-act="rec"]');
    await pg.waitForFunction((r) => /luvan/.test(document.querySelector(r + ' .rec-msg').textContent), row, { timeout: 4000 }).catch(() => {});
    check(/Mikrofoni vaatii luvan ja HTTPS-osoitteen/.test(await pg.textContent(row + ' .rec-msg')), 'denied mic: friendly message');
    check(!(await pg.evaluate((r) => document.querySelector(r + ' [data-act="rec"]').disabled, row)), 'denied mic: can retry');
    await pg.screenshot({ path: path.join(OUT, 'denied.png') });
    check(!errs.length, 'denied: no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }
  /* no MediaRecorder (unsupported browser / plain http) */
  {
    const { ctx, pg, errs } = await page(browser, { width: 390, height: 844 }, { initScript: () => { delete window.MediaRecorder; } });
    await pg.click('#openBtn');
    await pg.locator('.set-card-rec').scrollIntoViewIfNeeded();
    check(await pg.isVisible('[data-rec-note]'), 'unsupported: explanation shown');
    check(await pg.evaluate(() => Array.from(document.querySelectorAll('[data-act="rec"]')).every((b) => b.disabled)), 'unsupported: Nauhoita disabled');
    await pg.screenshot({ path: path.join(OUT, 'unsupported.png') });
    check(!errs.length, 'unsupported: no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'all passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
