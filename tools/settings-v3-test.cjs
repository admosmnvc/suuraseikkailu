/* v3 settings sheet checks + screenshots (dev tool, not part of the app).
   Run:  node tools/settings-v3-test.cjs [outDir]          (default ../qa/v3-settings)
   Starts its own Vite dev server on 127.0.0.1:5202 without HMR / file watching (other agents edit files in
   parallel; a reload mid-test would break it). BASE=http://... uses an already running server instead.
   Uses Chromium's fake microphone, so recording start/stop/save/play/delete runs for real. */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'qa', 'v3-settings'));
const PORT = 5202;
let BASE = process.env.BASE || '';
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(ok, msg) { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; }

async function startServer() {
  const vite = await import(pathToFileURL(path.join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: false, logLevel: 'warn', clearScreen: false,
    server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null }
  });
  await server.listen();
  return server;
}

async function page(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: !!opts.touch, reducedMotion: 'reduce' });
  if (opts.grantMic !== false) await ctx.grantPermissions(['microphone'], { origin: BASE });
  if (opts.initScript) await ctx.addInitScript(opts.initScript);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await pg.goto(BASE + '/tools/settings-v3-test.html' + (opts.query || ''));
  await pg.waitForFunction(() => window.__t, null, { timeout: 30000 });
  await pg.evaluate(() => document.fonts.ready);
  return { ctx, pg, errs };
}

const T = (pg, fn, arg) => pg.evaluate(fn, arg);
const logTail = (pg, n) => T(pg, (k) => window.__t.log.slice(-k), n);
const logLen = (pg) => T(pg, () => window.__t.log.length);
const K = (id, inner) => '[data-kid="' + id + '"] ' + (inner || '');

async function noHScroll(pg, label) {
  const r = await T(pg, () => {
    const b = document.querySelector('.set-body');
    const clipped = [];
    /* the check bubble (.kid-tick) hangs over the corner on purpose: leave it out of the text measurement */
    const hide = document.createElement('style');
    hide.textContent = '.kid-tick{display:none!important}';
    document.head.appendChild(hide);
    document.querySelectorAll('#settings button, #settings .kid-name, #settings .rec-label, #settings summary').forEach((el) => {
      const rr = el.getBoundingClientRect();
      if (!rr.width) return;
      if (el.scrollWidth > el.clientWidth + 1) clipped.push((el.className || el.tagName) + ':' + el.textContent.trim().slice(0, 20) + ' ' + el.scrollWidth + '>' + el.clientWidth);
    });
    hide.remove();
    return { doc: document.documentElement.scrollWidth - innerWidth, body: b ? b.scrollWidth - b.clientWidth : 0, clipped };
  });
  check(r.doc <= 0 && r.body <= 0, label + ': no horizontal scroll (doc ' + r.doc + ', sheet ' + r.body + ')');
  check(!r.clipped.length, label + ': no clipped button text ' + (r.clipped.length ? JSON.stringify(r.clipped) : ''));
}

async function minSizes(pg, label) {
  const bad = await T(pg, () => {
    const out = [];
    /* (the shared, visually hidden file input is opened by the "Tuo tiedosto" buttons, it is not a control itself) */
    document.querySelectorAll('#settings button, #settings summary, #settings .set-switch, #settings input:not([type="checkbox"]):not([type="file"])').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return; /* not rendered (hidden / closed details) */
      if (r.height < 63.5 || r.width < 63.5) out.push((el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out;
  });
  check(!bad.length, label + ': every control >= 64x64 px ' + (bad.length ? JSON.stringify(bad) : ''));
}

/* WCAG contrast of every visible text run against its (composited) background colour. */
async function contrast(pg, label) {
  const bad = await T(pg, () => {
    const parse = (c) => {
      const m = /rgba?\(([^)]+)\)/.exec(c || '');
      if (!m) return { r: 0, g: 0, b: 0, a: 0 };
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      }
      let res = { r: 255, g: 255, b: 255 };
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        res = { r: l.r * l.a + res.r * (1 - l.a), g: l.g * l.a + res.g * (1 - l.a), b: l.b * l.a + res.b * (1 - l.a) };
      }
      return res;
    };
    const out = [];
    const seen = new Set();
    const sheet = document.querySelector('#settings .set-sheet');
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (!n.textContent.trim() || seen.has(el)) continue;
      seen.add(el);
      if (!el.getClientRects().length || el.closest('[disabled], .is-dim, .set-sr, [hidden]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      const fg = parse(cs.color), bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), w = Number(cs.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && w >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push(el.textContent.trim().slice(0, 24) + ' ' + ratio.toFixed(2));
    }
    return out;
  });
  check(!bad.length, label + ': text contrast >= 4.5:1 (large >= 3:1) ' + (bad.length ? JSON.stringify(bad.slice(0, 12)) : ''));
}

async function fullShot(pg, file) {
  /* expand the scroll container so one screenshot shows the whole sheet */
  await T(pg, () => {
    const s = document.querySelector('.set-sheet'), b = document.querySelector('.set-body');
    document.querySelector('#settings').style.position = 'absolute';
    document.querySelector('#settings').style.height = (b.scrollHeight + 200) + 'px';
    s.style.maxHeight = 'none';
  });
  await pg.screenshot({ path: path.join(OUT, file), fullPage: true });
  await T(pg, () => {
    document.querySelector('#settings').style.cssText = '';
    document.querySelector('.set-sheet').style.maxHeight = '';
  });
}
async function shotAt(pg, sel, file) {
  await pg.locator(sel).first().scrollIntoViewIfNeeded();
  await pg.waitForTimeout(80);
  await pg.screenshot({ path: path.join(OUT, file) });
}

async function openSheet(pg) {
  await pg.click('#openBtn');
  await pg.waitForSelector('.set-sheet');
  await pg.waitForTimeout(150);
}

