// End-to-end test of the built PWA (service worker, offline, Range, manifest, icons). OWNER: pwa agent.
//
//   npx vite build --outDir ../build-pwa --emptyOutDir && node tools/pwa-test.cjs ../build-pwa [--shots dir]
//
// Uses Playwright Chromium (env PLAYWRIGHT=<path> if not resolvable) and tools/pwa-serve.cjs.
// Runs at the site root and under /sub/suuraseikkailu/; offline checks also stop the server.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { serve } = require('./pwa-serve.cjs');

function loadPlaywright() {
  for (const t of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!t) continue;
    try { return require(t); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT=/path/to/node_modules/playwright');
}

const args = process.argv.slice(2);
const shotsAt = args.indexOf('--shots');
const SHOTS = shotsAt >= 0 ? path.resolve(args.splice(shotsAt, 2)[1]) : null;
const BUILD = path.resolve(args[0] || path.join(__dirname, '..', '..', 'build-pwa'));

let failed = 0;
const notes = [];
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  — ' + detail : ''}`);
}

function walk(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), prefix + e.name + '/'));
    else out.push(prefix + e.name);
  }
  return out;
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function readSW(dir) {
  const text = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  const version = /const VERSION = "([0-9a-f]+)";/.exec(text);
  const files = /const FILES = (\[[\s\S]*?\]);/.exec(text);
  return { text, version: version && version[1], files: files ? JSON.parse(files[1]) : [] };
}
function pngInfo(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25], sig: b.slice(1, 4).toString() };
}

// ---------- static checks ----------
function staticChecks() {
  console.log(`\n# static: ${BUILD}`);
  const sw = readSW(BUILD);
  check('sw.js has VERSION + FILES', !!sw.version && sw.files.length > 0, `${sw.version}, ${sw.files.length} files`);
  try { new vm.Script(sw.text, { filename: 'sw.js' }); check('sw.js parses', true); } catch (e) { check('sw.js parses', false, e.message); }
  const onDisk = walk(BUILD).filter((f) => f !== 'sw.js').sort();
  const listed = sw.files.map((f) => f.split('/').map(decodeURIComponent).join('/')).sort();
  check('precache lists every file in the build', JSON.stringify(onDisk) === JSON.stringify(listed),
    `${onDisk.length} on disk / ${listed.length} listed`);
  const kinds = ['index.html', 'assets/', 'audio/fi/', 'audio/shahada-1.mp3', 'audio/001001.mp3', 'icons/', 'manifest.webmanifest'];
  check('precache covers html, assets, audio/fi, shahada, recitation, icons, manifest',
    kinds.every((k) => listed.some((f) => f.startsWith(k))));

  let mf = null;
  try { mf = JSON.parse(fs.readFileSync(path.join(BUILD, 'manifest.webmanifest'), 'utf8')); } catch (e) { /* below */ }
  check('manifest is valid JSON', !!mf);
  if (mf) {
    const want = { name: 'Suuraseikkailu', short_name: 'Suuraseikkailu', lang: 'fi', start_url: './', scope: './',
      display: 'standalone', orientation: 'any', background_color: '#F6FBFF', theme_color: '#E4F3FF' };
    const bad = Object.keys(want).filter((k) => mf[k] !== want[k]);
    check('manifest fields', bad.length === 0 && typeof mf.description === 'string', bad.join(', ') || 'ok');
    const need = [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']];
    check('manifest icons 192 any, 512 any, 512 maskable',
      need.every(([s, p]) => mf.icons.some((i) => i.sizes === s && (i.purpose || 'any').split(' ').includes(p))));
    for (const icon of mf.icons) {
      const file = path.join(BUILD, icon.src);
      const info = fs.existsSync(file) ? pngInfo(file) : null;
      check(`icon ${icon.src}`, !!info && info.sig === 'PNG' && `${info.w}x${info.h}` === icon.sizes, info ? `${info.w}x${info.h}` : 'missing');
    }
  }
  for (const [f, px] of [['icons/apple-touch-icon.png', 180], ['icons/favicon-32.png', 32]]) {
    const p = path.join(BUILD, f);
    const info = fs.existsSync(p) ? pngInfo(p) : null;
    check(`${f} ${px}x${px} opaque`, !!info && info.w === px && info.h === px && info.colorType === 2,
      info ? `${info.w}x${info.h} colortype ${info.colorType}` : 'missing');
  }
  const html = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');
  const head = html.split('</head>')[0];
  const tags = {
    manifest: /<link rel="manifest" href="\.\/manifest\.webmanifest">/,
    'apple-touch-icon': /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/,
    'theme-color': /<meta name="theme-color" content="#E4F3FF">/,
    'apple-mobile-web-app-capable': /<meta name="apple-mobile-web-app-capable" content="yes">/,
    'apple-mobile-web-app-title': /<meta name="apple-mobile-web-app-title" content="Suuraseikkailu">/,
    'viewport-fit=cover': /<meta name="viewport" content="[^"]*viewport-fit=cover/,
    'relative asset urls': /src="\.\/assets\//
  };
  const missing = Object.keys(tags).filter((k) => !tags[k].test(head));
  check('index.html head tags', missing.length === 0, missing.join(', ') || 'ok');
  return sw;
}

