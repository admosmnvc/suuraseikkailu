// Dev tool: renders tools/art-preview.html with Playwright and saves screenshots (v3 pop art).
// Usage: node tools/art-shots.cjs [outDir]   (default ../qa/v3-art2). Serves the project root on a random port.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, '..', 'qa', 'v3-art2'));
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const only = process.argv[3] ? process.argv[3].split(',') : null;

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
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const port = srv.address().port;
  const b = await chromium.launch();
  const errs = [];
  const open = async (opts, query) => {
    const pg = await b.newPage(opts);
    pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    pg.on('requestfailed', (rq) => errs.push('requestfailed: ' + rq.url()));
    await pg.goto(`http://127.0.0.1:${port}/tools/art-preview.html${query || ''}`);
    await pg.waitForFunction(() => window.__artReady === true);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    return pg;
  };
  const want = (n) => !only || only.includes(n);

  // covers at several viewports (composition follows orientation)
  // covers: see tools/art-shots-cover.cjs

  const pg = await open({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const secs = await pg.evaluate(() => [...document.querySelectorAll('section[id]')].map((s) => s.id));
  for (const id of secs) if (want(id) || want('sections')) await pg.locator('#' + id).screenshot({ path: path.join(outDir, id + '.png') });

  // runtime toggles: add .on live, check the pop-in + :has() completion
  const check = await pg.evaluate(() => {
    const out = {};
    const all = [...document.querySelectorAll('[id]')].map((e) => e.id);
    out.dupIds = all.length - new Set(all).size;
    out.pw = document.querySelectorAll('#progress-girl .pw[data-i]').length;
    out.rp = document.querySelectorAll('#progress-boy .rp[data-i]').length;
    out.slots = document.querySelectorAll('#reward-girl .slot[data-i]').length + '/' + document.querySelectorAll('#reward-boy .slot[data-i]').length;
    // last-but-one progress (17/18) of each theme: switch the last part on live
    const g = document.querySelectorAll('#progress-girl .art')[17], bo = document.querySelectorAll('#progress-boy .art')[17];
    g.querySelector('.pw:not(.on)').classList.add('on'); bo.querySelector('.rp:not(.on)').classList.add('on');
    const fx = (el) => getComputedStyle(el.querySelector('.art-done-fx')).opacity;
    out.liveComplete = [fx(g), fx(bo)];
    const rg = document.querySelectorAll('#reward-girl .art')[3], rb = document.querySelectorAll('#reward-boy .art')[3];
    rg.querySelector('.slot:not(.on)').classList.add('on'); rb.querySelector('.slot:not(.on)').classList.add('on');
    return out;
  });
  await pg.waitForTimeout(800);
  if (want('toggled')) {
    await pg.locator('#progress-girl').screenshot({ path: path.join(outDir, 'toggled-progress-girl.png') });
    await pg.locator('#progress-boy').screenshot({ path: path.join(outDir, 'toggled-progress-boy.png') });
  }
  console.log('checks:', JSON.stringify(check));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
