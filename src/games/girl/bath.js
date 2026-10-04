/* 2 - Kylvetä koiranpentu! A muddy puppy sits in a pink tub. 1) Soap: touch anywhere, the soap jumps under the
   finger; rubbing a mud splat turns it into foam. 2) Shower: tap the shower (any tap works) and water rinses the
   foam away. 3) Towel: rub the wet spots dry, they turn fluffy and sparkly. Goal 9 = 4 soap + 1 rinse + 4 dry. */
import { INK, C, G, HL, SH, svg, el, put, sfx, dist, makeStage, heartD, sparkD, pick, WORDS } from './kit.js';

const SPOTS = [{ x: 114, y: 78 }, { x: 196, y: 134 }, { x: 116, y: 204 }, { x: 186, y: 202 }];
const RUB_PX = 165; /* rubbing needed per spot, in screen px */
const REACH = 78;
const LINE = (c, w) => ' fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
const bubble = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#gg-bub)"/>' +
  '<circle cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.38) + '" r="' + (r * 0.22) + '" fill="#fff"/>';

function eye(x, y) {
  return '<g class="gd-eye"><ellipse cx="' + x + '" cy="' + y + '" rx="11" ry="13" fill="' + INK + '"/><circle cx="' + (x - 4) + '" cy="' + (y - 5) + '" r="4.5" fill="#fff"/>' +
    '<circle cx="' + (x + 4) + '" cy="' + (y + 5) + '" r="2" fill="#fff"/></g>' +
    '<path class="gd-joy" d="M' + (x - 12) + ' ' + (y + 3) + 'Q' + x + ' ' + (y - 14) + ' ' + (x + 12) + ' ' + (y + 3) + '"' + LINE(INK, 5) + '/>';
}
function spotLayers(s, i) {
  const mud = '<path d="M-24 -6Q-26 -24 -6 -24Q4 -34 18 -22Q30 -16 26 0Q34 14 18 22Q8 32 -6 24Q-26 26 -26 10Q-34 2 -24 -6Z" fill="' + G('mud') + '"/>' +
    '<circle cx="34" cy="-18" r="5" fill="' + G('mud') + '"/><circle cx="-34" cy="18" r="4" fill="' + G('mud') + '"/>' + HL(-8, -10, 9, 5, -20);
  const foam = '<ellipse cx="0" cy="16" rx="34" ry="10" fill="url(#gg-sh)"/>' +
    [[-12, -6, 15], [10, -12, 13], [16, 8, 14], [-6, 12, 13], [-24, 8, 9], [28, -6, 8], [2, -2, 10]].map((c) => bubble(c[0], c[1], c[2])).join('');
  const wet = '<path d="M-14 -4q4 10 0 18M0 -10q4 12 0 22M14 -4q4 10 0 18"' + LINE('#8FB4E6', 3.5) + ' opacity=".7"/>' +
    '<path d="M-20 14Q-20 25 -14 25Q-8 25 -8 14L-14 2Z" fill="' + G('water') + '"/><path d="M16 18Q16 29 22 29Q28 29 28 18L22 6Z" fill="' + G('water') + '"/>';
  const fluff = '<path d="' + sparkD(-14, -12, 13) + '" fill="' + G('gold') + '"/><path d="' + sparkD(18, 8, 9) + '" fill="#fff"/>' +
    '<path d="' + heartD(0, 16, 7) + '" fill="' + G('coral') + '"/>';
  return '<g class="gd-spot" data-i="' + i + '" transform="translate(' + s.x + ' ' + s.y + ')">' +
    '<g class="gd-mud">' + mud + '</g><g class="gd-foam">' + foam + '</g><g class="gd-wet">' + wet + '</g><g class="gd-fluff">' + fluff + '</g></g>';
}
function puppySVG() {
  return svg('0 0 300 310',
    SH(150, 304, 140, 12) +
    '<ellipse cx="150" cy="230" rx="138" ry="24" fill="' + G('berry') + '"/>' +
    '<ellipse cx="150" cy="236" rx="124" ry="14" fill="' + G('water') + '"/>' +
    '<g class="gd-tail"><path d="M220 196Q262 170 254 140"' + LINE('#F6D6B4', 14) + '/></g>' +
    '<ellipse cx="150" cy="218" rx="78" ry="58" fill="' + G('fur') + '"/>' + HL(130, 186, 34, 12, -10) +
    '<g class="gd-head">' +
    '<ellipse cx="80" cy="128" rx="24" ry="48" transform="rotate(18 80 128)" fill="' + G('ear') + '"/>' +
    '<ellipse cx="220" cy="128" rx="24" ry="48" transform="rotate(-18 220 128)" fill="' + G('ear') + '"/>' +
    '<ellipse cx="150" cy="182" rx="56" ry="12" fill="url(#gg-sh)"/>' +
    '<circle cx="150" cy="114" r="72" fill="' + G('fur') + '"/>' + HL(122, 70, 34, 16, -18) +
    '<ellipse cx="178" cy="106" rx="25" ry="23" fill="#F4CDA6"/>' +
    '<ellipse cx="150" cy="150" rx="40" ry="28" fill="' + G('white') + '"/>' +
    eye(124, 108) + eye(178, 108) +
    '<ellipse cx="102" cy="140" rx="14" ry="9" fill="url(#gg-blush)"/><ellipse cx="198" cy="140" rx="14" ry="9" fill="url(#gg-blush)"/>' +
    '<ellipse cx="150" cy="138" rx="14" ry="10" fill="' + INK + '"/><ellipse cx="146" cy="134" rx="5" ry="3" fill="#fff" opacity=".8"/>' +
    '<path d="M150 148v8M136 156q14 12 28 0"' + LINE(INK, 3) + '/>' +
    '<path d="M142 160Q142 178 150 178Q158 178 158 160Z" fill="' + G('coral') + '"/>' +
    '</g>' +
    SPOTS.map(spotLayers).join('') +
    '<ellipse cx="102" cy="240" rx="22" ry="14" fill="' + G('fur') + '"/><ellipse cx="198" cy="240" rx="22" ry="14" fill="' + G('fur') + '"/>' +
    '<path d="M94 236v8M102 234v10M110 236v8M190 236v8M198 234v10M206 236v8"' + LINE('#D9B08A', 2.5) + '/>' +
    /* tub front */
    '<path d="M14 232Q150 258 286 232L268 290Q150 316 32 290Z" fill="' + G('coral') + '"/>' + HL(90, 262, 50, 8, 4) +
    '<path d="M12 236Q150 266 288 236"' + LINE('#E4607F', 8) + ' opacity=".5"/>' +
    '<path d="M10 230Q150 258 290 230"' + LINE('#fff', 12) + '/>' +
    '<path d="' + heartD(150, 280, 11) + '" fill="#fff" opacity=".9"/>' +
    '<circle cx="54" cy="300" r="10" fill="' + G('gold') + '"/><circle cx="246" cy="300" r="10" fill="' + G('gold') + '"/>' +
    [[30, 220, 11], [52, 210, 7], [264, 218, 10], [246, 208, 6], [278, 204, 5]].map((b) => bubble(b[0], b[1], b[2])).join(''));
}
const SOAP = svg('0 0 110 80',
  '<rect x="8" y="24" width="94" height="48" rx="22" fill="' + G('plum') + '"/>' +
  '<rect x="8" y="16" width="94" height="46" rx="22" fill="' + G('lav') + '"/>' + HL(40, 24, 24, 5) +
  '<path d="' + heartD(55, 40, 11) + '" fill="#fff" opacity=".9"/>' +
  bubble(24, 12, 9) + bubble(40, 6, 6) + bubble(88, 10, 7));
