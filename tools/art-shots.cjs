// Dev tool: renders tools/art-preview.html with Playwright and saves screenshots.
// Usage: node tools/art-shots.cjs <outDir>
// Serves the project root on a random local port (no Vite needed: art.js has no imports).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, '..', 'qa', 'art'));
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

const srv = http.createServer((q, r) => {
  let p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, b) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    r.end(b);
  });
});

(async () => {
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const port = srv.address().port;
  const b = await chromium.launch();
  const errs = [];
  const shoot = async (opts) => {
    const pg = await b.newPage(opts);
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
    pg.on('requestfailed', rq => errs.push('requestfailed: ' + rq.url()));
    await pg.goto(`http://127.0.0.1:${port}/tools/art-preview.html`);
    await pg.waitForFunction(() => window.__artReady === true);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(400);
    return pg;
  };

  const pg = await shoot({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  await pg.screenshot({ path: path.join(outDir, 'full.png'), fullPage: true });
  for (const id of ['hero', 'icons', 'smalls', 'crowns', 'palaces', 'palaceCounts', 'stickers', 'ayah', 'appicon']) {
    await pg.locator('#' + id).screenshot({ path: path.join(outDir, id + '.png') });
  }
  // Runtime toggle check: add .on to an empty crown slot and a dark window, then screenshot.
  const toggled = await pg.evaluate(() => {
    const slot = document.querySelector('#crowns .crown-slot:not(.on)');
    const win = document.querySelector('#palaces .pw:not(.on)');
    slot.classList.add('on'); win.classList.add('on');
    const r = slot.getBoundingClientRect(), w = win.getBoundingClientRect();
    return { slot: [r.width, r.height].map(Math.round), win: [w.width, w.height].map(Math.round),
      slots: document.querySelectorAll('.crown-slot[data-i]').length, wins: document.querySelectorAll('.pw[data-i]').length,
      ids: (() => { const all = [...document.querySelectorAll('[id]')].map(e => e.id); return all.length - new Set(all).size; })() };
  });
  await pg.waitForTimeout(900);
  await pg.locator('#palaces').screenshot({ path: path.join(outDir, 'palaces-toggled.png') });
  console.log('toggle/bbox check:', JSON.stringify(toggled));

  // Phone width + reduced motion: no horizontal scroll, silhouette crops to the centre.
  const ph = await shoot({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await ph.screenshot({ path: path.join(outDir, 'phone.png') });
  const scroll = await ph.evaluate(() => document.documentElement.scrollWidth);
  console.log('phone scrollWidth (page itself is a dev tool, wide panels expected):', scroll);

  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
