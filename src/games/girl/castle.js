/* 5 - Sytytä linnan valot! A soft dreamy castle at dusk with ten dark windows. Tap a window: it lights up at
   once (warm glow) and a little animal friend peeks out. When all ten shine, the star on the top tower
   sparkles: tap anywhere and heart and star fireworks bloom over the castle (taps keep making fireworks during
   the celebration). Goal 11 = 10 windows + fireworks. */
import { C, G, HL, SH, svg, el, put, sfx, dist, makeStage, heartD, starD, sparkD, pick, WORDS } from './kit.js';

const VB = [400, 430];
const WINDOWS = [
  { x: 75, y: 214, t: 'arch', a: 'kitten' }, { x: 325, y: 214, t: 'arch', a: 'bunny' },
  { x: 146, y: 262, t: 'arch', a: 'duck' }, { x: 254, y: 262, t: 'arch', a: 'puppy' },
  { x: 75, y: 326, t: 'arch', a: 'bunny' }, { x: 325, y: 326, t: 'arch', a: 'kitten' },
  { x: 200, y: 152, t: 'round', a: 'duck' }, { x: 200, y: 300, t: 'round', a: 'puppy' },
  { x: 138, y: 352, t: 'arch', a: 'puppy' }, { x: 262, y: 352, t: 'arch', a: 'duck' }];
const STAR = { x: 200, y: 8 };
const SIL = '#7A62C4';