// ---------- browser helpers ----------
async function waitForSW(page, timeout = 30000) {
  return page.evaluate((timeout) => Promise.race([
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
      const w = reg.active;
      if (w.state !== 'activated') await new Promise((r) => w.addEventListener('statechange', () => w.state === 'activated' && r()));
      return { scope: reg.scope, state: reg.active && reg.active.state, controlled: !!navigator.serviceWorker.controller };
    })(),
    new Promise((r) => setTimeout(() => r(null), timeout))
  ]), timeout);
}
async function cacheState(page) {
  return page.evaluate(async () => {
    const scope = (await navigator.serviceWorker.getRegistration()).scope;
    const names = (await caches.keys()).filter((n) => n.startsWith('suuraseikkailu:' + scope + ':'));
    const keys = names.length ? (await (await caches.open(names[0])).keys()).map((r) => r.url) : [];
    return { scope, names, keys };
  });
}
async function rangeFetch(page, url, range) {
  return page.evaluate(async ({ url, range }) => {
    const r = await fetch(url, range ? { headers: { Range: range } } : {});
    const b = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, len: b.length, cr: r.headers.get('Content-Range'), cl: r.headers.get('Content-Length'),
      type: r.headers.get('Content-Type'), head: Array.from(b.slice(0, 16)), tail: Array.from(b.slice(-16)) };
  }, { url, range });
}
function bytesOk(res, buf, start, end) {
  const slice = buf.slice(start, end + 1);
  return res.len === slice.length &&
    JSON.stringify(res.head) === JSON.stringify(Array.from(slice.slice(0, 16))) &&
    JSON.stringify(res.tail) === JSON.stringify(Array.from(slice.slice(-16)));
}

