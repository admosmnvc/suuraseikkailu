/* Suuraseikkailu - art.js
   Inline SVG artwork helpers. Plain ES2020, no modules, no network.
   Exposes only window.ART. */
(function () {
  'use strict';

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

  var SECTION_COLORS = {
    shahada: '#22B07D',
    fatiha: '#8E5BEA',
    ikhlas: '#F2992E',
    kawthar: '#2FA8E0'
  };

  var DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function arabicDigits(n) {
    return String(n).replace(/[0-9]/g, function (d) { return DIGITS.charAt(+d); });
  }

  /* ---------- geometry helpers ---------- */

  // Star polygon. For an 8-point khatam star use r = 0.765 * R.
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

  // Onion-ish pointed dome sitting on y = base.
  function domePath(cx, base, hw, h, bulge) {
    var b = bulge == null ? hw * 0.12 : bulge;
    return 'M' + f(cx - hw) + ' ' + f(base) +
      'C' + f(cx - hw - b) + ' ' + f(base - h * 0.55) + ' ' + f(cx - hw * 0.4) + ' ' + f(base - h * 0.8) + ' ' + f(cx) + ' ' + f(base - h) +
      'C' + f(cx + hw * 0.4) + ' ' + f(base - h * 0.8) + ' ' + f(cx + hw + b) + ' ' + f(base - h * 0.55) + ' ' + f(cx + hw) + ' ' + f(base) + 'Z';
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

  // Trapezoid: top edge half-width hwTop at y, bottom half-width hwBot at y + h.
  function trapPath(cx, y, hwTop, hwBot, h) {
    return 'M' + f(cx - hwTop) + ' ' + f(y) + 'H' + f(cx + hwTop) +
      'L' + f(cx + hwBot) + ' ' + f(y + h) + 'H' + f(cx - hwBot) + 'Z';
  }

  function paths(list) {
    return list.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
  }

  /* ---------- icons (24x24, currentColor) ---------- */

  var SK = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="';

  function gearPath() {
    var cx = 12, cy = 12, ro = 10, ri = 7.5, n = 8, hole = 3.6;
    var step = Math.PI * 2 / n, d = '';
    function pt(r, a) { return f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a)); }
    for (var i = 0; i < n; i++) {
      var a = i * step - Math.PI / 2;
      var a0 = a - 0.27 * step, a1 = a - 0.15 * step, a2 = a + 0.15 * step, a3 = a + 0.27 * step;
      var next = a + step - 0.27 * step;
      d += (i ? 'L' : 'M') + pt(ri, a0) +
        'L' + pt(ro, a1) + 'A' + ro + ' ' + ro + ' 0 0 1 ' + pt(ro, a2) +
        'L' + pt(ri, a3) + 'A' + ri + ' ' + ri + ' 0 0 1 ' + pt(ri, next);
    }
    d += 'Z';
    d += 'M' + f(cx + hole) + ' ' + cy + 'A' + hole + ' ' + hole + ' 0 1 0 ' + f(cx - hole) + ' ' + cy +
      'A' + hole + ' ' + hole + ' 0 1 0 ' + f(cx + hole) + ' ' + cy + 'Z';
    return d;
  }

  var ICONS = {
    home:
      '<path d="M3.2 11.3 12 3.9l8.8 7.4"' + SK + '2.4"/>' +
      '<path d="M5.8 9.7v9.1a1.7 1.7 0 0 0 1.7 1.7h9a1.7 1.7 0 0 0 1.7-1.7V9.7"' + SK + '2.4"/>' +
      '<path d="M9.8 20.5v-3.7a2.2 2.2 0 0 1 4.4 0v3.7z" fill="currentColor"/>',
    play:
      '<path d="M8 5.3 19.2 12 8 18.7z" fill="currentColor" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>',
    star:
      '<path d="' + starPath(12, 12.9, 9.6, 4.6, 5) + '" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    speech:
      '<path d="M6.2 3.8h11.6a3 3 0 0 1 3 3v7.4a3 3 0 0 1-3 3h-6.6l-4.6 3.4v-3.4h-.4a3 3 0 0 1-3-3V6.8a3 3 0 0 1 3-3z"' + SK + '2.2"/>' +
      '<circle cx="8.2" cy="10.5" r="1.35" fill="currentColor"/>' +
      '<circle cx="12" cy="10.5" r="1.35" fill="currentColor"/>' +
      '<circle cx="15.8" cy="10.5" r="1.35" fill="currentColor"/>',
    gear:
      '<path d="' + gearPath() + '" fill="currentColor" fill-rule="evenodd" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    close:
      '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"' + SK + '2.8"/>',
    check:
      '<path d="M4.8 12.6l4.6 4.6 9.8-10"' + SK + '2.8"/>',
    replay:
      '<path d="M4.8 13.2A7.2 7.2 0 1 0 12 6"' + SK + '2.4"/>' +
      '<path d="M8.1 6 12.5 2.7v6.6z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    back:
      '<path d="M19.5 12H5M11 5.5 4.5 12l6.5 6.5"' + SK + '2.6"/>',
    sound:
      '<path d="M3.5 9.4h3.4l5-4.2v13.6l-5-4.2H3.5z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M14.96 8.48A4.6 4.6 0 0 1 14.96 15.52M17.62 5.76A8.4 8.4 0 0 1 17.62 18.24"' + SK + '2.2"/>'
  };

  function icon(name, className = '') {
    var body = ICONS[name] || '';
    var cls = 'icon' + (className ? ' ' + esc(className) : '');
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* ---------- background pattern (khatam star-and-cross lattice) ---------- */

  var patternCache = null;

  function patternURL() {
    if (patternCache) return patternCache;
    // Khatam stars (R = half the tile, r = 0.765 R) centred on the tile corners
    // touch tip-to-tip; the gaps between them form the cross shapes.
    // Drawing all four corners (clipped by the tile) makes it seamless.
    var d = '';
    var corners = [[0, 0], [72, 0], [0, 72], [72, 72]];
    corners.forEach(function (c) {
      d += starPath(c[0], c[1], 36, 27.55, 8);
      d += starPath(c[0], c[1], 17, 13, 8, -Math.PI / 2 + Math.PI / 8);
    });
    // Little star in the middle of the cross.
    d += starPath(36, 36, 7, 5.36, 8);
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'>" +
      "<path d='" + d + "' fill='none' stroke='#FFFFFF' stroke-opacity='0.09' stroke-width='1.2' stroke-linejoin='round'/></svg>";
    var enc = svg
      .replace(/%/g, '%25')
      .replace(/#/g, '%23')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E')
      .replace(/"/g, '%22')
      .replace(/[\r\n\t]+/g, ' ');
    patternCache = 'url("data:image/svg+xml,' + enc + '")';
    return patternCache;
  }

  /* ---------- mosque skyline ---------- */

  function skyline() {
    var far = [], near = [], holes = [], glow = [];
    var UP = -Math.PI / 2;

    function minaret(list, cx) {
      list.push(rectPath(cx - 6.5, 96, 13, 14));          // base block
      list.push(rectPath(cx - 4.5, 50, 9, 47));           // lower shaft
      list.push(rectPath(cx - 7.5, 46.8, 15, 3.4));       // balcony 1
      list.push(trapPath(cx, 50.2, 7, 4.5, 4));           // corbel
      list.push(rectPath(cx - 3.7, 27, 7.4, 21));         // upper shaft
      list.push(rectPath(cx - 6, 25, 12, 2.8));           // balcony 2
      list.push(trapPath(cx, 27.8, 5.6, 3.7, 3));         // corbel
      list.push('M' + f(cx - 4.4) + ' 25.5Q' + f(cx - 3.4) + ' 16 ' + f(cx) + ' 9.5Q' +
        f(cx + 3.4) + ' 16 ' + f(cx + 4.4) + ' 25.5Z');   // pointed cap
      list.push(rectPath(cx - 0.5, 5.5, 1, 5));           // finial rod
      list.push(crescentPath(cx, 4.2, 2.9, UP));          // crescent
    }

    function finial(list, cx, top, len, ball) {
      list.push(rectPath(cx - 0.5, top - len, 1, len + 0.5));
      list.push('M' + f(cx - ball) + ' ' + f(top - len * 0.55) + 'a' + ball + ' ' + ball + ' 0 1 0 ' + f(ball * 2) + ' 0a' + ball + ' ' + ball + ' 0 1 0 ' + f(-ball * 2) + ' 0Z');
    }

    /* far layer: distant domes and minarets */
    far.push(rectPath(0, 100, 400, 10));
    far.push(rectPath(14, 80, 48, 30));
    far.push(domePath(38, 80.5, 15, 18));
    finial(far, 38, 62.5, 6, 1.3);
    far.push(rectPath(4, 48, 6, 62));
    far.push(rectPath(2, 55, 10, 2.2));
    far.push('M3.8 48.5Q5 41 7 36Q9 41 10.2 48.5Z');
    far.push(rectPath(6.5, 32, 1, 5));
    far.push(crescentPath(7, 30.5, 2.3, UP));
    far.push(rectPath(60, 76, 34, 34));
    far.push(domePath(78, 76.5, 12, 15));
    finial(far, 78, 61.5, 5, 1.1);
    far.push(rectPath(288, 80, 24, 30));
    far.push(domePath(300, 80.5, 10, 12));
    far.push(rectPath(326, 74, 46, 36));
    far.push(domePath(350, 74.5, 15, 18));
    finial(far, 350, 56.5, 6, 1.3);
    far.push(rectPath(383, 42, 6, 68));
    far.push(rectPath(381, 50, 10, 2.2));
    far.push('M382.8 42.5Q384 35 386 30Q388 35 389.2 42.5Z');
    far.push(rectPath(385.5, 26, 1, 5));
    far.push(crescentPath(386, 24.5, 2.3, UP));

    /* near layer: the mosque */
    near.push(rectPath(0, 104, 400, 6));                 // plinth
    near.push(rectPath(0, 95, 54, 15));                  // left wall
    near.push(rectPath(18, 89, 16, 7));
    near.push(domePath(26, 89.5, 8, 9));
    near.push(rectPath(52, 85, 56, 25));                 // left wing
    near.push(domePath(80, 85.5, 11, 13));
    finial(near, 80, 72.5, 5, 1.2);
    near.push(rectPath(116, 81, 16, 29));                // connectors
    near.push(rectPath(268, 81, 16, 29));
    minaret(near, 112);
    minaret(near, 288);
    near.push(rectPath(128, 72, 144, 38));               // prayer hall
    near.push(rectPath(124, 70.5, 152, 3));              // cornice
    near.push(domePath(150, 71, 15, 19));                // side domes
    finial(near, 150, 52, 5, 1.2);
    near.push(domePath(250, 71, 15, 19));
    finial(near, 250, 52, 5, 1.2);
    near.push(rectPath(170, 57, 60, 15));                // drum
    near.push(rectPath(166, 56, 68, 3));
    near.push(domePath(200, 57.5, 33, 37, 4));           // main dome
    near.push(rectPath(199.4, 9.5, 1.2, 11.5));          // main finial
    near.push('M198.1 14.5a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0Z');
    near.push(crescentPath(200, 6, 3.6, UP));
    near.push(rectPath(292, 83, 62, 27));                // right wing
    near.push(domePath(318, 83.5, 12, 14));
    finial(near, 318, 69.5, 5, 1.2);
    near.push(domePath(341, 83.5, 7, 8));
    near.push(rectPath(354, 94, 46, 16));                // right wall
    near.push(rectPath(372, 90, 22, 5));

    /* arcade openings (deep shadow) */
    [145, 162, 179, 221, 238, 255].forEach(function (x) { holes.push(archPath(x, 90, 11, 110)); });
    holes.push(archPath(200, 84, 18, 110));
    [62, 98].forEach(function (x) { holes.push(archPath(x, 96, 7, 110)); });
    [304, 318, 332, 346].forEach(function (x) { holes.push(archPath(x, 95.5, 7, 110)); });
    [8, 20, 32, 44].forEach(function (x) { holes.push(archPath(x, 99.5, 6, 110)); });
    [364, 376, 388].forEach(function (x) { holes.push(archPath(x, 99, 6, 110)); });

    /* a few small windows glowing gold */
    glow.push(archPath(186, 60.5, 4.2, 68.5));
    glow.push(archPath(200, 60, 4.6, 68.5));
    glow.push(archPath(214, 60.5, 4.2, 68.5));
    glow.push(archPath(150, 76.5, 5, 85));
    glow.push(archPath(250, 76.5, 5, 85));
    glow.push(archPath(112, 58, 3.2, 64.5));
    glow.push(archPath(288, 58, 3.2, 64.5));
    glow.push(archPath(80, 89, 4, 96));
    glow.push(archPath(318, 87.5, 4, 94.5));
    glow.push(archPath(200, 87.5, 9, 110));

    return '<svg class="skyline" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" aria-hidden="true" focusable="false">' +
      '<g fill="#171B4A">' + paths(far) + '</g>' +
      '<g fill="#10133A">' + paths(near) + '</g>' +
      '<g fill="#0A0C2C">' + paths(holes) + '</g>' +
      '<g fill="#FFC93C" fill-opacity="0.35">' + paths(glow) + '</g>' +
      '</svg>';
  }

  /* ---------- header emblem ---------- */

  function emblem() {
    var id = uid('emblem');
    return '<svg class="emblem" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">' +
      '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">' +
      '<rect width="48" height="48" fill="#FFFFFF"/><circle cx="31.5" cy="18.5" r="15" fill="#000000"/></mask></defs>' +
      '<circle cx="23.5" cy="25" r="18" fill="#FFC93C" mask="url(#' + id + ')"/>' +
      '<path d="' + starPath(33, 22.5, 7.6, 5.81) + '" fill="#FFE08A" stroke="#FFE08A" stroke-width="1" stroke-linejoin="round"/>' +
      '</svg>';
  }

  /* ---------- section medals ---------- */

  function medalIcon(sectionId, id, ink, wood, light) {
    switch (sectionId) {
      case 'shahada':
        return '<defs><mask id="' + id + '-m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">' +
          '<rect width="100" height="100" fill="#FFFFFF"/><circle cx="56.2" cy="45.6" r="13" fill="#000000"/></mask></defs>' +
          '<circle cx="49.5" cy="50.5" r="15.5" fill="' + ink + '" mask="url(#' + id + '-m)"/>' +
          '<path d="' + starPath(59.6, 48.2, 6, 2.75, 5, -Math.PI / 2 + 0.2) + '" fill="' + ink + '" stroke="' + ink + '" stroke-width="1" stroke-linejoin="round"/>';
      case 'fatiha': {
        var lines = '';
        for (var i = 0; i < 3; i++) {
          var o = i * 3.6;
          lines += 'M45.6 ' + f(43.6 + o) + 'C42.4 ' + f(41.1 + o) + ' 39 ' + f(40.7 + o) + ' 35.8 ' + f(41.4 + o) +
            'M54.4 ' + f(43.6 + o) + 'C57.6 ' + f(41.1 + o) + ' 61 ' + f(40.7 + o) + ' 64.2 ' + f(41.4 + o);
        }
        return '<path d="M38 50.5 57 64.75M62 50.5 43 64.75" fill="none" stroke="' + wood + '" stroke-width="3.6" stroke-linecap="round"/>' +
          '<path d="M48.8 40C44 36.5 38 36 32.5 37.5V53.5C38 52 44 52.5 48.8 56ZM51.2 40C56 36.5 62 36 67.5 37.5V53.5C62 52 56 52.5 51.2 56Z" fill="' + ink + '" stroke="' + ink + '" stroke-width="1.6" stroke-linejoin="round"/>' +
          '<path d="' + lines + '" fill="none" stroke="' + light + '" stroke-width="1.3" stroke-linecap="round"/>';
      }
      case 'ikhlas':
        return '<text x="50" y="58.6" text-anchor="middle" font-family="Amiri Quran, Amiri, serif" font-size="38" fill="' + ink + '" stroke="' + ink + '" stroke-width="0.8" stroke-linejoin="round">' + DIGITS.charAt(1) + '</text>';
      case 'kawthar':
        return '<path d="M50 31.5C50 31.5 39.2 43.6 39.2 50.4 39.2 56.4 44 61 50 61S60.8 56.4 60.8 50.4C60.8 43.6 50 31.5 50 31.5Z" fill="' + ink + '"/>' +
          '<path d="M44.6 50.8c0-2.8 1.3-5.3 2.9-7.4" fill="none" stroke="' + light + '" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>' +
          '<path d="M37 66.2q3.25-3 6.5 0t6.5 0 6.5 0 6.5 0" fill="none" stroke="' + ink + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
      default:
        return '<path d="' + starPath(50, 51.5, 15, 7, 5) + '" fill="' + ink + '" stroke="' + ink + '" stroke-width="2" stroke-linejoin="round"/>';
    }
  }

  function medal(sectionId, earned) {
    var on = !!earned;
    var col = SECTION_COLORS[sectionId] || '#FFC93C';
    var id = uid('medal');
    var starFill = on ? col : '#2F3270';
    var edge = on ? mix(col, '#141838', 0.32) : '#4A4E8C';
    var inner = on ? '#FFE08A' : '#4A4E8C';
    var disc = on ? '#FFF4D6' : '#262A5E';
    var ink = on ? mix(col, '#141838', 0.12) : '#4A4E8C';
    var wood = on ? '#3A2600' : '#4A4E8C';
    var outer = starPath(50, 50, 44, 33.66);

    var s = '<svg class="medal' + (on ? '' : ' locked') + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">';
    // soft drop shadow
    s += '<g opacity="' + (on ? '0.4' : '0.3') + '"><path d="' + starPath(50, 53, 44, 33.66) + '" fill="#07081E" stroke="#07081E" stroke-width="4" stroke-linejoin="round"/></g>';
    // star body with darker edge
    s += '<path d="' + outer + '" fill="' + starFill + '" stroke="' + edge + '" stroke-width="3.5" stroke-linejoin="round"/>';
    if (on) {
      s += '<defs><clipPath id="' + id + '-c"><path d="' + outer + '"/></clipPath></defs>' +
        '<ellipse cx="40" cy="22" rx="42" ry="24" fill="#FFFFFF" fill-opacity="0.14" clip-path="url(#' + id + '-c)"/>';
    }
    // inner gold star outline
    s += '<path d="' + starPath(50, 50, 36.5, 27.92) + '" fill="none" stroke="' + inner + '" stroke-width="2" stroke-linejoin="round"/>';
    // centre disc
    s += '<circle cx="50" cy="50" r="24.5" fill="' + disc + '" stroke="' + edge + '" stroke-opacity="' + (on ? '0.35' : '0.6') + '" stroke-width="1.5"/>';
    // icon
    s += '<g' + (on ? '' : ' opacity="0.5"') + '>' + medalIcon(sectionId, id, ink, wood, disc) + '</g>';
    return s + '</svg>';
  }

  /* ---------- verse-end rosette ---------- */

  function ayah(n) {
    var digits = arabicDigits(n);
    var len = digits.length;
    var fs = len <= 1 ? 19 : (len === 2 ? 15.5 : 12);
    var y = 20 + fs * 0.225;   // optical centre of Amiri digits
    return '<span class="ayah" role="img" aria-label="jae ' + esc(n) + '">' +
      '<svg viewBox="0 0 40 40">' +
      '<path d="' + starPath(20, 20, 19, 14.54) + '" fill="#FFC93C" stroke="#FFC93C" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<circle cx="20" cy="20" r="12.4" fill="#FFF4D6" stroke="#C98A00" stroke-width="1.4"/>' +
      '<text x="20" y="' + f(y) + '" text-anchor="middle" direction="ltr" font-family="Amiri Quran, Amiri, serif" font-size="' + fs + '" fill="#3A2600">' + esc(digits) + '</text>' +
      '</svg></span>';
  }

  /* ---------- reward star ---------- */

  function rewardStar() {
    var id = uid('reward');
    var rays = '';
    var n = 16;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i + 0.5) * (2 * Math.PI / n);
      var long = i % 2 === 0;
      var L = long ? 99 : 80;
      var w = long ? 0.11 : 0.075;
      rays += '<path d="M100 100L' + f(100 + L * Math.cos(a - w)) + ' ' + f(100 + L * Math.sin(a - w)) +
        'A' + L + ' ' + L + ' 0 0 1 ' + f(100 + L * Math.cos(a + w)) + ' ' + f(100 + L * Math.sin(a + w)) + 'Z"/>';
    }
    var S = starPath(100, 106.5, 70, 32, 5);
    var sparkles = [[34, 46, 7], [168, 52, 5.5], [160, 166, 6.5], [42, 158, 4.5]].map(function (p) {
      return '<path d="' + starPath(p[0], p[1], p[2], p[2] * 0.3, 4) + '"/>';
    }).join('');
    return '<svg class="reward-star" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<radialGradient id="' + id + '-ray" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="100">' +
      '<stop offset="0" stop-color="#FFF3C4" stop-opacity="0.9"/><stop offset="0.5" stop-color="#FFE08A" stop-opacity="0.38"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + '-glow" gradientUnits="userSpaceOnUse" cx="100" cy="104" r="82">' +
      '<stop offset="0" stop-color="#FFE08A" stop-opacity="0.5"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + '-fill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#FFE08A"/><stop offset="0.5" stop-color="#FFC93C"/><stop offset="1" stop-color="#E6A100"/></linearGradient>' +
      '</defs>' +
      '<circle cx="100" cy="104" r="82" fill="url(#' + id + '-glow)"/>' +
      '<g class="rays" fill="url(#' + id + '-ray)" opacity="0.7">' + rays + '</g>' +
      '<g fill="#FFF3C4" opacity="0.8">' + sparkles + '</g>' +
      '<g class="big-star">' +
      '<path d="' + S + '" fill="#C98A00" stroke="#C98A00" stroke-width="13" stroke-linejoin="round"/>' +
      '<path d="' + S + '" fill="url(#' + id + '-fill)" stroke="url(#' + id + '-fill)" stroke-width="9" stroke-linejoin="round"/>' +
      '<ellipse cx="93" cy="64" rx="4.2" ry="14" transform="rotate(23 93 64)" fill="#FFFFFF" fill-opacity="0.6"/>' +
      '<circle cx="62" cy="91" r="3.2" fill="#FFFFFF" fill-opacity="0.5"/>' +
      '</g>' +
      '</svg>';
  }

  /* ---------- CSS (injected once) ---------- */

  var CSS =
    '.icon{width:1em;height:1em;display:inline-block;flex-shrink:0;vertical-align:-0.15em}' +
    '.ayah{display:inline-block;width:1.1em;height:1.1em;vertical-align:middle;margin-inline-start:.12em;line-height:1}' +
    '.ayah svg{width:100%;height:100%;display:block}' +
    '.medal{display:block;width:100%;height:auto}' +
    '.medal.locked{filter:saturate(.4)}' +
    '.reward-star{display:block;width:100%;height:auto}' +
    '.reward-star .rays{transform-origin:100px 100px;animation:art-spin 18s linear infinite}' +
    '.reward-star .big-star{transform-origin:100px 100px;animation:art-pop .6s cubic-bezier(.2,1.6,.4,1) both}' +
    '@keyframes art-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
    '@keyframes art-pop{0%{transform:scale(0) rotate(-30deg);opacity:0}100%{transform:scale(1) rotate(0deg);opacity:1}}' +
    '@media (prefers-reduced-motion: reduce){.reward-star .rays,.reward-star .big-star{animation:none}}';

  function injectCSS() {
    if (typeof document === 'undefined' || !document || !document.createElement) return;
    if (document.getElementById && document.getElementById('art-css')) return;
    var st = document.createElement('style');
    st.id = 'art-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  injectCSS();

  window.ART = {
    icon: icon,
    starPath: starPath,
    patternURL: patternURL,
    skyline: skyline,
    emblem: emblem,
    medal: medal,
    ayah: ayah,
    rewardStar: rewardStar,
    arabicDigits: arabicDigits
  };
})();
