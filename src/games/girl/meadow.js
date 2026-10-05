/* 4 - Kasvata kukkaniitty! Six soil mounds on a sunny meadow. Tap a mound: a seed pops in (a tiny sprout).
   Tap it again - or drag the watering can over it - and a flower pops open at once. Every second flower
   brings a butterfly with a happy face. Goal 6 flowers. */
import { C, G, HL, SH, svg, el, put, sfx, dist, makeStage, heartD, starD, pick, WORDS } from './kit.js';
import { butterfly } from './animals.js';

const N = 6;

function mound() {
  return svg('0 0 120 60',
    SH(60, 52, 58, 8) +
    '<ellipse cx="60" cy="38" rx="54" ry="20" fill="' + G('brown') + '"/>' + HL(42, 28, 20, 5) +
    '<ellipse cx="60" cy="33" rx="20" ry="7" fill="#9A6A4C"/>' +
    '<g class="gm-seed"><path d="M60 30q-2-14-14-16q2 14 14 16zM60 30q2-16 16-18q-2 16-16 18z" fill="' + G('leaf') + '"/>' +
    '<ellipse cx="60" cy="31" rx="7" ry="5" fill="' + G('gold') + '"/></g>');
}
function bloom(kind) {
  let head;
  if (kind === 0) { /* daisy */
    head = Array.from({ length: 8 }, (_, i) => '<ellipse cx="50" cy="21" rx="11" ry="20" transform="rotate(' + i * 45 + ' 50 46)" fill="' + G('white') + '"/>').join('') +
      '<circle cx="50" cy="46" r="15" fill="' + G('gold') + '"/>' + HL(45, 41, 6, 4);
  } else if (kind === 1) { /* tulip */
    head = '<path d="M24 30Q22 72 50 74Q78 72 76 30Q68 36 64 44Q58 26 50 20Q42 26 36 44Q32 36 24 30Z" fill="' + G('coral') + '"/>' + HL(38, 46, 6, 12, 10);
  } else if (kind === 2) { /* star flower */
    head = [0, 72, 144, 216, 288].map((a) => '<ellipse cx="50" cy="22" rx="14" ry="22" transform="rotate(' + a + ' 50 46)" fill="' + G('lav') + '"/>').join('') +
      '<circle cx="50" cy="46" r="12" fill="' + G('gold') + '"/>' + HL(46, 42, 5, 3);
  } else { /* heart flower */
    head = [0, 90, 180, 270].map((a) => '<path d="' + heartD(50, 26, 14) + '" transform="rotate(' + a + ' 50 46)" fill="' + G('rose') + '"/>').join('') +
      '<circle cx="50" cy="46" r="12" fill="' + G('gold') + '"/>' + HL(46, 42, 5, 3);
  }
  return svg('0 0 100 170',
    '<path d="M50 168V70" stroke="' + C.leaf + '" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M50 132Q24 108 12 122Q26 142 50 132Z" fill="' + G('leaf') + '"/><path d="M50 116Q76 94 88 108Q74 128 50 116Z" fill="' + G('mint') + '"/>' +
    '<g class="gm-head">' + head + '</g>');
}
const CAN = svg('0 0 150 110',
  '<path d="M38 52L6 30L2 38L30 66Z" fill="' + G('mint') + '"/>' +
  '<path d="M96 30Q140 22 134 62Q130 82 108 84" fill="none" stroke="' + C.lav + '" stroke-width="10" stroke-linecap="round"/>' +
  '<path d="M30 40Q30 28 46 28H100Q114 28 114 40V92Q114 104 100 104H44Q30 104 30 92Z" fill="' + G('mint') + '"/>' + HL(56, 42, 22, 7, -4) +
  '<path d="' + heartD(72, 68, 12) + '" fill="' + G('rose') + '"/>' +
  '<ellipse cx="4" cy="34" rx="6" ry="9" transform="rotate(-36 4 34)" fill="' + G('gold') + '"/>');