async function kidFlows(pg, tag) {
  const [A, O] = await T(pg, () => window.__t.store.children.map((c) => c.id));
  let st = await T(pg, () => {
    const cards = Array.from(document.querySelectorAll('.kid[data-kid]'));
    return {
      first: document.querySelector('.set-body').firstElementChild.classList.contains('set-card-kids'),
      names: cards.map((c) => c.querySelector('.kid-name').textContent),
      kt: cards.map((c) => c.dataset.kt),
      chip: cards.map((c) => !!c.querySelector('.kid-chip')),
      play: cards.map((c) => !!c.querySelector('[data-kact="play"]')),
      lvl: cards.map((c) => (c.querySelector('[data-kact="level"][aria-pressed="true"]') || {}).dataset.v)
    };
  });
  check(st.first, tag + ': Lapset is the first section');
  check(JSON.stringify(st.names) === '["Amina","Omar"]' && JSON.stringify(st.kt) === '["girl","boy"]', tag + ': two child cards (Amina girl, Omar boy) ' + JSON.stringify(st));
  check(JSON.stringify(st.chip) === '[true,false]' && JSON.stringify(st.play) === '[false,true]', tag + ': active child has the chip, the other a Pelaa nyt button');
  check(JSON.stringify(st.lvl) === '["easy","medium"]', tag + ': default level shown pressed');

  /* ---- rename ---- */
  await pg.click(K(A, '[data-kact="edit"]'));
  st = await T(pg, () => ({ v: document.activeElement.value, inp: document.activeElement.dataset.input }));
  check(st.inp === 'rename' && st.v === 'Amina', tag + ': rename field opens focused with the name');
  await pg.screenshot({ path: path.join(OUT, tag + '-rename.png') });
  let n0 = await logLen(pg);
  await pg.fill(K(A, '[data-input="rename"]'), '  Sara   Amina ');
  await pg.click(K(A, '[data-kact="editok"]'));
  st = await T(pg, (id) => ({ name: window.__t.store.children.find((c) => c.id === id).name, shown: document.querySelector('[data-kid="' + id + '"] .kid-name').textContent,
    focus: document.activeElement.dataset.kact, log: window.__t.log.slice() }), A);
  check(st.name === 'Sara Amina' && st.shown === 'Sara Amina' && st.focus === 'edit', tag + ': Tallenna renames (trimmed) + focus back on edit: ' + JSON.stringify(st.name));
  check(JSON.stringify(st.log.slice(n0)) === '["save","children"]', tag + ': rename -> save() then onChildrenChange() ' + JSON.stringify(st.log.slice(n0)));
  await pg.click(K(A, '[data-kact="edit"]'));
  await pg.fill(K(A, '[data-input="rename"]'), 'Amina');
  await pg.keyboard.press('Enter');
  check((await T(pg, (id) => window.__t.store.children.find((c) => c.id === id).name, A)) === 'Amina', tag + ': Enter saves the rename');
  n0 = await logLen(pg);
  await pg.click(K(A, '[data-kact="edit"]'));
  await pg.fill(K(A, '[data-input="rename"]'), 'Zzz');
  await pg.keyboard.press('Escape');
  st = await T(pg, (id) => ({ name: window.__t.store.children.find((c) => c.id === id).name, open: window.__t.settings.isSettingsOpen(),
    edit: !!document.querySelector('[data-input="rename"]'), n: window.__t.log.length }), A);
  check(st.name === 'Amina' && st.open && !st.edit && st.n === n0, tag + ': Escape in the field cancels the rename and keeps the sheet open');
  await pg.click(K(A, '[data-kact="edit"]'));
  await pg.fill(K(A, '[data-input="rename"]'), '   ');
  await pg.click(K(A, '[data-kact="editok"]'));
  st = await T(pg, (id) => ({ err: (document.querySelector('[data-kid="' + id + '"] .kid-err') || {}).textContent, name: window.__t.store.children.find((c) => c.id === id).name }), A);
  check(st.err === 'Kirjoita nimi.' && st.name === 'Amina', tag + ': empty name is refused with a message');
  await pg.fill(K(A, '[data-input="rename"]'), 'x'.repeat(40));
  await pg.click(K(A, '[data-kact="editok"]'));
  check((await T(pg, (id) => window.__t.store.children.find((c) => c.id === id).name.length, A)) === 24, tag + ': name capped at NAME_MAX 24');
  await pg.click(K(A, '[data-kact="edit"]'));
  await pg.fill(K(A, '[data-input="rename"]'), 'Amina');
  await pg.click(K(A, '[data-kact="editok"]'));

  /* ---- theme ---- */
  n0 = await logLen(pg);
  await pg.click(K(A, '[data-kact="theme"][data-v="boy"]'));
  st = await T(pg, (id) => ({ theme: window.__t.store.children.find((c) => c.id === id).theme, kt: document.querySelector('[data-kid="' + id + '"]').dataset.kt,
    pressed: document.querySelector('[data-kid="' + id + '"] [data-kact="theme"][data-v="boy"]').getAttribute('aria-pressed'),
    html: document.documentElement.dataset.theme, focus: document.activeElement.dataset.v, log: window.__t.log.slice() }), A);
  check(st.theme === 'boy' && st.kt === 'boy' && st.pressed === 'true' && st.focus === 'boy', tag + ': theme toggle -> Poika (store, card, aria-pressed, focus kept)');
  check(JSON.stringify(st.log.slice(n0)) === '["save","children"]' && st.html === 'boy', tag + ': theme -> save + onChildrenChange (app re-themes: html ' + st.html + ')');
  await pg.screenshot({ path: path.join(OUT, tag + '-theme-boy.png') });
  await pg.click(K(A, '[data-kact="theme"][data-v="girl"]'));
  check((await T(pg, (id) => window.__t.store.children.find((c) => c.id === id).theme, A)) === 'girl', tag + ': theme back to Tyttö');
  n0 = await logLen(pg);
  await pg.click(K(A, '[data-kact="theme"][data-v="girl"]'));
  check((await logLen(pg)) === n0, tag + ': tapping the chosen theme again does not fire callbacks');

  /* ---- level ---- */
  n0 = await logLen(pg);
  await pg.click(K(O, '[data-kact="level"][data-v="hard"]'));
  st = await T(pg, (id) => ({ level: window.__t.store.children.find((c) => c.id === id).level,
    pressed: Array.from(document.querySelectorAll('[data-kid="' + id + '"] [data-kact="level"]')).map((b) => b.getAttribute('aria-pressed')), log: window.__t.log.slice() }), O);
  check(st.level === 'hard' && JSON.stringify(st.pressed) === '["false","false","true"]', tag + ': level -> VAIKEA');
  check(JSON.stringify(st.log.slice(n0)) === '["save","children"]', tag + ': level -> save + onChildrenChange');

  /* ---- add ---- */
  await pg.click('[data-kact="add"]');
  check(await T(pg, () => document.activeElement.id === 'kidNewName'), tag + ': Lisää lapsi opens the form, name field focused');
  await pg.click('[data-kact="addok"]');
  st = await T(pg, () => ({ err: document.querySelector('.kid-new .kid-err').textContent, n: window.__t.store.children.length }));
  check(st.err === 'Kirjoita lapsen nimi.' && st.n === 2, tag + ': add without a name asks for it');
  await pg.fill('#kidNewName', 'Leila');
  await pg.click('[data-kact="addok"]');
  st = await T(pg, () => ({ err: document.querySelector('.kid-new .kid-err').textContent, n: window.__t.store.children.length }));
  check(st.err === 'Valitse Tyttö tai Poika.' && st.n === 2, tag + ': add without Tyttö/Poika asks for it');
  await pg.locator('.kid-new').scrollIntoViewIfNeeded();
  await pg.screenshot({ path: path.join(OUT, tag + '-add-error.png') });
  await pg.click('[data-kact="addtheme"][data-v="girl"]');
  st = await T(pg, () => ({ p: document.querySelector('[data-kact="addtheme"][data-v="girl"]').getAttribute('aria-pressed'), err: document.querySelector('.kid-new .kid-err').textContent }));
  check(st.p === 'true' && st.err === '', tag + ': picking Tyttö marks it and clears the message');
  n0 = await logLen(pg);
  await pg.click('[data-kact="addok"]');
  st = await T(pg, (a) => {
    const s = window.__t.store, c = s.children[s.children.length - 1];
    return { n: s.children.length, name: c.name, theme: c.theme, level: c.level, activeStays: s.activeId === a, id: c.id,
      card: !!document.querySelector('[data-kid="' + c.id + '"]'), focus: document.activeElement.dataset.kact,
      msg: document.querySelector('[data-kids-msg]').textContent, log: window.__t.log.slice() };
  }, A);
  check(st.n === 3 && st.name === 'Leila' && st.theme === 'girl' && st.card, tag + ': Lisää adds Leila (girl) and shows her card');
  check(st.activeStays, tag + ': the previously active child stays active after adding');
  check(JSON.stringify(st.log.slice(n0)) === '["save","children"]' && st.focus === 'play' && /Lisätty: Leila/.test(st.msg), tag + ': add -> save + onChildrenChange, focus on Pelaa nyt, message');
  const L = st.id;
  await shotAt(pg, K(L), tag + '-added.png');
  /* Enter in the name field moves on to Tyttö/Poika instead of failing */
  await pg.click('[data-kact="add"]');
  await pg.fill('#kidNewName', 'Ali');
  await pg.keyboard.press('Enter');
  check(await T(pg, () => document.activeElement.dataset.kact === 'addtheme'), tag + ': Enter without a theme moves focus to Tyttö/Poika');
  await pg.click('[data-kact="addtheme"][data-v="boy"]');
  await pg.click('#kidNewName');
  await pg.keyboard.press('Enter');
  st = await T(pg, () => window.__t.store.children.map((c) => c.name + ':' + c.theme));
  check(st.length === 4 && st[3] === 'Ali:boy', tag + ': Enter with name + theme adds (' + st.join(', ') + ')');
  const ALI = await T(pg, () => window.__t.store.children[3].id);
  /* Peru closes the form without adding */
  await pg.click('[data-kact="add"]');
  await pg.fill('#kidNewName', 'Ei lisätä');
  await pg.click('[data-kact="addno"]');
  check((await T(pg, () => window.__t.store.children.length)) === 4 && await T(pg, () => document.activeElement.dataset.kact === 'add'), tag + ': Peru closes the add form');

  /* ---- delete with confirm ---- */
  await pg.click(K(L, '[data-kact="del"]'));
  st = await T(pg, (id) => ({ q: document.querySelector('[data-kid="' + id + '"] .kid-confirm p').textContent, focus: document.activeElement.dataset.kact }), L);
  check(st.q === 'Poistetaanko Leila?' && st.focus === 'confirmno', tag + ': Poista lapsi asks first (focus on Peru)');
  await shotAt(pg, K(L, '.kid-confirm'), tag + '-delete-confirm.png');
  n0 = await logLen(pg);
  await pg.click(K(L, '[data-kact="confirmno"]'));
  check((await T(pg, () => window.__t.store.children.length)) === 4 && (await logLen(pg)) === n0 && await T(pg, () => document.activeElement.dataset.kact === 'del'), tag + ': Peru keeps the child');
  await pg.click(K(L, '[data-kact="del"]'));
  await pg.click(K(L, '[data-kact="delyes"]'));
  st = await T(pg, (id) => ({ names: window.__t.store.children.map((c) => c.name), card: !!document.querySelector('[data-kid="' + id + '"]'),
    msg: document.querySelector('[data-kids-msg]').textContent, log: window.__t.log.slice(), focus: document.activeElement.dataset.kact }), L);
  check(JSON.stringify(st.names) === '["Amina","Omar","Ali"]' && !st.card && /Poistettu: Leila/.test(st.msg), tag + ': Kyllä, poista removes Leila');
  check(JSON.stringify(st.log.slice(n0)) === '["save","children"]' && st.focus === 'edit', tag + ': delete -> save + onChildrenChange, focus on the next card');
  await pg.click(K(ALI, '[data-kact="del"]'));
  await pg.click(K(ALI, '[data-kact="delyes"]'));

  /* ---- reset with confirm ---- */
  await pg.click(K(O, '[data-kact="reset"]'));
  st = await T(pg, (id) => ({ q: document.querySelector('[data-kid="' + id + '"] .kid-confirm p').textContent, focus: document.activeElement.dataset.kact }), O);
  check(st.q === 'Aloitetaanko alusta?' && st.focus === 'confirmno', tag + ': Aloita alusta asks first');
  await shotAt(pg, K(O, '.kid-confirm'), tag + '-reset-confirm.png');
  await pg.click(K(O, '[data-kact="confirmno"]'));
  check(!(await T(pg, () => window.__t.log.some((x) => /^reset:/.test(x)))), tag + ': Peru does not reset');
  n0 = await logLen(pg);
  await pg.click(K(O, '[data-kact="reset"]'));
  await pg.click(K(O, '[data-kact="resetyes"]'));
  st = await T(pg, (id) => {
    const c = window.__t.store.children.find((x) => x.id === id);
    return { log: window.__t.log.slice(), stars: c.stars, prog: c.progress.shahada, name: c.name, theme: c.theme, level: c.level,
      meta: document.querySelector('[data-kid="' + id + '"] .kid-meta').textContent, msg: document.querySelector('[data-kids-msg]').textContent };
  }, O);
  check(JSON.stringify(st.log.slice(n0)) === JSON.stringify(['save', 'reset:' + O]) && st.stars === 0 && st.prog === 0, tag + ': Kyllä -> resetChild + save + onReset(childId) (' + JSON.stringify(st.log.slice(n0)) + ')');
  check(st.name === 'Omar' && st.theme === 'boy' && st.level === 'hard' && /^0 tähteä · 0\/4 valmiina$/.test(st.meta) && /Omar: tähdet/.test(st.msg), tag + ': reset keeps name/theme/level, card shows 0 stars: ' + st.meta);

  /* ---- shared switches ---- */
  for (const key of ['speech', 'slow', 'translit', 'sfx']) {
    const before = await T(pg, (k) => window.__t.store.settings[k], key);
    await pg.locator('.set-switch-input[data-key="' + key + '"]').click({ force: true });
    const after = await T(pg, (k) => ({ v: window.__t.store.settings[k], tail: window.__t.log.slice(-2) }), key);
    check(after.v === !before && JSON.stringify(after.tail) === JSON.stringify(['save', 'change:' + key]), tag + ': switch ' + key + ' -> store.settings + save + onChange');
  }
  await pg.click('[data-every="2"]');
  st = await T(pg, () => ({ every: window.__t.store.settings.every, p: document.querySelector('[data-every="2"]').getAttribute('aria-pressed'), tail: window.__t.log.slice(-2) }));
  check(st.every === 2 && st.p === 'true' && JSON.stringify(st.tail) === '["save","change:every"]', tag + ': every=2 + aria-pressed + onChange');
  await shotAt(pg, '.set-card-sound', tag + '-switches.png');
  await pg.click('[data-every="1"]');
  for (const key of ['speech', 'slow', 'translit', 'sfx']) await pg.locator('.set-switch-input[data-key="' + key + '"]').click({ force: true });

  /* ---- Pelaa nyt ---- */
  n0 = await logLen(pg);
  await pg.click(K(O, '[data-kact="play"]'));
  st = await T(pg, () => ({ active: window.__t.store.activeId, open: window.__t.settings.isSettingsOpen(), html: document.documentElement.dataset.theme, log: window.__t.log.slice() }));
  check(st.active === O && !st.open && st.html === 'boy', tag + ': Pelaa nyt -> Omar active, sheet closes, app re-themes boy');
  check(JSON.stringify(st.log.slice(n0)) === '["save","children"]', tag + ': Pelaa nyt -> save + onChildrenChange');
  check(await T(pg, () => document.activeElement && document.activeElement.id === 'openBtn'), tag + ': focus back on the opener');
  await openSheet(pg);
  st = await T(pg, (a) => ({ chip: !!document.querySelector('[data-kid="' + window.__t.store.activeId + '"] .kid-chip'), aPlay: !!document.querySelector('[data-kid="' + a + '"] [data-kact="play"]') }), A);
  check(st.chip && st.aPlay, tag + ': reopened: Omar has the chip, Amina the Pelaa nyt button');
  return { A, O };
}

