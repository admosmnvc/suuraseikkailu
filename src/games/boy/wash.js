/* boy 1 – Pese auto puhtaaksi! A muddy car, three rubbing steps, the finger is the tool:
   1 sponge: mud wipes off, foam bubbles appear under the finger
   2 shower: water drops rinse the foam away
   3 cloth:  sparkles, the car starts to shine
   Clean -> gleam, happy eyes, honk, bounce. Rubbing works anywhere (only the car changes).
   Progress per grid cell = how much the finger scrubbed over it (no pixel reads). */
import { carSideSVG, wheelSVG, spongeSVG, showerSVG, clothSVG, CAR_COLORS } from './art.js';
import { put, honk, clamp, eyesFollow } from './kit.js';

const BODY = 'M30 180L370 180Q390 180 390 160L390 140Q390 122 370 118L322 110L292 72Q282 58 266 58L150 58Q134 58 124 70L96 110L42 116Q18 120 16 142L16 166Q16 180 30 180Z';
const VB_W = 400, VB_H = 230;      /* car incl. wheels, in car units */
const GX = 13, GY = 6;             /* progress grid over the car bbox */
const DONE_AT = 0.66;              /* share of clean cells that completes a step (the rest is done for the child) */
const R = 26;                      /* brush radius, car units */
const MUD = ['#B9A08C', '#CDB8A6', '#C3AC97']; /* soft dust, not dark clumps */
/* need = px of scrubbing over a cell */
const STEPS = [
  { key: 'soap', need: 40, icon: spongeSVG, sfx: 'plop', every: 150, word: 'Vaahtoa!' },
  { key: 'rinse', need: 30, icon: showerSVG, sfx: 'whoosh', every: 380, word: 'Puhdas!' },
  { key: 'polish', need: 26, icon: clothSVG, sfx: 'sparkle', every: 240, word: 'Kiiltää!' }
];

