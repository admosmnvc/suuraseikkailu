/* Suuraseikkailu service worker runtime. OWNER: pwa agent.
 *
 * Not loaded directly: the 'suuraseikkailu-sw' plugin in vite.config.js prepends
 *     const VERSION = '<hash of every file in dist>';
 *     const FILES = ['index.html', 'assets/…', 'audio/…', …];   // relative to sw.js
 * and writes the result to dist/sw.js after each build. Classic worker script: no imports.
 *
 * install  : download every file of this build into a new cache (3 tries per file). If one file
 *            still fails, the new cache is deleted and install fails, so the previous version (or
 *            plain online use) stays in charge; the browser tries again on the next visit.
 *            skipWaiting(): a new version takes over without a reload under the child.
 * activate : delete older caches of this same app folder, clients.claim().
 * fetch    : same-origin GET inside our folder -> cache first, network fallback (successful
 *            responses are stored). Navigations -> cached page, offline -> cached index.html.
 *            Range requests (iOS Safari media) -> 206 Partial Content sliced from the cached file.
 *            Cross-origin requests are left to the browser.
 * ('use strict' is emitted by the generator, as the first statement of sw.js.)
 */

var SCOPE = self.registration.scope;                 // e.g. https://host/sub/suuraseikkailu/
var CACHE_BASE = 'suuraseikkailu:' + SCOPE + ':';    // one app folder = one cache family
var CACHE = CACHE_BASE + VERSION;
var INDEX_URL = new URL('index.html', self.location.href).href;
var TRIES = 3;
var PARALLEL = 4;

function noop() {}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Navigations must not be answered with a redirected response (Cloudflare Pages redirects
// /index.html -> /), so such responses are stored as plain copies.
async function plain(res) {
  if (!res.redirected) return res;
  var body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function download(url) {
  var lastErr = null;
  for (var attempt = 0; attempt < TRIES; attempt++) {
    if (attempt) await sleep(attempt * 800);
    try {
      var res = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (res.status === 200) return await plain(res);
      lastErr = new Error('HTTP ' + res.status + ' ' + url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function precache() {
  var cache = await caches.open(CACHE);
  var queue = FILES.slice();
  var failure = null;
  async function worker() {
    while (queue.length && !failure) {
      var url = new URL(queue.shift(), self.location.href).href;
      try {
        if (await cache.match(url)) continue;        // already stored by an interrupted install
        await cache.put(url, await download(url));
      } catch (e) {
        failure = failure || e;
      }
    }
  }
  var workers = [];
  for (var i = 0; i < PARALLEL; i++) workers.push(worker());
  await Promise.all(workers);
  if (!failure) {
    // the bare folder URL (start_url './') opens the same page
    var index = await cache.match(INDEX_URL);
    if (index) await cache.put(SCOPE, index);
    else failure = new Error('index.html missing from precache');
  }
  if (failure) {
    await caches.delete(CACHE);                       // never leave a half-filled version behind
    throw failure;
  }
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var names = await caches.keys();
    await Promise.all(names.map(function (name) {
      return name !== CACHE && name.indexOf(CACHE_BASE) === 0 ? caches.delete(name) : null;
    }));
    await self.clients.claim();
  })());
});

async function fromCache(cache, req, opts) {
  try { return await cache.match(req, opts); } catch (e) { return undefined; }
}

function store(event, cache, key, res) {
  if (res.status !== 200 || res.type !== 'basic') return;
  var copy = res.clone();
  var job = plain(copy).then(function (r) { return cache.put(key, r); }).catch(noop);
  try { event.waitUntil(job); } catch (e) { /* event already finished: the put still runs */ }
}

async function cacheFirst(event) {
  var req = event.request;
  var cache = await caches.open(CACHE);
  var hit = await fromCache(cache, req, { ignoreVary: true });
  if (hit) return hit;
  var res = await fetch(req);
  store(event, cache, req, res);
  return res;
}

// Opening the app: network first (a new version shows at once), cache when offline or the network is slow.
// Network answers are not stored: offline the app always starts from its own complete, consistent precache.
var NAV_TIMEOUT_MS = 3000;
function fetchWithin(req, ms) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
    fetch(req, { cache: 'no-store' }).then(function (res) { clearTimeout(timer); resolve(res); },
      function (err) { clearTimeout(timer); reject(err); });
  });
}

async function navigate(event) {
  var req = event.request;
  var cache = await caches.open(CACHE);
  try {
    var net = await fetchWithin(req, NAV_TIMEOUT_MS);
    if (net && net.ok) return net;
  } catch (e) { /* offline or slow: use the stored app */ }
  var hit = await fromCache(cache, req, { ignoreSearch: true, ignoreVary: true });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (e) {
    // offline and not cached: open the app. Deeper paths are redirected to the app folder so the
    // page's relative URLs (./assets/…) still point into the cache.
    var index = await fromCache(cache, INDEX_URL, { ignoreVary: true });
    if (!index) throw e;
    var dir = req.url.split(/[?#]/)[0].replace(/[^/]*$/, '');
    return dir === SCOPE ? index : Response.redirect(SCOPE, 302);
  }
}

// RFC 9110 single byte range: "bytes=a-b", "bytes=a-", "bytes=-n" (only the first of a list).
function parseRange(header, size) {
  var m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*(?:,|$)/i.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;            // unusable header -> full file
  var start, end;
  if (m[1] === '') {
    var n = parseInt(m[2], 10);
    if (!n) return { bad: true };
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (start >= size || end < start) return { bad: true };
  return { start: start, end: end };
}

async function partial(full, header) {
  var blob = await full.blob();
  var size = blob.size;
  var type = full.headers.get('Content-Type') || blob.type || 'application/octet-stream';
  var r = parseRange(header, size);
  var headers = new Headers({ 'Content-Type': type, 'Accept-Ranges': 'bytes' });
  if (!r) {
    headers.set('Content-Length', String(size));
    return new Response(blob, { status: 200, statusText: 'OK', headers: headers });
  }
  if (r.bad) {
    headers.set('Content-Range', 'bytes */' + size);
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers: headers });
  }
  headers.set('Content-Range', 'bytes ' + r.start + '-' + r.end + '/' + size);
  headers.set('Content-Length', String(r.end - r.start + 1));
  return new Response(blob.slice(r.start, r.end + 1), { status: 206, statusText: 'Partial Content', headers: headers });
}

async function ranged(event) {
  var req = event.request;
  var cache = await caches.open(CACHE);
  var full = await fromCache(cache, req.url, { ignoreVary: true });
  if (!full) {
    // not cached yet: fetch the whole file once (no Range), keep it, then answer the range
    full = await fetch(req.url, { credentials: 'same-origin' });
    if (full.status !== 200) return full;
    store(event, cache, req.url, full);
  }
  return partial(full, req.headers.get('Range'));
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf(SCOPE) !== 0) return;          // cross-origin or outside our folder
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  if (req.headers.has('Range')) event.respondWith(ranged(event));
  else if (req.mode === 'navigate') event.respondWith(navigate(event));
  else event.respondWith(cacheFirst(event));
});