const TOWEL = svg('0 0 130 100',
  '<path d="M10 20Q65 4 120 20L114 88Q65 100 16 88Z" fill="' + G('mint') + '"/>' +
  '<path d="M14 34Q65 20 118 34M16 74Q65 88 114 74"' + LINE('#fff', 7) + ' opacity=".85"/>' +
  '<path d="M14 34Q65 20 118 34M16 74Q65 88 114 74"' + LINE(C.rose, 3) + '/>' +
  '<path d="' + heartD(65, 54, 10) + '" fill="' + G('rose') + '"/>' + HL(40, 24, 22, 5, -6));
const SHOWER = svg('0 0 130 120',
  '<path d="M126 6Q86 6 80 30"' + LINE('#CFC6EE', 9) + '/>' +
  '<path d="M30 44Q54 12 98 30L104 46Q60 40 38 76Z" fill="' + G('gold') + '"/>' +
  '<ellipse cx="44" cy="76" rx="40" ry="18" transform="rotate(-28 44 76)" fill="' + G('gold') + '"/>' +
  '<ellipse cx="44" cy="76" rx="30" ry="11" transform="rotate(-28 44 76)" fill="#FFF8EA"/>' + HL(60, 30, 18, 5, -20) +
  [[-14, -2], [-4, 3], [8, 0], [18, -5], [-8, -8], [6, -10]].map((d) => '<circle cx="' + (44 + d[0]) + '" cy="' + (76 + d[1]) + '" r="2.4" fill="' + C.lav + '"/>').join(''));

