// Rasterises ART.appIcon() (src/art.js) into the PWA icons in public/icons/. OWNER: pwa agent.
//
//   node tools/make-icons.cjs                     # writes public/icons/*.png
//   node tools/make-icons.cjs --preview out.png   # also renders a check sheet (masks, safe zone)
//
// Needs Playwright with Chromium (env PLAYWRIGHT=<path to the playwright package> if it is not
// resolvable). Chromium draws the SVG at the exact target size; the pixels are written here as
// opaque 8-bit RGB PNGs (no alpha channel, so iOS shows no black corners).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'icons');
const MASKABLE_SCALE = 0.9;            // art + this scale keeps crown and crystal well inside the 80 % circle
const FAVICON_VIEWBOX = '96 96 320 320'; // tiny sizes: crop to the crown so it stays readable

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'];
  for (const t of tries) {
    if (!t) continue;
    try { return require(t); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT=/path/to/node_modules/playwright');
}

// ---- SVG variants (string edits on the root <svg> tag only) ----
function rootAttr(svg, name, value) {
  return svg.replace(/<svg\b[^>]*>/, (tag) => {
    const re = new RegExp('\\s' + name + '="[^"]*"');
    return re.test(tag) ? tag.replace(re, ' ' + name + '="' + value + '"') : tag.replace(/^<svg/, '<svg ' + name + '="' + value + '"');
  });
}
function sized(svg, px) { return rootAttr(rootAttr(svg, 'width', px), 'height', px); }
function maskable(svg) {
  // keep the full-bleed background rect, shrink everything drawn on top of it around the centre
  const re = /(<\/defs>\s*<rect\b[^>]*\bwidth="512"[^>]*\/>)([\s\S]*)(<\/svg>\s*)$/;
  if (!re.test(svg)) throw new Error('appIcon(): expected </defs><rect width="512" …/> background – update make-icons.cjs');
  const s = MASKABLE_SCALE;
  return svg.replace(re, `$1<g transform="translate(256 256) scale(${s}) translate(-256 -256)">$2</g>$3`);
}

// ---- PNG encoder (RGB, Paeth filter) ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function encodePNG(w, h, rgba) {
  const stride = w * 3;
  const rgb = Buffer.alloc(stride * h);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]; }
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1), r = y * stride;
    raw[o] = 4;
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? rgb[r + x - 3] : 0, b = y ? rgb[r - stride + x] : 0, c = x >= 3 && y ? rgb[r - stride + x - 3] : 0;
      raw[o + 1 + x] = (rgb[r + x] - paeth(a, b, c)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- rasterise in Chromium ----
async function rasterise(page, svg, px) {
  const b64 = await page.evaluate(async ({ svg, px }) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#F6FBFF';            // only shows if the art ever has transparent pixels
    ctx.fillRect(0, 0, px, px);
    ctx.drawImage(img, 0, 0, px, px);
    const data = ctx.getImageData(0, 0, px, px).data;
    let s = '';
    for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    return btoa(s);
  }, { svg: sized(svg, px), px });
  return encodePNG(px, px, Buffer.from(b64, 'base64'));
}

async function main() {
  const previewAt = process.argv.indexOf('--preview');
  const previewPath = previewAt > 0 ? path.resolve(process.argv[previewAt + 1] || 'icons-preview.png') : null;
  const mod = await import(pathToFileURL(path.join(ROOT, 'src', 'art.js')).href);
  const ART = mod.default || mod.ART;
  const svg = ART.appIcon();
  if (!/^<svg\b/.test(svg) || /<text\b/.test(svg)) throw new Error('appIcon(): expected a text-free <svg>');

  const jobs = [
    ['icon-192.png', svg, 192],
    ['icon-512.png', svg, 512],
    ['icon-maskable-512.png', maskable(svg), 512],
    ['apple-touch-icon.png', svg, 180],
    ['favicon-32.png', rootAttr(svg, 'viewBox', FAVICON_VIEWBOX), 32]
  ];
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>icons</title>');
    fs.mkdirSync(OUT, { recursive: true });
    const made = {};
    for (const [name, src, px] of jobs) {
      const png = await rasterise(page, src, px);
      fs.writeFileSync(path.join(OUT, name), png);
      made[name] = 'data:image/png;base64,' + png.toString('base64');
      console.log(`${name.padEnd(24)} ${px}x${px}  ${(png.length / 1024).toFixed(1)} kB`);
    }
    if (previewPath) {
      const m = made['icon-maskable-512.png'];
      await page.setViewportSize({ width: 1180, height: 620 });
      await page.setContent(`<!doctype html><style>
        body{margin:0;padding:24px;background:#eef3f8;font:14px/1.3 sans-serif;color:#23306B;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end}
        figure{margin:0;text-align:center} img{display:block} .w{position:relative;width:256px;height:256px}
        .ring{position:absolute;inset:12.8px;border:2px dashed #e0306b;border-radius:50%;box-sizing:border-box}
        .px{image-rendering:pixelated}</style>
        <figure><div class="w"><img src="${m}" width="256" height="256"><div class="ring"></div></div><figcaption>maskable + 80% safe zone</figcaption></figure>
        <figure><img src="${m}" width="256" height="256" style="border-radius:50%"><figcaption>circle mask</figcaption></figure>
        <figure><img src="${m}" width="256" height="256" style="border-radius:32%"><figcaption>squircle mask</figcaption></figure>
        <figure><img src="${made['icon-512.png']}" width="256" height="256" style="border-radius:12%"><figcaption>any 512</figcaption></figure>
        <figure><img src="${made['apple-touch-icon.png']}" width="180" height="180" style="border-radius:22.5%"><figcaption>apple-touch 180</figcaption></figure>
        <figure><img src="${made['icon-192.png']}" width="96" height="96" style="border-radius:20%"><figcaption>192 @96</figcaption></figure>
        <figure><img src="${made['favicon-32.png']}" width="32" height="32"><figcaption>favicon 32</figcaption></figure>
        <figure><img class="px" src="${made['favicon-32.png']}" width="128" height="128"><figcaption>favicon 32 ×4</figcaption></figure>`);
      await page.screenshot({ path: previewPath, fullPage: true });
      console.log('preview:', previewPath);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