const CAN_W = 150, CAN_H = 110, SPOUT = { x: 4, y: 34 };
const BFLY = [['rose', 'gold'], ['gold', 'coral'], ['lav', 'rose']];

export default {
  id: 'girl-meadow',
  title: 'Kasvata kukkaniitty!',
  goal: N,
  start(S) {
    const st = makeStage(S, { cls: 'meadow', P: [380, 560], L: [720, 340] });
    S.autoFinish = false; /* the last flower + butterfly show before the finale */
    const sun = st.add(el('div', 'gm-sun', svg('0 0 100 100',
      '<circle cx="50" cy="50" r="48" fill="url(#gg-glow)"/><circle cx="50" cy="50" r="27" fill="' + G('gold') + '"/>' + HL(42, 40, 11, 7, -20))));
    const hills = st.add(el('div', 'gm-hills'));
    const spots = Array.from({ length: N }, (_, i) => {
      const sp = { i, state: 0, kind: i % 4, el: st.add(el('div', 'gm-spot', '<div class="gm-flower">' + bloom(i % 4) + '</div><div class="gm-mound">' + mound() + '</div><div class="gm-rain"><i></i><i></i><i></i><i></i></div>')), x: 0, y: 0 };
      sp.el.setAttribute('data-gg', 'spot');
      return sp;
    });
    const can = st.add(el('div', 'gg-tool gm-can', CAN));
    can.setAttribute('data-gg', 'can');
    const flies = [];
    let U = 100, grown = 0, held = null, rest = { x: 0, y: 0 };

    function layout() {
      const w = st.w, h = st.h;
      let pos;
      if (st.land) {
        U = Math.min(112, (w - 200) / 3.4, h * 0.3);
        const x0 = w * 0.08 + U / 2, dx = (w * 0.74 - U) / 2;
        pos = [0, 1, 2].map((j) => ({ x: x0 + dx * j + U * 0.4, y: h * 0.55 })).concat([0, 1, 2].map((j) => ({ x: x0 + dx * j - U * 0.15, y: h * 0.86 })));
        rest = { x: w - CAN_W / 2 - 14, y: h * 0.3 };
      } else {
        U = Math.min(108, (w - 40) / 3.4);
        const m = U / 2 + 8, dx = (w - 2 * m - U * 0.3) / 2;
        pos = [0, 1, 2].map((j) => ({ x: m + U * 0.3 + dx * j, y: h * 0.57 })).concat([0, 1, 2].map((j) => ({ x: m + dx * j, y: h * 0.85 })));
        rest = { x: w - CAN_W / 2 - 12, y: Math.max(70, h * 0.3) };
      }
      spots.forEach((sp, i) => {
        sp.x = pos[i].x; sp.y = pos[i].y;
        put(sp.el, sp.x - U / 2, sp.y - U * 1.9, U, U * 2.2);
        sp.el.style.zIndex = String(i < 3 ? 6 : 8);
      });
      const hy = Math.min(spots[0].y - U * 0.55, h * 0.48);
      put(hills, 0, hy, w, h - hy);
      const ss = Math.min(110, h * 0.22);
      put(sun, 14, 10, ss, ss);
      if (!held) placeCan(rest.x, rest.y);
      flies.forEach(landFly);
    }
    function placeCan(x, y) { put(can, x - CAN_W / 2, y - CAN_H / 2); }
    function spoutPos() { return { x: held.x - CAN_W / 2 + SPOUT.x, y: held.y - CAN_H / 2 + SPOUT.y }; }

    function spotAt(p, slack) {
      let best = null, bd = U * 0.62 + (slack || 0);
      for (const sp of spots) {
        const d = Math.min(dist(p, sp), sp.state === 2 ? dist(p, { x: sp.x, y: sp.y - U * 1.1 }) : Infinity);
        if (d < bd) { bd = d; best = sp; }
      }
      return best;
    }
    function seed(sp) {
      sp.state = 1;
      sp.el.classList.add('is-seed');
      S.bump(sp.el.querySelector('.gm-mound'));
      sfx('plop');
      st.sparks(sp.x, sp.y - 10, 4, [C.leaf, C.gold, '#fff']);
    }
    function grow(sp, rain) {
      sp.state = 2;
      sp.el.classList.add('is-bloom');
      if (rain) sp.el.classList.add('is-rain');
      sfx('pop');
      sfx('ding', grown);
      const top = { x: sp.x, y: sp.y - U * 1.35 };
      st.sparks(top.x, top.y, 8);
      grown++;
      if (grown % 2 === 0) addFly(sp);
      if (grown === 3) st.praise(top.x, top.y - 50, pick(WORDS));
      S.point();
      if (grown === N) { st.say('fx-pretty'); S.later(() => S.finish(), 1000); }
      S.later(() => sp.el.classList.remove('is-rain'), 600);
    }
    function landFly(f) {
      const sp = f.sp, s = U * 0.62;
      put(f.el, sp.x - s / 2 + U * 0.18, sp.y - U * 1.95 - s * 0.2, s, s * 0.8);
    }
    function addFly(sp) {
      const k = flies.length;
      const f = { sp, el: st.add(el('div', 'gm-fly', '<div class="gm-fin">' + butterfly(BFLY[k % 3][0], BFLY[k % 3][1]) + '</div>')) };
      f.el.style.setProperty('--fx', (k % 2 ? 1 : -1) * st.w * 0.6 + 'px');
      f.el.style.setProperty('--fy', -st.h * 0.4 + 'px');
      flies.push(f);
      landFly(f);
      S.later(() => { sfx('sparkle'); if (k === 0) st.say('fx-wow'); }, 700); /* first butterfly lands */
    }

    st.onDown((p) => {
      if (!S.active()) return false;
      if (!held && dist(p, rest) < 78) {
        held = { x: p.x + 20, y: p.y + 6 };
        can.classList.add('is-down');
        placeCan(held.x, held.y);
        sfx('tap');
        return true;
      }
      const sp = spotAt(p, 10);
      if (!sp) return false;
      if (sp.state === 0) seed(sp);
      else if (sp.state === 1) grow(sp, true);
      else { S.bump(sp.el.querySelector('.gm-flower')); st.sparks(sp.x, sp.y - U * 1.3, 4); sfx('sparkle'); }
      return true;
    });
    st.onMove((p) => {
      if (!held) return;
      held = { x: p.x + 20, y: p.y + 6 };
      placeCan(held.x, held.y);
      /* pour on the seeded mound below the spout (anywhere above it counts) */
      const s = spoutPos();
      let best = null, bd = U * 0.7;
      for (const sp of spots) {
        if (sp.state !== 1 || s.y > sp.y + 24 || s.y < sp.y - U * 2.4) continue;
        const d = Math.abs(s.x - sp.x);
        if (d < bd) { bd = d; best = sp; }
      }
      can.classList.toggle('is-pour', !!best);
      if (best) grow(best, true);
    });
    st.onUp(() => {
      if (!held) return;
      held = null;
      can.classList.remove('is-down', 'is-pour');
      placeCan(rest.x, rest.y);
    });
    st.idle(() => {
      const sp = spots.find((q) => q.state === 1) || spots.find((q) => q.state === 0);
      return sp ? { type: 'tap', at: { x: sp.x, y: sp.y - 8 } } : null;
    }, 2400);
    S.fillRest = function () {
      spots.forEach((sp) => { sp.state = 2; sp.el.classList.add('is-seed', 'is-bloom'); });
      return 300;
    };
    S.onComplete = () => { st.el.classList.add('is-party'); };
    st.layout(layout);
    st.hint({ type: 'tap', at: { x: spots[0].x, y: spots[0].y - 8 } });
  }
};
