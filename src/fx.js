/* FX – one full-screen particle canvas (viewport coordinates), soft premium look, palette per theme.
   OWNER: games-core.

   API (unchanged names from v2):
     FX.burst(x, y, colors?, n?)   soft glow flash + shaded dots + a white ring
     FX.sparkle(x, y)              4-point sparkle stars with a soft glow
     FX.confetti(n?)               falling flat confetti: stars + circles + strips (girl: + hearts)
     FX.firework(x, y, hue?)       streak firework (hue picks one of the theme's colour pairs)
     FX.rocket(x0, y0, x1, y1, onArrive?)
     FX.show(ms?)                  finale: soft fireworks at the screen sides / top corners only (no ribbons)
     FX.clear()
   v3 additions:
     FX.setTheme('girl'|'boy'|null) force a palette (the minigame core sets it while a game runs);
                                    null = follow <html data-theme> (default girl palette)
     FX.palette()                  the current theme colours (array of hex)

   Look: rounded shapes with a white highlight and a soft glow, no outlines (CONTRACTS brief 1).
   prefers-reduced-motion: particles do not fly; they appear in place and fade. */
import { TAU, clamp, rand, now, reducedMotion, hexToRgb, shade } from './util.js';
import { SFX } from './audio/sfx.js';

const THEMES = {
  girl: {
    main: ['#FF7A9A', '#B9A4FF', '#FFD36E', '#8EE3C8', '#FFB3C7', '#FFC9A8'],
    spark: ['#FFD36E', '#FFFFFF', '#FFB3C7', '#B9A4FF'],
    fire: [['#FF7A9A', '#FFD0DC'], ['#B9A4FF', '#E6DDFF'], ['#FFC94D', '#FFEDB0'], ['#5FD6B4', '#C9F5E7'], ['#FF9E7A', '#FFDCCB']],
    hearts: true
  },
  boy: {
    main: ['#5AB4FF', '#2F6BFF', '#FFD54A', '#FF9A3C', '#2EC4B6', '#FF5A5F'],
    spark: ['#FFD54A', '#FFFFFF', '#5AB4FF', '#FF9A3C'],
    fire: [['#2F6BFF', '#BFD5FF'], ['#5AB4FF', '#CFE8FF'], ['#FFC21F', '#FFEFA8'], ['#2EC4B6', '#BDF0EA'], ['#FF7A3C', '#FFD7B8']],
    hearts: false
  }
};

