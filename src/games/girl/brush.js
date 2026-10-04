/* 0 - Harjaa hevosen harja! A friendly pony with a tangled mane (5 locks) and tail (2 locks). Touch anywhere: the
   brush jumps under the finger at once; rubbing smooths the nearest tangled lock (it turns shiny bit by bit while
   you brush, then sparkles). Then three treats appear: tap two of them (tiara on the head, flower in the mane, bow
   on the tail); the pony neighs happily ("Ihahaa!") and the game is done. Goal 9 = 7 locks + 2 treats. */
import { INK, C, G, HL, SH, svg, el, put, sfx, dist, makeStage, heartD, starD, pick, WORDS } from './kit.js';

const LOCKS = [ /* lock anchor (pony box units 420 x 380) + angle */
  { x: 182, y: 78, a: -18 }, { x: 204, y: 112, a: -4 }, { x: 220, y: 146, a: 8 }, { x: 238, y: 176, a: 18 }, { x: 262, y: 202, a: 30 },
  { x: 366, y: 230, a: 66 }, { x: 374, y: 282, a: 92 }]; /* the last two = tail */
const LOCK_COLORS = ['coral', 'lav', 'rose', 'lav', 'coral', 'lav', 'rose'];
const TREAT_AT = { /* each treat has its own spot, so any two never overlap */
  tiara: { head: true, t: 'translate(100 54) rotate(-14) scale(.56) translate(-60 -40)' },
  flower: { head: true, t: 'translate(186 70) scale(.5) translate(-50 -50)' },
  bow: { head: false, t: 'translate(364 224) rotate(24) scale(.62) translate(-50 -40)' } };
const PICKS = 2;
const RUB_PX = 250; /* brushing needed per lock, in screen px (same effort on phone and tablet) */
const REACH = 92;  /* a rub within this distance of a lock brushes it */
const LINE = (c, w) => ' fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
const NECK = '<path d="M160 262C140 214 128 170 118 126L196 98C204 146 224 186 262 206C230 236 196 262 160 262Z"/>';

function smoothLock(color) {
  return '<path d="M-24 -22C14 -42 62 -20 58 26C50 12 36 8 25 13C32 25 29 38 18 47C12 28 -4 22 -24 24Z" fill="' + G(color) + '"/>' +
    '<path d="M-8 -18C14 -26 36 -14 42 4"' + LINE('#fff', 5) + ' opacity=".75"/>' +
    '<path d="M-14 6C2 4 14 12 18 26"' + LINE('#fff', 3) + ' opacity=".45"/>';
}
/* tangled = a soft lilac clump of curls (no dark scribbles) */
function tangledLock() {
  const curl = (x, y, r, rot) => '<path d="M' + (x - r) + ' ' + y + 'a' + r + ' ' + r + ' 0 1 1 ' + (r * 1.4) + ' ' + (r * 0.9) +
    'a' + (r * 0.6) + ' ' + (r * 0.6) + ' 0 1 1 ' + (-r * 0.9) + ' ' + (-r * 0.8) + '" transform="rotate(' + rot + ' ' + x + ' ' + y + ')"/>';
  return '<g><circle cx="-6" cy="-6" r="20" fill="' + G('wall') + '"/><circle cx="20" cy="-14" r="15" fill="' + G('wall') + '"/>' +
    '<circle cx="34" cy="8" r="17" fill="' + G('wall') + '"/><circle cx="10" cy="20" r="16" fill="' + G('wall') + '"/>' +
    '<circle cx="-16" cy="16" r="12" fill="' + G('wall') + '"/></g>' + HL(-10, -14, 10, 6, -20) + HL(18, -20, 6, 4) +
    '<g' + LINE('#A996F0', 3) + ' opacity=".75">' + curl(-6, -4, 8, 0) + curl(22, -12, 6, 60) + curl(32, 10, 7, 140) +
    curl(8, 20, 7, 200) + curl(-16, 14, 5, 300) + '</g>';
}

