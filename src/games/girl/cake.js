/* 3 - Koristele kakku! A big two-tier cake and a tray of decorations (strawberry, candle, sprinkles, tiara).
   Drag one onto the cake (it sticks where it lands; a candle stands on a tier, the tiara crowns the top) or just
   tap it in the tray: it hops onto a free nice spot. After 7 decorations every candle lights up. Goal 7. */
import { INK, C, G, HL, SH, svg, el, put, sfx, dist, makeStage, heartD, pick, WORDS } from './kit.js';
import { FOODS } from './animals.js';

const VB = [360, 330];
const FACES = [{ x0: 100, x1: 260, y0: 96, y1: 158 }, { x0: 46, x1: 314, y0: 196, y1: 284 }];
const CANDLES = [{ x: 104, y: 76 }, { x: 256, y: 76 }, { x: 136, y: 78 }, { x: 224, y: 78 }, { x: 60, y: 176 }, { x: 300, y: 176 }];
const TIARA = { x: 180, y: 52 };
const AUTO = {
  strawberry: [[70, 182], [290, 182], [130, 244], [230, 244], [180, 266], [124, 130], [236, 130]],
  sprinkles: [[180, 126], [96, 230], [264, 230], [180, 220], [130, 270], [230, 270]],
  heart: [[180, 132], [80, 256], [280, 256], [180, 240]]
};
const GOAL = 7;