export default {
  id: 'wash',
  goal: 6,
  start(S) {
    let si = -1, busy = true, L = null, cells = [], total = 0, cleanN = 0, travel = 0, lastP = null, drops = [], ended = false, pts = 0, lastSpark = 0;
    const scene = S.el('div', 'bw-scene');
    const carEl = S.el('div', 'bw-car', '', scene);
    S.el('div', 'bw-wheel bw-w1', wheelSVG('normal', true), carEl);
    S.el('div', 'bw-wheel bw-w2', wheelSVG('normal', true), carEl);
    S.el('div', 'bw-body', carSideSVG({ color: CAR_COLORS[1] }), carEl);
    const bodyEl = carEl.querySelector('.bw-body');
    const gloss = S.el('div', 'bw-gloss', '<svg viewBox="0 0 400 230" aria-hidden="true"><defs><clipPath id="bwgc' + S.index + '"><path d="' + BODY + '"/></clipPath></defs>' +
      '<g clip-path="url(#bwgc' + S.index + ')" fill="#fff"><path d="M60 200L150 40L190 40L100 200Z" opacity=".55"/><path d="M200 200L280 40L300 40L220 200Z" opacity=".5"/>' +
      '<path d="M120 200L200 40L215 40L135 200Z" opacity=".35"/></g></svg>', carEl);
    let dull = -1;
    function setDull(v) { const q = Math.round(v * 10) / 10; if (q === dull) return; dull = q; bodyEl.style.filter = q > 0 ? 'saturate(' + (1 - 0.5 * q).toFixed(2) + ') brightness(' + (1 - 0.1 * q).toFixed(2) + ')' : ''; }
    const mud = S.el('canvas', 'bw-mud', null, carEl);
    const foam = S.el('canvas', 'bw-foam', null, carEl);
    const spray = S.el('canvas', 'bw-spray');
    const badge = S.el('div', 'bw-badge', '');
    const tool = S.el('div', 'bw-tool', '');
    const zone = S.el('div', 'bw-zone');
    const gm = mud.getContext('2d'), gf = foam.getContext('2d'), gs = spray.getContext('2d');
    const body = new Path2D(BODY);
    const carClip = new Path2D(BODY); /* body + both wheels: foam stays on the car */
    carClip.moveTo(146, 182); carClip.arc(100, 182, 46, 0, Math.PI * 2, true); /* same winding as the body: union */
    carClip.moveTo(346, 182); carClip.arc(300, 182, 46, 0, Math.PI * 2, true);
    const probe = document.createElement('canvas').getContext('2d'); /* identity transform: point tests in car units */
    const blobs = [];
    for (let i = 0; i < 24; i++) {
      const x = 30 + Math.random() * 350, y = 70 + Math.random() * 150, parts = [];
      for (let k = 0; k < 4; k++) parts.push([x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 30, 10 + Math.random() * 20, MUD[(Math.random() * 3) | 0]]);
      blobs.push(parts);
    }
    const step = () => STEPS[si];

    function inside(x, y) {
      if (probe && probe.isPointInPath(body, x, y)) return true;
      return Math.hypot(x - 100, y - 182) < 44 || Math.hypot(x - 300, y - 182) < 44;
    }
    function layout() {
      const W = S.W, H = S.H, portrait = W < H;
      const cw = Math.min(W * 0.9, (H * (portrait ? 0.52 : 0.78)) * VB_W / VB_H); /* ~0.9 of the arena width */
      const ch = cw * VB_H / VB_W;
      L = { cw, ch, k: cw / VB_W, cx: W / 2, cy: portrait ? H * 0.52 : Math.min(H * 0.56, H - ch / 2 - 6) };
      put(scene, W / 2, H / 2, W, H);
      put(carEl, L.cx, L.cy, cw, ch);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [mud, foam]) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
      spray.width = Math.round(W * dpr); spray.height = Math.round(H * dpr);
      gm.setTransform(dpr * L.k, 0, 0, dpr * L.k, 0, 0);
      gf.setTransform(dpr * L.k, 0, 0, dpr * L.k, 0, 0);
      gs.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bs = clamp(Math.min(W, H) * 0.19, 64, 100);
      put(badge, bs * 0.5 + 8, bs * 0.5 + 8, bs, bs);
      put(tool, -200, -200, bs * 1.15, bs * 1.15);
    }
    function clearC(g, c) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.restore(); }
    /* full redraw from the cell state (after a resize) */
    function redraw() {
      clearC(gm, mud); clearC(gf, foam);
      if (si <= 0) {
        drawMud();
        for (const c of cells) if (c.rub > 0) eraseMud(c.x, c.y, c.w * 0.7, Math.min(1, c.rub / STEPS[0].need));
      }
      if (si === 0) for (const c of cells) if (c.rub > 0) foamAt(c.x, c.y, c.w * 0.6, 2);
      if (si === 1) for (const c of cells) if (!c.done) foamAt(c.x, c.y, c.w * 0.6, 3);
      gloss.style.opacity = si === 2 ? String(cleanN / total) : (ended ? '1' : '0');
    }
    /* soft dusty patches: radial gradients with feathered edges (no hard dark blobs) */
    function dust(x, y, r, c, a) {
      const g = gm.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, c); g.addColorStop(0.62, c); g.addColorStop(1, 'rgba(205,184,166,0)');
      gm.globalAlpha = a; gm.fillStyle = g;
      gm.beginPath(); gm.arc(x, y, r, 0, Math.PI * 2); gm.fill();
    }
    function drawMud() {
      gm.save();
      gm.clip(carClip);
      for (const b of blobs) for (const p of b) dust(p[0], p[1], p[2] * 1.35, p[3], 0.85);
      for (const x of [100, 300]) { dust(x - 8, 194, 30, MUD[0], 0.9); dust(x + 16, 176, 22, MUD[1], 0.9); }
      gm.globalAlpha = 0.5; gm.fillStyle = '#A88E79';
      for (let i = 0; i < 46; i++) { gm.beginPath(); gm.arc(20 + Math.random() * 370, 70 + Math.random() * 140, 1.6 + Math.random() * 2.4, 0, Math.PI * 2); gm.fill(); }
      gm.restore();
    }
    function eraseMud(x, y, r, a) {
      gm.save();
      gm.globalCompositeOperation = 'destination-out';
      gm.globalAlpha = a;
      gm.beginPath(); gm.arc(x, y, r, 0, Math.PI * 2); gm.fill();
      gm.restore();
    }
    function foamAt(x, y, r, n) {
      if (!inside(x, y)) return;
      gf.save();
      gf.clip(carClip);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * r, br = 5 + Math.random() * 9;
        const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
        gf.fillStyle = '#FFFFFF'; gf.strokeStyle = '#BFE3FF'; gf.lineWidth = 1.6;
        gf.beginPath(); gf.arc(bx, by, br, 0, Math.PI * 2); gf.fill(); gf.stroke();
        gf.fillStyle = '#D8F0FF';
        gf.beginPath(); gf.arc(bx - br * 0.35, by - br * 0.35, br * 0.28, 0, Math.PI * 2); gf.fill();
      }
      gf.restore();
    }
    function eraseFoam(x, y, r, a) {
      gf.save();
      gf.globalCompositeOperation = 'destination-out';
      gf.globalAlpha = a;
      gf.beginPath(); gf.arc(x, y, r, 0, Math.PI * 2); gf.fill();
      gf.restore();
    }
    function buildCells() {
      cells = [];
      const x0 = 16, x1 = 392, y0 = 60, y1 = 226, w = (x1 - x0) / GX, h = (y1 - y0) / GY;
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
        const x = x0 + (i + 0.5) * w, y = y0 + (j + 0.5) * h;
        if (inside(x, y)) cells.push({ x, y, w: Math.max(w, h), rub: 0, done: false });
      }
      total = cells.length;
    }
    function toCar(cx, cy) {
      const r = carEl.getBoundingClientRect();
      return { x: (cx - r.left) / L.k, y: (cy - r.top) / L.k };
    }
    /* one brush stamp at p (car units) that moved `d` car units */
    function stamp(p, d) {
      const st = step();
      if (st.key === 'soap') { eraseMud(p.x, p.y, R, 0.22); if (Math.random() < 0.7) foamAt(p.x, p.y, R * 0.7, 1); }
      else if (st.key === 'rinse') eraseFoam(p.x, p.y, R * 1.05, 0.3);
      for (const c of cells) {
        if (c.done) continue;
        if (Math.hypot(c.x - p.x, c.y - p.y) < R + c.w * 0.25) {
          c.rub += Math.max(d * L.k, 3); /* need is in screen px of scrubbing */
          if (c.rub >= st.need) { c.done = true; cleanN++; }
        }
      }
      if (st.key === 'polish') { gloss.style.opacity = (cleanN / total).toFixed(2); setDull(1 - cleanN / total); }
    }
    function strokeTo(p) {
      if (!lastP) { stamp(p, 0); lastP = p; return; }
      const d = Math.hypot(p.x - lastP.x, p.y - lastP.y), n = Math.max(1, Math.ceil(d / (R * 0.5)));
      for (let i = 1; i <= n; i++) stamp({ x: lastP.x + (p.x - lastP.x) * i / n, y: lastP.y + (p.y - lastP.y) * i / n }, d / n);
      lastP = p;
    }
    function check() {
      const share = cleanN / total, base = si * 2;
      while (pts - base < 2 && share >= [0.4, DONE_AT][pts - base]) { pts++; S.point(); }
      if (share >= DONE_AT && !busy) stepDone();
    }
    function startStep(i) {
      si = i;
      busy = false;
      cleanN = 0;
      for (const c of cells) { c.rub = 0; c.done = false; }
      badge.innerHTML = step().icon();
      tool.innerHTML = step().icon();
      S.bump(badge, 0.8);
      S.snd('pop');
      showHint();
      S.progress();
    }
    function stepDone() {
      busy = true;
      tool.classList.remove('on');
      const st = step();
      S.comic(st.word, { x: L.cx, y: L.cy - L.ch * 0.62 });
      if (st.key === 'soap') {
        /* finish the soaping for the child: the rest of the mud goes, the whole car turns foamy */
        mud.classList.add('fade');
        for (const c of cells) foamAt(c.x, c.y, c.w * 0.6, 3);
        S.snd('sparkle');
        S.later(() => startStep(1), 750);
      } else if (st.key === 'rinse') {
        foam.classList.add('fade');
        S.snd('whoosh');
        S.later(() => startStep(2), 750);
      } else outro();
    }
    function outro() {
      if (ended) return;
      ended = true;
      busy = true;
      S.hideHint();
      tool.classList.remove('on');
      mud.classList.add('fade');
      foam.classList.add('fade');
      gloss.style.opacity = '1';
      setDull(0);
      carEl.classList.add('shine', 'happy');
      S.snd('sparkle');
      for (let i = 0; i < 5; i++) S.later(() => S.sparkle({ x: L.cx + (Math.random() - 0.5) * L.cw * 0.8, y: L.cy + (Math.random() - 0.5) * L.ch * 0.6 }), i * 150);
      S.later(() => { honk(S); carEl.classList.add('bounce'); }, 450);
      S.later(() => S.finish(), 1000);
    }
    function dirtiest() {
      let best = null, bn = -1;
      for (const c of cells) {
        if (c.done) continue;
        let n = 0;
        for (const d of cells) if (!d.done && Math.hypot(d.x - c.x, d.y - c.y) < 70) n += 1 - d.rub / step().need;
        if (n > bn) { bn = n; best = c; }
      }
      if (!best) return { x: L.cx, y: L.cy };
      const r = carEl.getBoundingClientRect();
      return S.local(r.left + best.x * L.k, r.top + best.y * L.k);
    }
    function showHint() {
      if (busy || si < 0) return;
      S.hint({ type: 'rub', at: dirtiest(), r: clamp(L.cw * 0.15, 30, 110) }); /* wide strokes: shows a big scrub */
    }
    function moveTool(x, y) {
      const a = S.local(x, y);
      tool.style.translate = (a.x + 200).toFixed(0) + 'px ' + (a.y + 200 - 26).toFixed(0) + 'px';
    }

    S.rub(zone, {
      enabled: () => !busy,
      onStart(p) {
        tool.classList.add('on');
        moveTool(p.x, p.y);
        lastP = null;
        strokeTo(toCar(p.x, p.y));
        S.snd(step().sfx);
        check();
      },
      onRub(d, x, y) {
        if (busy) return;
        moveTool(x, y);
        strokeTo(toCar(x, y));
        travel += d;
        const st = step(), a = S.local(x, y);
        if (st.key === 'rinse' && !S.rm) for (let i = 0; i < 3; i++) drops.push({ x: a.x + (Math.random() - 0.5) * 30, y: a.y + 14, vx: (Math.random() - 0.5) * 140, vy: 140 + Math.random() * 160, life: 0.5 });
        if (st.key === 'polish' && performance.now() - lastSpark > 140) { lastSpark = performance.now(); S.sparkle({ x: a.x, y: a.y - 10 }); }
        if (travel > st.every) { travel = 0; S.snd(st.sfx); S.progress(); }
        check();
      },
      onEnd() { tool.classList.remove('on'); lastP = null; }
    });

    S.update = (dt) => {
      if (!drops.length) return;
      gs.clearRect(0, 0, S.W, S.H);
      if (drops.length > 120) drops.splice(0, drops.length - 120);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life -= dt;
        if (d.life <= 0) { drops.splice(i, 1); continue; }
        d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        gs.globalAlpha = Math.min(1, d.life * 3);
        gs.fillStyle = '#5AB4FF';
        gs.beginPath(); gs.ellipse(d.x, d.y, 4.5, 6.5, 0, 0, Math.PI * 2); gs.fill();
        gs.fillStyle = '#FFFFFF'; gs.beginPath(); gs.arc(d.x - 1.5, d.y - 2, 1.6, 0, Math.PI * 2); gs.fill();
      }
      gs.globalAlpha = 1;
      if (!drops.length) gs.clearRect(0, 0, S.W, S.H);
    };
    S.fillRest = () => { outro(); return 1100; };
    S.resize = () => { layout(); redraw(); };
    eyesFollow(S, carEl);
    S.idleHint(showHint, 2400);
    S.endWait = 1500;
    S.autoFinish = false; /* the outro calls S.finish() */

    layout();
    buildCells();
    drawMud();
    setDull(1);
    S.later(() => startStep(0), 400);
  }
};
