/* games.js - Suuraseikkailu: SFX (synthesized sound effects), FX (full-screen
   particle canvas) and MiniGames (six short reward games).
   Plain ES2020 browser script, no modules. Exposes only window.SFX, window.FX
   and window.MiniGames. No music, no characters, no external resources. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var motionMQ = null;
  try { motionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { motionMQ = null; }
  function reducedMotion() { return !!(motionMQ && motionMQ.matches); }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, toHex, amt) {
    var a = hexToRgb(hex), b = hexToRgb(toHex), s = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(a[i] + (b[i] - a[i]) * amt);
      s += (v < 16 ? '0' : '') + v.toString(16);
    }
    return s;
  }
  function shade(hex, amt) { return amt < 0 ? mix(hex, '#000000', -amt) : mix(hex, '#ffffff', amt); }

  /* ================================================================== */
  /* SFX - short synthesized sound effects (Web Audio, no files)         */
  /* ================================================================== */
  var SFX = (function () {
    var ctx = null, out = null, enabled = true, noiseBuf = null, primed = false, resumeAt = -1e9;

    function unlock() {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
      try {
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          out = ctx.createGain();
          out.gain.value = 0.5;
          var comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
          if (comp) {
            comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4;
            comp.attack.value = 0.003; comp.release.value = 0.15;
            out.connect(comp); comp.connect(ctx.destination);
          } else {
            out.connect(ctx.destination);
          }
        }
        if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) {
          resumeAt = now();
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () {});
        }
        if (!primed) { /* one silent sample fully unlocks iOS Safari */
          primed = true;
          var b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
          src.buffer = b; src.connect(ctx.destination); src.start(0);
        }
      } catch (e) { /* audio unavailable: stay silent */ }
    }

    function ready() {
      if (!enabled || !ctx || !out) return false;
      if (ctx.state === 'running') return true;
      if (ctx.state === 'closed') return false;
      /* right after unlock() the resume is still pending: schedule anyway, it plays on resume */
      if (now() - resumeAt < 800) return true;
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
      return false;
    }

    function env(g, t, attack, peak, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function osc(type, f0, f1, t, attack, decay, peak, glide) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + (glide || attack + decay));
      env(g, t, attack, peak, decay);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + attack + decay + 0.03);
    }
    function getNoise() {
      if (!noiseBuf) {
        var len = Math.floor(ctx.sampleRate * 2);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return noiseBuf;
    }
    function noise(t, dur, peak, type, f0, f1, q, attack) {
      var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      var a = attack || 0.004;
      src.buffer = getNoise();
      f.type = type; f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, a, peak, Math.max(0.01, dur - a));
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t, Math.random() * 1.2);
      src.stop(t + dur + 0.05);
    }
    function play(fn) {
      if (!ready()) return;
      try { fn(ctx.currentTime + 0.005); } catch (e) { /* ignore */ }
    }

    var CHIME_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

    return {
      unlock: unlock,
      setEnabled: function (b) { enabled = !!b; },
      pop: function () {
        play(function (t) {
          noise(t, 0.05, 0.3, 'bandpass', 2600, 900, 1.2, 0.002);
          osc('sine', 820, 180, t, 0.004, 0.1, 0.4, 0.075);
        });
      },
      ding: function (i) {
        i = clamp(Math.round(+i || 0), 0, 12);
        play(function (t) {
          var f = 880 * Math.pow(2, i / 12);
          osc('sine', f, 0, t, 0.003, 0.48, 0.26);
          osc('sine', f * 2.76, 0, t, 0.002, 0.16, 0.05);
          osc('triangle', f * 2, 0, t, 0.002, 0.08, 0.035);
        });
      },
      chime: function (i) {
        i = Math.abs(Math.round(+i || 0));
        play(function (t) {
          var f = 1046.5 * Math.pow(2, CHIME_STEPS[i % CHIME_STEPS.length] / 12);
          osc('sine', f, 0, t, 0.012, 0.55, 0.16);
          osc('sine', f * 2.01, 0, t, 0.008, 0.32, 0.06);
        });
      },
      plop: function () {
        play(function (t) {
          osc('sine', 360, 105, t, 0.004, 0.14, 0.42, 0.1);
          noise(t, 0.05, 0.12, 'lowpass', 700, 300, 0.7, 0.003);
        });
      },
      whoosh: function () {
        play(function (t) {
          noise(t, 0.5, 0.2, 'bandpass', 380, 2800, 1.3, 0.2);
        });
      },
      boom: function () {
        play(function (t) {
          osc('sine', 110, 40, t, 0.01, 0.42, 0.3, 0.3);
          noise(t, 0.36, 0.17, 'lowpass', 800, 150, 0.7, 0.008);
          for (var k = 0; k < 7; k++) {
            noise(t + 0.12 + Math.random() * 0.36, 0.025, 0.04 + Math.random() * 0.04, 'highpass', 4200, 0, 0.7, 0.001);
          }
        });
      },
      sparkle: function () {
        play(function (t) {
          for (var k = 0; k < 3; k++) osc('sine', rand(3200, 5200), 0, t + k * 0.045, 0.002, 0.07, 0.05);
        });
      },
      success: function () {
        play(function (t) {
          [0, 4, 7].forEach(function (st, k) {
            var f = 1046.5 * Math.pow(2, st / 12), tk = t + k * 0.1;
            osc('sine', f, 0, tk, 0.003, 0.3, 0.2);
            osc('sine', f * 2, 0, tk, 0.002, 0.12, 0.04);
          });
        });
      },
      tap: function () {
        play(function (t) { osc('triangle', 1500, 900, t, 0.001, 0.03, 0.12, 0.03); });
      }
    };
  })();

  /* ================================================================== */
  /* FX - one full-screen particle canvas (viewport coordinates)        */
  /* ================================================================== */
  var FX = (function () {
    var cv = null, g = null, W = 1, H = 1, dpr = 1;
    var raf = 0, last = 0, inFrame = false, showTimer = 0;
    var parts = [], rings = [], rockets = [];
    var MAXP = 1600;
    var FESTIVE = ['#FFC93C', '#FFE08A', '#22B07D', '#2FA8E0', '#8E5BEA', '#F2992E', '#FF5D73', '#FF7AC6', '#FFF8EA'];

    function k(n) { return reducedMotion() ? Math.max(1, Math.round(n * 0.5)) : n; }

    function resize() {
      if (!cv) return;
      var de = document.documentElement;
      W = Math.max(1, window.innerWidth || (de && de.clientWidth) || 1);
      H = Math.max(1, window.innerHeight || (de && de.clientHeight) || 1);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ensure() {
      if (cv) {
        if (!cv.isConnected && document.body) document.body.appendChild(cv);
        return true;
      }
      if (!document.body) return false;
      var c = document.createElement('canvas');
      var c2 = c.getContext ? c.getContext('2d') : null;
      if (!c2) return false;
      cv = c; g = c2;
      c.className = 'fx-layer';
      c.setAttribute('aria-hidden', 'true');
      var s = c.style;
      s.position = 'fixed'; s.inset = '0'; s.left = '0'; s.top = '0';
      s.width = '100%'; s.height = '100%'; s.margin = '0'; s.padding = '0'; s.border = '0';
      s.display = 'block'; s.zIndex = '60'; s.pointerEvents = 'none';
      document.body.appendChild(c);
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);
      return true;
    }

    function kick() {
      if (!raf && !inFrame) { last = now(); raf = requestAnimationFrame(frame); }
    }
    function add(p) {
      if (parts.length >= MAXP) return;
      p.max = p.life;
      parts.push(p);
    }

    function frame(ts) {
      raf = 0;
      if (!g) return;
      inFrame = true;
      var dt = Math.min(50, Math.max(0, ts - last)) / 1000;
      last = ts;
      var tsec = ts / 1000, i, j, p, r, lf, al;
      var rm = reducedMotion();

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, W, H);

      /* rockets: move (ease-out), leave embers, call onArrive */
      for (i = rockets.length - 1; i >= 0; i--) {
        r = rockets[i];
        if (!r) continue;
        r.t += dt;
        var q = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - q, 3);
        r.px = r.x; r.py = r.y;
        r.x = r.x0 + (r.x1 - r.x0) * e;
        r.y = r.y0 + (r.y1 - r.y0) * e;
        var m = rm ? 1 : 3;
        for (j = 0; j < m; j++) {
          var f = Math.random();
          add({ t: 4, x: r.px + (r.x - r.px) * f + rand(-1.5, 1.5), y: r.py + (r.y - r.py) * f,
            vx: rand(-22, 22), vy: rand(10, 55), gr: 60, dr: 0.9, life: rand(0.25, 0.5),
            r: rand(1.3, 2.7), c: Math.random() < 0.5 ? '#FFE08A' : '#FFB347' });
        }
        if (q >= 1) {
          rockets.splice(i, 1);
          if (r.cb) { try { r.cb(); } catch (err) { /* ignore */ } }
        }
      }

      /* update particles */
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i];
        p.life -= dt;
        if (p.life <= 0 || (p.t === 2 && p.y > H + 40)) {
          parts[i] = parts[parts.length - 1];
          parts.pop();
          continue;
        }
        if (p.t === 2) {
          p.vy += (p.term - p.vy) * Math.min(1, dt * 2.2);
          p.x += (p.vx + Math.sin(tsec * p.sf + p.ph) * p.sw) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          p.fl += p.vf * dt;
        } else if (p.t !== 5) {
          var d = Math.pow(p.dr, dt * 60);
          p.vx *= d; p.vy *= d;
          p.vy += p.gr * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
      }

      /* normal blending: dots, confetti */
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.t === 0) {
          lf = p.life / p.max;
          g.globalAlpha = Math.min(1, lf * 1.6);
          g.fillStyle = p.c;
          g.beginPath(); g.arc(p.x, p.y, p.r * (0.45 + 0.55 * lf), 0, TAU); g.fill();
        } else if (p.t === 2) {
          var cs = Math.cos(p.rot), sn = Math.sin(p.rot), fl = Math.cos(p.fl);
          g.globalAlpha = Math.min(1, p.life / 0.6);
          g.fillStyle = fl < 0 ? p.c2 : p.c;
          g.setTransform(cs * dpr, sn * dpr, -sn * fl * dpr, cs * fl * dpr, p.x * dpr, p.y * dpr);
          g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* expanding rings */
      for (i = rings.length - 1; i >= 0; i--) {
        var rg = rings[i];
        rg.life -= dt;
        if (rg.life <= 0) { rings.splice(i, 1); continue; }
        var q2 = 1 - rg.life / rg.max, ee = 1 - (1 - q2) * (1 - q2);
        g.globalAlpha = (1 - q2) * 0.85;
        g.strokeStyle = rg.c;
        g.lineWidth = Math.max(0.5, rg.w * (1 - q2));
        g.beginPath(); g.arc(rg.x, rg.y, rg.r + (rg.R - rg.r) * ee, 0, TAU); g.stroke();
      }

      /* additive blending: sparks, firework trails, embers, flashes, rockets */
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        lf = p.life / p.max;
        if (p.t === 1) {
          var tw = 0.55 + 0.45 * Math.sin(tsec * p.tf + p.ph);
          al = Math.min(1, lf * 2) * tw;
          var s = p.r * (0.6 + 0.4 * lf);
          g.globalAlpha = al * 0.3; g.fillStyle = p.c;
          g.beginPath(); g.arc(p.x, p.y, s * 2.4, 0, TAU); g.fill();
          g.globalAlpha = al; g.strokeStyle = p.c; g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(p.x - s * 2.2, p.y); g.lineTo(p.x + s * 2.2, p.y);
          g.moveTo(p.x, p.y - s * 2.2); g.lineTo(p.x, p.y + s * 2.2);
          g.stroke();
          g.fillStyle = '#FFF8EA';
          g.beginPath(); g.arc(p.x, p.y, s * 0.6, 0, TAU); g.fill();
        } else if (p.t === 3) {
          al = lf < 0.35 ? lf / 0.35 : 1;
          if (p.fk && lf < 0.5) al *= (Math.sin(tsec * 38 + p.ph) > 0 ? 1 : 0.25);
          g.globalAlpha = al; g.strokeStyle = p.c; g.lineWidth = p.r;
          g.beginPath(); g.moveTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); g.lineTo(p.x, p.y); g.stroke();
        } else if (p.t === 4) {
          g.globalAlpha = lf * 0.9; g.fillStyle = p.c;
          g.beginPath(); g.arc(p.x, p.y, p.r * (0.4 + 0.6 * lf), 0, TAU); g.fill();
        } else if (p.t === 5) {
          g.globalAlpha = lf * lf * 0.5; g.fillStyle = p.c;
          g.beginPath(); g.arc(p.x, p.y, p.r * (1.5 - 0.5 * lf), 0, TAU); g.fill();
        }
      }
      for (i = 0; i < rockets.length; i++) {
        r = rockets[i];
        g.globalAlpha = 0.6; g.strokeStyle = '#FFE08A'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - (r.x - r.px) * 3, r.y - (r.y - r.py) * 3); g.stroke();
        g.globalAlpha = 0.35; g.fillStyle = '#FFC93C';
        g.beginPath(); g.arc(r.x, r.y, 9, 0, TAU); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#FFF8EA';
        g.beginPath(); g.arc(r.x, r.y, 3, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;

      inFrame = false;
      if (parts.length || rings.length || rockets.length) raf = requestAnimationFrame(frame);
    }

    function burst(x, y, colors, n) {
      if (!ensure()) return;
      colors = (colors && colors.length) ? colors : ['#FFC93C', '#ffffff'];
      n = k(n > 0 ? n : 20);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * TAU, sp = rand(140, 400);
        add({ t: 0, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, gr: 520, dr: 0.92,
          life: rand(0.55, 0.95), r: rand(2.5, 5.5), c: colors[i % colors.length] });
      }
      rings.push({ x: x, y: y, r: 8, R: rand(56, 76), life: 0.38, max: 0.38, c: colors[0], w: 4 });
      kick();
    }

    function sparkle(x, y) {
      if (!ensure()) return;
      var n = k(16);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * TAU, sp = rand(40, 210), pick = Math.random();
        add({ t: 1, x: x + rand(-6, 6), y: y + rand(-6, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
          gr: 140, dr: 0.93, life: rand(0.5, 0.95), r: rand(1.6, 3.4), tf: rand(14, 26), ph: rand(0, TAU),
          c: pick < 0.3 ? '#FFF8EA' : (pick < 0.65 ? '#FFE08A' : '#FFC93C') });
      }
      add({ t: 5, x: x, y: y, life: 0.25, r: 26, c: '#FFC93C' });
      kick();
    }

    function confetti(n) {
      if (!ensure()) return;
      n = k(n > 0 ? n : 60);
      for (var i = 0; i < n; i++) {
        var c = FESTIVE[(Math.random() * FESTIVE.length) | 0];
        add({ t: 2, x: rand(0, W), y: rand(-H * 0.35, -14), vx: rand(-18, 18), vy: rand(40, 140),
          term: Math.max(120, H * rand(0.2, 0.32)), sf: rand(1.5, 3.2), ph: rand(0, TAU), sw: rand(14, 42),
          rot: rand(0, TAU), vr: rand(-3, 3), fl: rand(0, TAU), vf: rand(5, 11),
          w: rand(6, 10), h: rand(10, 16), c: c, c2: shade(c, -0.32), life: 9 });
      }
      kick();
    }

    function firework(x, y, hue) {
      if (!ensure()) return;
      var h = (typeof hue === 'number' && isFinite(hue)) ? ((hue % 360) + 360) % 360 : rand(0, 360);
      var n = k(72), base = clamp(Math.min(W, H) * 0.62, 200, 420);
      var c1 = 'hsl(' + h.toFixed(0) + ',100%,64%)', c2 = 'hsl(' + ((h + 35) % 360).toFixed(0) + ',100%,76%)';
      for (var i = 0; i < n; i++) {
        var a = (i / n) * TAU + rand(-0.06, 0.06), sp = base * (0.45 + 0.55 * Math.sqrt(Math.random())), pick = Math.random();
        add({ t: 3, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 150, dr: 0.97,
          life: rand(0.9, 1.5), r: rand(1.6, 2.7), fk: Math.random() < 0.35, ph: rand(0, TAU),
          c: pick < 0.12 ? '#FFF8EA' : (pick < 0.4 ? c2 : c1) });
      }
      add({ t: 5, x: x, y: y, life: 0.32, r: 44, c: c1 });
      kick();
    }

    function rocket(x0, y0, x1, y1, onArrive) {
      var cb = typeof onArrive === 'function' ? onArrive : null;
      if (!ensure()) { if (cb) setTimeout(cb, 600); return; }
      rockets.push({ x0: x0, y0: y0, x1: x1, y1: y1, x: x0, y: y0, px: x0, py: y0, t: 0, dur: 0.6, cb: cb });
      kick();
    }

    function show(ms) {
      if (!ensure()) return;
      ms = ms > 0 ? ms : 5000;
      var end = now() + ms;
      if (showTimer) clearTimeout(showTimer);
      (function launch() {
        showTimer = 0;
        if (now() >= end) return;
        var x0 = rand(0.12, 0.88) * W;
        var x1 = clamp(x0 + rand(-0.15, 0.15) * W, 0.08 * W, 0.92 * W);
        var y1 = rand(0.08, 0.6) * H;
        var hue = rand(0, 360);
        SFX.whoosh();
        rocket(x0, H + 8, x1, y1, function () { firework(x1, y1, hue); SFX.boom(); });
        showTimer = setTimeout(launch, reducedMotion() ? rand(600, 900) : rand(350, 600));
      })();
    }

    function clear() {
      parts.length = 0; rings.length = 0; rockets.length = 0;
      if (showTimer) { clearTimeout(showTimer); showTimer = 0; }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (g) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, W, H);
      }
    }

    return { burst: burst, sparkle: sparkle, confetti: confetti, firework: firework, rocket: rocket, show: show, clear: clear };
  })();

  /* ================================================================== */
  /* Art - inline SVG (no characters: objects and shapes only)          */
  /* ================================================================== */
  var uidN = 0;
  function uid(p) { uidN += 1; return 'mg' + p + uidN; }
  var SVG0 = ' aria-hidden="true" focusable="false"';

  function starPath(cx, cy, R, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2) ? r : R;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + 'Z';
  }
  var GOAL_STAR = '<svg viewBox="0 0 24 24"' + SVG0 + '><path d="' + starPath(12, 12.8, 10.6, 4.8) +
    '" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function rg(id, cx, cy, r, stops) {
    var s = '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">';
    for (var i = 0; i < stops.length; i++) s += '<stop offset="' + stops[i][0] + '" stop-color="' + stops[i][1] + '"/>';
    return s + '</radialGradient>';
  }

  function balloonSVG(c) {
    var id = uid('b');
    return '<svg viewBox="0 0 100 170"' + SVG0 + '><defs>' +
      rg(id, '.36', '.3', '.78', [[0, shade(c, 0.5)], [0.45, c], [1, shade(c, -0.34)]]) + '</defs>' +
      '<path d="M50 110 C42 121 58 130 49 141 C41 151 57 159 51 169" fill="none" stroke="rgba(255,248,234,.62)" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M44.5 111 L50 101.5 L55.5 111 Q50 113.5 44.5 111 Z" fill="' + shade(c, -0.22) + '"/>' +
      '<path d="M50 4 C77 4 95 25 95 51 C95 79 71 100 52 104 L48 104 C29 100 5 79 5 51 C5 25 23 4 50 4 Z" fill="url(#' + id + ')"/>' +
      '<ellipse cx="30" cy="34" rx="7.5" ry="15" transform="rotate(32 30 34)" fill="#fff" opacity=".5"/>' +
      '<circle cx="42" cy="18" r="3.4" fill="#fff" opacity=".55"/></svg>';
  }

  var STAR_D = starPath(50, 53, 46, 20.5), STAR_IN = starPath(50, 53, 21, 9.5);
  function starSVG() {
    var id = uid('s');
    return '<svg viewBox="0 0 100 100"' + SVG0 + '><defs>' +
      rg(id, '.5', '.48', '.62', [[0, '#FFF7CF'], [0.45, '#FFD54F'], [1, '#F2A900']]) + '</defs>' +
      '<path d="' + STAR_D + '" fill="url(#' + id + ')" stroke="#FFE08A" stroke-width="4.5" stroke-linejoin="round"/>' +
      '<path d="' + STAR_IN + '" fill="#FFFBEA" opacity=".55"/></svg>';
  }

  var LT_BODY = 'M26 49 H74 L80 84 L70 117 H30 L20 84 Z';
  function lanternSVG(tint) {
    var id = uid('l');
    return '<svg viewBox="0 0 100 170"' + SVG0 + '><defs>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(tint, 0.55) +
      '"/><stop offset=".55" stop-color="' + tint + '"/><stop offset="1" stop-color="' + shade(tint, -0.22) + '"/></linearGradient>' +
      rg(id + 'h', '.5', '.5', '.5', [[0, '#FFF7D6'], [0.5, 'rgba(255,224,138,.5)'], [1, 'rgba(255,224,138,0)']]) + '</defs>' +
      '<circle class="lt-ring" cx="50" cy="9" r="5.5" fill="none" stroke-width="3"/>' +
      '<rect class="lt-metal" x="47" y="13" width="6" height="6" rx="2"/>' +
      '<path class="lt-metal" d="M27 41 Q29 22 50 17 Q71 22 73 41 Z"/>' +
      '<rect class="lt-metal" x="22" y="39" width="56" height="10" rx="3"/>' +
      '<path class="lt-glass" d="' + LT_BODY + '"/>' +
      '<path class="lt-glass-lit" fill="url(#' + id + 'g)" d="' + LT_BODY + '"/>' +
      '<ellipse class="lt-halo" cx="50" cy="90" rx="27" ry="27" fill="url(#' + id + 'h)"/>' +
      '<g class="lt-fire"><g>' +
      '<path class="lt-flame" fill="#FF9A1F" d="M50 74 C57 85 60 93 50 104 C40 93 43 85 50 74 Z"/>' +
      '<path class="lt-core" fill="#FFEBB0" d="M50 86 C54 92 54 97 50 102 C46 97 46 92 50 86 Z"/>' +
      '</g></g>' +
      '<path class="lt-frame" fill="none" stroke-width="2.6" stroke-linejoin="round" d="' + LT_BODY +
      ' M20 84 H80 M39 49 L36 84 L41 117 M61 49 L64 84 L59 117"/>' +
      '<rect class="lt-metal" x="27" y="116" width="46" height="9" rx="3"/>' +
      '<path class="lt-metal" d="M31 125 H69 Q58 137 50 158 Q42 137 31 125 Z"/>' +
      '<circle class="lt-metal" cx="50" cy="160" r="3.5"/></svg>';
  }

  var FRUITS = ['date', 'grapes', 'pomegranate', 'fig', 'olives'];
  var FRUIT_FI = { date: 'Taateli', grapes: 'Viinirypäleet', pomegranate: 'Granaattiomena', fig: 'Viikuna', olives: 'Oliivit' };
  function fruitSVG(kind) {
    var id = uid('f'), s = '<svg viewBox="0 0 100 100"' + SVG0 + '><defs>';
    if (kind === 'date') {
      s += rg(id, '.38', '.3', '.75', [[0, '#C98042'], [0.55, '#8A4520'], [1, '#4E2410']]) + '</defs>' +
        '<path d="M42 23 Q41 13 48 7" stroke="#7A5A2A" stroke-width="5" stroke-linecap="round" fill="none"/>' +
        '<ellipse cx="50" cy="57" rx="25" ry="37" transform="rotate(-14 50 57)" fill="url(#' + id + ')"/>' +
        '<ellipse cx="39" cy="44" rx="6" ry="14" transform="rotate(-14 39 44)" fill="#fff" opacity=".42"/>' +
        '<path d="M40 74 Q48 82 60 77" stroke="#2E1206" stroke-width="2.2" fill="none" opacity=".35" stroke-linecap="round"/>';
    } else if (kind === 'grapes') {
      s += rg(id, '.35', '.3', '.72', [[0, '#C793F2'], [0.5, '#8E4FD0'], [1, '#4A1F8A']]) + '</defs>' +
        '<path d="M50 26 Q51 14 58 8" stroke="#6B8F2A" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        '<path d="M55 21 C61 6 81 8 86 18 C77 18 71 27 55 21 Z" fill="#3FAE5A"/>' +
        '<path d="M57 20 Q70 15 82 17" stroke="#2A7A3E" stroke-width="1.6" fill="none"/>';
      var rows = [[34, [26, 42, 58, 74]], [50, [34, 50, 66]], [66, [42, 58]], [82, [50]]];
      for (var r = 0; r < rows.length; r++) {
        for (var q = 0; q < rows[r][1].length; q++) {
          var gx = rows[r][1][q], gy = rows[r][0];
          s += '<circle cx="' + gx + '" cy="' + gy + '" r="10.5" fill="url(#' + id + ')"/>' +
            '<circle cx="' + (gx - 3.5) + '" cy="' + (gy - 4) + '" r="2.7" fill="#fff" opacity=".55"/>';
        }
      }
    } else if (kind === 'pomegranate') {
      s += rg(id, '.35', '.32', '.75', [[0, '#FF8F7E'], [0.5, '#E23A44'], [1, '#8A1224']]) + '</defs>' +
        '<path d="M38 31 L39 15 L45 22 L50 11 L55 22 L61 15 L62 31 Z" fill="#B71F33" stroke="#7E1020" stroke-width="2" stroke-linejoin="round"/>' +
        '<circle cx="50" cy="61" r="34" fill="url(#' + id + ')"/>' +
        '<ellipse cx="37" cy="47" rx="8" ry="13" transform="rotate(35 37 47)" fill="#fff" opacity=".38"/>';
    } else if (kind === 'fig') {
      s += rg(id, '.38', '.42', '.75', [[0, '#B56CA0'], [0.55, '#7A3A68'], [1, '#41163A']]) + '</defs>' +
        '<path d="M50 18 Q49 9 55 5" stroke="#6B8F2A" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
        '<path d="M50 16 C57 16 58 27 63 35 C79 50 82 70 72 83 C63 94 37 94 28 83 C18 70 21 50 37 35 C42 27 43 16 50 16 Z" fill="url(#' + id + ')"/>' +
        '<ellipse cx="38" cy="59" rx="6" ry="14" transform="rotate(14 38 59)" fill="#fff" opacity=".33"/>' +
        '<path d="M44 81 Q50 85 56 81" stroke="#250A20" stroke-width="2.2" opacity=".4" fill="none" stroke-linecap="round"/>';
    } else {
      s += rg(id, '.35', '.3', '.75', [[0, '#CFE87A'], [0.55, '#7FA62E'], [1, '#43641A']]) + '</defs>' +
        '<path d="M12 23 Q48 31 88 18" stroke="#6E5A2E" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        '<path d="M30 26 C22 9 9 6 3 10 C11 16 17 26 30 26 Z" fill="#6F9A80"/>' +
        '<path d="M71 21 C79 5 92 4 98 8 C91 14 85 22 71 21 Z" fill="#83A894"/>' +
        '<path d="M52 27 C57 11 65 6 70 5 C68 14 62 24 52 27 Z" fill="#6A9479"/>' +
        '<path d="M35 27 L35 38 M65 25 L67 36" stroke="#6E5A2E" stroke-width="3" stroke-linecap="round"/>' +
        '<ellipse cx="34" cy="61" rx="17" ry="23" transform="rotate(12 34 61)" fill="url(#' + id + ')"/>' +
        '<ellipse cx="67" cy="59" rx="17" ry="23" transform="rotate(-10 67 59)" fill="url(#' + id + ')"/>' +
        '<ellipse cx="28" cy="52" rx="4.5" ry="8.5" transform="rotate(12 28 52)" fill="#fff" opacity=".45"/>' +
        '<ellipse cx="61" cy="50" rx="4.5" ry="8.5" transform="rotate(-10 61 50)" fill="#fff" opacity=".45"/>';
    }
    return s + '</svg>';
  }

  function basketBackSVG() {
    return '<svg viewBox="0 0 200 140"' + SVG0 + '>' +
      '<ellipse cx="100" cy="137" rx="76" ry="5" fill="#0A0820" opacity=".35"/>' +
      '<path d="M40 66 C40 2 160 2 160 66" fill="none" stroke="#8E561E" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M40 66 C40 2 160 2 160 66" fill="none" stroke="#DDA75E" stroke-width="5" stroke-linecap="round" stroke-dasharray="9 6"/>' +
      '<ellipse cx="100" cy="64" rx="84" ry="10" fill="#3E220C"/></svg>';
  }
  function basketFrontSVG() {
    var id = uid('k'), v = '', braid = '';
    for (var i = 1; i < 10; i++) {
      var t = i / 10;
      v += 'M' + (16 + 168 * t).toFixed(1) + ' 70 L' + (37 + 126 * t).toFixed(1) + ' 136 ';
    }
    for (var x = 16; x < 186; x += 12) braid += 'M' + x + ' 68 l7 -8 ';
    return '<svg viewBox="0 0 200 140"' + SVG0 + '><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#E6B068"/><stop offset="1" stop-color="#9E6128"/></linearGradient></defs>' +
      '<path d="M16 64 H184 L163 130 Q160 138 151 138 H49 Q40 138 37 130 Z" fill="url(#' + id + ')"/>' +
      '<path d="' + v + '" stroke="#7E4A1A" stroke-width="3" opacity=".45"/>' +
      '<path d="M22 86 H178 M28 105 H172 M33 123 H167" stroke="#7E4A1A" stroke-width="3.2" opacity=".55"/>' +
      '<rect x="8" y="56" width="184" height="16" rx="8" fill="#EDBE78" stroke="#8E561E" stroke-width="3"/>' +
      '<path d="' + braid + '" stroke="#B07432" stroke-width="3" stroke-linecap="round"/></svg>';
  }

  function skylineSVG() {
    return '<svg class="mg-skyline" viewBox="0 0 400 90" preserveAspectRatio="xMidYMax meet"' + SVG0 + '>' +
      '<path fill="#0A0C26" d="M0 90 V70 Q50 62 104 68 T214 66 T320 64 T400 70 V90 Z' +
      ' M150 90 V58 H232 V90 Z M160 58 Q160 32 191 27 Q222 32 222 58 Z M189 27 V16 H193 V27 Z' +
      ' M134 90 V34 H146 V90 Z M132 34 L140 19 L148 34 Z M238 90 V40 H248 V90 Z M236 40 L243 27 L250 40 Z' +
      ' M40 90 V64 H74 V90 Z M48 64 Q57 52 66 64 Z M300 90 V60 H340 V90 Z M309 60 Q320 46 331 60 Z"/>' +
      '<path fill="#FFC93C" opacity=".55" d="M185 75 h6 v15 h-6 Z M53 74 h5 v8 h-5 Z M318 72 h5 v8 h-5 Z"/></svg>';
  }

  /* ================================================================== */
  /* MiniGames                                                          */
  /* ================================================================== */
  var TITLES = ['Puhkaise ilmapallot!', 'Napauta tähtiä!', 'Poksauta kuplat!', 'Sytytä lyhdyt!', 'Kerää hedelmät koriin!', 'Napauta taivasta!'];
  var GOALS = [8, 8, 10, 6, 6, 6];
  var TIME_LIMIT = 25000, END_WAIT = 900;
  var root = null, titleEl = null, goalEl = null, arena = null, current = null;

  function ensureOverlay() {
    if (!document.body) return false;
    if (!root) {
      root = document.createElement('section');
      root.className = 'mg';
      root.hidden = true;
      root.setAttribute('aria-live', 'polite');
      var head = document.createElement('header');
      head.className = 'mg-head';
      titleEl = document.createElement('h2');
      titleEl.className = 'mg-title';
      goalEl = document.createElement('div');
      goalEl.className = 'mg-goal';
      goalEl.setAttribute('role', 'img');
      head.appendChild(titleEl);
      head.appendChild(goalEl);
      arena = document.createElement('div');
      arena.className = 'mg-arena';
      arena.setAttribute('aria-live', 'off');
      root.appendChild(head);
      root.appendChild(arena);
      root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    if (!root.isConnected) document.body.appendChild(root);
    return true;
  }

  function makeItem(cls, html, label, w, h) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'mg-item ' + cls;
    el.setAttribute('aria-label', label);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.innerHTML = html;
    return el;
  }
  function detach(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  /* nearest live item within `slack` px of the tap (forgiving taps) */
  function nearest(list, p, slack) {
    var best = null, bd = slack;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.gone || it.cx == null) continue;
      var dx = it.cx - p.x, dy = it.cy - p.y, d = Math.sqrt(dx * dx + dy * dy) - it.r;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /* random spot inside the box that keeps away from live items */
  function freeSpot(list, w, h, x0, x1, y0, y1) {
    var best = { x: x0, y: y0 }, bestD = -Infinity;
    x1 = Math.max(x0, x1); y1 = Math.max(y0, y1);
    for (var k = 0; k < 40; k++) {
      var x = rand(x0, x1), y = rand(y0, y1), cx = x + w / 2, cy = y + h / 2, md = Infinity;
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (it.gone) continue;
        var dx = it.x + it.w / 2 - cx, dy = it.y + it.h / 2 - cy;
        md = Math.min(md, Math.sqrt(dx * dx + dy * dy) - (it.w + w) / 2);
      }
      if (md > bestD) { bestD = md; best = { x: x, y: y }; }
      if (md > 10) break;
    }
    return best;
  }

  function createSession(index, onDone) {
    var S = { index: index, goal: GOALS[index], score: 0, done: false, dead: false,
      W: 0, H: 0, t: 0, rm: reducedMotion(), update: null, resize: null, tap: null, near: null, destroy: null };
    var timers = [], offs = [], stars = [], raf = 0, last = 0, ro = null, limitT = 0, endT = 0;

    S.later = function (fn, ms) {
      var id = setTimeout(function () {
        var k = timers.indexOf(id);
        if (k >= 0) timers.splice(k, 1);
        if (!S.dead) fn();
      }, ms);
      timers.push(id);
      return id;
    };
    S.on = function (el, type, fn, opt) {
      el.addEventListener(type, fn, opt);
      offs.push(function () { el.removeEventListener(type, fn, opt); });
    };
    S.active = function () { return !S.done && !S.dead; };
    S.add = function (el) { arena.appendChild(el); return el; };
    S.vp = function (x, y) { var r = arena.getBoundingClientRect(); return { x: r.left + x, y: r.top + y }; };
    S.local = function (cx, cy) { var r = arena.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; };
    S.point = function () {
      if (!S.active()) return;
      S.score += 1;
      var st = stars[S.score - 1];
      if (st) st.classList.add('on');
      goalEl.setAttribute('aria-label', 'Pisteet ' + S.score + ' / ' + S.goal);
      if (S.score >= S.goal) finish();
    };

    function measure() {
      var w = arena.clientWidth, h = arena.clientHeight;
      if (!w || !h) { w = window.innerWidth || 390; h = Math.max(240, (window.innerHeight || 700) - 130); }
      var changed = w !== S.W || h !== S.H;
      S.W = w; S.H = h;
      return changed;
    }
    function onResize() {
      if (S.dead) return;
      var ow = S.W, oh = S.H;
      if (measure() && S.resize) S.resize(ow, oh);
    }
    function loop(ts) {
      raf = 0;
      if (S.dead) return;
      var dt = Math.min(50, Math.max(0, ts - last)) / 1000;
      last = ts;
      S.t += dt;
      if (S.update) S.update(dt, S.t);
      raf = requestAnimationFrame(loop);
    }
    function itemOf(target) {
      var el = target && target.closest ? target.closest('.mg-item') : null;
      return (el && el.__mg && !el.__mg.gone) ? el.__mg : null;
    }
    function onDown(e) {
      if (!S.active()) return;
      if (e.cancelable) e.preventDefault();
      if (e.button > 0) return;
      var p = S.local(e.clientX, e.clientY), it = itemOf(e.target);
      if (it) { it.hit(p); return; }
      if (S.tap) { S.tap(p); return; }
      if (S.near) { it = S.near(p); if (it) it.hit(p); }
    }
    function onClick(e) { /* keyboard activation (Enter / Space) */
      if (!S.active() || e.detail !== 0) return;
      var it = itemOf(e.target);
      if (!it) return;
      var r = e.target.closest('.mg-item').getBoundingClientRect();
      it.hit(S.local(r.left + r.width / 2, r.top + r.height / 2));
    }

    function finish() {
      if (!S.active()) return;
      S.done = true;
      arena.classList.add('is-done');
      if (limitT) { clearTimeout(limitT); limitT = 0; }
      SFX.success();
      FX.confetti(70);
      endT = setTimeout(function () {
        endT = 0;
        if (S.dead) return;
        cleanup();
        if (typeof onDone === 'function') onDone();
      }, END_WAIT);
    }
    function cleanup() {
      S.dead = true;
      if (current === S) current = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (limitT) { clearTimeout(limitT); limitT = 0; }
      if (endT) { clearTimeout(endT); endT = 0; }
      while (timers.length) clearTimeout(timers.pop());
      while (offs.length) { try { offs.pop()(); } catch (e) { /* ignore */ } }
      if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
      if (S.destroy) { try { S.destroy(); } catch (e) { /* ignore */ } }
      S.update = S.resize = S.tap = S.near = S.destroy = null;
      arena.textContent = '';
      arena.classList.remove('is-done');
      goalEl.textContent = '';
      goalEl.removeAttribute('aria-label');
      titleEl.textContent = '';
      root.classList.remove('mg--g' + index);
      root.hidden = true;
    }
    S.abort = function () { if (!S.dead) cleanup(); };

    S.start = function (game) {
      titleEl.textContent = TITLES[index];
      goalEl.textContent = '';
      for (var i = 0; i < S.goal; i++) {
        var s = document.createElement('span');
        s.className = 'mg-gstar';
        s.innerHTML = GOAL_STAR;
        goalEl.appendChild(s);
        stars.push(s);
      }
      goalEl.setAttribute('aria-label', 'Pisteet 0 / ' + S.goal);
      arena.textContent = '';
      arena.classList.remove('is-done');
      root.classList.add('mg--g' + index);
      root.hidden = false;
      measure();
      S.on(arena, 'pointerdown', onDown, { passive: false });
      S.on(arena, 'click', onClick);
      S.on(window, 'resize', onResize);
      if (window.ResizeObserver) {
        try { ro = new ResizeObserver(onResize); ro.observe(arena); } catch (e) { ro = null; }
      }
      try { game(S); } catch (err) {
        if (window.console) console.warn('MiniGames: game ' + index + ' failed to start', err);
        S.later(finish, 1200);
      }
      limitT = setTimeout(finish, TIME_LIMIT);
      last = now();
      raf = requestAnimationFrame(loop);
    };
    return S;
  }

  /* ---------- shared engine for rising balloons / falling stars ---------- */
  function floaters(S, o) {
    var list = [], spawnIn = o.every[0], lastLane = -1, n = 0;
    function alive() { var c = 0; for (var i = 0; i < list.length; i++) if (!list[i].gone) c++; return c; }
    function drop(it) {
      var k = list.indexOf(it);
      if (k >= 0) list.splice(k, 1);
      detach(it.el);
    }
    function place(it) {
      var x = it.x, r = it.rot;
      if (it.amp) { var a = S.t * it.f + it.ph; x += Math.sin(a) * it.amp; r = Math.cos(a) * 4.5; }
      it.cx = x + it.w / 2; it.cy = it.y + it.h * o.cyFrac; it.r = it.w * 0.5;
      it.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + it.y.toFixed(1) + 'px,0) rotate(' + r.toFixed(1) + 'deg)';
    }
    function hit(it) {
      if (it.gone || !S.active()) return;
      it.gone = true;
      var v = S.vp(it.cx, it.cy);
      o.onHit(it, v);
      it.el.classList.add('is-gone');
      S.later(function () { drop(it); }, 240);
      S.point();
    }
    function spawn(fy) {
      var w = o.size(), h = Math.round(w * o.aspect);
      var lanes = Math.max(2, Math.floor((S.W - 8) / (w * 0.95)));
      var lane = (Math.random() * lanes) | 0;
      if (lane === lastLane) lane = (lane + 1 + ((Math.random() * (lanes - 1)) | 0)) % lanes;
      lastLane = lane;
      var span = Math.max(0, S.W - w - 16);
      var x = clamp(8 + (lane / (lanes - 1)) * span + rand(-6, 6), 4, Math.max(4, S.W - w - 4));
      var y = (fy != null) ? fy * S.H : (o.dir < 0 ? S.H + rand(2, 24) : -h - rand(2, 24));
      var art = o.art(n++);
      var it = { x: x, y: y, w: w, h: h, c: art.color, gone: false,
        v: (S.H + h) / rand(o.cross[0], o.cross[1]) * (S.rm ? 0.85 : 1),
        amp: (o.sway && !S.rm) ? rand(8, 15) : 0, f: rand(1.0, 1.6), ph: rand(0, TAU),
        rot: o.spin ? rand(-30, 30) : 0, vr: (o.spin && !S.rm) ? rand(22, 45) * (Math.random() < 0.5 ? -1 : 1) : 0 };
      it.el = makeItem(o.cls, art.html, o.label, w, h);
      it.el.__mg = it;
      it.hit = function () { hit(it); };
      S.add(it.el);
      list.push(it);
      place(it);
    }
    S.update = function (dt) {
      for (var i = list.length - 1; i >= 0; i--) {
        var it = list[i];
        if (it.gone) continue;
        it.y += o.dir * it.v * dt;
        it.rot += it.vr * dt;
        if ((o.dir < 0 && it.y + it.h < -2) || (o.dir > 0 && it.y > S.H + 2)) { it.gone = true; drop(it); continue; }
        place(it);
      }
      if (S.active()) {
        spawnIn -= dt;
        if (spawnIn <= 0 && alive() < o.max) { spawn(null); spawnIn = rand(o.every[0], o.every[1]); }
      }
    };
    S.near = function (p) { return nearest(list, p, 24); };
    S.resize = function () {
      for (var i = 0; i < list.length; i++) list[i].x = clamp(list[i].x, 4, Math.max(4, S.W - list[i].w - 4));
    };
    for (var i = 0; i < o.initial.length; i++) spawn(o.initial[i]);
  }

  var BALLOON_COLORS = ['#FF5D73', '#FFB020', '#22B07D', '#2FA8E0', '#8E5BEA', '#FF7AC6', '#FFE14D'];

  /* 0 - Puhkaise ilmapallot! */
  function gameBalloons(S) {
    var c0 = (Math.random() * BALLOON_COLORS.length) | 0;
    floaters(S, {
      dir: -1, max: 6, aspect: 1.7, cyFrac: 0.318, cls: 'mg-balloon', label: 'Ilmapallo',
      size: function () { return Math.round(clamp((window.innerWidth || S.W) * 0.2, 64, 104)); },
      art: function (n) { var c = BALLOON_COLORS[(c0 + n) % BALLOON_COLORS.length]; return { html: balloonSVG(c), color: c }; },
      initial: [0.08, 0.34, 0.6, 0.86], cross: [6.5, 8.5], every: [0.7, 1.05], sway: true, spin: false,
      onHit: function (it, v) {
        FX.burst(v.x, v.y, [it.c, '#FFFFFF', shade(it.c, 0.45)], 22);
        SFX.pop();
      }
    });
  }

  /* 1 - Napauta tähtiä! */
  function gameStars(S) {
    floaters(S, {
      dir: 1, max: 5, aspect: 1, cyFrac: 0.53, cls: 'mg-star', label: 'Tähti',
      size: function () { return Math.round(clamp(S.W * 0.22, 74, 116)); },
      art: function () { return { html: starSVG(), color: '#FFC93C' }; },
      initial: [0.02, 0.24, 0.46], cross: [7, 9], every: [0.85, 1.25], sway: false, spin: true,
      onHit: function (it, v) {
        FX.sparkle(v.x, v.y);
        SFX.ding(S.score);
      }
    });
  }

  /* 2 - Poksauta kuplat! */
  function gameBubbles(S) {
    var list = [];
    var BUBBLE_FX = ['#E8FBFF', '#9BE7FF', '#FFFFFF', '#FFC6EC'];
    function scale() { return clamp(Math.min(S.W, S.H) / 390, 1, 1.4); }
    function drop(b) { var k = list.indexOf(b); if (k >= 0) list.splice(k, 1); detach(b.el); }
    function spawn() {
      if (!S.active()) return;
      var s = Math.round(rand(64, 110) * scale());
      s = Math.min(s, Math.max(64, Math.min(S.W, S.H) - 8));
      var p = freeSpot(list, s, s, 0, S.W - s, 0, S.H - s);
      var a = rand(0, TAU), sp = rand(22, 46) * (S.rm ? 0.5 : 1);
      var b = { x: p.x, y: p.y, w: s, h: s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ph: rand(0, TAU), wf: rand(2, 3.2), gone: false };
      b.el = makeItem('mg-bubble mg-in', '<span class="mg-skin"></span>', 'Kupla', s, s);
      b.el.__mg = b;
      b.hit = function () { pop(b); };
      S.add(b.el);
      list.push(b);
      place(b);
    }
    function place(b) {
      var sx = 1, sy = 1;
      if (!S.rm) { var q = Math.sin(S.t * b.wf + b.ph) * 0.035; sx = 1 + q; sy = 1 - q; }
      b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2; b.r = b.w / 2;
      b.el.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px,0) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    }
    function pop(b) {
      if (b.gone || !S.active()) return;
      b.gone = true;
      var v = S.vp(b.cx, b.cy);
      FX.burst(v.x, v.y, BUBBLE_FX, 18);
      SFX.pop();
      b.el.classList.remove('mg-in');
      b.el.classList.add('is-gone');
      S.later(function () { drop(b); }, 240);
      S.later(spawn, 380);
      S.point();
    }
    S.update = function (dt) {
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (b.gone) continue;
        b.x += b.vx * dt; b.y += b.vy * dt;
        var mx = Math.max(0, S.W - b.w), my = Math.max(0, S.H - b.h);
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } else if (b.x > mx) { b.x = mx; b.vx = -Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } else if (b.y > my) { b.y = my; b.vy = -Math.abs(b.vy); }
        place(b);
      }
    };
    S.near = function (p) { return nearest(list, p, 20); };
    S.resize = function () {
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        b.x = clamp(b.x, 0, Math.max(0, S.W - b.w));
        b.y = clamp(b.y, 0, Math.max(0, S.H - b.h));
      }
    };
    for (var i = 0; i < 7; i++) spawn();
  }

  /* 3 - Sytytä lyhdyt! */
  var LANTERN_TINTS = ['#FFC93C', '#FF7A9A', '#5EE0B0', '#6CC8FF', '#FF9F2E', '#B58CFF'];
  var STRING_F = [0.04, 0.6, 0.22, 0.95, 0.12, 0.78]; /* by column, left to right */
  function gameLanterns(S) {
    var list = [], order = shuffle([0, 1, 2, 3, 4, 5]), lw = 80, lh = 136;
    for (var i = 0; i < 6; i++) {
      var tint = LANTERN_TINTS[order[i]];
      var wrap = document.createElement('div');
      wrap.className = 'mg-lantern';
      var str = document.createElement('span');
      str.className = 'mg-string';
      var lamp = makeItem('mg-lamp', lanternSVG(tint), 'Lyhty', 80, 136);
      lamp.style.setProperty('--lg', tint);
      lamp.style.setProperty('--fd', (-Math.random() * 0.5).toFixed(2) + 's');
      wrap.appendChild(str);
      wrap.appendChild(lamp);
      var it = { wrap: wrap, str: str, el: lamp, tint: tint, gone: false, col: i, L: 0, x: 0, y: 0, w: 0, h: 0,
        ph: rand(0, TAU), f: 1, amp: 0, ang: 0 };
      lamp.__mg = it;
      it.hit = (function (o) { return function () { light(o); }; })(it);
      S.add(wrap);
      list.push(it);
    }
    function layout() {
      lw = Math.round(clamp(Math.min(S.W * 0.24, (S.H - 24) / 3.75), 64, 120));
      lh = Math.round(lw * 1.7);
      var spare = clamp(S.H - 2 * lh - 16, 0, lh * 2.2);
      var span = Math.max(0, S.W - lw - 12), step = span / 5;
      for (var i = 0; i < list.length; i++) {
        var it = list[i], row = i % 2;
        it.L = Math.round(6 + (row ? lh : 0) + spare * STRING_F[i]);
        it.x = 6 + step * i;
        it.w = lw; it.h = lh;
        var d = it.L + lh * 0.55;
        it.amp = S.rm ? 0 : Math.atan(11 / d) * 180 / Math.PI;
        it.f = clamp(Math.sqrt(220 / d), 0.6, 1.6) * 1.15;
        it.wrap.style.width = lw + 'px';
        it.wrap.style.height = (it.L + lh) + 'px';
        it.str.style.height = (it.L + 6) + 'px';
        it.el.style.width = lw + 'px';
        it.el.style.height = lh + 'px';
        it.el.style.top = it.L + 'px';
        place(it);
      }
    }
    function place(it) {
      it.ang = it.amp ? Math.sin(S.t * it.f + it.ph) * it.amp : 0;
      var a = it.ang * Math.PI / 180, d = it.L + lh * 0.55;
      it.cx = it.x + lw / 2 - d * Math.sin(a);
      it.cy = d * Math.cos(a);
      it.r = lw * 0.4;
      it.wrap.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,0,0) rotate(' + it.ang.toFixed(2) + 'deg)';
    }
    function light(it) {
      if (it.gone || !S.active()) return;
      it.gone = true;
      it.el.classList.add('lit');
      it.el.setAttribute('aria-label', 'Lyhty palaa');
      SFX.chime(S.score);
      var v = S.vp(it.cx, it.cy);
      FX.sparkle(v.x, v.y);
      S.point();
    }
    S.update = function () {
      if (S.rm) return;
      for (var i = 0; i < list.length; i++) place(list[i]);
    };
    S.near = function (p) { return nearest(list, p, 24); };
    S.resize = layout;
    layout();
  }

  /* 4 - Kerää hedelmät koriin! */
  var PILE_POS = [[10, 24], [62, 24], [36, 20], [22, 11], [50, 11], [36, 3]];
  function gameFruits(S) {
    var list = [], flying = [], kinds = shuffle(FRUITS.slice()), kn = 0, inBasket = 0, lastSpot = null;
    var bk = { el: document.createElement('div'), x: 0, y: 0, w: 0, h: 0, bt: -1 };
    bk.el.className = 'mg-basket';
    bk.el.innerHTML = basketBackSVG() + '<div class="mg-pile"></div>' + basketFrontSVG();
    var pile = bk.el.querySelector('.mg-pile');
    S.add(bk.el);

    function fsize() { return Math.round(clamp(Math.min(S.W, S.H) * 0.22, 72, 116)); }
    function placeBasket() {
      var sx = 1, sy = 1;
      if (bk.bt >= 0) {
        var k = bk.bt, a = Math.sin(k * 22) * Math.exp(-k * 7) * (S.rm ? 0.5 : 1);
        sx = 1 + 0.07 * a; sy = 1 - 0.12 * a;
      }
      bk.el.style.transform = 'translate3d(' + bk.x.toFixed(1) + 'px,' + bk.y.toFixed(1) + 'px,0) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    }
    function layoutBasket() {
      bk.w = Math.round(Math.min(S.W * 0.46, 220, (S.H * 0.45) / 0.7));
      bk.h = Math.round(bk.w * 0.7);
      bk.x = (S.W - bk.w) / 2;
      bk.y = S.H - bk.h - 8;
      bk.el.style.width = bk.w + 'px';
      bk.el.style.height = bk.h + 'px';
      placeBasket();
    }
    function region(s) {
      var y1 = Math.min(S.H * 0.6, bk.y - 6) - s;
      return { x0: 8, x1: S.W - s - 8, y0: 8, y1: Math.max(8, y1) };
    }
    function put(f) {
      f.cx = f.x + f.w / 2; f.cy = f.y + f.h / 2; f.r = f.w * 0.45;
      f.el.style.transform = 'translate3d(' + f.x.toFixed(1) + 'px,' + f.y.toFixed(1) + 'px,0)';
    }
    function spawn() {
      if (!S.active()) return;
      var s = fsize(), R = region(s), kind = kinds[kn++ % kinds.length];
      if (kn % kinds.length === 0) shuffle(kinds);
      var p = freeSpot(lastSpot ? list.concat([lastSpot]) : list, s, s, R.x0, R.x1, R.y0, R.y1);
      var f = { kind: kind, x: p.x, y: p.y, w: s, h: s, gone: false };
      f.el = makeItem('mg-fruit mg-in', fruitSVG(kind), FRUIT_FI[kind], s, s);
      f.el.__mg = f;
      f.hit = function () { pick(f); };
      S.add(f.el);
      list.push(f);
      put(f);
    }
    function pick(f) {
      if (f.gone || !S.active()) return;
      f.gone = true;
      lastSpot = { x: f.x, y: f.y, w: f.w, h: f.h, gone: false };
      var k = list.indexOf(f);
      if (k >= 0) list.splice(k, 1);
      f.el.classList.remove('mg-in');
      f.el.setAttribute('tabindex', '-1');
      SFX.tap();
      f.fx0 = f.x; f.fy0 = f.y; f.ft = 0; f.dur = 0.55;
      f.spin = rand(-160, 160);
      f.arc = clamp(S.H * 0.16, 50, 140);
      flying.push(f);
      S.later(spawn, 300 + 550);
    }
    function land(f) {
      detach(f.el);
      var pos = PILE_POS[inBasket % PILE_POS.length];
      inBasket += 1;
      var i = document.createElement('i');
      i.style.left = pos[0] + '%';
      i.style.top = pos[1] + '%';
      i.innerHTML = fruitSVG(f.kind);
      pile.appendChild(i);
      bk.bt = 0;
      SFX.plop();
      S.point();
    }
    S.update = function (dt) {
      for (var j = flying.length - 1; j >= 0; j--) {
        var f = flying[j];
        f.ft += dt;
        var q = Math.min(1, f.ft / f.dur), e = q * (2 - q);
        var tx = bk.x + bk.w / 2 - f.w / 2, ty = bk.y + bk.h * 0.32 - f.h / 2;
        var x = f.fx0 + (tx - f.fx0) * e;
        var y = f.fy0 + (ty - f.fy0) * e - f.arc * 4 * q * (1 - q);
        var sc = 1 - 0.55 * q;
        f.cx = x + f.w / 2; f.cy = y + f.h / 2;
        f.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + (f.spin * q).toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
        if (q >= 1) { flying.splice(j, 1); land(f); }
      }
      if (bk.bt >= 0) {
        bk.bt += dt;
        if (bk.bt > 0.6) bk.bt = -1;
        placeBasket();
      }
    };
    S.near = function (p) { return nearest(list, p, 22); };
    S.resize = function () {
      layoutBasket();
      for (var i = 0; i < list.length; i++) {
        var f = list[i], R = region(f.w);
        f.x = clamp(f.x, R.x0, Math.max(R.x0, R.x1));
        f.y = clamp(f.y, R.y0, Math.max(R.y0, R.y1));
        put(f);
      }
    };
    layoutBasket();
    for (var n = 0; n < 5; n++) spawn();
  }

  /* 5 - Napauta taivasta! */
  function gameSky(S) {
    var inFlight = 0, idle = 0;
    S.add((function () {
      var d = document.createElement('div');
      d.innerHTML = skylineSVG();
      return d.firstChild;
    })());
    function launch(p, real) {
      if (inFlight >= 3) return false;
      inFlight += 1;
      var to = S.vp(p.x, p.y), from = S.vp(p.x, S.H + 12);
      var hue = rand(0, 360), counted = true;
      function settle() { if (counted) { counted = false; inFlight = Math.max(0, inFlight - 1); } }
      S.later(settle, 1500); /* in case FX.clear() dropped the rocket */
      SFX.whoosh();
      FX.rocket(from.x, from.y, to.x, to.y, function () {
        settle();
        if (S.dead) return;
        FX.firework(to.x, to.y, hue);
        SFX.boom();
        if (real) S.point();
      });
      return true;
    }
    S.tap = function (p) {
      idle = 0;
      var y = clamp(p.y, 16, S.H - 90);
      var x = clamp(p.x, 12, S.W - 12);
      launch({ x: x, y: y }, true);
    };
    S.update = function (dt) {
      if (!S.active()) return;
      idle += dt;
      if (idle >= 3) {
        idle = 0;
        launch({ x: rand(0.18, 0.82) * S.W, y: rand(0.12, 0.5) * S.H }, false);
      }
    };
  }

  /* ---------- public API ---------- */
  var GAMES = [gameBalloons, gameStars, gameBubbles, gameLanterns, gameFruits, gameSky];

  function play(opts) {
    opts = opts || {};
    if (current) current.abort();
    current = null;
    var onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
    if (!ensureOverlay()) {
      var t = onDone ? setTimeout(onDone, 0) : 0;
      return { abort: function () { if (t) clearTimeout(t); t = 0; } };
    }
    var idx = Math.floor(+opts.index) || 0;
    idx = ((idx % GAMES.length) + GAMES.length) % GAMES.length;
    var S = createSession(idx, onDone);
    current = S;
    S.start(GAMES[idx]);
    if (typeof opts.say === 'function') {
      try { opts.say(TITLES[idx]); } catch (e) { /* ignore */ }
    }
    return { abort: function () { S.abort(); } };
  }

  window.SFX = SFX;
  window.FX = FX;
  window.MiniGames = {
    count: GAMES.length,
    titles: TITLES.slice(),
    play: play
  };
})();