function ponySVG() {
  let locks = '';
  LOCKS.forEach((l, i) => {
    locks += '<g class="gp-lock" data-i="' + i + '" transform="translate(' + l.x + ' ' + l.y + ') rotate(' + l.a + ')">' +
      '<g class="gp-tg">' + tangledLock() + '</g><g class="gp-sm">' + smoothLock(LOCK_COLORS[i]) + '</g></g>';
  });
  return svg('0 0 420 380',
    SH(270, 360, 160, 16) +
    /* tail */
    '<path d="M366 214C412 206 426 270 398 340C388 306 372 288 352 260Z" fill="' + G('rose') + '"/>' +
    /* back legs */
    '<rect x="292" y="282" width="34" height="74" rx="16" fill="' + G('snow') + '"/><rect x="334" y="276" width="34" height="78" rx="16" fill="' + G('snow') + '"/>' +
    '<rect x="292" y="334" width="34" height="24" rx="10" fill="' + G('berry') + '"/><rect x="334" y="332" width="34" height="24" rx="10" fill="' + G('berry') + '"/>' +
    /* body + neck: one soft silhouette */
    '<g fill="' + G('white') + '"><ellipse cx="270" cy="256" rx="116" ry="70"/>' + NECK + '</g>' +
    '<path d="M170 286Q270 346 370 276Q356 318 270 326Q196 324 170 286Z" fill="#E7DDFB" opacity=".75"/>' +
    HL(280, 210, 70, 20, -6) +
    '<path d="' + heartD(304, 240, 11) + '" fill="' + G('rose') + '"/><path d="' + heartD(334, 262, 7) + '" fill="' + G('rose') + '"/>' +
    /* front legs */
    '<rect x="178" y="286" width="34" height="72" rx="16" fill="' + G('white') + '"/><rect x="222" y="292" width="34" height="66" rx="16" fill="' + G('white') + '"/>' +
    '<rect x="178" y="336" width="34" height="24" rx="10" fill="' + G('coral') + '"/><rect x="222" y="336" width="34" height="24" rx="10" fill="' + G('coral') + '"/>' +
    /* mane locks */
    '<g class="gp-mane">' + locks + '</g><g class="gp-acc-b"></g>' +
    /* soft shadow under the head */
    '<ellipse cx="150" cy="172" rx="56" ry="20" fill="url(#gg-sh)"/>' +
    /* head (bobs when neighing) */
    '<g class="gp-head">' +
    '<path d="M134 74Q140 40 154 26Q172 44 178 66Z" fill="' + G('white') + '"/><path d="M145 64Q149 46 155 38Q164 50 167 60Z" fill="' + G('rose') + '"/>' +
    '<ellipse cx="112" cy="120" rx="74" ry="60" fill="' + G('white') + '"/>' + HL(98, 84, 38, 16, -12) +
    '<ellipse cx="60" cy="152" rx="48" ry="38" fill="' + G('peach') + '"/>' + HL(52, 132, 18, 8, -10) +
    '<ellipse cx="40" cy="146" rx="5" ry="7" fill="' + INK + '" opacity=".75"/>' +
    '<path class="gp-smile" d="M46 172Q64 184 84 168"' + LINE(INK, 4) + '/>' +
    '<g class="gp-neigh"><path d="M44 166Q64 204 88 164Q66 174 44 166Z" fill="#B8456A"/><ellipse cx="66" cy="182" rx="10" ry="5" fill="' + C.coral + '"/></g>' +
    '<ellipse cx="102" cy="148" rx="15" ry="10" fill="url(#gg-blush)"/>' +
    '<g class="gp-eye"><ellipse cx="118" cy="108" rx="14" ry="17" fill="' + INK + '"/>' +
    '<circle cx="112" cy="101" r="6" fill="#fff"/><circle cx="123" cy="115" r="2.6" fill="#fff"/>' +
    '<path d="M104 90l-7 -8M113 86l-3 -10M124 87l3 -9"' + LINE(INK, 3.5) + '/></g>' +
    '<path class="gp-joy" d="M102 112Q118 92 134 112"' + LINE(INK, 5) + '/>' +
    /* forelock (always smooth) */
    '<g transform="translate(136 70) scale(-0.72 0.72) rotate(-30)">' + smoothLock('lav') + '</g>' +
    '<g class="gp-acc"></g>' +
    '</g>');
}