function cakeSVG() {
  const drip = (x0, x1, y, d) => {
    let p = 'M' + x0 + ' ' + (y - 4);
    const n = Math.round((x1 - x0) / 34);
    for (let i = 0; i < n; i++) {
      const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, m = (a + b) / 2, dd = d * (i % 2 ? 0.7 : 1.1);
      p += 'L' + (m - 8) + ' ' + (y + dd - 6) + 'Q' + m + ' ' + (y + dd + 8) + ' ' + (m + 8) + ' ' + (y + dd - 6) + 'L' + b + ' ' + (y + 2);
    }
    return p + 'L' + x1 + ' ' + (y - 4) + 'Z';
  };
  return svg('0 0 360 330',
    SH(180, 318, 176, 14) +
    /* stand */
    '<path d="M150 302h60l12 22h-84z" fill="' + G('mint') + '"/>' +
    '<ellipse cx="180" cy="300" rx="172" ry="20" fill="' + G('mint') + '"/>' + HL(120, 294, 70, 5) +
    /* bottom tier */
    '<path d="M34 176V286Q34 300 54 300H306Q326 300 326 286V176Z" fill="' + G('rose') + '"/><rect x="46" y="202" width="16" height="84" rx="8" fill="#fff" opacity=".28"/>' +
    '<ellipse cx="180" cy="176" rx="146" ry="18" fill="' + G('cream') + '"/>' +
    '<path d="' + drip(34, 326, 184, 26) + '" fill="#E9A3BC" opacity=".55"/>' +
    '<path d="' + drip(34, 326, 180, 26) + '" fill="' + G('white') + '"/>' +
    /* top tier */
    '<ellipse cx="180" cy="176" rx="96" ry="10" fill="url(#gg-sh)"/>' +
    '<path d="M90 76V164Q90 174 106 174H254Q270 174 270 164V76Z" fill="' + G('lav') + '"/><rect x="100" y="104" width="12" height="58" rx="6" fill="#fff" opacity=".28"/>' +
    '<ellipse cx="180" cy="76" rx="90" ry="14" fill="' + G('snow') + '"/>' +
    '<path d="' + drip(90, 270, 84, 20) + '" fill="#9C86E8" opacity=".5"/>' +
    '<path d="' + drip(90, 270, 80, 20) + '" fill="' + G('coral') + '"/>' +
    '<path d="M108 90q20-6 40 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>');
}
const DECO = {
  strawberry: { w: 60, h: 60, art: FOODS.strawberry, label: 'Mansikka' },
  candle: { w: 34, h: 80, art: () => svg('0 0 30 70',
    '<g class="gk-flame"><circle cx="15" cy="16" r="15" fill="url(#gg-glow)"/><path d="M15 2Q26 14 20 22Q15 28 10 22Q4 14 15 2Z" fill="' + G('gold') + '"/>' +
    '<path d="M15 10Q19 16 16 20Q13 22 12 18Q11 14 15 10Z" fill="#fff"/></g>' +
    '<path d="M15 22v6" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>' +
    '<rect x="6" y="28" width="18" height="40" rx="6" fill="' + G('white') + '"/>' +
    '<path d="M7 38l16-7M7 50l16-7M7 62l16-7" stroke="' + C.coral + '" stroke-width="4" stroke-linecap="round"/>' + HL(11, 40, 3, 9)), label: 'Kynttilä' },
  sprinkles: { w: 76, h: 62, art: () => svg('0 0 62 50',
    [[8, 10, 30, 'gold'], [24, 6, -20, 'mint'], [40, 12, 60, 'lav'], [52, 26, -40, 'gold'], [14, 28, 80, 'coral'], [30, 24, 10, 'white'],
      [44, 38, 40, 'mint'], [20, 42, -60, 'lav'], [6, 40, 20, 'coral']].map((r) =>
      '<rect x="' + (r[0] - 7) + '" y="' + (r[1] - 3.5) + '" width="14" height="7" rx="3.5" transform="rotate(' + r[2] + ' ' + r[0] + ' ' + r[1] + ')" fill="' + G(r[3]) + '"/>').join('')), label: 'Strösselit' },
  tiara: { w: 136, h: 82, art: () => svg('0 0 124 74',
    '<path d="M12 62Q10 38 16 22Q28 38 38 42Q50 22 62 6Q74 22 86 42Q96 38 108 22Q114 38 112 62Z" fill="' + G('gold') + '"/>' +
    '<rect x="8" y="56" width="108" height="15" rx="7.5" fill="' + G('gold') + '"/>' + HL(42, 59, 26, 3) +
    '<circle cx="62" cy="40" r="10" fill="' + G('mint') + '"/><circle cx="32" cy="54" r="6" fill="' + G('coral') + '"/><circle cx="92" cy="54" r="6" fill="' + G('coral') + '"/>' +
    HL(59, 36, 4, 3) + '<circle cx="62" cy="6" r="5.5" fill="#fff"/><circle cx="16" cy="22" r="4.5" fill="#fff"/><circle cx="108" cy="22" r="4.5" fill="#fff"/>'), label: 'Tiara' },
  heart: { w: 56, h: 56, art: () => svg('0 0 44 44', '<path d="' + heartD(22, 24, 15) + '" fill="' + G('coral') + '"/>' + HL(16, 16, 5, 3, -30)), label: 'Sydän' }
};