async function siteRun(browser, base, dir, sw, { update }) {
  console.log(`\n# site at ${base}`);
  let server = await serve({ dir, base });
  const port = server.port;
  const url = server.url;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [], consoleErrors = [], failedReqs = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', (r) => failedReqs.push(r.url() + ' ' + (r.failure() || {}).errorText));

  await page.goto(url, { waitUntil: 'load' });
  const t0 = Date.now();
  const st = await waitForSW(page);
  check('service worker activated and controls the page', !!st && st.state === 'activated' && st.controlled,
    st ? `${st.scope} in ${Date.now() - t0} ms` : 'timeout');
  check('scope is the app folder', !!st && st.scope === url, st && st.scope);

  const cs = await cacheState(page);
  const expected = sw.files.map((f) => new URL(f, url).href).concat(url).sort();
  check('exactly one cache for this folder', cs.names.length === 1, cs.names.join(' | '));
  check('cache holds every precached file + folder URL', JSON.stringify(cs.keys.slice().sort()) === JSON.stringify(expected),
    `${cs.keys.length}/${expected.length}`);
  check('cache name carries the build version', cs.names.length === 1 && cs.names[0].endsWith(':' + sw.version));

  const mfOk = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]');
    const mfUrl = new URL(link.getAttribute('href'), document.baseURI);
    const mf = await (await fetch(mfUrl)).json();
    const icons = await Promise.all(mf.icons.map((i) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok(`${img.naturalWidth}x${img.naturalHeight}` === i.sizes);
      img.onerror = () => ok(false);
      img.src = new URL(i.src, mfUrl).href;
    })));
    const start = new URL(mf.start_url, mfUrl).href;
    return { icons: icons.every(Boolean), start, n: icons.length };
  });
  check('manifest fetch + all icons load in the browser', mfOk.icons, `${mfOk.n} icons`);
  check('start_url resolves to the app folder', mfOk.start === url, mfOk.start);

  // ---- offline: emulate offline AND stop the server, so nothing can come from the network ----
  await context.setOffline(true);
  await server.close();
  failedReqs.length = 0;
  pageErrors.length = 0;
  await page.evaluate(() => { window.__beforeReload = 1; });
  const resp = await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const view = await page.evaluate(() => ({
    reloaded: !window.__beforeReload,
    title: document.title,
    text: (document.body.innerText || '').trim().length,
    els: document.body.querySelectorAll('*').length,
    css: [...document.styleSheets].length,
    fromSW: performance.getEntriesByType('navigation')[0].workerStart > 0
  }));
  check('offline reload renders the app', !!resp && resp.status() === 200 && view.reloaded && view.title === 'Suuraseikkailu' &&
    view.text > 0 && view.els > 10 && view.css > 0, JSON.stringify(view));
  check('offline reload: no failed requests', failedReqs.length === 0, failedReqs.slice(0, 5).join(' ; ') || 'none');
  check('offline reload: no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' ; ') || 'none');
  const fonts = await page.evaluate(async () => {
    const faces = [...document.fonts];
    const res = await Promise.all(faces.map((f) => f.load().then(() => 'ok', () => 'fail ' + f.family + ' ' + f.weight)));
    return { n: faces.length, bad: res.filter((r) => r !== 'ok') };
  });
  check('offline: every bundled font face loads from the cache', fonts.n > 0 && fonts.bad.length === 0 && failedReqs.length === 0,
    `${fonts.n} faces${fonts.bad.length ? ', ' + fonts.bad.join(', ') : ''}`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `offline-${base === '/' ? 'root' : 'sub'}.png`) });

  const mp3 = fs.readFileSync(path.join(dir, 'audio/001001.mp3'));
  const size = mp3.length;
  let r = await rangeFetch(page, 'audio/001001.mp3', 'bytes=0-99');
  check('offline Range bytes=0-99 -> 206, 100 bytes', r.status === 206 && r.len === 100 && r.cr === `bytes 0-99/${size}` &&
    r.cl === '100' && bytesOk(r, mp3, 0, 99), `${r.status} ${r.len} ${r.cr} ${r.type}`);
  r = await rangeFetch(page, 'audio/001001.mp3', 'bytes=-100');
  check('offline Range bytes=-100 -> last 100 bytes', r.status === 206 && r.len === 100 && bytesOk(r, mp3, size - 100, size - 1), `${r.status} ${r.cr}`);
  r = await rangeFetch(page, 'audio/001001.mp3', 'bytes=1000-');
  check('offline Range bytes=1000- -> rest of file', r.status === 206 && r.len === size - 1000 && bytesOk(r, mp3, 1000, size - 1), `${r.status} ${r.cr}`);
  r = await rangeFetch(page, 'audio/001001.mp3', 'bytes=0-');
  check('offline Range bytes=0- -> whole file as 206', r.status === 206 && r.len === size, `${r.status} ${r.cr}`);
  r = await rangeFetch(page, 'audio/001001.mp3', `bytes=${size + 10}-`);
  check('offline Range beyond end -> 416', r.status === 416 && r.cr === `bytes */${size}`, `${r.status} ${r.cr}`);
  r = await rangeFetch(page, 'audio/001001.mp3', null);
  check('offline plain GET -> 200 full file', r.status === 200 && r.len === size, `${r.status} ${r.len}`);
  const fi = fs.readFileSync(path.join(dir, 'audio/fi/welcome.mp3'));
  r = await rangeFetch(page, 'audio/fi/welcome.mp3', 'bytes=0-1');
  check('offline Range on audio/fi clip (Safari probe 0-1)', r.status === 206 && r.len === 2 && bytesOk(r, fi, 0, 1), `${r.status} ${r.cr}`);

  const media = await page.evaluate(async () => {
    const out = {};
    for (const src of ['audio/001001.mp3', 'audio/shahada-1.mp3', 'audio/fi/turn-all.mp3']) {
      out[src] = await new Promise((ok) => {
        const a = new Audio();
        a.preload = 'auto';
        a.onloadedmetadata = () => ok(Math.round(a.duration * 100) / 100);
        a.onerror = () => ok('error ' + (a.error && a.error.code));
        a.src = src;
        setTimeout(() => ok('timeout'), 8000);
      });
    }
    return out;
  });
  check('offline <audio> loads recitation, Shahada and Finnish clips', Object.values(media).every((d) => typeof d === 'number' && d > 0.3),
    JSON.stringify(media));

  const navs = [['?from=homescreen', 'query string', url + '?from=homescreen'], ['index.html', 'index.html', url + 'index.html'],
    ['missing.html', 'unknown page -> app', url + 'missing.html'], ['nowhere/deep', 'unknown deep path -> redirect to app folder', url]];
  for (const [nav, label, endUrl] of navs) {
    failedReqs.length = 0;
    const res = await page.goto(url + nav, { waitUntil: 'load' }).catch((e) => ({ status: () => e.message }));
    const title = await page.title().catch(() => '');
    const ok = res.status() === 200 && title === 'Suuraseikkailu' && page.url() === endUrl && failedReqs.length === 0;
    check(`offline navigation: ${label}`, ok, `${res.status()} "${title}" ${page.url()} failed=${failedReqs.length}`);
  }

  if (update) {
    // ---- update: new build content -> new version replaces the old cache without reloading the page ----
    const html = path.join(dir, 'index.html');
    fs.writeFileSync(html, fs.readFileSync(html, 'utf8') + '<!-- update-test -->\n');
    const swPath = path.join(dir, 'sw.js');
    const newVersion = sw.version.split('').reverse().join('');
    fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(`"${sw.version}"`, `"${newVersion}"`));
    server = await serve({ dir, base, port });
    await context.setOffline(false);
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => { window.__marker = 'kept'; });
    const upd = await page.evaluate(async (newVersion) => {
      const reg = await navigator.serviceWorker.getRegistration();
      // controllerchange fires when the new worker starts activating; cleanup is done once it is 'activated'
      const changed = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', () => {
        const w = navigator.serviceWorker.controller;
        if (w.state === 'activated') r(true);
        else w.addEventListener('statechange', () => w.state === 'activated' && r(true));
      }, { once: true }));
      await reg.update();
      const ok = await Promise.race([changed, new Promise((r) => setTimeout(() => r(false), 30000))]);
      const names = (await caches.keys()).filter((n) => n.startsWith('suuraseikkailu:' + reg.scope));
      return { ok, names, marker: window.__marker, isNew: names.length === 1 && names[0].endsWith(':' + newVersion) };
    }, newVersion);
    check('update: new worker takes over (skipWaiting + claim) without reload', upd.ok && upd.marker === 'kept', JSON.stringify(upd));
    check('update: old cache deleted, only the new version left', upd.isNew, upd.names.join(' | '));
    await context.setOffline(true);
    await server.close();
    await page.reload({ waitUntil: 'load' });
    const html2 = await page.evaluate(async () => (await (await fetch('index.html')).text()).includes('update-test'));
    check('update: offline start serves the new version', html2 && (await page.title()) === 'Suuraseikkailu');
  } else {
    await server.close().catch(() => {});
  }
  if (consoleErrors.length) notes.push(`console errors at ${base}: ${consoleErrors.slice(0, 5).join(' ; ')}`);
  await context.close();
}

