/* 5 - Sytytä moskeijan valot! A soft pastel mosque at dusk (central dome with a gold crescent finial, two slender
   minarets with crescents, pointed-arch windows). Tap a window: it lights up at once (warm glow) and a little animal
   friend peeks out. When all ten shine, the star above the dome sparkles: tap anywhere and heart and star fireworks
   bloom over the mosque (taps keep making fireworks during the celebration). Goal 11 = 10 windows + fireworks. */
import { C, G, HL, SH, svg, el, put, sfx, dist, makeStage, heartD, starD, sparkD, pick, WORDS } from './kit.js';

const VB = [400, 430];
/* k = window size (the minaret windows are slimmer) */
const WINDOWS = [
  { x: 128, y: 292, t: 'arch', a: 'kitten' }, { x: 272, y: 292, t: 'arch', a: 'bunny' },
  { x: 200, y: 222, t: 'round', a: 'duck', k: 0.72 }, { x: 200, y: 292, t: 'arch', a: 'puppy' },
  { x: 58, y: 236, t: 'arch', a: 'bunny', k: 0.6 }, { x: 342, y: 236, t: 'arch', a: 'kitten', k: 0.6 },
  { x: 128, y: 374, t: 'arch', a: 'duck' }, { x: 272, y: 374, t: 'arch', a: 'puppy' },
  { x: 58, y: 322, t: 'arch', a: 'kitten', k: 0.6 }, { x: 342, y: 322, t: 'arch', a: 'duck', k: 0.6 }];
const STAR = { x: 200, y: 14 };
const SIL = '#7A62C4';