function silhouette(a) {
  const f = ' fill="' + SIL + '"';
  if (a === 'kitten') return '<path d="M-13 28V14Q-13 2 0 2Q13 2 13 14V28Z"' + f + '/><path d="M-12 8L-12 -6L-2 3ZM12 8L12 -6L2 3Z"' + f + '/>';
  if (a === 'bunny') return '<path d="M-12 28V16Q-12 4 0 4Q12 4 12 16V28Z"' + f + '/><ellipse cx="-5" cy="-6" rx="4" ry="11"' + f + '/><ellipse cx="5" cy="-6" rx="4" ry="11"' + f + '/>';
  if (a === 'duck') return '<path d="M-14 28Q-16 14 -4 12Q-8 0 2 -2Q12 -2 12 8L20 10L12 14Q16 20 12 28Z"' + f + '/>';
  return '<path d="M-12 28V14Q-12 2 0 2Q12 2 12 14V28Z"' + f + '/><ellipse cx="-13" cy="12" rx="5" ry="10" transform="rotate(20 -13 12)"' + f + '/><ellipse cx="13" cy="12" rx="5" ry="10" transform="rotate(-20 13 12)"' + f + '/>';
}
function windowSVG(w, i) {
  const glass = w.t === 'round' ? '<circle cx="0" cy="0" r="22"/>' : '<path d="M-20 28V-6A20 20 0 0 1 20 -6V28Z"/>';
  const clip = 'gcw' + i;
  return '<g class="gc-win" data-i="' + i + '" transform="translate(' + w.x + ' ' + w.y + ')">' +
    '<circle class="gc-halo" cx="0" cy="2" r="48" fill="url(#gg-glow)"/>' +
    '<clipPath id="' + clip + '">' + glass + '</clipPath>' +
    '<g fill="' + G('dusk') + '">' + glass + '</g>' +
    '<g class="gc-lit" clip-path="url(#' + clip + ')"><g fill="' + G('gold') + '">' + glass + '</g>' +
    '<circle cx="0" cy="-4" r="16" fill="#FFF6CF" opacity=".7"/>' +
    '<g transform="translate(0 ' + (w.t === 'round' ? -6 : 0) + ') scale(' + (w.t === 'round' ? 0.75 : 1) + ')">' + silhouette(w.a) + '</g></g>' +
    (w.t === 'round' ? '' : '<rect x="-26" y="26" width="52" height="8" rx="4" fill="' + G('white') + '"/>') +
    '</g>';
}
function castleSVG() {
  const merlons = (x0, x1, y, key) => {
    let s = '';
    for (let x = x0; x < x1 - 4; x += 36) s += '<rect x="' + x + '" y="' + (y - 22) + '" width="22" height="28" rx="6" fill="' + G(key) + '"/>';
    return s;
  };
  return svg('0 0 400 430',
    SH(200, 426, 200, 12) +
    /* keep */
    merlons(110, 290, 196, 'rose') +
    '<rect x="110" y="192" width="180" height="236" rx="6" fill="' + G('rose') + '"/>' + HL(150, 214, 30, 8) +
    /* center tower */
    '<rect x="160" y="100" width="80" height="98" rx="6" fill="' + G('mint') + '"/>' +
    '<path d="M146 106Q174 66 200 14Q226 66 254 106Z" fill="' + G('coral') + '"/>' + HL(186, 70, 6, 18, 20) +
    /* side towers */
    '<rect x="30" y="148" width="90" height="280" rx="8" fill="' + G('cream') + '"/>' +
    '<rect x="280" y="148" width="90" height="280" rx="8" fill="' + G('cream') + '"/>' +
    '<rect x="104" y="148" width="16" height="280" fill="#E9DDF5" opacity=".6"/><rect x="280" y="148" width="16" height="280" fill="#E9DDF5" opacity=".6"/>' +
    '<path d="M75 16V44M325 16V44" stroke="#CFC2EA" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M77 14Q92 16 104 24Q92 32 77 34Z" fill="' + G('gold') + '"/><path d="M327 14Q342 16 354 24Q342 32 327 34Z" fill="' + G('gold') + '"/>' +
    '<path d="M18 154Q48 98 75 40Q102 98 132 154Z" fill="' + G('rose') + '"/><path d="M268 154Q298 98 325 40Q352 98 382 154Z" fill="' + G('rose') + '"/>' +
    HL(62, 110, 6, 20, 20) + HL(312, 110, 6, 20, 20) +
    '<path d="' + heartD(75, 128, 9) + '" fill="' + G('coral') + '"/><path d="' + heartD(325, 128, 9) + '" fill="' + G('coral') + '"/>' +
    /* door */
    '<path d="M168 428V372A32 32 0 0 1 232 372V428Z" fill="' + G('plum') + '"/>' +
    '<path d="' + heartD(200, 392, 10) + '" fill="' + G('rose') + '"/>' +
    WINDOWS.map(windowSVG).join('') +
    /* top star */
    '<g class="gc-star"><circle cx="' + STAR.x + '" cy="' + (STAR.y + 6) + '" r="30" fill="url(#gg-glow)"/>' +
    '<path d="' + starD(STAR.x, STAR.y + 6, 22, 11) + '" fill="' + G('gold') + '" stroke="' + C.gold + '" stroke-width="4" stroke-linejoin="round"/>' +
    HL(STAR.x - 5, STAR.y + 2, 6, 4) + '</g>');
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
  id: 'girl-castle',
  title: 'Sytytä linnan valot!',
  goal: WINDOWS.length + 1,
  start(S) {
    const st = makeStage(S, { cls: 'castle', P: [380, 560], L: [720, 340] });
    const stars = st.add(el('div', 'gc-sky', svg('0 0 400 300',
      [[30, 40, 7], [90, 100, 5], [150, 30, 6], [260, 70, 7], [340, 30, 5], [370, 120, 6], [60, 170, 4], [220, 140, 4], [310, 190, 5], [120, 230, 4]].map((p) =>
        '<path d="' + sparkD(p[0], p[1], p[2] * 1.6) + '" fill="#fff" opacity=".8"/>').join(''))));
    const moon = st.add(el('div', 'gc-moon', svg('0 0 60 60', '<circle cx="30" cy="30" r="30" fill="url(#gg-glow)" opacity=".6"/>' +
      '<path d="M30 8a22 22 0 1 0 20 31a18 18 0 1 1 -20 -31z" fill="#FFF2C8"/>')));
    stars.firstChild.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const hill = st.add(el('div', 'gc-hill'));
    const castle = st.add(el('div', 'gc-castle', castleSVG()));
    castle.setAttribute('data-gg', 'castle');
    const wins = WINDOWS.map((w, i) => ({ i, w, on: false, g: castle.querySelector('.gc-win[data-i="' + i + '"]') }));
    const box = { x: 0, y: 0, s: 1 };
    let lit = 0, phase = 'light', lastFw = 0;
    S.autoFinish = false;

    function at(c) { return { x: box.x + c.x * box.s, y: box.y + c.y * box.s }; }
    function layout() {
      const w = st.w, h = st.h;
      let cw;
      if (st.land) cw = Math.min((h - 8) * VB[0] / VB[1], w * 0.6);
      else cw = Math.min(w - 16, (h - 110) * VB[0] / VB[1], 520);
      box.s = cw / VB[0];
      const ch = VB[1] * box.s;
      box.x = (w - cw) / 2;
      box.y = h - ch - 4;
      put(castle, box.x, box.y, cw, ch);
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
      if (lit === 5) st.praise(c.x, c.y - 60, pick(WORDS));
      S.point();
      if (lit === WINDOWS.length) {
        phase = 'fire';
        castle.classList.add('is-lit');
        sfx('sparkle');
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
      castle.classList.add('is-party');
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
      for (const wn of wins) { if (wn.on) continue; const d = dist(c, wn.w) - 26; if (d < bd) { bd = d; best = wn; } }
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
      castle.classList.add('is-lit', 'is-party');
      return 300;
    };
    st.layout(layout);
    st.hint({ type: 'tap', at: at(WINDOWS[6]) });
  }
};