function brushSVG() {
  return svg('0 0 150 80',
    '<rect x="84" y="15" width="62" height="20" rx="10" fill="' + G('lav') + '"/>' +
    '<path d="' + heartD(118, 25, 5) + '" fill="#fff" opacity=".9"/>' +
    '<g' + LINE('#E9DFF5', 4) + '>' + [14, 24, 34, 44, 54, 64, 74].map((x) => '<path d="M' + x + ' 38V' + (58 + (x % 20 ? 0 : 3)) + '"/>').join('') + '</g>' +
    '<rect x="4" y="8" width="86" height="32" rx="16" fill="' + G('coral') + '"/>' + HL(36, 16, 26, 5));
}
const BRUSH = { w: 150, h: 80, hx: 44, hy: 62 }; /* hot spot = bristle tips under the finger */

const TREATS = [
  { id: 'bow', label: 'Rusetti', art: () => svg('0 0 100 80',
    '<path d="M50 40Q22 4 10 18Q2 40 10 62Q22 76 50 40Z" fill="' + G('coral') + '"/><path d="M50 40Q78 4 90 18Q98 40 90 62Q78 76 50 40Z" fill="' + G('coral') + '"/>' +
    HL(22, 28, 9, 6, -30) + HL(78, 28, 9, 6, 30) +
    '<rect x="38" y="27" width="24" height="26" rx="10" fill="' + G('rose') + '"/>') },
  { id: 'flower', label: 'Kukka', art: () => svg('0 0 100 100',
    [0, 72, 144, 216, 288].map((a) => '<ellipse cx="50" cy="24" rx="17" ry="22" transform="rotate(' + a + ' 50 50)" fill="' + G('rose') + '"/>').join('') +
    '<circle cx="50" cy="50" r="17" fill="' + G('gold') + '"/>' + HL(45, 44, 7, 4)) },
  { id: 'tiara', label: 'Tiara', art: () => svg('0 0 120 80',
    '<path d="M12 64Q10 40 16 24Q28 40 38 44Q48 24 60 8Q72 24 82 44Q92 40 104 24Q110 40 108 64Z" fill="' + G('gold') + '"/>' +
    '<rect x="8" y="58" width="104" height="16" rx="8" fill="' + G('gold') + '"/>' + HL(40, 62, 24, 3) +
    '<circle cx="60" cy="42" r="10" fill="' + G('mint') + '"/><circle cx="30" cy="56" r="6" fill="' + G('coral') + '"/><circle cx="90" cy="56" r="6" fill="' + G('coral') + '"/>' +
    HL(57, 38, 4, 3) + '<circle cx="60" cy="8" r="6" fill="#fff"/>') }
];