async function recordingFlows(pg, tag) {
  const groups = await pg.$$eval('.rec-group', (els) => els.map((e) => e.dataset.group + ':' + e.querySelectorAll('.rec-row').length));
  check(groups.includes('Pelit (poika):6') && groups.includes('Pelit (tyttö):6'), tag + ': recordings grouped incl. Pelit (poika)/(tyttö) ' + JSON.stringify(groups));
  check((await pg.$$('.rec-row')).length > 40, tag + ': every RECORDABLE clip has a row');

  /* sound test panel */
  await pg.locator('[data-test="sfx"]').scrollIntoViewIfNeeded();
  await pg.click('[data-test="sfx"]');
  await pg.waitForFunction(() => { const r = document.querySelector('.test-result'); return r && !r.hidden && r.dataset.tone !== 'wait'; }, null, { timeout: 8000 }).catch(() => {});
  check(/Efekti:/.test(await pg.textContent('.test-result')), tag + ': test Efekti: ' + (await pg.textContent('.test-result')));
  await pg.click('[data-test="recitation"]');
  await pg.waitForFunction(() => document.querySelector('.test-result').dataset.tone !== 'wait', null, { timeout: 20000 }).catch(() => {});
  check(/Resitaatio: MP3: OK/.test(await pg.textContent('.test-result')), tag + ': test Resitaatio: ' + (await pg.textContent('.test-result')));
  await pg.click('[data-test="fi"]');
  await pg.waitForFunction(() => document.querySelector('.test-result').dataset.tone !== 'wait', null, { timeout: 20000 }).catch(() => {});
  check(/Suomen puhe:/.test(await pg.textContent('.test-result')), tag + ': test Suomen puhe: ' + (await pg.textContent('.test-result')));
  const diag = await pg.$$eval('.diag li', (els) => els.map((e) => e.textContent));
  check(diag.length >= 5, tag + ': diagnostics list: ' + JSON.stringify(diag));
  await shotAt(pg, '.set-card-test', tag + '-test.png');

  /* recording: start -> recording UI -> stop+save -> status -> play -> delete */
  const row = '.rec-row[data-id="shahada-1"]';
  await pg.locator(row).scrollIntoViewIfNeeded();
  await pg.click(row + ' [data-act="rec"]');
  await pg.waitForSelector(row + ' .rec-live:not([hidden])', { timeout: 5000 }).catch(() => {});
  check(await pg.isVisible(row + ' [data-act="stoprec"]'), tag + ': recording shows Lopeta');
  check(await T(pg, () => document.querySelector('.rec-row[data-id="praise-1"] [data-act="rec"]').disabled), tag + ': other rows locked while recording');
  await pg.waitForTimeout(1600);
  check(/[1-9] s/.test(await pg.textContent(row + ' .rec-sec')), tag + ': elapsed seconds tick: ' + (await pg.textContent(row + ' .rec-sec')));
  await pg.screenshot({ path: path.join(OUT, tag + '-recording.png') });
  await pg.click(row + ' [data-act="stoprec"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', row, { timeout: 8000 }).catch(() => {});
  let st = await T(pg, (r) => ({ st: document.querySelector(r).dataset.st, status: document.querySelector(r + ' .rec-status').textContent,
    del: !document.querySelector(r + ' [data-act="del"]').hidden, msg: document.querySelector(r + ' .rec-msg').textContent }), row);
  check(st.st === 'own' && st.status === 'Oma ääni' && st.del, tag + ': saved: Oma ääni + delete visible (' + st.msg + ')');
  check(await T(pg, () => (window.__t.engine.diagnostics().recordings || []).includes('shahada-1')), tag + ': engine.refreshRecordings() picked the recording up');
  await pg.screenshot({ path: path.join(OUT, tag + '-saved.png') });
  await pg.click(row + ' [data-act="play"]');
  await pg.waitForTimeout(300);
  check(await T(pg, (r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), row), tag + ': Kuuntele -> playing state');
  await pg.waitForFunction((r) => !document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), row, { timeout: 8000 }).catch(() => {});
  check(!(await T(pg, (r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), row)), tag + ': playback finished and button reset');
  await pg.click(row + ' [data-act="del"]');
  check(await pg.isVisible(row + ' .rec-confirm'), tag + ': delete recording asks for confirmation');
  await pg.click(row + ' [data-act="delyes"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'file', row, { timeout: 5000 }).catch(() => {});
  check((await pg.textContent(row + ' .rec-status')) === 'Valmis ääni', tag + ': deleted: back to Valmis ääni');
  /* a v3 game prompt row records + plays too */
  const grow = '.rec-row[data-id="game-boy-0"]';
  await T(pg, () => document.querySelectorAll('.set-details').forEach((d) => { d.open = true; }));
  await pg.locator(grow).scrollIntoViewIfNeeded();
  await pg.click(grow + ' [data-act="rec"]');
  await pg.waitForSelector(grow + ' .rec-live:not([hidden])', { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(900);
  await pg.click(grow + ' [data-act="stoprec"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', grow, { timeout: 8000 }).catch(() => {});
  check((await pg.textContent(grow + ' .rec-status')) === 'Oma ääni', tag + ': game-boy-0 own recording saved');
  await pg.click(grow + ' [data-act="del"]');
  await pg.click(grow + ' [data-act="delyes"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'file', grow, { timeout: 5000 }).catch(() => {});
  /* 15 s auto-stop saves the take by itself */
  const row2 = '.rec-row[data-id="turn-1"]';
  await pg.locator(row2).scrollIntoViewIfNeeded();
  await pg.click(row2 + ' [data-act="rec"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', row2, { timeout: 22000 }).catch(() => {});
  st = await T(pg, (r) => ({ st: document.querySelector(r).dataset.st, msg: document.querySelector(r + ' .rec-msg').textContent, live: !document.querySelector(r + ' .rec-live').hidden }), row2);
  check(st.st === 'own' && /täynnä/.test(st.msg) && !st.live, tag + ': auto-stop at 15 s saves: ' + st.msg);
  await pg.click(row2 + ' [data-act="del"]');
  await pg.click(row2 + ' [data-act="delyes"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'file', row2, { timeout: 5000 }).catch(() => {});
  await nameRecordingFlows(pg, tag);
  await importFlows(pg, tag);
}

/* "Tuo tiedosto": a local audio file becomes the recording (IndexedDB only) */
async function importFlows(pg, tag) {
  const MP3 = path.join(ROOT, 'public/audio/fi/praise-1.mp3');
  const size = fs.statSync(MP3).size;
  const pick = async (row, files) => {
    const [chooser] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.click(row + ' [data-act="file"]')]);
    await chooser.setFiles(files);
  };
  const msgOf = (row) => pg.textContent(row + ' .rec-msg');
  check(await T(pg, () => { const i = document.querySelector('#settings [data-file]'); return !!i && i.accept === 'audio/*' && !i.closest('.set-sheet'); }),
    tag + ': one shared file input accept=audio/* (outside the dialog\'s Tab cycle)');
  check(await T(pg, () => Array.from(document.querySelectorAll('.rec-row')).every((r) => !!r.querySelector('[data-act="file"]'))), tag + ': every recording row has Tuo tiedosto');
  /* child's name from a file */
  const id = await T(pg, () => window.__t.store.children[0].id);
  const nrow = '.rec-row[data-id="name-' + id + '"]';
  await pg.locator(nrow).scrollIntoViewIfNeeded();
  await pick(nrow, MP3);
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', nrow, { timeout: 8000 }).catch(() => {});
  let st = await T(pg, (a) => window.__t.recorder.get('name-' + a.id).then((b) => ({ st: document.querySelector(a.r).dataset.st, status: document.querySelector(a.r + ' .rec-status').textContent,
    size: b && b.size, type: b && b.type, eng: (window.__t.engine.diagnostics().recordings || []).includes('name-' + a.id),
    focus: document.activeElement && document.activeElement.dataset.act })), { id, r: nrow });
  check(st.st === 'own' && st.status === 'Oma ääni' && /Tiedosto tuotu/.test(await msgOf(nrow)), tag + ': Tuo tiedosto (mp3) -> name-<childId> = Oma ääni');
  check(st.size === size && st.type === 'audio/mpeg' && st.eng && st.focus === 'play', tag + ': stored in IndexedDB as audio/mpeg (' + st.size + ' B), engine refreshed, focus on Kuuntele');
  await shotAt(pg, nrow, tag + '-name-imported.png');
  await pg.click(nrow + ' [data-act="play"]');
  await pg.waitForTimeout(250);
  check(await T(pg, (r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), nrow), tag + ': imported name plays');
  await pg.waitForFunction((r) => !document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), nrow, { timeout: 8000 }).catch(() => {});
  check(!(await T(pg, (r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), nrow)), tag + ': playback of the imported file finished');
  await pg.click(nrow + ' [data-act="del"]');
  await pg.click(nrow + ' [data-act="delyes"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'none', nrow, { timeout: 5000 }).catch(() => {});
  /* a Shahada line from a file, then wrong files */
  const srow = '.rec-row[data-id="shahada-1"]';
  await pg.locator(srow).scrollIntoViewIfNeeded();
  await pick(srow, MP3);
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', srow, { timeout: 8000 }).catch(() => {});
  check((await pg.textContent(srow + ' .rec-status')) === 'Oma ääni', tag + ': Shahada rivi 1 from a file -> Oma ääni');
  await pg.click(srow + ' [data-act="del"]');
  await pg.click(srow + ' [data-act="delyes"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'file', srow, { timeout: 5000 }).catch(() => {});
  const brow = '.rec-row[data-id="shahada-2"]';
  await pg.locator(brow).scrollIntoViewIfNeeded();
  await pick(brow, { name: 'muistio.txt', mimeType: 'text/plain', buffer: Buffer.from('ei ääntä') });
  await pg.waitForFunction((r) => /äänitiedosto/.test(document.querySelector(r + ' .rec-msg').textContent), brow, { timeout: 5000 }).catch(() => {});
  check(/Tiedosto ei ole äänitiedosto/.test(await msgOf(brow)) && (await pg.textContent(brow + ' .rec-status')) === 'Valmis ääni', tag + ': a text file is refused in Finnish: ' + (await msgOf(brow)));
  await shotAt(pg, brow, tag + '-import-error.png');
  await pick(brow, { name: 'iso.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(2.5 * 1024 * 1024, 1) });
  await pg.waitForFunction((r) => /liian suuri/.test(document.querySelector(r + ' .rec-msg').textContent), brow, { timeout: 5000 }).catch(() => {});
  check(/liian suuri \(enintään 2 Mt\)/.test(await msgOf(brow)) && (await pg.textContent(brow + ' .rec-status')) === 'Valmis ääni', tag + ': a 2.5 MB file is refused: ' + (await msgOf(brow)));
  check(await T(pg, () => Array.from(document.querySelectorAll('[data-act="file"]')).every((b) => !b.disabled)), tag + ': Tuo tiedosto usable again after errors');
  /* recorder.saveBlob unit checks */
  st = await T(pg, async () => {
    const r = window.__t.recorder, out = {};
    const err = async (fn) => { try { await fn(); return 'no error'; } catch (e) { return e.name + ': ' + e.message; } };
    const typed = await r.saveBlob('unit-m4a', new File([new Uint8Array([1, 2, 3])], 'nimi.m4a', { type: '' }));
    out.m4a = typed.type;
    out.noId = await err(() => r.saveBlob('', new Blob([new Uint8Array([1])], { type: 'audio/mpeg' })));
    out.empty = await err(() => r.saveBlob('unit-x', new Blob([], { type: 'audio/mpeg' })));
    out.video = await err(() => r.saveBlob('unit-x', new File([new Uint8Array([1])], 'v.mp4', { type: 'video/mp4' })));
    await r.remove('unit-m4a');
    out.left = (await r.list()).filter((x) => /^unit-/.test(x));
    return out;
  });
  check(st.m4a === 'audio/mp4' && /^TypeError: /.test(st.noId) && /^NotFoundError: Tiedosto on tyhjä/.test(st.empty) && /^TypeMismatchError: /.test(st.video) && !st.left.length,
    tag + ': saveBlob: type from extension, Finnish errors ' + JSON.stringify(st));
}

/* the child's own name recording ('name-<childId>') in every child card */
async function nameRecordingFlows(pg, tag) {
  const ids = await T(pg, () => window.__t.store.children.map((c) => c.id));
  check(await T(pg, (list) => list.every((id) => !!document.querySelector('[data-kid="' + id + '"] .rec-row[data-id="name-' + id + '"]')), ids), tag + ': every child card has its own name recording row');
  check(!(await pg.$('.rec-row[data-id="name"]')), tag + ': no global name row any more');
  const nrow = '.rec-row[data-id="name-' + ids[0] + '"]';
  const rowState = () => T(pg, (r) => { const e = document.querySelector(r); return { st: e.dataset.st, status: e.querySelector('.rec-status').textContent,
    play: !e.querySelector('[data-act="play"]').disabled, del: !e.querySelector('[data-act="del"]').hidden }; }, nrow);
  let st = await rowState();
  check(st.st === 'none' && st.status === 'Ei äänitystä' && st.play && !st.del, tag + ': name row starts as Ei äänitystä, Kuuntele enabled (device speech says the name)');
  await pg.locator(nrow).scrollIntoViewIfNeeded();
  await pg.click(nrow + ' [data-act="rec"]');
  await pg.waitForSelector(nrow + ' .rec-live:not([hidden])', { timeout: 5000 }).catch(() => {});
  check(await T(pg, () => Array.from(document.querySelectorAll('[data-kact]')).every((b) => b.disabled)), tag + ': child controls locked while a name is recorded');
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: path.join(OUT, tag + '-name-recording.png') });
  await pg.click(nrow + ' [data-act="stoprec"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', nrow, { timeout: 8000 }).catch(() => {});
  st = await rowState();
  check(st.st === 'own' && st.status === 'Oma ääni' && st.del, tag + ': name recorded: Oma ääni + Poista visible');
  check(await T(pg, (id) => (window.__t.engine.diagnostics().recordings || []).includes('name-' + id), ids[0]), tag + ': engine knows name-<childId>');
  check(await T(pg, () => Array.from(document.querySelectorAll('[data-kact]')).every((b) => !b.disabled)), tag + ': child controls unlocked again');
  await shotAt(pg, nrow, tag + '-name-saved.png');
  await pg.click(nrow + ' [data-act="play"]');
  await pg.waitForTimeout(250);
  check(await T(pg, (r) => document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), nrow), tag + ': Kuuntele plays the name recording');
  await pg.waitForFunction((r) => !document.querySelector(r + ' [data-act="play"]').classList.contains('is-playing'), nrow, { timeout: 8000 }).catch(() => {});
  /* a re-render (theme toggle) keeps the row's status */
  await pg.click(K(ids[0], '[data-kact="theme"][data-v="boy"]'));
  check((await rowState()).st === 'own', tag + ': name row status survives a card re-render');
  await pg.click(K(ids[0], '[data-kact="theme"][data-v="girl"]'));
  await pg.click(nrow + ' [data-act="del"]');
  check(await pg.isVisible(nrow + ' .rec-confirm'), tag + ': deleting the name recording asks first');
  await pg.click(nrow + ' [data-act="delyes"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'none', nrow, { timeout: 5000 }).catch(() => {});
  check((await rowState()).status === 'Ei äänitystä', tag + ': name recording deleted');
  /* deleting a child also deletes that child's name recording */
  await pg.click('[data-kact="add"]');
  await pg.fill('#kidNewName', 'Testi');
  await pg.click('[data-kact="addtheme"][data-v="boy"]');
  await pg.click('[data-kact="addok"]');
  const X = await T(pg, () => window.__t.store.children[window.__t.store.children.length - 1].id);
  const xrow = '.rec-row[data-id="name-' + X + '"]';
  await pg.locator(xrow).scrollIntoViewIfNeeded();
  await pg.click(xrow + ' [data-act="rec"]');
  await pg.waitForSelector(xrow + ' .rec-live:not([hidden])', { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(700);
  await pg.click(xrow + ' [data-act="stoprec"]');
  await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', xrow, { timeout: 8000 }).catch(() => {});
  check(await T(pg, (id) => window.__t.recorder.list().then((l) => l.includes('name-' + id)), X), tag + ': Testi has a name recording');
  await pg.click(K(X, '[data-kact="del"]'));
  await pg.click(K(X, '[data-kact="delyes"]'));
  await pg.waitForFunction((id) => !(window.__t.engine.diagnostics().recordings || []).includes('name-' + id), X, { timeout: 5000 }).catch(() => {});
  st = await T(pg, (id) => window.__t.recorder.list().then((l) => ({ db: l.includes('name-' + id), eng: (window.__t.engine.diagnostics().recordings || []).includes('name-' + id) })), X);
  check(!st.db && !st.eng, tag + ': deleting the child removed name-<id> from the recorder and the engine');
}

async function closeFlows(pg, tag) {
  await pg.keyboard.press('Escape');
  check(!(await T(pg, () => window.__t.settings.isSettingsOpen())) && await pg.isHidden('#settings'), tag + ': Escape closes');
  check(await T(pg, () => document.activeElement && document.activeElement.id === 'openBtn'), tag + ': focus back on opener');
  await openSheet(pg);
  await pg.mouse.click(3, 3);
  check(!(await T(pg, () => window.__t.settings.isSettingsOpen())), tag + ': backdrop tap closes');
  await openSheet(pg);
  await pg.click('.set-close');
  check(!(await T(pg, () => window.__t.settings.isSettingsOpen())), tag + ': close button closes');
  await openSheet(pg);
  check(await T(pg, () => document.activeElement && document.activeElement.classList.contains('set-sheet')), tag + ': focus moves into the sheet');
  let inside = true;
  for (let i = 0; i < 70; i++) {
    await pg.keyboard.press('Tab');
    if (!(await T(pg, () => document.querySelector('#settings').contains(document.activeElement)))) { inside = false; break; }
  }
  check(inside, tag + ': Tab focus stays inside the sheet');
  /* a rename typed and then closed with X is kept */
  const A = await T(pg, () => window.__t.store.children[0].id);
  await pg.click(K(A, '[data-kact="edit"]'));
  await pg.fill(K(A, '[data-input="rename"]'), 'Amina Sofia');
  await pg.click('.set-close');
  check((await T(pg, (id) => window.__t.store.children.find((c) => c.id === id).name, A)) === 'Amina Sofia', tag + ': pending rename is kept when the sheet closes');
  await openSheet(pg);
  check(!(await pg.$('[data-input="rename"]')), tag + ': reopened sheet starts without open edits');
  await pg.click(K(A, '[data-kact="edit"]'));
  await pg.fill(K(A, '[data-input="rename"]'), 'Amina');
  await pg.keyboard.press('Enter');
}

(async () => {
  let server = null;
  if (!BASE) { server = await startServer(); BASE = 'http://127.0.0.1:' + PORT; }
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

  /* ---------- phone 360x740: every flow ---------- */
  {
    const tag = '360x740';
    const { ctx, pg, errs } = await page(browser, { width: 360, height: 740 }, { touch: false });
    await openSheet(pg);
    check(await T(pg, () => window.__t.settings.isSettingsOpen()), tag + ': opens');
    await pg.screenshot({ path: path.join(OUT, tag + '-open.png') });
    await noHScroll(pg, tag);
    await minSizes(pg, tag);
    await contrast(pg, tag + ' girl');
    await kidFlows(pg, tag);
    await pg.screenshot({ path: path.join(OUT, tag + '-boy-open.png') });
    await contrast(pg, tag + ' boy');
    await recordingFlows(pg, tag);
    /* whole sheet with the groups folded (Chromium leaves screenshots taller than ~16k device px blank) */
    await T(pg, () => document.querySelectorAll('.set-details').forEach((d) => { d.open = false; }));
    await fullShot(pg, tag + '-full-boy.png');
    await T(pg, () => document.querySelectorAll('.set-details').forEach((d) => { d.open = true; }));
    await noHScroll(pg, tag + ' (all details open)');
    await minSizes(pg, tag + ' (all details open)');
    await contrast(pg, tag + ' boy (all details open)');
    await shotAt(pg, '.set-card-tips', tag + '-tips.png');
    await shotAt(pg, '.set-card-credits', tag + '-credits.png');
    await closeFlows(pg, tag);
    /* max children: the add button gives way to a note */
    await T(pg, () => {
      const t = window.__t, keep = t.store.activeId;
      let i = 1;
      while (t.store.children.length < 8) t.profiles.addChild(t.store, 'Lapsi ' + (i++), i % 2 ? 'girl' : 'boy', t.ids);
      t.profiles.setActive(t.store, keep);
      t.settings.closeSettings();
      t.settings.openSettings();
    });
    const mx = await T(pg, () => ({ add: !!document.querySelector('[data-kact="add"]'), note: (document.querySelector('.kids-full') || {}).textContent, n: document.querySelectorAll('.kid[data-kid]').length }));
    check(!mx.add && /enintään 8/.test(mx.note || '') && mx.n === 8, tag + ': 8 children -> no add button, note shown');
    await noHScroll(pg, tag + ' (8 children)');
    await shotAt(pg, '.kids-full', tag + '-max.png');
    await pg.keyboard.press('Escape');
    check(!errs.length, tag + ': no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  /* ---------- tablet 1024x768 ---------- */
  {
    const tag = '1024x768';
    const { ctx, pg, errs } = await page(browser, { width: 1024, height: 768 });
    await openSheet(pg);
    await pg.screenshot({ path: path.join(OUT, tag + '-open.png') });
    await noHScroll(pg, tag);
    await minSizes(pg, tag);
    await contrast(pg, tag + ' girl');
    const cols = await T(pg, () => { const c = document.querySelectorAll('.kid[data-kid]'); return Math.round(c[1].getBoundingClientRect().top) === Math.round(c[0].getBoundingClientRect().top); });
    check(cols, tag + ': two child cards side by side');
    await kidFlows(pg, tag);
    await pg.screenshot({ path: path.join(OUT, tag + '-boy-open.png') });
    await contrast(pg, tag + ' boy');
    await pg.click('[data-kact="add"]');
    await pg.fill('#kidNewName', 'Noor');
    await pg.click('[data-kact="addtheme"][data-v="girl"]');
    await pg.screenshot({ path: path.join(OUT, tag + '-add-form.png') });
    await pg.click('[data-kact="addok"]');
    await fullShot(pg, tag + '-full-boy.png');
    await T(pg, () => document.querySelectorAll('.set-details').forEach((d) => { d.open = true; }));
    await noHScroll(pg, tag + ' (all details open)');
    await minSizes(pg, tag + ' (all details open)');
    await contrast(pg, tag + ' boy (all details open)');
    await shotAt(pg, '.set-card-tips', tag + '-tips.png');
    await closeFlows(pg, tag);
    await pg.keyboard.press('Escape');
    check(!errs.length, tag + ': no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  /* ---------- landscape phone + mid sizes: layout only ---------- */
  for (const vp of [{ width: 740, height: 360 }, { width: 390, height: 844 }, { width: 600, height: 900 }]) {
    const tag = vp.width + 'x' + vp.height;
    const { ctx, pg, errs } = await page(browser, vp);
    await openSheet(pg);
    await noHScroll(pg, tag);
    await minSizes(pg, tag);
    await pg.screenshot({ path: path.join(OUT, tag + '-open.png') });
    check(!errs.length, tag + ': no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  /* ---------- no children yet ---------- */
  {
    const tag = 'empty-360';
    const { ctx, pg, errs } = await page(browser, { width: 360, height: 740 }, { query: '?kids=0' });
    await openSheet(pg);
    check(await pg.isVisible('.kids-empty'), tag + ': empty note shown');
    await pg.screenshot({ path: path.join(OUT, tag + '.png') });
    await pg.click('[data-kact="add"]');
    await pg.fill('#kidNewName', 'Sara');
    await pg.click('[data-kact="addtheme"][data-v="boy"]');
    await pg.click('[data-kact="addok"]');
    const st = await T(pg, () => ({ n: window.__t.store.children.length, active: window.__t.store.activeId === (window.__t.store.children[0] || {}).id, html: document.documentElement.dataset.theme,
      chip: !!document.querySelector('.kid-chip'), log: window.__t.log.slice() }));
    check(st.n === 1 && st.active && st.chip && st.html === 'boy' && JSON.stringify(st.log) === '["save","children"]', tag + ': first child added becomes the active one ' + JSON.stringify(st));
    await pg.screenshot({ path: path.join(OUT, tag + '-added.png') });
    await pg.click('[data-kact="del"]');
    await pg.click('[data-kact="delyes"]');
    check((await T(pg, () => window.__t.store.children.length === 0 && window.__t.store.activeId === null)) && await pg.isVisible('.kids-empty'), tag + ': deleting the last child -> empty again, activeId null');
    check(!errs.length, tag + ': no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  /* ---------- name row without a recording: device speech says the child's name ---------- */
  {
    const { ctx, pg, errs } = await page(browser, { width: 390, height: 844 }, {
      initScript: () => {
        window.__spoken = [];
        const fake = { speaking: false, pending: false, paused: false, getVoices: () => [{ lang: 'fi-FI', name: 'Testi-fi', localService: true }],
          speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, resume() {}, addEventListener() {} };
        Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
        window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      }
    });
    await openSheet(pg);
    const id = await T(pg, () => window.__t.store.children[0].id);
    const row = '.rec-row[data-id="name-' + id + '"]';
    await pg.locator(row).scrollIntoViewIfNeeded();
    await pg.click(row + ' [data-act="play"]');
    await pg.waitForFunction(() => window.__spoken.includes('Amina'), null, { timeout: 4000 }).catch(() => {});
    const spoken = await T(pg, () => window.__spoken.slice());
    check(spoken.includes('Amina'), 'name row Kuuntele without a recording speaks the name: ' + JSON.stringify(spoken));
    /* Puhe off: the preview still plays (always) */
    await pg.locator('.set-switch-input[data-key="speech"]').click({ force: true });
    await pg.locator(row).scrollIntoViewIfNeeded();
    await pg.click(row + ' [data-act="play"]');
    await pg.waitForFunction(() => window.__spoken.filter((x) => x === 'Amina').length >= 2, null, { timeout: 4000 }).catch(() => {});
    check((await T(pg, () => window.__spoken.filter((x) => x === 'Amina').length)) >= 2, 'name preview plays even with Puhe off');
    check(!errs.length, 'name speech: no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  /* ---------- mic permission denied -> friendly message ---------- */
  {
    const { ctx, pg, errs } = await page(browser, { width: 390, height: 844 }, {
      initScript: () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); }
    });
    await openSheet(pg);
    const row = '.rec-row[data-id="shahada-2"]';
    await pg.locator(row).scrollIntoViewIfNeeded();
    await pg.click(row + ' [data-act="rec"]');
    await pg.waitForFunction((r) => /luvan|estettiin/.test(document.querySelector(r + ' .rec-msg').textContent), row, { timeout: 4000 }).catch(() => {});
    const msg = await pg.textContent(row + ' .rec-msg');
    check(/Mikrofoni vaatii luvan|Mikrofonin käyttö estettiin/.test(msg), 'denied mic: Finnish message: ' + msg);
    check(!(await T(pg, (r) => document.querySelector(r + ' [data-act="rec"]').disabled, row)), 'denied mic: can retry');
    await pg.screenshot({ path: path.join(OUT, 'denied.png') });
    check(!errs.length, 'denied: no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }
  /* ---------- no MediaRecorder (unsupported browser / plain http) ---------- */
  {
    const { ctx, pg, errs } = await page(browser, { width: 390, height: 844 }, { initScript: () => { delete window.MediaRecorder; } });
    await openSheet(pg);
    await pg.locator('.set-card-rec').scrollIntoViewIfNeeded();
    check(await pg.isVisible('[data-rec-note]'), 'unsupported: explanation shown');
    check(await T(pg, () => Array.from(document.querySelectorAll('[data-act="rec"]')).every((b) => b.disabled)), 'unsupported: Nauhoita disabled');
    check(await T(pg, () => Array.from(document.querySelectorAll('[data-act="file"]')).every((b) => !b.disabled) && /tuoda/.test(document.querySelector('[data-rec-note]').textContent)), 'unsupported: Tuo tiedosto still works (note says so)');
    const row = '.rec-row[data-id="turn-1"]';
    await T(pg, () => document.querySelectorAll('.set-details').forEach((d) => { d.open = true; }));
    await pg.locator(row).scrollIntoViewIfNeeded();
    const [chooser] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.click(row + ' [data-act="file"]')]);
    await chooser.setFiles(path.join(ROOT, 'public/audio/fi/praise-1.mp3'));
    await pg.waitForFunction((r) => document.querySelector(r).dataset.st === 'own', row, { timeout: 8000 }).catch(() => {});
    check((await pg.textContent(row + ' .rec-status')) === 'Oma ääni', 'unsupported: imported file replaces the prompt');
    await pg.screenshot({ path: path.join(OUT, 'unsupported-import.png') });
    check(!errs.length, 'unsupported: no console errors ' + (errs.length ? JSON.stringify(errs) : ''));
    await ctx.close();
  }

  await browser.close();
  if (server) await server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
