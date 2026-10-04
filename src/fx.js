/* FX - one full-screen particle canvas (viewport coordinates), frosty ice-palace palette.
   OWNER: games agent.

   API (unchanged from v1):
     FX.burst(x, y, colors?, n?)   pop of coloured dots + a few sparkles + a ring
     FX.sparkle(x, y)              twinkling 4-point sparkle stars
     FX.confetti(n?)               falling snowflakes, sequins and ice diamonds
     FX.firework(x, y, hue?)       sparkle firework (hue picks one of the frost palette pairs)
     FX.rocket(x0, y0, x1, y1, onArrive?)
     FX.show(ms?)                  finale: gentle aurora ribbons + sparkle fireworks
     FX.clear()

   Everything is drawn with normal (source-over) blending so it stays visible on the light
   theme: coloured bodies with white cores instead of additive glows (which vanish on white).
   prefers-reduced-motion: particles do not fly; they appear in place and fade (minimal movement). */
import { TAU, clamp, rand, now, reducedMotion, hexToRgb, shade } from './util.js';
import { SFX } from './audio/sfx.js';

export const FX = (function () {
  let cv = null, g = null, W = 1, H = 1, dpr = 1;
  let raf = 0, last = 0, inFrame = false, showTimer = 0;
  const parts = [], rings = [], rockets = [];
  let aurora = null; /* { t: elapsed s, dur: s, ribbons: [] } while FX.show() runs */
  const MAXP = 1400;

  /* Particle kinds */
  const DOT = 0, SPARK = 1, FLAKE = 2, STREAK = 3, EMBER = 4, FLASH = 5;

  /* Saturated enough to read on --snow / --frost; white is only ever used as a core/highlight. */
  const FROST = ['#7FD3F2', '#4A86FF', '#9A7BFF', '#B45FE0', '#FF8BC8', '#33C3D6', '#2F6FE0', '#C8B6FF'];
  const SPARK_C = ['#7FD3F2', '#9A7BFF', '#FF8BC8', '#4A86FF', '#B45FE0', '#33C3D6'];
  const EMBER_C = ['#9A7BFF', '#7FD3F2', '#FF9FD6', '#4A86FF'];
  /* firework colour pairs [main, light] picked by hue (5 bands of 72 degrees) */
  const FIRE = [['#2F6FE0', '#A9D4FF'], ['#B45FE0', '#E6CCFF'], ['#FF6FBF', '#FFC6E8'], ['#1FB0D3', '#AEEFFF'], ['#8A6BFF', '#D8CCFF']];
  const AURORA_C = ['#5FDCCF', '#9A7BFF', '#FF9FD6', '#7FD3F2'];

  function rm() { return reducedMotion(); }
  function k(n) { return rm() ? Math.max(1, Math.round(n * 0.4)) : n; }
  function snd(name) { try { if (SFX && typeof SFX[name] === 'function') SFX[name](); } catch (e) { /* silent */ } }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function rgba(hex, a) { const c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

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

  /* ---------- drawing helpers ---------- */
  /* concave 4-point sparkle star of radius R around (0,0) in the current transform */
  function sparkPath(x, y, R) {
    const r = R * 0.16;
    g.beginPath();
    g.moveTo(x, y - R);
    g.quadraticCurveTo(x + r, y - r, x + R, y);
    g.quadraticCurveTo(x + r, y + r, x, y + R);
    g.quadraticCurveTo(x - r, y + r, x - R, y);
    g.quadraticCurveTo(x - r, y - r, x, y - R);
    g.closePath();
  }
  function drawSpark(x, y, R, c, al) {
    g.globalAlpha = al * 0.22; g.fillStyle = c;
    g.beginPath(); g.arc(x, y, R * 0.9, 0, TAU); g.fill();
    g.globalAlpha = al; sparkPath(x, y, R); g.fill();
    g.fillStyle = '#FFFFFF';
    sparkPath(x, y, R * 0.45); g.fill();
  }
  /* six-armed snowflake glyph, radius s, centred on the transform origin */
  function drawSnow(s, c) {
    g.strokeStyle = c;
    g.lineWidth = Math.max(1.2, s * 0.2);
    g.beginPath();
    for (let a = 0; a < 6; a++) {
      const ca = Math.cos(a * TAU / 6), sa = Math.sin(a * TAU / 6);
      g.moveTo(0, 0); g.lineTo(ca * s, sa * s);
      /* one V branch per arm */
      const bx = ca * s * 0.55, by = sa * s * 0.55, bl = s * 0.32;
      for (let sd = -1; sd <= 1; sd += 2) {
        const ba = a * TAU / 6 + sd * 0.8;
        g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl);
      }
    }
    g.stroke();
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.arc(0, 0, s * 0.18, 0, TAU); g.fill();
  }

  function drawAurora(tsec) {
    const A = aurora, fadeIn = 0.9, fadeOut = 1.3;
    let env = Math.min(1, A.t / fadeIn, Math.max(0, (A.dur - A.t) / fadeOut));
    if (env <= 0) return;
    env = env * env * (3 - 2 * env); /* smoothstep */
    const tt = rm() ? 0 : tsec; /* reduced motion: static ribbons that only fade */
    const step = Math.max(14, W / 36);
    for (let i = 0; i < A.ribbons.length; i++) {
      const rb = A.ribbons[i], y0 = rb.y * H, amp = rb.amp * H, th = rb.th * H;
      const top = [];
      for (let x = -step; x <= W + step; x += step) {
        top.push([x, y0 + Math.sin(x * rb.f + tt * rb.sp + rb.ph) * amp + Math.sin(x * rb.f * 2.3 - tt * rb.sp * 0.6) * amp * 0.35]);
      }
      g.beginPath();
      for (let j = 0; j < top.length; j++) { if (j) g.lineTo(top[j][0], top[j][1]); else g.moveTo(top[j][0], top[j][1]); }
      for (let j = top.length - 1; j >= 0; j--) {
        const x = top[j][0];
        g.lineTo(x, top[j][1] + th * (0.55 + 0.45 * Math.sin(x * rb.f * 1.7 + tt * 0.8 + rb.ph * 2)));
      }
      g.closePath();
      const gr = g.createLinearGradient(0, y0 - amp * 1.4, 0, y0 + th + amp * 1.4);
      gr.addColorStop(0, rgba(rb.c, 0));
      gr.addColorStop(0.45, rgba(rb.c, 0.3 * env)); /* gentle: text under it stays readable */
      gr.addColorStop(1, rgba(rb.c, 0));
      g.globalAlpha = 1;
      g.fillStyle = gr;
      g.fill();
    }
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

    if (aurora) {
      aurora.t += dt;
      if (aurora.t >= aurora.dur) aurora = null; else drawAurora(tsec);
    }

    /* rockets: move (ease-out), leave embers, call onArrive */
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
            vx: rand(-20, 20), vy: rand(10, 50), gr: 50, dr: 0.9, life: rand(0.3, 0.55), r: rand(1.6, 3), c: pick(EMBER_C) });
        }
      }
      if (q >= 1) {
        rockets.splice(i, 1);
        if (r.cb) { try { r.cb(); } catch (err) { /* a game may already be gone */ } }
      }
    }

    /* update particles */
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
      } else if (p.t !== FLASH) {
        const d = Math.pow(p.dr, dt * 60);
        p.vx *= d; p.vy *= d;
        p.vy += p.gr * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }
    }

    /* flashes first (soft tinted glow behind everything else) */
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.t !== FLASH) continue;
      lf = p.life / p.max;
      const rad = p.r * (1.6 - 0.6 * lf);
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      gr.addColorStop(0, rgba(p.c, 0.5 * lf));
      gr.addColorStop(1, rgba(p.c, 0));
      g.globalAlpha = 1; g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, rad, 0, TAU); g.fill();
    }

    /* expanding rings */
    for (i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.life -= dt;
      if (rg.life <= 0) { rings.splice(i, 1); continue; }
      const q2 = 1 - rg.life / rg.max, ee = 1 - (1 - q2) * (1 - q2);
      g.globalAlpha = (1 - q2) * 0.8;
      g.strokeStyle = rg.c;
      g.lineWidth = Math.max(0.5, rg.w * (1 - q2));
      g.beginPath(); g.arc(rg.x, rg.y, rg.r + (rg.R - rg.r) * ee, 0, TAU); g.stroke();
    }

    g.lineCap = 'round';
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      lf = p.life / p.max;
      if (p.t === DOT) {
        al = Math.min(1, lf * 1.6, p.fade ? (p.max - p.life) / 0.2 : 1);
        const rr = p.r * (0.45 + 0.55 * lf);
        g.globalAlpha = al; g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, rr, 0, TAU); g.fill();
        g.globalAlpha = al * 0.8; g.fillStyle = '#FFFFFF';
        g.beginPath(); g.arc(p.x - rr * 0.3, p.y - rr * 0.3, rr * 0.35, 0, TAU); g.fill();
      } else if (p.t === SPARK) {
        const tw = 0.6 + 0.4 * Math.sin(tsec * p.tf + p.ph);
        al = Math.min(1, lf * 2, (p.max - p.life) / 0.15);
        drawSpark(p.x, p.y, p.r * (0.55 + 0.45 * lf) * tw * 2.4, p.c, al);
      } else if (p.t === FLAKE) {
        al = Math.min(1, p.life / 0.6, (p.max - p.life) / 0.3);
        const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
        g.globalAlpha = al * 0.95;
        if (p.kind === 0) {
          g.setTransform(cs * dpr, sn * dpr, -sn * dpr, cs * dpr, p.x * dpr, p.y * dpr);
          drawSnow(p.s, p.c);
        } else {
          const fl = Math.cos(p.fl);
          g.setTransform(cs * dpr, sn * dpr, -sn * fl * dpr, cs * fl * dpr, p.x * dpr, p.y * dpr);
          g.fillStyle = fl < 0 ? p.c2 : p.c;
          g.beginPath();
          if (p.kind === 1) g.arc(0, 0, p.s, 0, TAU);
          else { g.moveTo(0, -p.s * 1.3); g.lineTo(p.s * 0.8, 0); g.lineTo(0, p.s * 1.3); g.lineTo(-p.s * 0.8, 0); g.closePath(); }
          g.fill();
          g.fillStyle = '#FFFFFF';
          g.globalAlpha = al * 0.7;
          g.beginPath(); g.arc(-p.s * 0.3, -p.s * 0.35, p.s * 0.3, 0, TAU); g.fill();
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (p.t === STREAK) {
        al = lf < 0.35 ? lf / 0.35 : 1;
        if (p.fk && lf < 0.5) al *= (Math.sin(tsec * 34 + p.ph) > 0 ? 1 : 0.3);
        g.globalAlpha = al; g.strokeStyle = p.c; g.lineWidth = p.r;
        g.beginPath(); g.moveTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08); g.lineTo(p.x, p.y); g.stroke();
        g.fillStyle = '#FFFFFF'; g.globalAlpha = al * 0.9;
        g.beginPath(); g.arc(p.x, p.y, p.r * 0.45, 0, TAU); g.fill();
      } else if (p.t === EMBER) {
        g.globalAlpha = lf * 0.9; g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r * (0.4 + 0.6 * lf), 0, TAU); g.fill();
      }
    }

    for (i = 0; i < rockets.length; i++) {
      r = rockets[i];
      if (r.still) continue;
      g.globalAlpha = 0.55; g.strokeStyle = '#9A7BFF'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - (r.x - r.px) * 3, r.y - (r.y - r.py) * 3); g.stroke();
      drawSpark(r.x, r.y, 11, '#7FD3F2', 1);
    }
    g.globalAlpha = 1;

    inFrame = false;
    if (parts.length || rings.length || rockets.length || aurora) raf = requestAnimationFrame(frame);
  }

  /* ---------- public effects ---------- */
  function burst(x, y, colors, n) {
    if (!ensure()) return;
    colors = (colors && colors.length) ? colors : ['#7FD3F2', '#C8B6FF', '#FF9FD6'];
    n = k(n > 0 ? n : 20);
    const still = rm();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = still ? 0 : rand(140, 380);
      const off = still ? rand(8, 40) : 0;
      add({ t: DOT, x: x + Math.cos(a) * off, y: y + Math.sin(a) * off, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (still ? 0 : 50),
        gr: still ? 0 : 520, dr: 0.92, life: rand(0.55, 0.95), r: rand(3, 6), c: colors[i % colors.length], fade: still });
    }
    for (let i = 0; i < Math.ceil(n / 4); i++) {
      const a = Math.random() * TAU, sp = still ? 0 : rand(60, 200);
      add({ t: SPARK, x: x + (still ? Math.cos(a) * 26 : 0), y: y + (still ? Math.sin(a) * 26 : 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gr: still ? 0 : 120, dr: 0.93, life: rand(0.5, 0.85), r: rand(2.4, 3.6), tf: rand(14, 24), ph: rand(0, TAU), c: pick(SPARK_C) });
    }
    rings.push({ x: x, y: y, r: 8, R: still ? 40 : rand(56, 76), life: 0.4, max: 0.4, c: colors[0], w: 4 });
    kick();
  }

  function sparkle(x, y) {
    if (!ensure()) return;
    const n = k(14), still = rm();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = still ? 0 : rand(40, 200), off = still ? rand(6, 46) : rand(0, 6);
      add({ t: SPARK, x: x + Math.cos(a) * off, y: y + Math.sin(a) * off, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (still ? 0 : 30),
        gr: still ? 0 : 120, dr: 0.93, life: rand(0.55, 1), r: rand(2.2, 3.8), tf: rand(12, 22), ph: rand(0, TAU), c: pick(SPARK_C) });
    }
    add({ t: FLASH, x: x, y: y, life: 0.3, r: 34, c: '#9A7BFF' });
    kick();
  }

  function confetti(n) {
    if (!ensure()) return;
    n = k(n > 0 ? n : 60);
    const still = rm();
    for (let i = 0; i < n; i++) {
      const c = pick(FROST), kind = Math.random() < 0.5 ? 0 : (Math.random() < 0.6 ? 1 : 2);
      const base = { t: FLAKE, kind: kind, c: c, c2: shade(c, -0.25), s: kind === 0 ? rand(6, 10) : rand(3.5, 6),
        rot: rand(0, TAU), fl: rand(0, TAU), ph: rand(0, TAU) };
      if (still) {
        /* reduced motion: flakes appear where they are, hang still and fade */
        add(Object.assign(base, { x: rand(0, W), y: rand(0, H * 0.85), vx: 0, vy: 0, term: 0, sf: 0, sw: 0, vr: 0, vf: 0, life: rand(1.6, 2.6) }));
      } else {
        add(Object.assign(base, { x: rand(0, W), y: rand(-H * 0.35, -14), vx: rand(-16, 16), vy: rand(40, 110),
          term: Math.max(90, H * rand(0.14, 0.24)), sf: rand(1.2, 2.6), sw: rand(14, 38),
          vr: rand(-2, 2), vf: kind === 0 ? 0 : rand(4, 9), life: 9 }));
      }
    }
    kick();
  }

  function firework(x, y, hue) {
    if (!ensure()) return;
    const h = (typeof hue === 'number' && isFinite(hue)) ? ((hue % 360) + 360) % 360 : rand(0, 360);
    const pair = FIRE[Math.floor(h / 72) % FIRE.length], c1 = pair[0], c2 = pair[1];
    const base = clamp(Math.min(W, H) * 0.55, 180, 380);
    if (rm()) {
      /* static sparkle ring that fades in place */
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, d = base * rand(0.18, 0.42);
        add({ t: SPARK, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: 0, vy: 0, gr: 0, dr: 1,
          life: rand(1, 1.5), r: rand(2.4, 3.6), tf: rand(6, 10), ph: rand(0, TAU), c: i % 3 ? c1 : c2 });
      }
      add({ t: FLASH, x: x, y: y, life: 0.5, r: 50, c: c1 });
      kick();
      return;
    }
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.06, 0.06), sp = base * (0.45 + 0.55 * Math.sqrt(Math.random())), q = Math.random();
      add({ t: STREAK, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 140, dr: 0.97,
        life: rand(0.9, 1.4), r: rand(2, 3.2), fk: Math.random() < 0.35, ph: rand(0, TAU), c: q < 0.6 ? c1 : (q < 0.85 ? shade(c1, 0.25) : c2) });
    }
    /* lingering glitter that drifts down slowly */
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, sp = base * rand(0.15, 0.5);
      add({ t: SPARK, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 40, dr: 0.95,
        life: rand(1.2, 1.8), r: rand(2.2, 3.4), tf: rand(10, 18), ph: rand(0, TAU), c: pick([c1, c2, '#9A7BFF', '#7FD3F2']) });
    }
    add({ t: FLASH, x: x, y: y, life: 0.35, r: 46, c: c1 });
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
    aurora = {
      t: 0, dur: ms / 1000 + 0.6,
      ribbons: AURORA_C.slice(0, 3).map(function (c, i) {
        /* three soft ribbons in the top quarter of the screen */
        return { c: c, y: 0.03 + i * 0.07 + rand(-0.015, 0.015), amp: rand(0.02, 0.035), th: rand(0.06, 0.1),
          f: rand(0.004, 0.008) * (390 / Math.max(390, W)) * 1.4, sp: rand(0.5, 0.9) * (i % 2 ? -1 : 1), ph: rand(0, TAU) };
      })
    };
    if (showTimer) clearTimeout(showTimer);
    (function launch() {
      showTimer = 0;
      if (now() >= end - 700) return; /* last launch well before the end: the show ends tidily */
      /* page hidden: no frames run, so rockets would pile up and all burst at once on return */
      if (document.hidden) { showTimer = setTimeout(launch, 600); return; }
      const x1 = rand(0.14, 0.86) * W, y1 = rand(0.12, 0.5) * H, hue = rand(0, 360);
      if (rm()) {
        firework(x1, y1, hue);
        snd('sparkle');
      } else {
        snd('whoosh');
        rocket(clamp(x1 + rand(-0.12, 0.12) * W, 0.06 * W, 0.94 * W), H + 8, x1, y1, function () { firework(x1, y1, hue); snd('boom'); });
      }
      showTimer = setTimeout(launch, rm() ? rand(850, 1150) : rand(520, 820));
    })();
    kick();
  }

  function clear() {
    parts.length = 0; rings.length = 0; rockets.length = 0; aurora = null;
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

export default FX;