export const FX = (function () {
  let cv = null, g = null, W = 1, H = 1, dpr = 1;
  let raf = 0, last = 0, inFrame = false, showTimer = 0, forced = null;
  const parts = [], rings = [], rockets = [];
  const MAXP = 1200;

  /* Particle kinds */
  const DOT = 0, SPARK = 1, FLAKE = 2, STREAK = 3, EMBER = 4, BANG = 5;

  function rm() { return reducedMotion(); }
  function k(n) { return rm() ? Math.max(1, Math.round(n * 0.4)) : n; }
  function snd(name) { try { if (SFX && typeof SFX[name] === 'function') SFX[name](); } catch (e) { /* silent */ } }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function rgba(hex, a) { const c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function themeName() {
    if (forced) return forced;
    const t = (document.documentElement && document.documentElement.dataset.theme) || '';
    return t === 'boy' ? 'boy' : 'girl';
  }
  function T() { return THEMES[themeName()]; }

  function resize() {
    if (!cv) return;
    const de = document.documentElement;
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
    const c = document.createElement('canvas');
    const c2 = c.getContext ? c.getContext('2d') : null;
    if (!c2) return false;
    cv = c; g = c2;
    c.className = 'fx-layer';
    c.setAttribute('aria-hidden', 'true');
    const s = c.style;
    s.position = 'fixed'; s.left = '0'; s.top = '0';
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

  /* ---------- shapes (around the current transform origin or x,y) ---------- */
  function sparkPath(x, y, R) {
    const r = R * 0.22;
    g.beginPath();
    g.moveTo(x, y - R);
    g.quadraticCurveTo(x + r, y - r, x + R, y);
    g.quadraticCurveTo(x + r, y + r, x, y + R);
    g.quadraticCurveTo(x - r, y + r, x - R, y);
    g.quadraticCurveTo(x - r, y - r, x, y - R);
    g.closePath();
  }
  function starPath(R, n, inner) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? R * inner : R;
      if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
  }
  function heartPath(s) {
    g.beginPath();
    g.moveTo(0, s * 0.9);
    g.bezierCurveTo(-s * 1.3, 0, -s * 0.9, -s * 1.05, 0, -s * 0.45);
    g.bezierCurveTo(s * 0.9, -s * 1.05, s * 1.3, 0, 0, s * 0.9);
    g.closePath();
  }
  function drawSpark(x, y, R, c, al) {
    g.globalAlpha = al * 0.25; g.fillStyle = c;
    g.beginPath(); g.arc(x, y, R * 0.8, 0, TAU); g.fill();
    g.globalAlpha = al;
    sparkPath(x, y, R); g.fill();
    g.fillStyle = '#FFFFFF';
    sparkPath(x, y, R * 0.42); g.fill();
  }

  function frame(ts) {
    raf = 0;
    if (!g) return;
    inFrame = true;
    const dt = Math.min(50, Math.max(0, ts - last)) / 1000;
    last = ts;
    const tsec = ts / 1000;
    let i, p, r, lf, al;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);


    for (i = rockets.length - 1; i >= 0; i--) {
      r = rockets[i];
      r.t += dt;
      const q = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - q, 3);
      r.px = r.x; r.py = r.y;
      r.x = r.x0 + (r.x1 - r.x0) * e;
      r.y = r.y0 + (r.y1 - r.y0) * e;
      if (!r.still) {
        for (let j = 0; j < 3; j++) {
          const f = Math.random();
          add({ t: EMBER, x: r.px + (r.x - r.px) * f + rand(-1.5, 1.5), y: r.py + (r.y - r.py) * f,
            vx: rand(-20, 20), vy: rand(10, 50), gr: 50, dr: 0.9, life: rand(0.3, 0.55), r: rand(2, 3.4), c: pick(T().spark) });
        }
      }
      if (q >= 1) {
        rockets.splice(i, 1);
        if (r.cb) { try { r.cb(); } catch (err) { /* a game may already be gone */ } }
      }
    }

    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || (p.t === FLAKE && p.y > H + 40)) {
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      if (p.t === FLAKE) {
        p.vy += (p.term - p.vy) * Math.min(1, dt * 2.2);
        p.x += (p.vx + Math.sin(tsec * p.sf + p.ph) * p.sw) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.fl += p.vf * dt;
      } else if (p.t !== BANG) {
        const d = Math.pow(p.dr, dt * 60);
        p.vx *= d; p.vy *= d;
        p.vy += p.gr * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }

    /* soft glow flashes first (behind the dots) */
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.t !== BANG) continue;
      lf = p.life / p.max;
      const rad = p.r * (1.5 - 0.5 * lf);
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      gr.addColorStop(0, rgba('#FFFFFF', 0.85 * lf));
      gr.addColorStop(0.35, rgba(p.c, 0.45 * lf));
      gr.addColorStop(1, rgba(p.c, 0));
      g.globalAlpha = 1; g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, rad, 0, TAU); g.fill();
    }

    for (i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.life -= dt;
      if (rg.life <= 0) { rings.splice(i, 1); continue; }
      const q2 = 1 - rg.life / rg.max, ee = 1 - (1 - q2) * (1 - q2);
      g.globalAlpha = (1 - q2) * 0.9;
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = Math.max(1, rg.w * (1 - q2));
      g.beginPath(); g.arc(rg.x, rg.y, rg.r + (rg.R - rg.r) * ee, 0, TAU); g.stroke();
    }

    g.lineCap = 'round';
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      lf = p.life / p.max;
      if (p.t === DOT) {
        al = Math.min(1, lf * 1.6, p.fade ? (p.max - p.life) / 0.2 : 1);
        const rr = p.r * (0.5 + 0.5 * lf);
        g.globalAlpha = al; g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, rr, 0, TAU); g.fill();
        g.globalAlpha = al * 0.85; g.fillStyle = '#FFFFFF';
        g.beginPath(); g.arc(p.x - rr * 0.32, p.y - rr * 0.32, rr * 0.34, 0, TAU); g.fill();
      } else if (p.t === SPARK) {
        const tw = 0.7 + 0.3 * Math.sin(tsec * p.tf + p.ph);
        al = Math.min(1, lf * 2, (p.max - p.life) / 0.12);
        drawSpark(p.x, p.y, p.r * (0.55 + 0.45 * lf) * tw * 2.4, p.c, al);
      } else if (p.t === FLAKE) {
        al = Math.min(1, p.life / 0.6, (p.max - p.life) / 0.3);
        const cs = Math.cos(p.rot), sn = Math.sin(p.rot), fl = Math.cos(p.fl);
        g.globalAlpha = al;
        g.setTransform(cs * dpr, sn * dpr, -sn * fl * dpr, cs * fl * dpr, p.x * dpr, p.y * dpr);
        g.fillStyle = fl < 0 ? p.c2 : p.c;
        if (p.kind === 0) starPath(p.s * 1.3, 5, 0.48);
        else if (p.kind === 1) { g.beginPath(); g.arc(0, 0, p.s, 0, TAU); }
        else if (p.kind === 2) { g.beginPath(); g.rect(-p.s * 0.55, -p.s * 1.3, p.s * 1.1, p.s * 2.6); }
        else heartPath(p.s * 1.15);
        g.fill();
        g.fillStyle = '#FFFFFF'; g.globalAlpha = al * 0.55;
        g.beginPath(); g.arc(-p.s * 0.3, -p.s * 0.35, p.s * 0.3, 0, TAU); g.fill();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (p.t === STREAK) {
        al = lf < 0.35 ? lf / 0.35 : 1;
        if (p.fk && lf < 0.5) al *= (Math.sin(tsec * 34 + p.ph) > 0 ? 1 : 0.3);
        g.globalAlpha = al;
        g.strokeStyle = p.c; g.lineWidth = p.r;
        g.beginPath(); g.moveTo(p.x - p.vx * 0.07, p.y - p.vy * 0.07); g.lineTo(p.x, p.y); g.stroke();
      } else if (p.t === EMBER) {
        g.globalAlpha = lf * 0.95; g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r * (0.4 + 0.6 * lf), 0, TAU); g.fill();
      }
    }

    for (i = 0; i < rockets.length; i++) {
      r = rockets[i];
      if (r.still) continue;
      drawSpark(r.x, r.y, 12, T().spark[0], 1);
    }
    g.globalAlpha = 1;

    inFrame = false;
    if (parts.length || rings.length || rockets.length) raf = requestAnimationFrame(frame);
  }

  /* ---------- public effects ---------- */
  function burst(x, y, colors, n) {
    if (!ensure()) return;
    const th = T();
    colors = (colors && colors.length) ? colors : th.main;
    n = k(n > 0 ? n : 18);
    const still = rm();
    add({ t: BANG, x: x, y: y, life: 0.32, r: still ? 34 : 44, rot: rand(0, TAU), c: colors[0] });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = still ? 0 : rand(160, 400);
      const off = still ? rand(10, 44) : 0;
      add({ t: DOT, x: x + Math.cos(a) * off, y: y + Math.sin(a) * off, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (still ? 0 : 60),
        gr: still ? 0 : 560, dr: 0.92, life: rand(0.5, 0.9), r: rand(3.5, 7), c: colors[i % colors.length], fade: still });
    }
    for (let i = 0; i < Math.ceil(n / 5); i++) {
      const a = Math.random() * TAU, sp = still ? 0 : rand(80, 220);
      add({ t: SPARK, x: x + (still ? Math.cos(a) * 28 : 0), y: y + (still ? Math.sin(a) * 28 : 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gr: still ? 0 : 140, dr: 0.93, life: rand(0.5, 0.8), r: rand(2.8, 4), tf: rand(14, 24), ph: rand(0, TAU), c: pick(th.spark) });
    }
    rings.push({ x: x, y: y, r: 10, R: still ? 40 : rand(56, 74), life: 0.36, max: 0.36, w: 4 });
    kick();
  }

  function sparkle(x, y) {
    if (!ensure()) return;
    const th = T(), n = k(9), still = rm();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = still ? 0 : rand(60, 220), off = still ? rand(8, 42) : rand(0, 6);
      add({ t: SPARK, x: x + Math.cos(a) * off, y: y + Math.sin(a) * off, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (still ? 0 : 40),
        gr: still ? 0 : 160, dr: 0.92, life: rand(0.45, 0.8), r: rand(2.6, 4.2), tf: rand(12, 22), ph: rand(0, TAU), c: pick(th.spark) });
    }
    rings.push({ x: x, y: y, r: 6, R: still ? 26 : 38, life: 0.28, max: 0.28, w: 3.5 });
    kick();
  }

  function confetti(n) {
    if (!ensure()) return;
    const th = T();
    n = k(n > 0 ? n : 60);
    const still = rm();
    for (let i = 0; i < n; i++) {
      const c = pick(th.main);
      let kind = (Math.random() * 3) | 0;
      if (th.hearts && Math.random() < 0.3) kind = 3;
      const base = { t: FLAKE, kind: kind, c: c, c2: shade(c, -0.22), s: rand(4.5, 7.5), rot: rand(0, TAU), fl: rand(0, TAU), ph: rand(0, TAU) };
      if (still) {
        add(Object.assign(base, { x: rand(0, W), y: rand(0, H * 0.85), vx: 0, vy: 0, term: 0, sf: 0, sw: 0, vr: 0, vf: 0, life: rand(1.6, 2.6) }));
      } else {
        add(Object.assign(base, { x: rand(0, W), y: rand(-H * 0.35, -14), vx: rand(-16, 16), vy: rand(60, 140),
          term: Math.max(110, H * rand(0.16, 0.28)), sf: rand(1.2, 2.6), sw: rand(14, 38),
          vr: rand(-3, 3), vf: rand(4, 9), life: 8 }));
      }
    }
    kick();
  }

  function firework(x, y, hue) {
    if (!ensure()) return;
    const th = T();
    const h = (typeof hue === 'number' && isFinite(hue)) ? ((hue % 360) + 360) % 360 : rand(0, 360);
    const pair = th.fire[Math.floor(h / 72) % th.fire.length], c1 = pair[0], c2 = pair[1];
    const base = clamp(Math.min(W, H) * 0.36, 130, 260);
    if (rm()) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU, d = base * rand(0.18, 0.42);
        add({ t: SPARK, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: 0, vy: 0, gr: 0, dr: 1,
          life: rand(1, 1.5), r: rand(2.6, 3.8), tf: rand(6, 10), ph: rand(0, TAU), c: i % 3 ? c1 : c2 });
      }
      add({ t: BANG, x: x, y: y, life: 0.5, r: 40, rot: 0, c: c1 });
      kick();
      return;
    }
    const n = 32;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.06, 0.06), sp = base * (0.45 + 0.55 * Math.sqrt(Math.random())), q = Math.random();
      add({ t: STREAK, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 140, dr: 0.97,
        life: rand(0.9, 1.3), r: rand(3, 4.4), fk: Math.random() < 0.3, ph: rand(0, TAU), c: q < 0.6 ? c1 : (q < 0.85 ? shade(c1, 0.25) : c2) });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU, sp = base * rand(0.15, 0.5);
      add({ t: SPARK, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 40, dr: 0.95,
        life: rand(1.1, 1.7), r: rand(2.6, 3.8), tf: rand(10, 18), ph: rand(0, TAU), c: pick([c1, c2].concat(th.spark)) });
    }
    add({ t: BANG, x: x, y: y, life: 0.3, r: 38, rot: rand(0, TAU), c: c1 });
    kick();
  }

  function rocket(x0, y0, x1, y1, onArrive) {
    const cb = typeof onArrive === 'function' ? onArrive : null;
    if (!ensure()) { if (cb) setTimeout(cb, 600); return; }
    const still = rm();
    rockets.push({ x0: still ? x1 : x0, y0: still ? y1 : y0, x1: x1, y1: y1, x: x0, y: y0, px: x0, py: y0,
      t: 0, dur: still ? 0.2 : 0.6, cb: cb, still: still });
    kick();
  }

  function show(ms) {
    if (!ensure()) return;
    ms = ms > 0 ? ms : 5000;
    const end = now() + ms;
    let side = Math.random() < 0.5 ? 0 : 1;
    if (showTimer) clearTimeout(showTimer);
    (function launch() {
      showTimer = 0;
      if (now() >= end - 700) return;
      if (document.hidden) { showTimer = setTimeout(launch, 600); return; }
      /* fireworks only at the screen sides / top corners, never over the card in the middle */
      side = 1 - side;
      const x1 = (side ? rand(0.76, 0.94) : rand(0.06, 0.24)) * W, y1 = rand(0.05, 0.18) * H, hue = rand(0, 360);
      if (rm()) {
        firework(x1, y1, hue);
        snd('sparkle');
      } else {
        snd('whoosh');
        rocket(clamp(x1 + rand(-0.04, 0.04) * W, 0.04 * W, 0.96 * W), H + 8, x1, y1, function () { firework(x1, y1, hue); snd('boom'); });
      }
      showTimer = setTimeout(launch, rm() ? rand(850, 1150) : rand(520, 820));
    })();
    kick();
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

  function setTheme(t) { forced = (t === 'boy' || t === 'girl') ? t : null; }
  function palette() { return T().main.slice(); }

  return { burst: burst, sparkle: sparkle, confetti: confetti, firework: firework, rocket: rocket, show: show, clear: clear,
    setTheme: setTheme, palette: palette };
})();

export default FX;