export default {
  id: 'girl-brush',
  title: 'Harjaa hevosen harja!',
  goal: LOCKS.length + PICKS,
  start(S) {
    const st = makeStage(S, { cls: 'brush', P: [400, 560], L: [720, 340] });
    const floor = st.add(el('div', 'gg-floor'));
    const pony = st.add(el('div', 'gp-pony', ponySVG()));
    pony.setAttribute('data-gg', 'pony');
    const brush = st.add(el('div', 'gg-tool gp-brush', brushSVG()));
    brush.setAttribute('data-gg', 'brush');
    const tray = st.add(el('div', 'gp-treats'));
    const locks = LOCKS.map((l, i) => ({ i, l, p: 0, done: false, g: pony.querySelector('.gp-lock[data-i="' + i + '"]') }));
    const box = { x: 0, y: 0, s: 1 };
    let phase = 'brush', active = null, last = null, lastSnd = 0, rest = { x: 0, y: 0 }, tilt = 0, picks = 0;
    const treats = [];
    S.autoFinish = false; /* the last treat plays a short neigh before the finale */

    function lockPos(lk) { return { x: box.x + (lk.l.x + 14) * box.s, y: box.y + (lk.l.y + 6) * box.s }; }
    function placeBrush(x, y) { put(brush, x - BRUSH.hx, y - BRUSH.hy); brush.style.setProperty('--tilt', tilt.toFixed(1) + 'deg'); }
    function layout() {
      const w = st.w, h = st.h;
      let pw;
      if (st.land) pw = Math.min(w * 0.62, (h - 16) * 420 / 380);
      else pw = Math.min(w - 30, (h - 200) * 420 / 380, 520); /* room for the tail locks */
      box.s = pw / 420;
      const ph = 380 * box.s;
      box.x = st.land ? Math.max(6, w * 0.4 - pw / 2) : (w - pw) / 2;
      box.y = st.land ? (h - ph) / 2 : Math.max(8, (h - ph) * 0.42);
      put(pony, box.x, box.y, pw, ph);
      const fy = box.y + 352 * box.s;
      put(floor, 0, fy, w, Math.max(0, h - fy));
      rest = st.land ? { x: Math.min(w - 116, box.x + pw + 90), y: h * 0.45 } : { x: w * 0.5 - 20, y: Math.min(h - 30, box.y + ph + 70) };
      if (!active) placeBrush(rest.x, rest.y);
      /* treats: a row under the pony (portrait) or a column on the right (landscape) */
      const tw = 104;
      treats.forEach((t, i) => {
        const x = st.land ? Math.min(w - tw - 8, box.x + pw + 30) : w / 2 + (i - 1) * (tw + 14) - tw / 2;
        const y = st.land ? h / 2 + (i - 1) * (tw + 6) - tw / 2 : box.y + ph + 24;
        t.cx = x + tw / 2; t.cy = y + tw / 2;
        put(t.el, x, y, tw, tw);
      });
    }

    function nearestLock(p) {
      let best = null, bd = REACH * box.s;
      for (const lk of locks) {
        if (lk.done) continue;
        const d = dist(p, lockPos(lk));
        if (d < bd) { bd = d; best = lk; }
      }
      return best;
    }
    function brushAt(p, d) {
      const lk = nearestLock(p);
      if (!lk) return;
      lk.p = Math.min(1, lk.p + d * st.k / RUB_PX);
      lk.g.style.setProperty('--p', lk.p.toFixed(3));
      lk.g.classList.add('is-brushing');
      const t = performance.now();
      if (t - lastSnd > 200) { lastSnd = t; sfx('tap'); }
      if (lk.p >= 1) smooth(lk);
    }
    function smooth(lk) {
      lk.done = true;
      lk.g.style.setProperty('--p', '1');
      lk.g.classList.remove('is-brushing');
      lk.g.classList.add('is-done');
      const c = lockPos(lk);
      st.sparks(c.x, c.y, 7);
      sfx('sparkle');
      sfx('ding', lk.i);
      const left = locks.filter((q) => !q.done).length;
      if (left === 2) st.praise(box.x + 300 * box.s, box.y + 20 * box.s, pick(WORDS)); /* above the back, not over the mane */
      if (lk.i === 4) st.praise(box.x + 300 * box.s, box.y + 20 * box.s, 'Nyt häntä!');
      S.point();
      if (!left) S.later(showTreats, 380);
    }
    function showTreats() {
      if (!S.active()) return;
      phase = 'treat';
      brush.classList.add('is-away');
      pony.classList.add('is-shiny');
      st.praise(box.x + 280 * box.s, box.y + 40 * box.s, 'Hienoa!');
      TREATS.forEach((d, i) => {
        const b = el('div', 'gp-treat', '<span class="gp-tin">' + d.art() + '</span>');
        b.setAttribute('data-gg', 'treat');
        b.style.animationDelay = (i * 70) + 'ms';
        tray.appendChild(b);
        treats.push({ d, el: b, cx: 0, cy: 0 });
      });
      layout();
      st.hint({ type: 'tap', at: { x: treats[1].cx, y: treats[1].cy } });
    }
    function liveTreats() { return treats.filter((q) => !q.used); }
    function giveTreat(t) {
      t.used = true;
      picks++;
      t.el.classList.add('is-picked');
      const at = TREAT_AT[t.d.id];
      const acc = pony.querySelector(at.head ? '.gp-acc' : '.gp-acc-b');
      acc.insertAdjacentHTML('beforeend', '<g transform="' + at.t + '"><g class="gp-accin">' + t.d.art().replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g></g>');
      sfx('pop');
      const m = at.t.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
      st.sparks(box.x + (+m[1]) * box.s, box.y + (+m[2]) * box.s, 9);
      S.point();
      if (picks < PICKS) {
        const n = liveTreats();
        st.hint({ type: 'tap', at: { x: n[0].cx, y: n[0].cy } });
        return;
      }
      phase = 'end';
      treats.forEach((q) => { if (!q.used) q.el.classList.add('is-gone'); });
      pony.classList.add('is-neigh');
      sfx('success');
      const hx = box.x + 120 * box.s, hy = box.y + 50 * box.s;
      st.hearts(box.x + 210 * box.s, box.y + 60 * box.s, 3);
      st.praise(Math.max(80, hx - 50 * box.s), Math.max(30, hy - 50 * box.s), 'Ihahaa!', 44);
      S.later(() => S.finish(), 1100); /* let the child see the happy pony before the finale */
    }

    st.onDown((p) => {
      if (!S.active()) return false;
      if (phase === 'treat') {
        /* the nearest unused treat (a tap beside them still counts: never fail) */
        const best = liveTreats().sort((a, b) => dist(p, { x: a.cx, y: a.cy }) - dist(p, { x: b.cx, y: b.cy }))[0];
        if (best) giveTreat(best);
        return true;
      }
      if (phase !== 'brush' || active != null) return false;
      active = true; last = p; tilt = 0;
      brush.classList.add('is-down');
      placeBrush(p.x, p.y);
      sfx('tap');
      brushAt(p, 6 * box.s);
      return true;
    });
    st.onMove((p) => {
      if (!active || phase !== 'brush') return;
      const d = dist(p, last);
      tilt = Math.max(-14, Math.min(14, tilt * 0.6 + (p.x - last.x) * 0.9));
      placeBrush(p.x, p.y);
      last = p;
      if (d > 0) brushAt(p, d);
    });
    st.onUp(() => {
      if (!active) return;
      active = null; tilt = 0;
      brush.classList.remove('is-down');
      locks.forEach((lk) => lk.g.classList.remove('is-brushing'));
      if (phase === 'brush') placeBrush(rest.x, rest.y);
    });
    st.idle(() => {
      if (phase === 'brush') {
        const lk = locks.find((q) => !q.done);
        return lk ? { type: 'rub', at: lockPos(lk) } : null;
      }
      const n = phase === 'treat' ? liveTreats() : [];
      if (n.length) { const t = n[(n.length - 1) >> 1]; return { type: 'tap', at: { x: t.cx, y: t.cy } }; }
      return null;
    }, 2400);
    S.fillRest = function () {
      locks.forEach((lk) => { if (!lk.done) { lk.done = true; lk.g.style.setProperty('--p', '1'); lk.g.classList.add('is-done'); } });
      pony.classList.add('is-shiny', 'is-neigh');
      return 300;
    };
    st.layout(layout);
    st.hint({ type: 'rub', at: lockPos(locks[0]) });
  }
};