// Cloudflare Pages answers /index.html with a redirect to the folder: the cached copy must still
// open offline (a redirected response must never answer a navigation).
async function redirectRun(browser) {
  console.log('\n# host that redirects index.html -> folder (Cloudflare Pages style)');
  const base = '/cf/';
  const server = await serve({ dir: BUILD, base, redirect: (p) => (p === base + 'index.html' ? base : null) });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failedReqs = [];
  page.on('requestfailed', (r) => failedReqs.push(r.url()));
  await page.goto(server.url, { waitUntil: 'load' });
  const st = await waitForSW(page);
  check('redirecting host: precache completes', !!st);
  await context.setOffline(true);
  await server.close();
  for (const nav of ['', 'index.html']) {
    const res = await page.goto(server.url + nav, { waitUntil: 'load' }).catch((e) => ({ status: () => e.message.split('\n')[0] }));
    check(`redirecting host: offline open ${nav || './'}`, res.status() === 200 && (await page.title()) === 'Suuraseikkailu' &&
      failedReqs.length === 0, `${res.status()} failed=${failedReqs.length}`);
  }
  await context.close();
}

async function failureRuns(browser, sw) {
  console.log('\n# broken downloads during install');
  const victim = 'audio/108002.mp3';
  // 1) one file always fails -> install aborts cleanly, no half cache, app still works online
  {
    let hits = 0;
    const server = await serve({ dir: BUILD, base: '/', fail: (p) => (p === '/' + victim && ++hits ? 500 : 0) });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'load' });
    const res = await page.evaluate(async () => {
      const t0 = Date.now();
      let reg = null, seen = false;
      while (Date.now() - t0 < 20000) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.installing) seen = true;
        if (seen && (!reg || (!reg.installing && !reg.waiting))) break;   // a failed first install clears the registration
        await new Promise((r) => setTimeout(r, 200));
      }
      const names = (await caches.keys()).filter((n) => n.startsWith('suuraseikkailu:'));
      return { ms: Date.now() - t0, seen, registered: !!reg, active: !!(reg && reg.active), installing: !!(reg && reg.installing), names };
    });
    check('permanent 500 on one file: 3 tries, install fails, no cache left behind',
      res.seen && !res.active && !res.installing && res.names.length === 0 && hits === 3, JSON.stringify(res) + ` hits=${hits}`);
    const alive = await page.evaluate(() => document.title === 'Suuraseikkailu' && document.body.querySelectorAll('*').length > 10);
    check('permanent 500: app still runs online', alive);
    await context.close();
    await server.close();
  }
  // 2) one file fails twice, then works -> retries make the install succeed
  {
    let hits = 0;
    const server = await serve({ dir: BUILD, base: '/', fail: (p) => (p === '/' + victim && ++hits <= 2 ? 503 : 0) });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'load' });
    const st = await waitForSW(page);
    const cs = await cacheState(page);
    check('flaky file (2× 503): retried and precache completes', !!st && cs.keys.length === sw.files.length + 1,
      `${hits} requests for ${victim}, ${cs.keys.length}/${sw.files.length + 1} cached`);
    await context.close();
    await server.close();
  }
}

(async () => {
  if (!fs.existsSync(path.join(BUILD, 'index.html'))) { console.error('No build at ' + BUILD); process.exit(2); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const sw = staticChecks();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(path.dirname(BUILD), '.pwa-test-'));
  try {
    const rootCopy = path.join(tmp, 'root');
    const subCopy = path.join(tmp, 'sub');
    copyDir(BUILD, rootCopy);
    copyDir(BUILD, subCopy);
    await siteRun(browser, '/', rootCopy, sw, { update: false });
    await siteRun(browser, '/sub/suuraseikkailu/', subCopy, sw, { update: true });
    await redirectRun(browser);
    await failureRuns(browser, sw);
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const n of notes) console.log('NOTE  ' + n);
  console.log(`\n${failed ? 'FAILED: ' + failed + ' check(s)' : 'ALL PASS'}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
