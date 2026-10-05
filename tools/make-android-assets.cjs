// Android app icons + launch splash from ART.appIcon() (src/art.js), the same art as the PWA icons.
//
//   node tools/make-android-assets.cjs        # writes android/app/src/main/res/{mipmap-*,drawable*}/...
//
//   mipmap-*/ic_launcher.png             legacy square icon (rounded corners)        48..192 px
//   mipmap-*/ic_launcher_round.png       legacy round icon (circle crop)             48..192 px
//   mipmap-*/ic_launcher_foreground.png  adaptive icon layer, 108 dp: the full maskable art at 82.5 dp, so its
//                                        80 % safe circle (66 dp) is exactly the adaptive safe zone
//   values/ic_launcher_background.xml    adaptive background = average edge colour of the art
//   drawable*/splash.png                 cream background + the icon, every size of the Capacitor template
// Needs Playwright with Chromium (see tools/make-icons.cjs).
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const CREAM = '#FFF8F1';               // manifest background_color
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const ART_IN_LAYER = 82.5 / 108;       // adaptive: maskable art size inside the 108 dp layer

function loadPlaywright() {
  for (const t of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!t) continue;
    try { return require(t); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT=/path/to/node_modules/playwright');
}

/* one PNG (with alpha) drawn in Chromium: kind 'square' | 'round' | 'layer' | 'splash' */
async function draw(page, svg, kind, w, h) {
  const b64 = await page.evaluate(async ({ svg, kind, w, h, cream, inLayer }) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    const rounded = (x, y, s, r) => { c.beginPath(); c.roundRect(x, y, s, s, r); c.clip(); };
    if (kind === 'square') { rounded(0, 0, w, w * 0.18); c.drawImage(img, 0, 0, w, w); }
    else if (kind === 'round') { c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.clip(); c.drawImage(img, 0, 0, w, w); }
    else if (kind === 'layer') { const s = w * inLayer; c.drawImage(img, (w - s) / 2, (w - s) / 2, s, s); }
    else {
      c.fillStyle = cream; c.fillRect(0, 0, w, h);
      const s = Math.round(Math.min(w, h) * 0.34), x = (w - s) / 2, y = (h - s) / 2;
      c.save(); c.shadowColor = 'rgba(36,50,79,.18)'; c.shadowBlur = s * 0.08; c.shadowOffsetY = s * 0.03;
      c.beginPath(); c.roundRect(x, y, s, s, s * 0.22); c.fillStyle = '#fff'; c.fill(); c.restore();
      c.save(); c.beginPath(); c.roundRect(x, y, s, s, s * 0.22); c.clip(); c.drawImage(img, x, y, s, s); c.restore();
    }
    return cv.toDataURL('image/png').split(',')[1];
  }, { svg, kind, w, h, cream: CREAM, inLayer: ART_IN_LAYER });
  return Buffer.from(b64, 'base64');
}

/* average colour of the art's outer ring (the adaptive background behind the layer's transparent margin) */
async function edgeColour(page, svg) {
  return page.evaluate(async (svg) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const n = 128, cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0, n, n);
    const d = c.getImageData(0, 0, n, n).data;
    let r = 0, g = 0, b = 0, k = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (x > 2 && y > 2 && x < n - 3 && y < n - 3) continue;
      const i = (y * n + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; k++;
    }
    const h = (v) => Math.round(v / k).toString(16).padStart(2, '0');
    return ('#' + h(r) + h(g) + h(b)).toUpperCase();
  }, svg);
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

async function main() {
  if (!fs.existsSync(RES)) throw new Error('No Android project: run `npx cap add android` first');
  const ART = (await import(pathToFileURL(path.join(ROOT, 'src', 'art.js')).href)).default;
  const svg = ART.appIcon();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>android assets</title>');
    for (const [dens, f] of Object.entries(DENSITIES)) {
      const dir = path.join(RES, 'mipmap-' + dens);
      fs.mkdirSync(dir, { recursive: true });
      const icon = Math.round(48 * f), layer = Math.round(108 * f);
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await draw(page, svg, 'square', icon, icon));
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await draw(page, svg, 'round', icon, icon));
      fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await draw(page, svg, 'layer', layer, layer));
      console.log(`mipmap-${dens.padEnd(8)} icon ${icon} px, layer ${layer} px`);
    }
    const bg = await edgeColour(page, svg);
    fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bg}</color>\n</resources>\n`);
    console.log('adaptive background', bg);
    /* every splash.png of the template, at its own size */
    for (const d of fs.readdirSync(RES).filter((n) => /^drawable/.test(n))) {
      const file = path.join(RES, d, 'splash.png');
      if (!fs.existsSync(file)) continue;
      const [w, h] = pngSize(file);
      fs.writeFileSync(file, await draw(page, svg, 'splash', w, h));
      console.log(`${d}/splash.png ${w}x${h}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