export default {
  id: 'girl-cake',
  title: 'Koristele kakku!',
  goal: GOAL,
  start(S) {
    const st = makeStage(S, { cls: 'cake', P: [380, 560], L: [720, 340] });
    S.autoFinish = false; /* candles light before the finale */
    const table = st.add(el('div', 'gg-floor gk-table'));
    const cake = st.add(el('div', 'gk-cake', cakeSVG() + '<div class="gk-decos"></div>'));
    cake.setAttribute('data-gg', 'cake');
    const decoBox = cake.querySelector('.gk-decos');
    const tray = st.add(el('div', 'gk-tray'));
    const kinds = ['strawberry', 'candle', 'sprinkles', 'tiara'];
    const slots = kinds.map((k) => {
      const t = { kind: k, el: el('div', 'gk-slot', '<div class="gk-sin">' + DECO[k].art() + '</div>'), cx: 0, cy: 0 };
      t.el.setAttribute('data-gg', 'deco');
      t.el.dataset.kind = k;
      tray.appendChild(t.el);
      return t;
    });
    const box = { x: 0, y: 0, s: 1 };
    const placed = [];
    let held = null, count = 0, tiaraUsed = false, T = 90;

    function toCake(p) { return { x: (p.x - box.x) / box.s, y: (p.y - box.y) / box.s }; }
    function fromCake(c) { return { x: box.x + c.x * box.s, y: box.y + c.y * box.s }; }
    function layout() {
      const w = st.w, h = st.h;
      let cw;
      if (st.land) { T = Math.min(96, (h - 40) / 2.3); cw = Math.min(w - 2 * T - 70, (h - 56) * VB[0] / VB[1], 560); }
      else { T = Math.min(92, (w - 50) / 4.3); cw = Math.min(w - 20, (h - T - 90) * VB[0] / VB[1], 520); }
      box.s = cw / VB[0];
      const ch = VB[1] * box.s;
      box.x = st.land ? Math.max(8, (w - 2 * T - 40 - cw) / 2) : (w - cw) / 2;
      box.y = st.land ? 46 + (h - 52 - ch) / 2 : Math.max(64, (h - T - 40 - ch) * 0.55); /* headroom for the tiara */
      put(cake, box.x, box.y, cw, ch);
      const ty = box.y + 300 * box.s;
      put(table, 0, ty, w, Math.max(0, h - ty));
      slots.forEach((t, i) => {
        let x, y;
        if (st.land) { x = w - (2 - (i % 2)) * (T + 14) - 6; y = h / 2 + (i < 2 ? -T - 8 : 8); }
        else { x = w / 2 + (i - 1.5) * (T + 10) - T / 2; y = h - T - 16; }
        t.cx = x + T / 2; t.cy = y + T / 2;
        put(t.el, x, y, T, T);
      });
      if (held) moveHeld(held.p);
    }
    function decoEl(kind) {
      const d = DECO[kind];
      const e = el('div', 'gk-deco gk-' + kind, d.art());
      e.dataset.kind = kind;
      return e;
    }
    function setDecoPos(e, kind, c) {
      const d = DECO[kind];
      const bottom = kind === 'candle' || kind === 'tiara';
      e.style.left = ((c.x - d.w / 2) / VB[0] * 100) + '%';
      e.style.top = ((c.y - (bottom ? d.h : d.h / 2)) / VB[1] * 100) + '%';
      e.style.width = (d.w / VB[0] * 100) + '%';
      e.style.height = (d.h / VB[1] * 100) + '%';
    }
    function freeCandle(c) {
      let best = null, bd = Infinity;
      for (const s of CANDLES) {
        if (placed.some((q) => q.kind === 'candle' && q.c.x === s.x && q.c.y === s.y)) continue;
        const d = c ? dist(c, s) : Math.abs(s.x - 180);
        if (d < bd) { bd = d; best = s; }
      }
      return best || CANDLES[(placed.length) % CANDLES.length];
    }
    function clampFace(c) {
      let best = null, bd = Infinity;
      for (const f of FACES) {
        const q = { x: Math.max(f.x0, Math.min(f.x1, c.x)), y: Math.max(f.y0, Math.min(f.y1, c.y)) };
        const d = dist(q, c);
        if (d < bd) { bd = d; best = q; }
      }
      return best;
    }
    function autoSpot(kind) {
      if (kind === 'candle') return freeCandle(null);
      if (kind === 'tiara') return TIARA;
      const list = AUTO[kind] || AUTO.strawberry;
      for (const a of list) {
        const c = { x: a[0], y: a[1] };
        if (!placed.some((q) => dist(q.c, c) < 34)) return c;
      }
      return { x: list[0][0] + (Math.random() * 40 - 20), y: list[0][1] };
    }
    function place(kind, c, fromP) {
      if (kind === 'candle') c = freeCandle(c);
      else if (kind === 'tiara') c = TIARA;
      else c = clampFace(c);
      const e = decoEl(kind);
      setDecoPos(e, kind, c);
      e.classList.add('is-in');
      decoBox.appendChild(e);
      placed.push({ kind, c, el: e });
      if (kind === 'tiara' && !tiaraUsed) {
        tiaraUsed = true;
        const t = slots.find((q) => q.kind === 'tiara');
        t.kind = 'heart';
        t.el.dataset.kind = 'heart';
        t.el.querySelector('.gk-sin').innerHTML = DECO.heart.art();
        S.bump(t.el);
      }
      const v = fromCake(kind === 'candle' || kind === 'tiara' ? { x: c.x, y: c.y - 30 } : c);
      st.sparks(v.x, v.y, 6);
      sfx('plop');
      sfx('ding', count);
      count++;
      if (count === 4) { st.praise(v.x, v.y - 60, pick(WORDS)); st.say('fx-pretty'); }
      if (count >= GOAL) { lightCandles(); S.later(() => S.finish(), 1200); }
      S.point();
      void fromP;
    }
    function lightCandles() {
      let cs = placed.filter((q) => q.kind === 'candle');
      for (let i = cs.length; i < 2; i++) { /* a cake always gets candles to light */
        const c = freeCandle(null), e = decoEl('candle');
        setDecoPos(e, 'candle', c);
        e.classList.add('is-in');
        decoBox.appendChild(e);
        placed.push({ kind: 'candle', c, el: e });
      }
      cs = placed.filter((q) => q.kind === 'candle');
      cs.forEach((q, i) => { q.el.style.setProperty('--d', (i * 90) + 'ms'); q.el.classList.add('is-lit'); });
      cake.classList.add('is-lit');
      sfx('whoosh');
      st.say('fx-yum');
      S.later(() => sfx('sparkle'), 300);
    }
    function moveHeld(p) {
      const d = DECO[held.kind], k = box.s * 1.15;
      const bottom = held.kind === 'candle' || held.kind === 'tiara';
      held.p = p;
      put(held.el, p.x - d.w * k / 2, p.y - (bottom ? d.h * k * 0.85 : d.h * k / 2) - 12, d.w * k, d.h * k);
    }

    st.onDown((p) => {
      if (!S.active()) return false;
      if (held) return true;
      let best = null, bd = T * 0.7;
      for (const t of slots) { const d = dist(p, { x: t.cx, y: t.cy }); if (d < bd) { bd = d; best = t; } }
      if (!best) {
        if (p.y > box.y && p.y < box.y + VB[1] * box.s && p.x > box.x && p.x < box.x + VB[0] * box.s) { S.bump(cake); sfx('tap'); return true; }
        return false;
      }
      S.bump(best.el);
      best.el.classList.add('is-down');
      held = { kind: best.kind, slot: best, el: st.add(decoEl(best.kind)), p0: p, t0: performance.now(), p };
      held.el.classList.add('is-held');
      moveHeld(p);
      sfx('tap');
      return true;
    });
    st.onMove((p) => { if (held) moveHeld(p); });
    st.onUp((p) => {
      if (!held) return;
      const h = held;
      held = null;
      h.slot.el.classList.remove('is-down');
      h.el.remove();
      if (!S.active()) return;
      const tap = dist(p, h.p0) < 16 || (dist(p, { x: h.slot.cx, y: h.slot.cy }) < T * 0.6);
      const bottom = h.kind === 'candle' || h.kind === 'tiara';
      const at = { x: p.x, y: p.y - 12 + (bottom ? DECO[h.kind].h * box.s * 0.15 : 0) };
      place(h.kind, tap ? autoSpot(h.kind) : toCake(at), p);
    });
    st.idle(() => {
      const t = slots[count % slots.length];
      const c = fromCake(autoSpot(t.kind));
      return { type: 'drag', at: { x: t.cx, y: t.cy }, to: c };
    }, 2600);
    S.fillRest = function () {
      while (count < GOAL - 1) { const k = kinds[count % 3]; place(k, autoSpot(k)); }
      lightCandles();
      return 200;
    };
    S.onComplete = () => cake.classList.add('is-party');
    st.layout(layout);
    const t0 = slots[0];
    st.hint({ type: 'drag', at: { x: t0.cx, y: t0.cy }, to: fromCake(autoSpot('strawberry')) });
  }
};
