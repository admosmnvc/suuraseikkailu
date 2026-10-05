// Dev tool: screenshots ART.cover() and ART.intro() full-screen at several viewports (intro also greyscaled). Usage: node tools/art-shots-cover.cjs [outDir]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, '..', 'qa', 'v3-art2'));
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(b); });
});
(async () => {
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const port = srv.address().port, b = await chromium.launch(), errs = [];
  const jobs = [];
  for (const [w, h] of [[390, 844], [1024, 768], [360, 740], [768, 1024], [1440, 900], [844, 390]]) jobs.push(['cover', w, h, '']);
  for (const [w, h, o] of [[390, 844, 'portrait'], [360, 740, 'portrait'], [1280, 720, 'landscape'], [1024, 768, 'landscape']]) {
    jobs.push(['intro', w, h, '&o=' + o]); jobs.push(['intro', w, h, '&o=' + o + '&nobtn=1&grey=1']);
  }
  for (const [which, w, h, extra] of jobs) {
    {
      const pg = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
      pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
      await pg.goto(`http://127.0.0.1:${port}/tools/art-preview.html?only=${which}${extra}`);
      await pg.waitForFunction(() => window.__artReady === true);
      await pg.evaluate(() => document.fonts.ready);
      await pg.waitForTimeout(250);
      await pg.screenshot({ path: path.join(outDir, `${which}-${w}x${h}${extra.includes('grey') ? '-grey' : ''}.png`) });
      await pg.close();
    }
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
