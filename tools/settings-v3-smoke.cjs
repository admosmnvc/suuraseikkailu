/* Smoke: the built app mounts the v3 settings sheet (dev tool). Run: node tools/settings-v3-smoke.cjs <buildDir> */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIR = path.resolve(process.argv[2] || '../build-v3-settings');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const p = path.join(DIR, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
}).listen(5202, '127.0.0.1', async () => {
  const browser = await chromium.launch();
  const pg = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await pg.goto('http://127.0.0.1:5202/index.html');
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => { const s = document.getElementById('settings'); return { root: !!s && s.classList.contains('set-root'), sheet: !!(s && s.querySelector('.set-sheet')), kids: !!(s && s.querySelector('.set-card-kids')), hidden: s && s.hidden }; });
  console.log(JSON.stringify(r), errs.length ? 'ERRORS ' + JSON.stringify(errs) : 'no console errors');
  await browser.close(); srv.close();
  process.exit(r.root && r.sheet && r.kids && r.hidden ? 0 : 1);
});
