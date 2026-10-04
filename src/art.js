/* Suuraseikkailu v2 – art.js: every piece of artwork as an inline SVG markup string.
   OWNER: art agent. Contract: CONTRACTS.md "Art API".

   Theme: light, bubbly ice palace (frosty blues, lilac, orchid, rose, silver, glossy highlights).
   Content rule: objects only (crowns, tiaras, palace, crystals, gems, bubbles, snowflakes).
   Never faces, people, animals, creatures or character figures.

   Conventions
   - Pure functions returning strings. The only DOM access is injectCSS(), once, on import.
   - Gradient / filter / clip ids come from uid(), so many copies on one page never clash.
   - SVGs carry a viewBox and class "art art-<name> <cls>". Default sizing uses :where(), i.e. zero
     specificity, so any class the caller passes wins over it.
   - Runtime state is CSS-driven: toggle `.on` on `.crown-slot` (gem appears) or on `.pw`
     (window lights up). No re-render needed; transitions respect prefers-reduced-motion. */

/* ---------- small utilities ---------- */

var idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return 'art-' + prefix + '-' + idCounter;
}

// Compact number formatting for path data.
function f(n) {
  var v = Math.round(n * 100) / 100;
  return v === 0 ? '0' : String(v);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isHex(c) { return typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c); }

function hexRgb(hex) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Linear mix of two hex colours, t = 0..1 towards b.
function mix(a, b, t) {
  var A = hexRgb(a), B = hexRgb(b), out = '#';
  for (var i = 0; i < 3; i++) {
    var c = Math.round(A[i] + (B[i] - A[i]) * t);
    out += (c < 16 ? '0' : '') + c.toString(16);
  }
  return out.toUpperCase();
}

function clampInt(v, lo, hi, dflt) {
  var n = Math.floor(Number(v));
  if (!isFinite(n)) n = dflt;
  return n < lo ? lo : (n > hi ? hi : n);
}

/* ---------- palette (src/styles/tokens.css, KORJAUSPYYNTO §2) ---------- */

var C = {
  snow: '#F6FBFF', frost: '#E4F3FF', ice: '#BFE6FF', glacier: '#7FD3F2', sapphire: '#2F6FE0',
  ink: '#23306B', lilac: '#C8B6FF', orchid: '#B45FE0', rose: '#FF9FD6', silver: '#DCE7F3', white: '#FFFFFF'
};

var SECTION_COLORS = { shahada: '#33C3D6', fatiha: '#9A7BFF', ikhlas: '#FF8BC8', kawthar: '#4A86FF' };

// Default gem cycle for the crown: sapphire, orchid, rose, glacier, lilac.
var GEM_CYCLE = [C.sapphire, C.orchid, C.rose, C.glacier, C.lilac];

// Shading ramp derived from one base colour.
function tones(c) {
  return {
    base: c,
    hi: mix(c, C.white, 0.78),
    light: mix(c, C.white, 0.42),
    dark: mix(c, C.ink, 0.26),
    deep: mix(c, C.ink, 0.5)
  };
}

// Frosted monochrome ramp for "not earned yet" ghost art.
var GHOST = { base: '#DCE6F2', hi: '#F8FBFE', light: '#EAF1F9', dark: '#C5D3E5', deep: '#A9BCD6' };

// Silver metal, faintly tinted towards the accent colour.
function metal(tint) {
  var t = tint || C.lilac;
  return {
    hi: C.white,
    base: mix('#E4ECF7', t, 0.12),
    light: mix('#F4F8FD', t, 0.06),
    dark: mix('#B4C5DE', t, 0.18),
    deep: mix('#7F96C2', t, 0.22)
  };
}

var DIGITS = '٠١٢٣٤٥٦٧٨٩';

function arabicDigits(n) {
  return String(n == null ? '' : n).replace(/[0-9]/g, function (d) { return DIGITS.charAt(+d); });
}

/* ---------- geometry helpers ---------- */

// Star polygon. For the classic 8-point khatam star use r = 0.765 * R.
function starPath(cx, cy, R, r, points = 8, rotation = -Math.PI / 2) {
  var n = Math.max(2, Math.round(points));
  if (r == null) r = R * 0.765;
  var d = '';
  for (var i = 0; i < n * 2; i++) {
    var rad = i % 2 ? r : R;
    var a = rotation + i * Math.PI / n;
    d += (i ? 'L' : 'M') + f(cx + rad * Math.cos(a)) + ' ' + f(cy + rad * Math.sin(a));
  }
  return d + 'Z';
}

// Crescent whose horns point towards angle `dir` (radians, -PI/2 = up).
function crescentPath(cx, cy, R, dir, alpha, off) {
  var a = alpha == null ? 0.95 : alpha;
  var d = (off == null ? 0.38 : off) * R;
  var x1 = cx + R * Math.cos(dir + a), y1 = cy + R * Math.sin(dir + a);
  var x2 = cx + R * Math.cos(dir - a), y2 = cy + R * Math.sin(dir - a);
  var lx = R * Math.cos(a) - d, ly = R * Math.sin(a);
  var r = Math.sqrt(lx * lx + ly * ly);
  var large = lx > 0 ? 1 : 0;
  return 'M' + f(x1) + ' ' + f(y1) +
    'A' + f(R) + ' ' + f(R) + ' 0 1 1 ' + f(x2) + ' ' + f(y2) +
    'A' + f(r) + ' ' + f(r) + ' 0 ' + large + ' 0 ' + f(x1) + ' ' + f(y1) + 'Z';
}

// Onion dome on y = base: narrow neck, round bulge (about 1.1 * hw wide), soft point on top.
function onionPath(cx, base, hw, h) {
  var n = hw * 0.78;
  return 'M' + f(cx - n) + ' ' + f(base) +
    'C' + f(cx - hw * 1.42) + ' ' + f(base - h * 0.26) + ' ' + f(cx - hw * 0.62) + ' ' + f(base - h * 0.74) + ' ' + f(cx) + ' ' + f(base - h) +
    'C' + f(cx + hw * 0.62) + ' ' + f(base - h * 0.74) + ' ' + f(cx + hw * 1.42) + ' ' + f(base - h * 0.26) + ' ' + f(cx + n) + ' ' + f(base) + 'Z';
}

// Pointed (Islamic) arch from `top` down to `bottom`.
function archPath(cx, top, w, bottom) {
  var hw = w / 2, sh = Math.min(w * 0.62, bottom - top);
  return 'M' + f(cx - hw) + ' ' + f(bottom) + 'V' + f(top + sh) +
    'Q' + f(cx - hw) + ' ' + f(top + sh * 0.25) + ' ' + f(cx) + ' ' + f(top) +
    'Q' + f(cx + hw) + ' ' + f(top + sh * 0.25) + ' ' + f(cx + hw) + ' ' + f(top + sh) +
    'V' + f(bottom) + 'Z';
}

function rectPath(x, y, w, h) {
  return 'M' + f(x) + ' ' + f(y) + 'h' + f(w) + 'v' + f(h) + 'h' + f(-w) + 'Z';
}

function paths(list) {
  return list.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
}

function poly(pts) {
  return 'M' + pts.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + 'Z';
}

// Four-point twinkle (concave sides), centred on cx, cy with radius R.
function sparklePath(cx, cy, R) {
  var k = R * 0.16;
  return 'M' + f(cx) + ' ' + f(cy - R) +
    'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + R) + ' ' + f(cy) +
    'Q' + f(cx + k) + ' ' + f(cy + k) + ' ' + f(cx) + ' ' + f(cy + R) +
    'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' + f(cx - R) + ' ' + f(cy) +
    'Q' + f(cx - k) + ' ' + f(cy - k) + ' ' + f(cx) + ' ' + f(cy - R) + 'Z';
}

// Six-armed snowflake as stroke segments. branches: [[pos 0..1 along arm, length as share of L], ...]
function snowflakeD(cx, cy, L, branches) {
  var d = '';
  for (var i = 0; i < 6; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 3, ux = Math.cos(a), uy = Math.sin(a);
    d += 'M' + f(cx) + ' ' + f(cy) + 'L' + f(cx + ux * L) + ' ' + f(cy + uy * L);
    branches.forEach(function (b) {
      var px = cx + ux * L * b[0], py = cy + uy * L * b[0], bl = L * b[1];
      for (var s = -1; s <= 1; s += 2) {
        var ba = a + s * 0.86;
        d += 'M' + f(px) + ' ' + f(py) + 'L' + f(px + Math.cos(ba) * bl) + ' ' + f(py + Math.sin(ba) * bl);
      }
    });
  }
  return d;
}

