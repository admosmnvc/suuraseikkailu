// Tiny static server with HTTP Range support, for testing the built app (and its service worker).
// OWNER: pwa agent.
//
//   node tools/pwa-serve.cjs [dir=dist] [--port 5106] [--base /sub/suuraseikkailu/]
//
// Serves <dir> under <base> on 127.0.0.1 only. require()able: serve({ dir, port, base, fail, redirect })
// -> Promise<{ url, port, close() }>. fail(urlPath) may return an HTTP status to answer instead, and
// redirect(urlPath) a Location for a 308 (tools/pwa-test.cjs simulates broken downloads and the
// Cloudflare Pages '/index.html -> /' redirect with them).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8'
};

function serve({ dir = 'dist', port = 0, base = '/', fail = null, redirect = null } = {}) {
  const root = path.resolve(dir);
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const send = (status, headers, body) => { res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : body); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { Allow: 'GET, HEAD' }, '');
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return send(400, {}, 'bad url'); }
    if (urlPath + '/' === base) return send(301, { Location: base }, '');
    if (!urlPath.startsWith(base)) return send(404, { 'Content-Type': 'text/plain' }, 'not found');
    const forced = fail && fail(urlPath);
    if (forced) return send(forced, { 'Content-Type': 'text/plain' }, 'simulated ' + forced);
    const moved = redirect && redirect(urlPath);
    if (moved) return send(308, { Location: moved }, '');
    let file = path.join(root, urlPath.slice(base.length));
    if (!file.startsWith(root)) return send(403, {}, 'forbidden');
    let stat;
    try { stat = fs.statSync(file); } catch (e) { return send(404, { 'Content-Type': 'text/plain' }, 'not found'); }
    if (stat.isDirectory()) {
      if (!urlPath.endsWith('/')) return send(301, { Location: urlPath + '/' }, '');
      file = path.join(file, 'index.html');
      try { stat = fs.statSync(file); } catch (e) { return send(404, {}, 'not found'); }
    }
    const size = stat.size;
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      'Last-Modified': stat.mtime.toUTCString()
    };
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      let start = m && m[1] !== '' ? +m[1] : NaN;
      let end = m && m[2] !== '' ? +m[2] : NaN;
      if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - end); end = size - 1; }
      if (!isNaN(start) && isNaN(end)) end = size - 1;
      if (isNaN(start) || start >= size || end < start) {
        return send(416, { 'Content-Range': 'bytes */' + size }, '');
      }
      end = Math.min(end, size - 1);
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise((ok, ko) => {
    server.once('error', ko);
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      ok({
        port: p,
        url: `http://127.0.0.1:${p}${base}`,
        close: () => new Promise((done) => { server.close(() => done()); for (const s of sockets) s.destroy(); })
      });
    });
  });
}

module.exports = { serve };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
  const port = +opt('--port', 5106);
  const base = opt('--base', '/');
  const dir = args[0] || path.join(__dirname, '..', 'dist');
  serve({ dir, port, base }).then((s) => console.log(`Serving ${path.resolve(dir)} at ${s.url}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