function silhouette(a) {
  const f = ' fill="' + SIL + '"';
  if (a === 'kitten') return '<path d="M-13 28V14Q-13 2 0 2Q13 2 13 14V28Z"' + f + '/><path d="M-12 8L-12 -6L-2 3ZM12 8L12 -6L2 3Z"' + f + '/>';
  if (a === 'bunny') return '<path d="M-12 28V16Q-12 4 0 4Q12 4 12 16V28Z"' + f + '/><ellipse cx="-5" cy="-6" rx="4" ry="11"' + f + '/><ellipse cx="5" cy="-6" rx="4" ry="11"' + f + '/>';
  if (a === 'duck') return '<path d="M-14 28Q-16 14 -4 12Q-8 0 2 -2Q12 -2 12 8L20 10L12 14Q16 20 12 28Z"' + f + '/>';
  return '<path d="M-12 28V14Q-12 2 0 2Q12 2 12 14V28Z"' + f + '/><ellipse cx="-13" cy="12" rx="5" ry="10" transform="rotate(20 -13 12)"' + f + '/><ellipse cx="13" cy="12" rx="5" ry="10" transform="rotate(-20 13 12)"' + f + '/>';
}
function windowSVG(w, i) {
  const glass = w.t === 'round' ? '<circle cx="0" cy="0" r="22"/>' : '<path d="M-20 28V-4Q-20 -24 0 -34Q20 -24 20 -4V28Z"/>';
  const clip = 'gcw' + i;
  return '<g class="gc-win" data-i="' + i + '" transform="translate(' + w.x + ' ' + w.y + ') scale(' + (w.k || 1) + ')">' +
    '<circle class="gc-halo" cx="0" cy="2" r="48" fill="url(#gg-glow)"/>' +
    '<clipPath id="' + clip + '">' + glass + '</clipPath>' +
    '<g fill="' + G('dusk') + '">' + glass + '</g>' +
    '<g class="gc-lit" clip-path="url(#' + clip + ')"><g fill="' + G('gold') + '">' + glass + '</g>' +
    '<circle cx="0" cy="-4" r="16" fill="#FFF6CF" opacity=".7"/>' +
    '<g class="gc-peek"><g transform="translate(0 ' + (w.t === 'round' ? -6 : 0) + ') scale(' + (w.t === 'round' ? 0.75 : 1) + ')">' + silhouette(w.a) + '</g></g></g>' +
    (w.t === 'round' ? '' : '<rect x="-26" y="26" width="52" height="8" rx="4" fill="' + G('white') + '"/>') +
    '</g>';
}
/* crescent (horns up) centred at (x, cy): outer arc radius r, inner arc radius 1.05 r through the same horn tips */
function crescent(x, cy, r) {
  const f = (v) => v.toFixed(1), hx = x + 0.35 * r;
  return '<path d="M' + f(hx) + ' ' + f(cy - 0.94 * r) + 'A' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(hx) + ' ' + f(cy + 0.94 * r) +
    'A' + f(1.05 * r) + ' ' + f(1.05 * r) + ' 0 0 1 ' + f(hx) + ' ' + f(cy - 0.94 * r) + 'Z" transform="rotate(-90 ' + x + ' ' + cy + ')" fill="' + G('gold') + '"/>';
}
/* gold crescent finial on a short stem: stem from y0 up to the crescent centred at (x, cy) */
function finial(x, y0, cy, r) {
  return '<path d="M' + x + ' ' + y0 + 'V' + (cy + r * 0.9) + '" stroke="' + C.gold + '" stroke-width="' + Math.max(2.5, r * 0.32) + '" stroke-linecap="round"/>' +
    '<circle cx="' + x + '" cy="' + (y0 - (y0 - cy) * 0.35) + '" r="' + (r * 0.42) + '" fill="' + G('gold') + '"/>' +
    crescent(x, cy, r);
}
function minaret(x) {
  return '<rect x="' + (x - 16) + '" y="110" width="32" height="318" rx="10" fill="' + G('cream') + '"/>' +
    '<rect x="' + (x + 6) + '" y="116" width="8" height="306" rx="4" fill="#E9DDF5" opacity=".6"/>' +
    '<rect x="' + (x - 24) + '" y="172" width="48" height="13" rx="6.5" fill="' + G('gold') + '"/>' +
    '<rect x="' + (x - 22) + '" y="104" width="44" height="12" rx="6" fill="' + G('rose') + '"/>' +
    '<path d="M' + (x - 18) + ' 106Q' + (x - 18) + ' 80 ' + x + ' 66Q' + (x + 18) + ' 80 ' + (x + 18) + ' 106Z" fill="' + G('lav') + '"/>' +
    HL(x - 7, 88, 4, 9, 15) + finial(x, 68, 48, 8);
}
function mosqueSVG() {
  return svg('0 0 400 430',
    SH(200, 426, 200, 12) +
    minaret(58) + minaret(342) +
    /* little side domes */
    '<path d="M100 242Q100 212 124 202Q148 212 148 242Z" fill="' + G('mint') + '"/>' + HL(115, 216, 5, 8, 20) + finial(124, 204, 190, 6) +
    '<path d="M252 242Q252 212 276 202Q300 212 300 242Z" fill="' + G('mint') + '"/>' + HL(267, 216, 5, 8, 20) + finial(276, 204, 190, 6) +
    /* prayer hall */
    '<rect x="92" y="236" width="216" height="192" rx="12" fill="' + G('rose') + '"/>' + HL(140, 256, 36, 7) +
    '<rect x="92" y="236" width="216" height="12" rx="6" fill="' + G('white') + '"/>' +
    /* drum + central dome with the crescent finial */
    '<rect x="142" y="194" width="116" height="48" rx="8" fill="' + G('cream') + '"/>' +
    '<path d="M128 200C118 148 160 124 186 110C196 104 200 98 200 90C200 98 204 104 214 110C240 124 282 148 272 200Z" fill="' + G('lav') + '"/>' +
    HL(166, 146, 10, 26, 30) +
    '<rect x="124" y="194" width="152" height="10" rx="5" fill="' + G('gold') + '"/>' +
    finial(200, 92, 62, 11) +
    /* door: tall pointed arch */
    '<path d="M168 428V382Q168 356 200 342Q232 356 232 382V428Z" fill="' + G('plum') + '"/>' +
    '<path d="M180 428V386Q180 368 200 358Q220 368 220 386V428Z" fill="#9D8BEF" opacity=".55"/>' +
    WINDOWS.map(windowSVG).join('') +
    /* the star above the dome (tap for fireworks) */
    '<g class="gc-star"><circle cx="' + STAR.x + '" cy="' + (STAR.y + 6) + '" r="30" fill="url(#gg-glow)"/>' +
    '<path d="' + starD(STAR.x, STAR.y + 6, 18, 9) + '" fill="' + G('gold') + '" stroke="' + C.gold + '" stroke-width="4" stroke-linejoin="round"/>' +
    HL(STAR.x - 4, STAR.y + 2, 5, 3) + '</g>');
}
function fireworkHTML(n, big) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, d = (big ? 92 : 70) * (0.85 + (i % 3) * 0.12);
    const shape = i % 2 ? '<path d="' + heartD(12, 13, 8.5) + '" fill="' + G(['coral', 'rose', 'white'][i % 3]) + '"/>'
      : '<path d="' + starD(12, 12, 11, 5.5) + '" fill="' + G(['gold', 'mint', 'lav'][i % 3]) + '" stroke="' + [C.gold, C.mint, C.lav][i % 3] + '" stroke-width="2" stroke-linejoin="round"/>';
    s += '<i style="--fx:' + (Math.cos(a) * d).toFixed(1) + 'px;--fy:' + (Math.sin(a) * d).toFixed(1) + 'px">' + svg('0 0 24 24', shape) + '</i>';
  }
  return s + '<b></b>';
}