export default {
  id: 'girl-bath',
  title: 'Kylvetä koiranpentu!',
  goal: 9,
  start(S) {
    const st = makeStage(S, { cls: 'bath', P: [380, 560], L: [720, 340] });
    S.autoFinish = false; /* the happy fluffy puppy shows before the finale */
    const floor = st.add(el('div', 'gg-floor gd-floor'));
    const pup = st.add(el('div', 'gd-pup', puppySVG()));
    pup.setAttribute('data-gg', 'puppy');
    const water = st.add(el('div', 'gd-water', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>'));
    const shower = st.add(el('div', 'gd-shower', SHOWER));
    shower.setAttribute('data-gg', 'shower');
    const soap = st.add(el('div', 'gg-tool gd-soap', SOAP));
    const towel = st.add(el('div', 'gg-tool gd-towel is-away', TOWEL));
    soap.setAttribute('data-gg', 'soap');
    towel.setAttribute('data-gg', 'towel');
    const spots = SPOTS.map((s, i) => ({ i, s, p: 0, q: 0, g: pup.querySelector('.gd-spot[data-i="' + i + '"]') }));
    const box = { x: 0, y: 0, s: 1 };
    let phase = 'soap', active = false, last = null, lastSnd = 0, rest = {}, showerAt = { x: 0, y: 0 };

    const tool = () => (phase === 'towel' ? towel : soap);
    const TW = { soap: [110, 80], towel: [130, 100] };
    function spotPos(sp) { return { x: box.x + sp.s.x * box.s, y: box.y + sp.s.y * box.s }; }
    /* the tool rests at its centre; while rubbing it sits just above the finger, so the spot under it stays visible */
    function placeTool(t, x, y) { const d = t === towel ? TW.towel : TW.soap; put(t, x - d[0] / 2, y - d[1] * (active ? 0.92 : 0.5)); }
    function layout() {
      const w = st.w, h = st.h;
      let bw;
      if (st.land) bw = Math.min((h - 14) * 300 / 310, w * 0.55);
      else bw = Math.min(w - 20, (h - 170) * 300 / 310, 460);
      box.s = bw / 300;
      const bh = 310 * box.s;
      box.x = st.land ? Math.max(8, w * 0.42 - bw / 2) : (w - bw) / 2;
      box.y = st.land ? h - bh - 6 : Math.max(96, (h - bh) * 0.55);
      put(pup, box.x, box.y, bw, bh);
      const fy = box.y + 270 * box.s;
      put(floor, 0, fy, w, Math.max(0, h - fy));
      const sw = 120;
      const sx = st.land ? Math.min(w - sw - 6, box.x + bw * 0.78) : Math.min(w - sw - 4, box.x + bw * 0.62);
      const sy = st.land ? 4 : Math.max(4, box.y - sw * 0.9);
      put(shower, sx, sy, sw, sw * 120 / 130);
      showerAt = { x: sx + sw * 0.4, y: sy + sw * 0.55 };
      put(water, box.x + bw * 0.2, sy + sw * 0.62, bw * 0.6, Math.max(40, box.y + 230 * box.s - (sy + sw * 0.62)));
      rest = st.land ? { x: Math.min(w - 75, box.x + bw + 90), y: h * 0.62 } : { x: w * 0.5, y: Math.min(h - 50, box.y + bh + 50) };
      if (!active) { placeTool(soap, rest.x, rest.y); placeTool(towel, rest.x, rest.y); }
    }

    function nearest(p, key) {
      let best = null, bd = REACH * box.s;
      for (const sp of spots) {
        if (sp[key] >= 1) continue;
        const d = dist(p, spotPos(sp));
        if (d < bd) { bd = d; best = sp; }
      }
      return best;
    }
    function rubAt(p, d) {
      const key = phase === 'soap' ? 'p' : 'q';
      const sp = nearest(p, key);
      if (!sp) return;
      sp[key] = Math.min(1, sp[key] + d * st.k / RUB_PX);
      sp.g.style.setProperty(phase === 'soap' ? '--p' : '--q', sp[key].toFixed(3));
      const t = performance.now();
      if (t - lastSnd > 210) { lastSnd = t; sfx(phase === 'soap' ? 'plop' : 'tap'); }
      if (sp[key] >= 1) spotDone(sp);
    }
    function spotDone(sp) {
      const c = spotPos(sp);
      sp.g.classList.add(phase === 'soap' ? 'is-foam' : 'is-fluff');
      st.sparks(c.x, c.y, 6);
      sfx('sparkle');
      const key = phase === 'soap' ? 'p' : 'q';
      const left = spots.filter((q) => q[key] < 1).length;
      S.point();
      if (!left && phase === 'towel') S.later(() => S.finish(), 1000);
      if (left) return;
      if (phase === 'soap') {
        phase = 'wait';
        st.praise(box.x + 150 * box.s, box.y + 10 * box.s, 'Kuplia!');
        S.later(() => { if (!S.active()) return; phase = 'rinse'; soap.classList.add('is-away'); shower.classList.add('is-ready'); st.hint({ type: 'tap', at: showerAt }); }, 350);
      } else {
        phase = 'end';
        towel.classList.add('is-away');
        pup.classList.add('is-happy');
        st.hearts(box.x + 150 * box.s, box.y + 40 * box.s, 3);
        sfx('success');
      }
    }
    function rinse() {
      phase = 'rinsing';
      shower.classList.remove('is-ready');
      shower.classList.add('is-on');
      S.bump(shower);
      water.classList.add('is-on');
      pup.classList.add('is-rinse');
      sfx('whoosh');
      S.later(() => sfx('sparkle'), 500);
      S.later(() => {
        if (!S.active()) return;
        pup.classList.add('is-wet');
        st.praise(box.x + 150 * box.s, box.y + 10 * box.s, pick(WORDS));
        S.point();
      }, 1000);
      S.later(() => {
        if (!S.active()) return;
        shower.classList.remove('is-on');
        water.classList.remove('is-on');
        phase = 'towel';
        towel.classList.remove('is-away');
        const sp = spots[0];
        st.hint({ type: 'rub', at: spotPos(sp) });
      }, 1500);
    }

    st.onDown((p) => {
      if (!S.active()) return false;
      if (phase === 'rinse') { rinse(); return true; }
      if (phase !== 'soap' && phase !== 'towel') return false;
      if (active) return true;
      active = true; last = p;
      const t = tool();
      t.classList.add('is-down');
      placeTool(t, p.x, p.y);
      sfx('tap');
      rubAt(p, 8 * box.s);
      return true;
    });
    st.onMove((p) => {
      if (!active || (phase !== 'soap' && phase !== 'towel')) return;
      const d = dist(p, last);
      last = p;
      placeTool(tool(), p.x, p.y);
      if (d > 0) rubAt(p, d);
    });
    st.onUp(() => {
      if (!active) return;
      active = false;
      soap.classList.remove('is-down');
      towel.classList.remove('is-down');
      placeTool(soap, rest.x, rest.y);
      placeTool(towel, rest.x, rest.y);
    });
    st.idle(() => {
      if (phase === 'rinse') return { type: 'tap', at: showerAt };
      const key = phase === 'soap' ? 'p' : (phase === 'towel' ? 'q' : null);
      const sp = key && spots.find((q) => q[key] < 1);
      return sp ? { type: 'rub', at: spotPos(sp) } : null;
    }, 2400);
    S.fillRest = function () {
      spots.forEach((sp) => { sp.g.style.setProperty('--p', '1'); sp.g.style.setProperty('--q', '1'); sp.g.classList.add('is-foam', 'is-fluff'); });
      pup.classList.add('is-wet', 'is-happy');
      soap.classList.add('is-away'); towel.classList.add('is-away');
      return 300;
    };
    st.layout(layout);
    st.hint({ type: 'rub', at: spotPos(spots[0]) });
  }
};