// Place a motif drawn in a 100x100 box centred on (cx, cy) at `size` user units.
function place(inner, cx, cy, size) {
  var s = size / 100;
  return '<g transform="translate(' + f(cx - size / 2) + ' ' + f(cy - size / 2) + ') scale(' + f(Math.round(s * 10000) / 10000) + ')">' + inner + '</g>';
}

function svgOpen(name, vb, cls, extra) {
  return '<svg xmlns="http://www.w3.org/2000/svg" class="art art-' + name + (cls ? ' ' + esc(cls) : '') +
    '" viewBox="' + vb + '"' + (extra || '') + ' aria-hidden="true" focusable="false">';
}

function stops(list) {
  return list.map(function (s) {
    return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
  }).join('');
}
function linGrad(id, x1, y1, x2, y2, list) {
  return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stops(list) + '</linearGradient>';
}
function radGrad(id, cx, cy, r, list, fx, fy) {
  return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
    (fx != null ? ' fx="' + fx + '" fy="' + fy + '"' : '') + '>' + stops(list) + '</radialGradient>';
}

/* ---------- icons (24x24, stroke = currentColor, round caps/joins) ---------- */

var SW = 2.2;
var SK = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="' + SW + '"';
var FILL = ' fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.6"';

// Gear outline with 8 rounded teeth.
function gearOutline() {
  var cx = 12, cy = 12, ro = 9.6, ri = 7.2, n = 8;
  var step = Math.PI * 2 / n, d = '';
  function pt(r, a) { return f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a)); }
  for (var i = 0; i < n; i++) {
    var a = i * step - Math.PI / 2;
    var a0 = a - 0.27 * step, a1 = a - 0.16 * step, a2 = a + 0.16 * step, a3 = a + 0.27 * step;
    var next = a + step - 0.27 * step;
    d += (i ? 'L' : 'M') + pt(ri, a0) +
      'L' + pt(ro, a1) + 'A' + ro + ' ' + ro + ' 0 0 1 ' + pt(ro, a2) +
      'L' + pt(ri, a3) + 'A' + ri + ' ' + ri + ' 0 0 1 ' + pt(ri, next);
  }
  return d + 'Z';
}

var ICONS = {
  home:
    '<path d="M3.4 11.2 12 3.9l8.6 7.3"' + SK + '/>' +
    '<path d="M5.9 9.5v9.3a1.7 1.7 0 0 0 1.7 1.7h8.8a1.7 1.7 0 0 0 1.7-1.7V9.5"' + SK + '/>' +
    '<path d="M10 20.5v-3.4a2 2 0 0 1 4 0v3.4"' + SK + '/>',
  play:
    '<path d="M8.2 5.6v12.8a1.1 1.1 0 0 0 1.66.95l10.3-6.4a1.1 1.1 0 0 0 0-1.9L9.86 4.65a1.1 1.1 0 0 0-1.66.95z"' + FILL + '/>',
  star:
    '<path d="' + starPath(12, 12.7, 9.6, 4.5, 5) + '"' + SK + '/>',
  speech:
    '<path d="M6.2 3.9h11.6a3 3 0 0 1 3 3v7.2a3 3 0 0 1-3 3h-6.4l-4.6 3.3v-3.3h-.6a3 3 0 0 1-3-3V6.9a3 3 0 0 1 3-3z"' + SK + '/>' +
    '<circle cx="8.3" cy="10.5" r="1.3" fill="currentColor"/>' +
    '<circle cx="12" cy="10.5" r="1.3" fill="currentColor"/>' +
    '<circle cx="15.7" cy="10.5" r="1.3" fill="currentColor"/>',
  gear:
    '<path d="' + gearOutline() + '"' + SK.replace('stroke-width="' + SW + '"', 'stroke-width="2"') + '/>' +
    '<circle cx="12" cy="12" r="3"' + SK.replace('stroke-width="' + SW + '"', 'stroke-width="2"') + '/>',
  close:
    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"' + SK + '/>',
  check:
    '<path d="M4.8 12.7l4.6 4.5 9.8-10"' + SK + '/>',
  replay:
    '<path d="M3.6 12a8.4 8.4 0 1 0 2.46-5.94L3.6 8.5"' + SK + '/>' +
    '<path d="M3.6 3.7v4.8h4.8"' + SK + '/>',
  back:
    '<path d="M19.2 12H5.4M11.6 5.6 5.2 12l6.4 6.4"' + SK + '/>',
  sound:
    '<path d="M4.2 9.3h2.9l4.6-4v13.4l-4.6-4H4.2a1.2 1.2 0 0 1-1.2-1.2v-3a1.2 1.2 0 0 1 1.2-1.2z"' + SK + '/>' +
    '<path d="M15.2 8.9a4.4 4.4 0 0 1 0 6.2M18 6.1a8.4 8.4 0 0 1 0 11.8"' + SK + '/>',
  mic:
    '<path d="M12 3.2a3 3 0 0 1 3 3v5.4a3 3 0 0 1-6 0V6.2a3 3 0 0 1 3-3z"' + SK + '/>' +
    '<path d="M5.9 11.2a6.1 6.1 0 0 0 12.2 0M12 17.4v3.4M8.7 20.8h6.6"' + SK + '/>',
  stop:
    '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.6"' + FILL + '/>',
  trash:
    '<path d="M4 6.6h16M9.4 6.6V4.9a1.3 1.3 0 0 1 1.3-1.3h2.6a1.3 1.3 0 0 1 1.3 1.3v1.7"' + SK + '/>' +
    '<path d="M6.2 6.6l.85 12.2a2 2 0 0 0 2 1.85h5.9a2 2 0 0 0 2-1.85l.85-12.2M10.2 10.6v5.8M13.8 10.6v5.8"' + SK + '/>',
  crown:
    '<path d="M4.4 17.4 3.3 8.9l4.9 3.6L12 6.3l3.8 6.2 4.9-3.6-1.1 8.5z"' + SK + '/>' +
    '<path d="M4.8 20.6h14.4"' + SK + '/>' +
    '<circle cx="3.3" cy="6.6" r="1.35" fill="currentColor"/>' +
    '<circle cx="12" cy="3.9" r="1.35" fill="currentColor"/>' +
    '<circle cx="20.7" cy="6.6" r="1.35" fill="currentColor"/>',
  gem:
    '<path d="M7.4 4.3h9.2l4.3 5.2L12 20.1 3.1 9.5z"' + SK + '/>' +
    '<path d="M3.4 9.5h17.2M10 4.5 8.4 9.5 12 19.6l3.6-10.1L14 4.5"' + SK.replace('stroke-width="' + SW + '"', 'stroke-width="1.6"') + '/>',
  snowflake:
    '<path d="' + snowflakeD(12, 12, 9.4, [[0.56, 0.36]]) + '"' + SK + '/>',
  sparkle:
    '<path d="M10.6 3.4c.5 3.9 2 5.6 5.9 6.2-3.9.6-5.4 2.3-5.9 6.2-.5-3.9-2-5.6-5.9-6.2 3.9-.6 5.4-2.3 5.9-6.2z"' + SK + '/>' +
    '<path d="M18.2 14.4c.25 1.7.9 2.4 2.6 2.7-1.7.3-2.35 1-2.6 2.7-.25-1.7-.9-2.4-2.6-2.7 1.7-.3 2.35-1 2.6-2.7z"' + SK.replace('stroke-width="' + SW + '"', 'stroke-width="1.6"') + '/>' +
    '<circle cx="5.2" cy="18.8" r="1.25" fill="currentColor"/>'
};

function icon(name, className = '') {
  var body = ICONS[name] || '';
  var cls = 'icon' + (className ? ' ' + esc(className) : '');
  return '<svg xmlns="http://www.w3.org/2000/svg" class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
}

/* ---------- motifs (each drawn in a 100x100 box; `t` = tones(), `id` = unique prefix) ---------- */