export default {
  id: 'girl-mosque',
  title: 'Sytytä moskeijan valot!',
  goal: WINDOWS.length + 1,
  start(S) {
    const st = makeStage(S, { cls: 'mosque', P: [380, 560], L: [720, 340] });
    const stars = st.add(el('div', 'gc-sky', svg('0 0 400 300',
      [[30, 40, 7], [90, 100, 5], [150, 30, 6], [260, 70, 7], [340, 30, 5], [370, 120, 6], [60, 170, 4], [220, 140, 4], [310, 190, 5], [120, 230, 4]].map((p) =>
        '<path d="' + sparkD(p[0], p[1], p[2] * 1.6) + '" fill="#fff" opacity=".8"/>').join(''))));
    const moon = st.add(el('div', 'gc-moon', svg('0 0 60 60', '<circle cx="30" cy="30" r="30" fill="url(#gg-glow)" opacity=".6"/>' +
      '<path d="M30 8a22 22 0 1 0 20 31a18 18 0 1 1 -20 -31z" fill="#FFF2C8"/>')));
    stars.firstChild.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const hill = st.add(el('div', 'gc-hill'));
    const mosque = st.add(el('div', 'gc-mosque', mosqueSVG()));
    mosque.setAttribute('data-gg', 'mosque');
    const wins = WINDOWS.map((w, i) => ({ i, w, on: false, g: mosque.querySelector('.gc-win[data-i="' + i + '"]') }));
    const box = { x: 0, y: 0, s: 1 };
    let lit = 0, phase = 'light', lastFw = 0;
    S.autoFinish = false;

    function at(c) { return { x: box.x + c.x * box.s, y: box.y + c.y * box.s }; }
    function layout() {
      const w = st.w, h = st.h;
      let cw;
      if (st.land) cw = Math.min((h - 26) * VB[0] / VB[1], w * 0.6); /* headroom for the star */
      else cw = Math.min(w - 16, (h - 110) * VB[0] / VB[1], 520);
      box.s = cw / VB[0];
      const ch = VB[1] * box.s;
      box.x = (w - cw) / 2;
      box.y = h - ch - 4;
      put(mosque, box.x, box.y, cw, ch);
      const hy = box.y + 400 * box.s;
      put(hill, 0, hy, w, h - hy);
      put(stars, 0, 0, w, Math.max(120, box.y + ch * 0.5));
      const ms = Math.min(70, Math.max(40, box.y * 0.5));
      put(moon, w - ms - 18, 14, ms, ms);
    }
    function light(wn) {
      wn.on = true;
      wn.g.classList.add('on');
      const c = at({ x: wn.w.x, y: wn.w.y });
      st.sparks(c.x, c.y, 6);
      sfx('ding', lit);
      lit++;
      if (lit === 5) { st.praise(c.x, c.y - 60, pick(WORDS)); st.say('fx-wow'); }
      S.point();
      if (lit === WINDOWS.length) {
        phase = 'fire';
        mosque.classList.add('is-lit');
        sfx('sparkle');
        st.say('fx-pretty');
        S.later(() => st.hint({ type: 'tap', at: at(STAR) }), 500);
      }
    }
    function firework(x, y, big) {
      const f = st.add(el('div', 'gc-fw' + (big ? ' is-big' : ''), fireworkHTML(big ? 12 : 10, big)));
      put(f, x, y);
      S.later(() => f.remove(), 1300);
    }
    function finale() {
      phase = 'show';
      S.endWait = 1800;
      mosque.classList.add('is-party');
      const w = st.w, top = Math.max(60, box.y + 40);
      const spots = [[0.25, 0.35], [0.72, 0.28], [0.5, 0.15], [0.15, 0.12], [0.86, 0.5]];
      spots.forEach((q, i) => S.later(() => {
        firework(w * q[0], Math.min(top, st.h * 0.5) * (0.4 + q[1]), i === 2);
        sfx(i % 2 ? 'sparkle' : 'boom');
      }, i * 260));
      sfx('boom');
      S.point();
      S.later(() => S.finish(), 1300); /* fireworks first, then the finale */
    }

    st.onDown((p) => {
      if (phase === 'show' || (S.done && !S.dead)) { /* finale + celebration: every tap is a firework */
        const t = performance.now();
        if (t - lastFw > 120) { lastFw = t; firework(p.x, p.y, false); sfx('sparkle'); }
        return true;
      }
      if (!S.active()) return false;
      if (phase === 'fire') { finale(); return true; }
      if (phase !== 'light') return false;
      const c = { x: (p.x - box.x) / box.s, y: (p.y - box.y) / box.s };
      let best = null, bd = 64;
      for (const wn of wins) { if (wn.on) continue; const d = dist(c, wn.w) - 26 * (wn.w.k || 1); if (d < bd) { bd = d; best = wn; } }
      if (best) { light(best); return true; }
      return false;
    });
    st.idle(() => {
      if (phase === 'fire') return { type: 'tap', at: at(STAR) };
      const wn = wins.find((q) => !q.on);
      return wn ? { type: 'tap', at: at(wn.w) } : null;
    }, 2400);
    S.fillRest = function () {
      wins.forEach((wn) => { wn.on = true; wn.g.classList.add('on'); });
      mosque.classList.add('is-lit', 'is-party');
      return 300;
    };
    st.layout(layout);
    st.hint({ type: 'tap', at: at(WINDOWS[3]) });
  }
};