// 8-point ice crystal: 16 bevelled facets lit from the top-left, crisp outline, a glint.
function crystalMotif(t, id, opt) {
  var o = opt || {};
  var cx = 50, cy = 50, R = 46, r = R * 0.7, light = -2.36; // light from the top-left
  var pts = [];
  for (var i = 0; i < 16; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 8, rad = i % 2 ? r : R;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  var facets = '';
  for (var j = 0; j < 16; j++) {
    var p = pts[j], q = pts[(j + 1) % 16];
    // Outward normal of the facet's outer edge decides how much light it catches.
    var nx = q[1] - p[1], ny = -(q[0] - p[0]);
    var b = (Math.cos(Math.atan2(ny, nx) - light) + 1) / 2;
    var col = b > 0.5 ? mix(t.base, t.hi, (b - 0.5) * 2) : mix(t.dark, t.base, b * 2);
    facets += '<path d="' + poly([[cx, cy], p, q]) + '" fill="' + col + '"/>';
  }
  var outline = starPath(cx, cy, R, r, 8);
  var s = '<g stroke-linejoin="round">' + facets + '</g>' +
    // soft inner bevel: lighter inner star
    '<path d="' + starPath(cx, cy, R * 0.46, r * 0.46, 8) + '" fill="' + t.hi + '" fill-opacity=".55"/>' +
    '<path d="' + outline + '" fill="none" stroke="' + t.deep + '" stroke-width="' + (o.thin ? 3.2 : 4.2) + '" stroke-linejoin="round"/>';
  if (!o.noGlint) {
    s += '<path d="' + sparklePath(30, 27, 9) + '" fill="#FFFFFF"/>' +
      '<circle cx="62" cy="38" r="3" fill="#FFFFFF" fill-opacity=".85"/>';
  }
  return s;
}

// Brilliant-cut gem in side view: crown facets above the girdle, pavilion below.
function gemMotif(t, id) {
  var T1 = [31, 21], T2 = [69, 21], G0 = [9, 40], Ga = [31, 40], Gb = [50, 40], Gc = [69, 40], G4 = [91, 40], K = [50, 91];
  var facet = function (pts, col) { return '<path d="' + poly(pts) + '" fill="' + col + '"/>'; };
  var outline = poly([T1, T2, G4, K, G0]);
  return '<defs>' + linGrad(id + '-tab', 0, 0, 0, 1, [[0, t.hi], [1, t.light]]) + '</defs>' +
    facet([G0, T1, Ga], t.light) +
    facet([T1, Gb, Ga], t.base) +
    facet([T1, T2, Gb], 'url(#' + id + '-tab)') +
    facet([T2, Gc, Gb], t.base) +
    facet([T2, G4, Gc], t.dark) +
    facet([G0, Ga, K], t.base) +
    facet([Ga, Gb, K], t.light) +
    facet([Gb, Gc, K], t.dark) +
    facet([Gc, G4, K], t.deep) +
    '<path d="M9 40H91M31 40 50 91 69 40" fill="none" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="' + outline + '" fill="none" stroke="' + t.deep + '" stroke-width="4.2" stroke-linejoin="round"/>' +
    '<path d="' + sparklePath(34, 30, 9) + '" fill="#FFFFFF"/>' +
    '<path d="M40 52 47 74" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="3.4" stroke-linecap="round"/>';
}

// Round faceted gem centred on (0,0) with radius r (used in crown sockets and the tiara).
function roundGem(r, gradId, t, glint) {
  var oct = [];
  for (var i = 0; i < 8; i++) {
    var a = -Math.PI / 2 + Math.PI / 8 + i * Math.PI / 4;
    oct.push([r * 0.5 * Math.cos(a), r * 0.5 * Math.sin(a)]);
  }
  var rays = '';
  oct.forEach(function (p) {
    var a = Math.atan2(p[1], p[0]);
    rays += 'M' + f(p[0]) + ' ' + f(p[1]) + 'L' + f(r * 0.94 * Math.cos(a)) + ' ' + f(r * 0.94 * Math.sin(a));
  });
  return '<circle r="' + f(r) + '" fill="url(#' + gradId + ')" stroke="' + t.deep + '" stroke-width="' + f(Math.max(1, r * 0.13)) + '"/>' +
    '<path d="' + rays + '" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="' + f(r * 0.07) + '"/>' +
    '<path d="' + poly(oct) + '" fill="' + t.hi + '" fill-opacity=".55"/>' +
    '<ellipse cx="' + f(-r * 0.34) + '" cy="' + f(-r * 0.4) + '" rx="' + f(r * 0.3) + '" ry="' + f(r * 0.17) + '" transform="rotate(-35 ' + f(-r * 0.34) + ' ' + f(-r * 0.4) + ')" fill="#FFFFFF" fill-opacity=".92"/>' +
    (glint ? '<path class="art-gem-glint" d="' + sparklePath(r * 0.52, -r * 0.62, r * 0.5) + '" fill="#FFFFFF"/>' : '');
}

function gemGradient(id, t) {
  return radGrad(id, 0.38, 0.32, 0.78, [[0, t.hi], [0.45, t.base], [1, t.deep]]);
}

function pearl(cx, cy, r, gid) {
  return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="url(#' + gid + ')" stroke="#9DB0D4" stroke-width="' + f(r * 0.22) + '"/>' +
    '<circle cx="' + f(cx - r * 0.35) + '" cy="' + f(cy - r * 0.35) + '" r="' + f(r * 0.3) + '" fill="#FFFFFF"/>';
}

// Tiara: lace-like silver arch with five scalloped peaks, a row of five gems and pearls on the tips.
var TIARA_BODY = 'M9 76C9 63 15 53 22 46C25 52 28 56 30 58C32 50 34 42 36 33C39 43 42 50 43 54C45 40 47 26 50 11' +
  'C53 26 55 40 57 54C58 50 61 43 64 33C66 42 68 50 70 58C72 56 75 52 78 46C85 53 91 63 91 76Z';

function tiaraMotif(t, m, id, ghost) {
  var g = '<defs>' +
    linGrad(id + '-m', 0, 0, 0, 1, [[0, m.hi], [0.55, m.base], [1, m.dark]]) +
    gemGradient(id + '-g', t) +
    radGrad(id + '-p', 0.38, 0.32, 0.8, ghost ? [[0, GHOST.hi], [1, GHOST.dark]] : [[0, '#FFFFFF'], [0.6, '#EEF2FA'], [1, '#C9D4EA']]) +
    '</defs>';
  var line = ' stroke="' + m.deep + '" stroke-width="2.6" stroke-linejoin="round"';
  g += '<path d="' + TIARA_BODY + '" fill="url(#' + id + '-m)"' + line + '/>' +
    // inner filigree: a smaller copy of the outline in white
    '<path d="' + TIARA_BODY + '" transform="translate(50 76) scale(.8 .78) translate(-50 -76)" fill="' + (ghost ? GHOST.hi : t.hi) + '" fill-opacity=".7" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>' +
    // band
    '<path d="M7 72Q50 89 93 72L92 80Q50 98 8 80Z" fill="url(#' + id + '-m)"' + line + '/>' +
    '<path d="M13 76.5Q50 91 87 76.5" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>' +
    // teardrop centre gem
    '<path d="M50 38C55 45 58 50 58 56A8 8 0 0 1 42 56C42 50 45 45 50 38Z" fill="url(#' + id + '-g)" stroke="' + t.deep + '" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<ellipse cx="47" cy="53" rx="2.2" ry="3.6" transform="rotate(20 47 53)" fill="#FFFFFF" fill-opacity=".9"/>' +
    // four round gems following the arc
    '<g transform="translate(35 60)">' + roundGem(4.6, id + '-g', t, false) + '</g>' +
    '<g transform="translate(65 60)">' + roundGem(4.6, id + '-g', t, false) + '</g>' +
    '<g transform="translate(21 67)">' + roundGem(3.8, id + '-g', t, false) + '</g>' +
    '<g transform="translate(79 67)">' + roundGem(3.8, id + '-g', t, false) + '</g>';
  // pearl row on the band
  for (var i = 0; i < 7; i++) {
    var x = 20 + i * 10, tt = (x - 7) / 86;
    g += pearl(x, 76 + 35 * tt * (1 - tt), 2.2, id + '-p');
  }
  // pearls on the tips
  g += pearl(22, 43.5, 3.4, id + '-p') + pearl(78, 43.5, 3.4, id + '-p') +
    pearl(36, 30.5, 3.6, id + '-p') + pearl(64, 30.5, 3.6, id + '-p') + pearl(50, 8.6, 4.4, id + '-p');
  return g;
}

// Snowflake: blue outer stroke with a white core so it reads on light and dark grounds.
function snowflakeMotif(id, t) {
  var d = snowflakeD(50, 50, 42, [[0.48, 0.34], [0.76, 0.2]]);
  var outer = t ? t.dark : null;
  return '<defs>' + linGrad(id + '-s', 0, 0, 1, 1, outer ? [[0, t.base], [1, outer]] : [[0, C.glacier], [0.55, '#5E9CF0'], [1, '#8C7BF0']]) + '</defs>' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="' + d + '" stroke="url(#' + id + '-s)" stroke-width="10"/>' +
    '<path d="' + d + '" stroke="#FFFFFF" stroke-width="4.2"/>' +
    '</g>' +
    '<path d="' + starPath(50, 50, 10, 7, 6, -Math.PI / 2) + '" fill="#FFFFFF" stroke="url(#' + id + '-s)" stroke-width="3" stroke-linejoin="round"/>';
}

// Crown wearing a snowflake crest (kawthar sticker).
function snowCrownMotif(t, id) {
  var g = '<defs>' +
    linGrad(id + '-c', 0, 0, 0, 1, [[0, t.light], [0.5, t.base], [1, t.dark]]) +
    linGrad(id + '-b', 0, 0, 0, 1, [[0, t.base], [1, t.deep]]) +
    radGrad(id + '-p', 0.38, 0.32, 0.8, [[0, '#FFFFFF'], [0.6, '#EEF2FA'], [1, '#C9D4EA']]) +
    gemGradient(id + '-g', tones(C.glacier)) +
    '</defs>';
  var line = ' stroke="' + t.deep + '" stroke-width="3" stroke-linejoin="round"';
  g += '<path d="M17 80 11 47 30 61 50 41 70 61 89 47 83 80Z" fill="url(#' + id + '-c)"' + line + '/>' +
    '<path d="M22 74 19 57 31 66 50 49 69 66 81 57 78 74" fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<rect x="14" y="74" width="72" height="14" rx="5" fill="url(#' + id + '-b)"' + line + '/>' +
    '<path d="M20 78H80" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>' +
    '<g transform="translate(32 81.5)">' + roundGem(3.4, id + '-g', tones(C.glacier), false) + '</g>' +
    '<g transform="translate(50 81.5)">' + roundGem(3.8, id + '-g', tones(C.glacier), false) + '</g>' +
    '<g transform="translate(68 81.5)">' + roundGem(3.4, id + '-g', tones(C.glacier), false) + '</g>' +
    pearl(11, 44, 4.4, id + '-p') + pearl(89, 44, 4.4, id + '-p') +
    place(snowflakeMotif(id + '-f', null), 50, 31, 44);
  return g;
}

// Ghost (not yet earned) version of the snow crown: same shapes, frosted monochrome.
function snowCrownGhost(id) {
  var t = GHOST, line = ' stroke="' + t.deep + '" stroke-width="3" stroke-linejoin="round"';
  return '<path d="M17 80 11 47 30 61 50 41 70 61 89 47 83 80Z" fill="' + t.light + '"' + line + '/>' +
    '<rect x="14" y="74" width="72" height="14" rx="5" fill="' + t.base + '"' + line + '/>' +
    '<circle cx="11" cy="44" r="4.4" fill="' + t.hi + '"' + line + '/>' +
    '<circle cx="89" cy="44" r="4.4" fill="' + t.hi + '"' + line + '/>' +
    place('<path d="' + snowflakeD(50, 50, 42, [[0.48, 0.34], [0.76, 0.2]]) + '" fill="none" stroke="' + t.deep + '" stroke-width="7" stroke-linecap="round"/>', 50, 31, 44);
}

/* ---------- public small pieces ---------- */

var CRYSTAL_TONES = { base: '#A8E2F8', hi: '#F4FCFF', light: '#CDEFFC', dark: '#5DB0E4', deep: '#2F6FE0' };

function crystal(cls) {
  return svgOpen('crystal', '0 0 100 100', cls) + crystalMotif(CRYSTAL_TONES, uid('cry')) + '</svg>';
}

function snowflake(cls) {
  return svgOpen('snowflake', '0 0 100 100', cls) + snowflakeMotif(uid('snow'), null) + '</svg>';
}

// Glossy translucent soap bubble with an iridescent rim.
function bubble(cls) {
  var id = uid('bub');
  return svgOpen('bubble', '0 0 100 100', cls) +
    '<defs>' +
    radGrad(id + '-f', 0.5, 0.5, 0.5, [[0, '#FFFFFF', 0.04], [0.68, '#E9F4FF', 0.1], [0.88, C.lilac, 0.26], [1, C.ice, 0.62]]) +
    linGrad(id + '-r', 0, 0, 1, 1, [[0, C.rose], [0.35, C.lilac], [0.7, C.glacier], [1, '#9FC2FF']]) +
    '</defs>' +
    '<circle cx="50" cy="50" r="46" fill="url(#' + id + '-f)"/>' +
    '<circle cx="50" cy="50" r="45" fill="none" stroke="url(#' + id + '-r)" stroke-width="3.2" stroke-opacity=".9"/>' +
    '<path d="M18 48A32 32 0 0 1 44 18" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-opacity=".95"/>' +
    '<circle cx="56" cy="17" r="3.6" fill="#FFFFFF" fill-opacity=".95"/>' +
    '<path d="M68 81A32 32 0 0 0 81 67" fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-opacity=".7"/>' +
    '</svg>';
}

function gem(color, cls) {
  var c = isHex(color) ? color : C.orchid;
  return svgOpen('gem', '0 0 100 100', cls) + gemMotif(tones(c), uid('gem')) + '</svg>';
}

function tiara(color, cls) {
  var c = isHex(color) ? color : C.orchid;
  return svgOpen('tiara', '0 0 100 100', cls) + tiaraMotif(tones(c), metal(c), uid('tia'), false) + '</svg>';
}

/* ---------- crown with gem sockets ---------- */

// Crown silhouette (viewBox 240x180): five scalloped peaks, crystal on the centre peak.
var CROWN_BODY = 'M24 126C24 104 32 86 40 72C44 86 50 98 60 100C70 98 77 74 80 54C84 74 90 92 100 94C110 92 116 56 120 26' +
  'C124 56 130 92 140 94C150 92 156 74 160 54C163 74 170 98 180 100C190 98 196 86 200 72C208 86 216 104 216 126Z';
var CROWN_BAND = 'M20 120Q120 146 220 120L217 150Q120 176 23 150Z';

function crownMarkup(o) {
  var n = o.slots, k = o.filled, id = o.id, bare = o.bare;
  var colors = Array.isArray(o.colors) && o.colors.length ? o.colors.map(function (c) { return isHex(c) ? c : C.orchid; }) : GEM_CYCLE;
  var m = { dark: '#A9C1E6', deep: '#7D96C9' };
  var defs = linGrad(id + '-m', 0, 0, 0, 1, [[0, '#FFFFFF'], [0.5, '#DDEBFA'], [1, m.dark]]) +
    linGrad(id + '-in', 0, 0, 0, 1, [[0, '#F7F3FF'], [1, '#D3C4FF']]) +
    linGrad(id + '-b', 0, 0, 0, 1, [[0, '#F8FBFF'], [0.55, '#DAE7F8'], [1, '#AFC6EA']]) +
    radGrad(id + '-so', 0.5, 0.42, 0.62, [[0, '#B9CBE6'], [0.7, '#D5E1F2'], [1, '#EEF3FB']]) +
    radGrad(id + '-p', 0.38, 0.32, 0.8, [[0, '#FFFFFF'], [0.6, '#EEF2FA'], [1, '#C9D4EA']]);
  var gradOf = {};
  colors.forEach(function (c, i) {
    if (gradOf[c]) return;
    gradOf[c] = id + '-g' + i;
    defs += gemGradient(gradOf[c], tones(c));
  });
  var line = ' stroke="' + m.deep + '" stroke-width="2.8" stroke-linejoin="round"';
  var s = '<defs>' + defs + '</defs>' +
    // soft floor shadow
    '<ellipse cx="120" cy="166" rx="92" ry="7" fill="#9DB7E0" fill-opacity=".22"/>' +
    '<path d="' + CROWN_BODY + '" fill="url(#' + id + '-m)"' + line + '/>' +
    // inner lilac filigree, a smaller copy of the body
    '<path d="' + CROWN_BODY + '" transform="translate(120 126) scale(.8 .76) translate(-120 -126)" fill="url(#' + id + '-in)" stroke="#FFFFFF" stroke-width="2.6" stroke-linejoin="round"/>' +
    // gloss on the left peaks
    '<path d="M34 112C34 100 37 90 41 82M74 100C76 88 78 76 80 66" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-opacity=".9"/>' +
    // pearls on the side peaks, crystal on the centre peak (or nothing when the caller places its own)
    pearl(40, 68, 6.4, id + '-p') + pearl(80, 50, 6.4, id + '-p') + pearl(160, 50, 6.4, id + '-p') + pearl(200, 68, 6.4, id + '-p') +
    (o.noTip ? '' : place(crystalMotif(CRYSTAL_TONES, id + '-cr', { thin: true }), 120, 22, 34)) +
    // band
    '<path d="' + CROWN_BAND + '" fill="url(#' + id + '-b)"' + line + '/>' +
    '<path d="M28 127Q120 150 212 127" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M28 151Q120 174 212 151" fill="none" stroke="' + m.dark + '" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".6"/>';
  // Sockets along the band's midline: quadratic (22,135)-(120,160)-(218,135); x is linear in t.
  var span = 172, sp = span / n, r = Math.min(13, sp * 0.37);
  for (var i = 0; i < n; i++) {
    var x = 120 + (i - (n - 1) / 2) * sp;
    var tt = (x - 22) / 196, y = 135 + 50 * tt * (1 - tt);
    var col = colors[i % colors.length];
    var on = i < k;
    var gemG = '<g transform="translate(' + f(x) + ' ' + f(y) + ')"><g class="art-slot-gem">' +
      roundGem(r, gradOf[col], tones(col), !bare) + '</g></g>';
    var socket = '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r + 2.6) + '" fill="#FFFFFF" stroke="' + m.deep + '" stroke-width="1.6"/>' +
      '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="url(#' + id + '-so)"/>';
    if (bare) {
      s += '<g>' + socket + (on ? gemG : '') + '</g>';
    } else {
      s += '<g class="crown-slot' + (on ? ' on' : '') + '" data-i="' + i + '" style="--art-d:' + f((i % 5) * 0.37) + 's">' + socket + gemG + '</g>';
    }
  }
  return s;
}

function crown(opts) {
  var o = opts || {};
  var n = clampInt(o.slots, 1, 12, 5);
  var k = clampInt(o.filled, 0, n, 0);
  return svgOpen('crown', '0 0 240 180', o.cls) +
    crownMarkup({ slots: n, filled: k, colors: o.colors, id: uid('crown'), bare: false }) + '</svg>';
}

/* ---------- ice palace ---------- */

var PALACE_NORMAL = {
  wallHi: '#FFFFFF', wallLo: '#D4EAFB', line: '#9CBEE6', towerHi: '#FBFDFF', towerLo: '#C9E3F8',
  domeAHi: '#FCFAFF', domeA: '#CFC0FF', domeALo: '#A08AF0', domeALine: '#8A70DD',
  domeBHi: '#FFFFFF', domeB: '#C6E9FF', domeBLo: '#88CAF0', domeBLine: '#62A8DA',
  capHi: '#FFF2F9', cap: '#FFB3DE', capLo: '#F287C6', capLine: '#D86AA8',
  cresA: '#2F6FE0', cresB: '#B45FE0', rod: '#9FB3D6',
  winHi: '#E8F5FF', winLo: '#BEDDF5', winLine: '#8FB8E2',
  litHi: '#FFFCEA', litLo: '#FFD46A', glow: '#FFD15C', litLine: '#E8AE3C',
  doorHi: '#EEE8FF', doorLo: '#BDAEF6', doorLine: '#8C77DD',
  snow: '#FFFFFF', snowShade: '#CFE6F9', accent: '#C8B6FF', sparkle: '#A98EFF', sparkle2: '#7FD3F2'
};
var PALACE_GHOST = (function () {
  var o = {};
  Object.keys(PALACE_NORMAL).forEach(function (k) {
    o[k] = /Line|line|rod|cres/.test(k) ? GHOST.deep : (/Lo|shade/i.test(k) ? GHOST.dark : (/Hi$|snow$/.test(k) ? GHOST.hi : GHOST.base));
  });
  o.glow = GHOST.base;
  return o;
})();

// Window grid: up to 6 per row, rows filled bottom-up (row 0 = bottom), every row centred.
function windowLayout(n) {
  var rows = n <= 6 ? 1 : Math.ceil(n / 6);
  var cols = Math.ceil(n / rows);
  var x0 = 84, x1 = 276, yTop = 147, yBot = 233;
  // cap the spacing so a few windows stay together in the middle instead of drifting apart
  var cellW = Math.min((x1 - x0) / cols, 40), cellH = (yBot - yTop) / rows;
  var h = Math.min(cellH * 0.8, 42), w = Math.min(cellW * 0.62, h * (rows > 2 ? 0.78 : 0.66), 24);
  var out = [];
  for (var i = 0; i < n; i++) {
    var row = Math.floor(i / cols), inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
    var j = i - row * cols;
    var cx = 180 + (j - (inRow - 1) / 2) * cellW;
    var cy = yBot - (row + 0.5) * cellH;
    out.push({ cx: cx, top: cy - h / 2, bot: cy + h / 2, w: w });
  }
  return out;
}

// Small icicles hanging under a ledge from x0 to x1 at y.
function icicles(x0, x1, y, step, col, line) {
  var d = '';
  for (var x = x0, i = 0; x + step <= x1 + 0.01; x += step, i++) {
    var len = [6, 3.6, 5, 3][i % 4];
    d += 'M' + f(x) + ' ' + f(y) + 'Q' + f(x + step * 0.42) + ' ' + f(y + len * 0.45) + ' ' + f(x + step / 2) + ' ' + f(y + len) +
      'Q' + f(x + step * 0.58) + ' ' + f(y + len * 0.45) + ' ' + f(x + step) + ' ' + f(y) + 'Z';
  }
  return '<path d="' + d + '" fill="' + col + '" stroke="' + line + '" stroke-width=".9" stroke-linejoin="round"/>';
}

function finialWithCrescent(cx, top, rodLen, R, P, gid) {
  return '<rect x="' + f(cx - 1.1) + '" y="' + f(top - rodLen) + '" width="2.2" height="' + f(rodLen + 1) + '" rx="1.1" fill="' + P.rod + '"/>' +
    '<circle cx="' + f(cx) + '" cy="' + f(top - rodLen * 0.4) + '" r="' + f(R * 0.36) + '" fill="' + P.rod + '"/>' +
    '<path d="' + crescentPath(cx, top - rodLen - R * 0.55, R, -Math.PI / 2) + '" fill="url(#' + gid + ')"/>';
}

/* Palace scene in viewBox 0 0 360 280. o: { windows, lit, id, ghost, bare }.
   bare = static rendering (no .pw classes, unlit windows draw no lit layer); used inside stickers. */
function palaceMarkup(o) {
  var P = o.ghost ? PALACE_GHOST : PALACE_NORMAL, id = o.id;
  var g = function (name) { return 'url(#' + id + '-' + name + ')'; };
  var defs = '<defs>' +
    linGrad(id + '-wall', 0, 0, 0, 1, [[0, P.wallHi], [1, P.wallLo]]) +
    linGrad(id + '-tower', 0, 0, 1, 0, [[0, P.towerHi], [0.6, P.towerHi], [1, P.towerLo]]) +
    radGrad(id + '-domeA', 0.36, 0.3, 0.8, [[0, P.domeAHi], [0.5, P.domeA], [1, P.domeALo]]) +
    radGrad(id + '-domeB', 0.36, 0.3, 0.8, [[0, P.domeBHi], [0.5, P.domeB], [1, P.domeBLo]]) +
    linGrad(id + '-cap', 0, 0, 1, 0, [[0, P.capHi], [0.45, P.cap], [1, P.capLo]]) +
    linGrad(id + '-cres', 0, 0, 1, 1, [[0, P.cresA], [1, P.cresB]]) +
    linGrad(id + '-win', 0, 0, 0, 1, [[0, P.winHi], [1, P.winLo]]) +
    linGrad(id + '-lit', 0, 0, 0, 1, [[0, P.litHi], [0.55, '#FFE79A'], [1, P.litLo]]) +
    linGrad(id + '-door', 0, 0, 0, 1, [[0, P.doorHi], [1, P.doorLo]]) +
    linGrad(id + '-snow', 0, 0, 0, 1, [[0, P.snow], [1, P.snowShade]]) +
    '<filter id="' + id + '-blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>' +
    '</defs>';
  var s = defs;
  var stroke = function (c, w) { return ' stroke="' + c + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round"'; };

  // ground shadow
  s += '<ellipse cx="180" cy="267" rx="160" ry="10" fill="' + P.snowShade + '" fill-opacity=".9"/>';

  // back spires (behind the hall)
  [104, 256].forEach(function (cx) {
    s += '<rect x="' + (cx - 6) + '" y="70" width="12" height="66" fill="' + g('tower') + '"' + stroke(P.line, 1.8) + '/>' +
      '<rect x="' + (cx - 9.5) + '" y="98" width="19" height="6" rx="3" fill="' + P.wallHi + '"' + stroke(P.line, 1.6) + '/>' +
      '<path d="M' + (cx - 9) + ' 72Q' + (cx - 8) + ' 57 ' + cx + ' 44Q' + (cx + 8) + ' 57 ' + (cx + 9) + ' 72Z" fill="' + g('cap') + '"' + stroke(P.capLine, 1.8) + '/>' +
      '<rect x="' + (cx - 10) + '" y="70" width="20" height="5" rx="2.5" fill="' + P.wallHi + '"' + stroke(P.line, 1.5) + '/>' +
      finialWithCrescent(cx, 45, 9, 5.6, P, id + '-cres');
  });

  // side towers
  [46, 314].forEach(function (cx) {
    s += '<rect x="' + (cx - 22) + '" y="124" width="44" height="142" fill="' + g('tower') + '"' + stroke(P.line) + '/>' +
      '<rect x="' + (cx - 16) + '" y="110" width="32" height="14" fill="' + g('wall') + '"' + stroke(P.line, 1.8) + '/>' +
      '<path d="' + onionPath(cx, 111, 19, 44) + '" fill="' + g('domeB') + '"' + stroke(P.domeBLine) + '/>' +
      '<path d="M' + (cx - 9) + ' 100Q' + (cx - 10) + ' 84 ' + (cx - 3) + ' 76" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" stroke-opacity=".9"/>' +
      finialWithCrescent(cx, 67, 10, 6.4, P, id + '-cres') +
      '<rect x="' + (cx - 25) + '" y="120" width="50" height="8" rx="4" fill="' + P.wallHi + '"' + stroke(P.line, 1.8) + '/>' +
      icicles(cx - 22, cx + 22, 128, 7.33, P.wallHi, P.line) +
      // decorative crystal rosette and a slim niche (not windows)
      place(crystalMotif(o.ghost ? GHOST : tones(P.accent), id + '-ro' + cx, { thin: true, noGlint: true }), cx, 160, 22) +
      // small lilac tower door (clearly not one of the counted windows)
      '<path d="' + archPath(cx, 236, 16, 266) + '" fill="' + g('door') + '"' + stroke(P.doorLine, 1.4) + '/>';
  });

  // main hall
  s += '<rect x="66" y="128" width="228" height="138" fill="' + g('wall') + '"' + stroke(P.line) + '/>';
  // parapet: little rounded merlons
  var mer = '';
  for (var mx = 74; mx <= 286; mx += 14) mer += 'M' + (mx - 5) + ' 125a5 5 0 0 1 10 0Z';
  s += '<path d="' + mer + '" fill="' + P.wallHi + '"' + stroke(P.line, 1.5) + '/>';
  s += '<rect x="60" y="122" width="240" height="9" rx="4.5" fill="' + P.wallHi + '"' + stroke(P.line, 1.8) + '/>';
  s += icicles(66, 294, 131, 9.12, P.wallHi, P.line);
  // frieze of tiny diamonds
  var fr = '';
  for (var fx = 78; fx <= 282; fx += 17) fr += 'M' + fx + ' 140.5l3-3 3 3-3 3Z';
  s += '<path d="' + fr + '" fill="' + P.accent + '" fill-opacity=".85"/>';

  // drum + main onion dome
  s += '<rect x="136" y="103" width="88" height="22" rx="3" fill="' + g('wall') + '"' + stroke(P.line, 1.8) + '/>';
  var pearls = '';
  for (var px = 146; px <= 214; px += 11.33) pearls += '<circle cx="' + f(px) + '" cy="114" r="2.4" fill="' + P.accent + '"/>';
  s += pearls;
  s += '<path d="' + onionPath(180, 104, 44, 74) + '" fill="' + g('domeA') + '"' + stroke(P.domeALine, 2.2) + '/>' +
    // gentle ribs
    '<path d="M180 32Q160 64 166 103M180 32Q200 64 194 103" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.8"/>' +
    // gloss
    '<path d="M152 92Q144 66 166 46" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-opacity=".85"/>' +
    '<circle cx="171" cy="40" r="2.6" fill="#FFFFFF" fill-opacity=".9"/>' +
    finialWithCrescent(180, 31, 13, 8.4, P, id + '-cres');

  // main door
  s += '<path d="' + archPath(180, 238, 28, 266) + '" fill="' + g('door') + '"' + stroke(P.doorLine, 1.8) + '/>' +
    '<path d="M180 249V266" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="1.6"/>' +
    // one small diamond on the arch (two round knobs side by side read as a pair of eyes)
    '<path d="M180 241.2L182.4 244.6L180 248L177.6 244.6Z" fill="#FFFFFF"/>';

  // windows
  var wins = windowLayout(o.windows);
  wins.forEach(function (w, i) {
    var d = archPath(w.cx, w.top, w.w, w.bot);
    var on = i < o.lit;
    var sill = '<rect x="' + f(w.cx - w.w / 2 - 2) + '" y="' + f(w.bot - 0.6) + '" width="' + f(w.w + 4) + '" height="3" rx="1.5" fill="' + P.wallHi + '"' + stroke(P.line, 1.1) + '/>';
    var mull = w.w >= 12 ? '<path d="M' + f(w.cx) + ' ' + f(w.top + w.w * 0.45) + 'V' + f(w.bot) + 'M' + f(w.cx - w.w / 2) + ' ' + f(w.top + (w.bot - w.top) * 0.6) + 'H' + f(w.cx + w.w / 2) + '" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="1.3"/>' : '';
    var base = '<path d="' + d + '" fill="' + g('win') + '"' + stroke(P.winLine, 1.5) + '/>' +
      '<path d="M' + f(w.cx - w.w * 0.22) + ' ' + f(w.bot - (w.bot - w.top) * 0.2) + 'L' + f(w.cx - w.w * 0.22) + ' ' + f(w.top + (w.bot - w.top) * 0.45) + '" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="' + f(Math.max(1.2, w.w * 0.12)) + '" stroke-linecap="round"/>';
    var halo = '<g class="art-pw-halo"><path class="art-pw-glow" d="' + d + '" fill="' + P.glow + '" filter="url(#' + id + '-blur)" transform="translate(' + f(w.cx) + ' ' + f((w.top + w.bot) / 2) + ') scale(1.45) translate(' + f(-w.cx) + ' ' + f(-(w.top + w.bot) / 2) + ')"/></g>';
    var lit = '<path class="art-pw-lit" d="' + d + '" fill="' + g('lit') + '"' + stroke(P.litLine, 1.5) + '/>';
    if (o.bare) {
      s += '<g>' + (on ? halo + base + lit : base) + mull + sill + '</g>';
    } else {
      s += '<g class="pw' + (on ? ' on' : '') + '" data-i="' + i + '" style="--art-d:' + f(-((i * 0.73) % 3)) + 's">' + halo + base + lit + mull + sill + '</g>';
    }
  });

  // snow drifts in front
  s += '<path d="M4 280C6 270 16 265 34 264Q80 259 126 265Q170 270 214 263Q268 257 326 264C344 266 354 271 356 280Z" fill="' + g('snow') + '"/>' +
    '<path d="M26 269Q56 263 92 267M250 266Q286 261 320 267" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>';

  // a few sparkles in the sky
  if (!o.ghost) {
    s += '<path class="art-twinkle" style="--art-d:-.4s" d="' + sparklePath(24, 70, 7) + '" fill="' + P.sparkle + '"/>' +
      '<path class="art-twinkle" style="--art-d:-1.3s" d="' + sparklePath(332, 92, 6) + '" fill="' + P.sparkle2 + '"/>' +
      '<path class="art-twinkle" style="--art-d:-2.1s" d="' + sparklePath(292, 30, 5) + '" fill="' + P.sparkle + '"/>' +
      '<path class="art-twinkle" style="--art-d:-.9s" d="' + sparklePath(66, 26, 4.5) + '" fill="' + P.sparkle2 + '"/>';
  }
  return s;
}

function palace(opts) {
  var o = opts || {};
  var n = clampInt(o.windows, 0, 24, 6);
  var k = clampInt(o.lit, 0, n, 0);
  return svgOpen('palace', '0 0 360 280', o.cls) +
    palaceMarkup({ windows: n, lit: k, id: uid('pal'), ghost: false, bare: false }) + '</svg>';
}

/* ---------- background silhouette ---------- */

// Wide, soft, translucent palace skyline for the bottom of the app background.
// The centre (x 380..820) carries the main palace so phones, which see only the middle, still get it.
function palaceSilhouette() {
  var id = uid('sil');
  var UP = -Math.PI / 2;
  var far = [], mid = [], near = [], cres = [];

  function tower(list, cx, top, w, base) { list.push(rectPath(cx - w / 2, top, w, base - top)); }
  function onionTower(list, cx, top, w, domeH, base) {
    tower(list, cx, top, w, base);
    list.push(rectPath(cx - w / 2 - 3, top - 4, w + 6, 6));
    list.push(onionPath(cx, top - 3, w * 0.5, domeH));
    var tip = top - 3 - domeH;
    list.push(rectPath(cx - 1.2, tip - 9, 2.4, 10));
    cres.push(crescentPath(cx, tip - 13, Math.max(4.2, w * 0.16), UP));
  }
  function spire(list, cx, top, w, base) {
    tower(list, cx, top, w, base);
    list.push('M' + f(cx - w / 2 - 1.5) + ' ' + f(top + 1) + 'Q' + f(cx - w * 0.45) + ' ' + f(top - 18) + ' ' + f(cx) + ' ' + f(top - 34) +
      'Q' + f(cx + w * 0.45) + ' ' + f(top - 18) + ' ' + f(cx + w / 2 + 1.5) + ' ' + f(top + 1) + 'Z');
    list.push(rectPath(cx - 1, top - 44, 2, 11));
    cres.push(crescentPath(cx, top - 47, 4.4, UP));
  }
  function roundDome(list, cx, base, hw, h) {
    list.push('M' + f(cx - hw) + ' ' + f(base) + 'C' + f(cx - hw) + ' ' + f(base - h * 0.75) + ' ' + f(cx - hw * 0.45) + ' ' + f(base - h) + ' ' + f(cx) + ' ' + f(base - h) +
      'C' + f(cx + hw * 0.45) + ' ' + f(base - h) + ' ' + f(cx + hw) + ' ' + f(base - h * 0.75) + ' ' + f(cx + hw) + ' ' + f(base) + 'Z');
  }

  /* far layer: distant domes and towers across the whole width */
  far.push('M0 220V176Q150 160 300 170T600 166T900 170T1200 172V220Z');
  [[60, 120, 26, 40], [210, 132, 22, 34], [360, 110, 30, 44], [840, 112, 30, 44], [990, 130, 22, 34], [1140, 118, 26, 40]].forEach(function (t) {
    onionTower(far, t[0], t[1], t[2], t[3], 200);
  });
  [[130, 140, 40, 30], [290, 150, 34, 24], [920, 148, 34, 24], [1070, 140, 40, 30]].forEach(function (d) {
    far.push(rectPath(d[0] - d[2], d[1], d[2] * 2, 200 - d[1]));
    roundDome(far, d[0], d[1] + 1, d[2] * 0.8, d[3]);
  });
  [[20, 100, 10], [1180, 100, 10]].forEach(function (t) { spire(far, t[0], t[1], t[2], 200); });

  /* mid layer: the palace in the centre plus wings */
  mid.push(rectPath(470, 150, 260, 70));                    // hall
  mid.push(rectPath(462, 144, 276, 9));                     // cornice
  mid.push(rectPath(548, 118, 104, 28));                    // drum
  mid.push(onionPath(600, 119, 54, 78));                    // main dome
  mid.push(rectPath(598.6, 28, 2.8, 16));
  cres.push(crescentPath(600, 24, 8, UP));
  onionTower(mid, 444, 126, 40, 54, 220);
  onionTower(mid, 756, 126, 40, 54, 220);
  spire(mid, 500, 96, 12, 150);
  spire(mid, 700, 96, 12, 150);
  mid.push(rectPath(330, 168, 92, 52));                     // left wing
  roundDome(mid, 376, 169, 30, 30);
  mid.push(rectPath(778, 168, 92, 52));                     // right wing
  roundDome(mid, 824, 169, 30, 30);
  onionTower(mid, 300, 150, 26, 36, 220);
  onionTower(mid, 900, 150, 26, 36, 220);

  /* near layer: snow drifts */
  near.push('M0 220V196Q90 182 200 192T420 190Q520 204 600 198T800 192Q900 182 1000 194T1200 188V220Z');

  // arched openings punched through the hall (lighter so they read as frosty windows)
  var holes = [];
  [500, 530, 560, 640, 670, 700].forEach(function (x) { holes.push(archPath(x, 166, 14, 196)); });
  holes.push(archPath(600, 160, 30, 220));
  [352, 400, 800, 848].forEach(function (x) { holes.push(archPath(x, 182, 12, 206)); });

  return '<svg xmlns="http://www.w3.org/2000/svg" class="art art-silhouette palace-silhouette" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" aria-hidden="true" focusable="false">' +
    '<defs>' +
    linGrad(id + '-far', 0, 0, 0, 1, [[0, '#DCD4FF', 0.55], [1, '#CFE6FF', 0.5]]) +
    linGrad(id + '-mid', 0, 0, 0, 1, [[0, '#FFFFFF', 0.92], [1, '#D9EDFD', 0.92]]) +
    linGrad(id + '-near', 0, 0, 0, 1, [[0, '#FFFFFF', 1], [1, '#F3F9FF', 1]]) +
    linGrad(id + '-cres', 0, 0, 1, 1, [[0, '#9FC2FF'], [1, '#C8B6FF']]) +
    '</defs>' +
    '<g fill="url(#' + id + '-far)">' + paths(far) + '</g>' +
    '<g fill="url(#' + id + '-mid)" stroke="#B9D8F5" stroke-opacity=".7" stroke-width="1.5" stroke-linejoin="round">' + paths(mid) + '</g>' +
    '<g fill="#C8E2FA" fill-opacity=".55">' + paths(holes) + '</g>' +
    '<g fill="url(#' + id + '-cres)" fill-opacity=".9">' + paths(cres) + '</g>' +
    '<g fill="url(#' + id + '-near)">' + paths(near) + '</g>' +
    '</svg>';
}

/* ---------- stickers ---------- */

// Motif per sticker id, drawn into the 100x100 box. ghost = frosted monochrome outline version.
function stickerMotif(sid, ghost, id) {
  var col = SECTION_COLORS[sid];
  switch (sid) {
    case 'shahada':
      return ghost ? tiaraMotif(GHOST, GHOST, id, true) : tiaraMotif(tones(col), metal(col), id, false);
    case 'fatiha':
      return crystalMotif(ghost ? GHOST : tones(col), id, ghost ? { noGlint: true } : null);
    case 'ikhlas':
      return gemMotif(ghost ? GHOST : tones(col), id);
    case 'kawthar':
      return ghost ? snowCrownGhost(id) : snowCrownMotif(tones(col), id);
    case 'palace':
      return '<svg x="0" y="8" width="100" height="84" viewBox="20 0 320 280" overflow="visible">' +
        palaceMarkup({ windows: 6, lit: ghost ? 0 : 6, id: id + '-pal', ghost: ghost, bare: true }) + '</svg>';
    default:
      return crystalMotif(ghost ? GHOST : CRYSTAL_TONES, id);
  }
}

// Round sticker with a white die-cut border. earned = full colour with shine, else a frosted ghost.
function sticker(sid, earned) {
  var on = !!earned, id = uid('stk');
  var col = SECTION_COLORS[sid] || (sid === 'palace' ? C.glacier : C.lilac);
  var s = svgOpen('sticker', '0 0 120 120', 'art-sticker-' + esc(sid) + (on ? ' earned' : ' ghost'));
  if (on) {
    s += '<defs>' +
      radGrad(id + '-bg', 0.5, 0.3, 0.75, [[0, mix(col, C.white, 0.9)], [0.6, mix(col, C.white, 0.72)], [1, mix(col, C.white, 0.5)]]) +
      '<clipPath id="' + id + '-clip"><circle cx="60" cy="60" r="46"/></clipPath>' +
      '</defs>' +
      // soft layered shadow
      '<circle cx="60" cy="64" r="55" fill="#23306B" fill-opacity=".07"/>' +
      '<circle cx="60" cy="62" r="55" fill="#23306B" fill-opacity=".07"/>' +
      '<circle cx="60" cy="60" r="54" fill="#FFFFFF" stroke="#DCE7F3" stroke-width="1.5"/>' +
      '<circle cx="60" cy="60" r="46" fill="url(#' + id + '-bg)"/>' +
      // snow dots
      '<g fill="#FFFFFF" fill-opacity=".75">' +
      '<circle cx="30" cy="44" r="1.8"/><circle cx="92" cy="50" r="2.2"/><circle cx="84" cy="88" r="1.6"/>' +
      '<circle cx="34" cy="86" r="2.1"/><circle cx="60" cy="22" r="1.5"/><circle cx="22" cy="64" r="1.4"/></g>' +
      place(stickerMotif(sid, false, id + '-m'), 60, 61, 72) +
      // gloss across the upper left, clipped to the inner disc
      '<g clip-path="url(#' + id + '-clip)"><ellipse cx="44" cy="30" rx="36" ry="17" transform="rotate(-28 44 30)" fill="#FFFFFF" fill-opacity=".3"/></g>' +
      '<circle cx="60" cy="60" r="46" fill="none" stroke="' + mix(col, C.white, 0.35) + '" stroke-opacity=".55" stroke-width="2"/>' +
      '<path class="art-twinkle" style="--art-d:-.6s" d="' + sparklePath(95, 26, 7) + '" fill="#FFFFFF" stroke="' + mix(col, C.white, 0.2) + '" stroke-width="1.2" stroke-linejoin="round"/>';
  } else {
    s += '<circle cx="60" cy="60" r="54" fill="#FFFFFF" fill-opacity=".6" stroke="#BCCDE4" stroke-width="2.2" stroke-dasharray="1 6.2" stroke-linecap="round"/>' +
      '<circle cx="60" cy="60" r="46" fill="#EEF5FC" fill-opacity=".85"/>' +
      '<g opacity=".72">' + place(stickerMotif(sid, true, id + '-m'), 60, 61, 72) + '</g>' +
      '<circle cx="60" cy="60" r="46" fill="#FFFFFF" fill-opacity=".22"/>';
  }
  return s + '</svg>';
}

/* ---------- verse-end marker ---------- */

// Inline marker after an Arabic verse: sapphire/orchid 8-point star ring, Arabic-Indic digits.
function ayah(n) {
  var id = uid('ayah');
  var digits = arabicDigits(n);
  var len = digits.length;
  var fs = len <= 1 ? 18 : (len === 2 ? 14.5 : 11.5);
  var y = 20 + fs * 0.225;   // optical centre of Amiri digits
  return '<span class="ayah" role="img" aria-label="jae ' + esc(n == null ? '' : n) + '">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<defs>' + linGrad(id + '-s', 0, 0, 1, 1, [[0, C.sapphire], [1, C.orchid]]) +
    linGrad(id + '-f', 0, 0, 0, 1, [[0, '#FFFFFF'], [1, '#E9E2FF']]) + '</defs>' +
    '<path d="' + starPath(20, 20, 18.6, 14.4) + '" fill="url(#' + id + '-f)" stroke="url(#' + id + '-s)" stroke-width="2.3" stroke-linejoin="round"/>' +
    '<circle cx="20" cy="20" r="11.8" fill="#FFFFFF" stroke="url(#' + id + '-s)" stroke-width="1.2" stroke-opacity=".75"/>' +
    '<text x="20" y="' + f(y) + '" text-anchor="middle" direction="ltr" font-family="\'Amiri Quran\', Amiri, serif" font-size="' + fs + '" fill="' + C.ink + '">' + esc(digits) + '</text>' +
    '</svg></span>';
}

/* ---------- app icon ---------- */

// 512x512 square, no text. Content stays inside the central ~80 % so maskable crops are safe.
function appIcon() {
  var id = uid('app');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' +
    '<defs>' +
    linGrad(id + '-bg', 0, 0, 0, 1, [[0, '#F6FBFF'], [0.55, '#D3EDFF'], [1, '#CDBEFF']]) +
    radGrad(id + '-halo', 0.5, 0.45, 0.5, [[0, '#FFFFFF', 0.95], [0.6, '#FFFFFF', 0.35], [1, '#FFFFFF', 0]]) +
    linGrad(id + '-rim', 0, 0, 1, 1, [[0, C.rose], [0.5, C.lilac], [1, C.glacier]]) +
    '</defs>' +
    '<rect width="512" height="512" fill="url(#' + id + '-bg)"/>' +
    '<circle cx="256" cy="236" r="230" fill="url(#' + id + '-halo)"/>' +
    // bubbles
    '<g fill="#FFFFFF" fill-opacity=".18" stroke="url(#' + id + '-rim)" stroke-width="4" stroke-opacity=".7">' +
    '<circle cx="78" cy="96" r="34"/><circle cx="440" cy="132" r="24"/><circle cx="430" cy="420" r="40"/><circle cx="74" cy="404" r="22"/></g>' +
    '<g fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"><path d="M58 92a22 22 0 0 1 16-18"/><path d="M406 412a26 26 0 0 1 18-22"/></g>' +
    // sparkles
    '<g fill="#FFFFFF"><path d="' + sparklePath(118, 186, 16) + '"/><path d="' + sparklePath(398, 236, 13) + '"/><path d="' + sparklePath(352, 80, 10) + '"/></g>' +
    // crown (bare = static, all five gems set) wearing a large ice crystal as its jewel
    '<g transform="translate(94 161) scale(1.35)">' + crownMarkup({ slots: 5, filled: 5, id: id + '-cw', bare: true, noTip: true }) + '</g>' +
    '<circle cx="256" cy="178" r="78" fill="url(#' + id + '-halo)"/>' +
    place(crystalMotif(CRYSTAL_TONES, id + '-cr'), 256, 178, 124) +
    '</svg>';
}

/* ---------- CSS (injected once) ---------- */
// :where() keeps the default sizing at zero specificity so callers' classes always win.
// State rules (.crown-slot.on, .pw.on) carry the art- prefix scope to avoid touching app markup.

var CSS =
  ':where(.icon){width:1em;height:1em;display:inline-block;flex-shrink:0;vertical-align:-0.15em}' +
  ':where(.art){display:block;width:100%;height:100%;overflow:visible}' +
  ':where(.ayah){display:inline-block;width:1.1em;height:1.1em;vertical-align:middle;margin-inline-start:.12em;line-height:1}' +
  '.ayah svg{width:100%;height:100%;display:block}' +
  /* crown sockets: gem pops in when .on is added */
  '.art-crown .art-slot-gem{transform-box:fill-box;transform-origin:center;transition:transform .45s cubic-bezier(.2,1.6,.4,1),opacity .25s ease}' +
  '.art-crown .crown-slot:not(.on) .art-slot-gem{transform:scale(.2);opacity:0}' +
  '.art-gem-glint{transform-box:fill-box;transform-origin:center;opacity:.9}' +
  '.crown-slot.on .art-gem-glint{animation:art-glint 2.6s ease-in-out infinite;animation-delay:var(--art-d,0s)}' +
  /* palace windows: lit layer fades in, halo breathes softly */
  '.art-palace .art-pw-lit,.art-palace .art-pw-halo{transition:opacity .6s ease}' +
  '.art-palace .pw:not(.on) .art-pw-lit,.art-palace .pw:not(.on) .art-pw-halo{opacity:0}' +
  '.art-palace .pw.on .art-pw-glow{animation:art-breathe 3.2s ease-in-out infinite alternate;animation-delay:var(--art-d,0s)}' +
  /* small sky / sticker sparkles */
  '.art-twinkle{transform-box:fill-box;transform-origin:center;animation:art-twinkle 2.8s ease-in-out infinite;animation-delay:var(--art-d,0s)}' +
  '@keyframes art-glint{0%,62%,100%{transform:scale(.35);opacity:0}76%{transform:scale(1.1);opacity:1}88%{transform:scale(.8);opacity:.9}}' +
  '@keyframes art-breathe{from{opacity:.55}to{opacity:1}}' +
  '@keyframes art-twinkle{0%,100%{transform:scale(.7) rotate(0deg);opacity:.55}50%{transform:scale(1.1) rotate(20deg);opacity:1}}' +
  '@media (prefers-reduced-motion: reduce){' +
  '.art-twinkle,.art-gem-glint,.art-pw-glow{animation:none!important}' +
  '.art-slot-gem,.art-pw-lit,.art-pw-halo{transition:none!important}' +
  '.crown-slot.on .art-gem-glint{transform:none;opacity:.9}}';

function injectCSS() {
  if (typeof document === 'undefined' || !document || !document.createElement) return;
  if (document.getElementById && document.getElementById('art-css')) return;
  var st = document.createElement('style');
  st.id = 'art-css';
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}

injectCSS();

export const ART = {
  icon: icon,
  ayah: ayah,
  arabicDigits: arabicDigits,
  starPath: starPath,
  crystal: crystal,
  snowflake: snowflake,
  bubble: bubble,
  gem: gem,
  tiara: tiara,
  crown: crown,
  palace: palace,
  palaceSilhouette: palaceSilhouette,
  sticker: sticker,
  appIcon: appIcon
};
export default ART;
