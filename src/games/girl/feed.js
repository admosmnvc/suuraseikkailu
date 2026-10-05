/* 1 - Ruoki eläimet! A bunny, a pony and a kitten each think of a treat (thought bubble). The treats wait in a
   tray: drag one to the animal that wants it (or just tap it: it hops there by itself). The animal munches
   happily with hearts. A treat dropped on the wrong animal bounces back with a giggle wiggle (never a fail).
   Two rounds: carrot / apple / fish, then strawberry / hay / milk. Goal 6. */
import { el, put, sfx, dist, makeStage, pick, WORDS } from './kit.js';
import { bunny, kitten, ponyBust, FOODS, thought } from './animals.js';

const ANIMALS = [
  { id: 'bunny', art: bunny, mouth: { x: 80, y: 122 }, wants: ['carrot', 'strawberry'] },
  { id: 'pony', art: ponyBust, mouth: { x: 38, y: 124 }, wants: ['apple', 'hay'] },
  { id: 'kitten', art: kitten, mouth: { x: 80, y: 120 }, wants: ['fish', 'milk'] }
];
const ROUNDS = 2;

export default {
  id: 'girl-feed',
  title: 'Ruoki eläimet!',
  goal: 6,
  start(S) {
    const st = makeStage(S, { cls: 'feed', P: [380, 580], L: [720, 340] });
    S.autoFinish = false; /* the last munch plays before the finale */
    const ground = st.add(el('div', 'gg-floor gf-ground'));
    const animals = ANIMALS.map((d, i) => {
      const a = { d, i, el: st.add(el('div', 'gf-animal', '<div class="gf-body">' + d.art() + '</div>')),
        bub: st.add(el('div', 'gf-bubble', thought() + '<div class="gf-wish"></div>')), want: null, x: 0, y: 0, s: 0 };
      a.el.setAttribute('data-gg', 'animal');
      a.el.dataset.id = d.id;
      return a;
    });
    let foods = [], round = 0, fed = 0, held = null, lay = { F: 96, A: 150 };

    function mouthOf(a) { return { x: a.x + a.d.mouth.x / 160 * a.s, y: a.y + a.d.mouth.y / 170 * a.s * 170 / 160 }; }
    function centerOf(a) { return { x: a.x + a.s / 2, y: a.y + a.s * 0.55 }; }
    function layout() {
      const w = st.w, h = st.h;
      if (st.land) {
        const cell = w * 0.76 / 3;
        lay.A = Math.min(cell - 10, h * 0.48, 190);
        lay.F = Math.min(96, (h - 40) / 3.3);
        const ay = h - lay.A * 1.24 - 4;
        animals.forEach((a, i) => { a.s = lay.A; a.x = cell * i + (cell - lay.A) / 2 + 6; a.y = ay + (i === 1 ? lay.A * 0.06 : 0); });
      } else {
        /* portrait: a little V (the pony a bit lower, in front), animals bigger than a third of the width */
        const cell = w / 3;
        lay.A = Math.min(cell * 1.16, 172);
        lay.F = Math.min(100, w / 3 - 26);
        const ay = Math.min(h * 0.4, h - lay.F - 90 - lay.A * 1.3);
        animals.forEach((a, i) => {
          a.s = lay.A;
          a.x = Math.max(-lay.A * 0.06, Math.min(w - lay.A * 0.94, cell * i + (cell - lay.A) / 2));
          a.y = Math.max(lay.A * 0.95, ay) + (i === 1 ? lay.A * 0.22 : 0);
        });
      }
      const B = Math.min(lay.A * 0.8, 130);
      animals.forEach((a) => {
        put(a.el, a.x, a.y, a.s, a.s * 170 / 160);
        a.bx = a.x + a.s * 0.5 - B * 0.42; a.by = a.y - B * 0.86;
        put(a.bub, a.bx, a.by, B, B * 110 / 120);
        a.wishC = { x: a.bx + B * 0.5, y: a.by + B * 0.36 };
      });
      const gy = animals[0].y + lay.A * 0.96;
      put(ground, 0, gy, w, Math.max(0, h - gy));
      foods.forEach(placeHome);
      foods.forEach((f) => { if (!f.done && f !== held) moveTo(f, f.home.x, f.home.y); });
    }
    function placeHome(f, i) {
      const n = foods.length, F = lay.F, w = st.w, h = st.h;
      const k = foods.indexOf(f);
      if (st.land) f.home = { x: w * 0.88, y: h / 2 + (k - (n - 1) / 2) * (F + 14) };
      else f.home = { x: w / 2 + (k - (n - 1) / 2) * (F + 22), y: h - F / 2 - 22 };
      f.el.style.width = f.el.style.height = F + 'px';
      void i;
    }
    function moveTo(f, x, y) { f.x = x; f.y = y; put(f.el, x - lay.F / 2, y - lay.F / 2); }

    function newRound() {
      if (!S.active()) return;
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      foods.forEach((f) => f.el.remove());
      foods = order.map((ai) => {
        const id = ANIMALS[ai].wants[round];
        const f = { id, el: st.add(el('div', 'gf-food', '<div class="gf-fin">' + FOODS[id]() + '</div>')), done: false, x: 0, y: 0 };
        f.el.setAttribute('data-gg', 'food');
        f.el.dataset.id = id;
        return f;
      });
      animals.forEach((a, i) => {
        a.want = ANIMALS[i].wants[round];
        a.bub.querySelector('.gf-wish').innerHTML = FOODS[a.want]();
        a.bub.classList.remove('is-pop');
        a.bub.classList.add('is-in');
        a.el.classList.remove('is-happy');
      });
      layout();
      foods.forEach((f, i) => { f.el.style.animationDelay = (i * 60) + 'ms'; });
      const f0 = foods[0], a0 = animals.find((a) => a.want === f0.id);
      st.hint({ type: 'drag', at: { x: f0.home.x, y: f0.home.y }, to: mouthOf(a0) });
    }

    function animalAt(p) {
      let best = null, bd = lay.A * 0.72;
      for (const a of animals) { const d = dist(p, centerOf(a)); if (d < bd) { bd = d; best = a; } }
      return best;
    }
    function eat(f, a) {
      f.done = true;
      a.want = null;
      const m = mouthOf(a);
      f.el.classList.remove('is-held');
      f.el.classList.add('is-eaten');
      moveTo(f, m.x, m.y);
      a.bub.classList.remove('is-in');
      a.bub.classList.add('is-pop');
      a.el.classList.remove('is-want', 'is-no', 'is-eat', 'is-happy');
      void a.el.offsetWidth;
      a.el.classList.add('is-eat');
      sfx('plop');
      sfx('ding', fed);
      S.later(() => { a.el.classList.remove('is-eat'); a.el.classList.add('is-happy'); st.hearts(m.x, a.y + 10, 3); sfx('sparkle'); }, 650);
      st.sparks(m.x, m.y, 6);
      st.praise(a.x + a.s * 0.5, a.y - 6, fed === 3 ? pick(WORDS) : 'Nam!', 34);
      fed++;
      if (fed === 1 || fed === 4) st.say(fed === 1 ? 'fx-namnam' : 'fx-yum');
      else if (fed === 6) st.say('fx-yay');
      S.point();
      if (fed === 6) S.later(() => S.finish(), 900);
      if (fed % 3 === 0 && ++round < ROUNDS) S.later(newRound, 900);
    }
    function giggle(f, a) {
      a.el.classList.remove('is-no');
      void a.el.offsetWidth;
      a.el.classList.add('is-no');
      sfx('pop');
      S.later(() => a.el.classList.remove('is-no'), 700);
      goHome(f, true);
    }
    function goHome(f, wiggle) {
      f.el.classList.remove('is-held');
      f.el.classList.add('is-back');
      if (wiggle) f.el.classList.add('is-wiggle');
      moveTo(f, f.home.x, f.home.y);
      S.later(() => f.el.classList.remove('is-back', 'is-wiggle'), 520);
    }

    st.onDown((p) => {
      if (!S.active()) return false;
      if (held) return true;
      let best = null, bd = lay.F * 0.75;
      for (const f of foods) { if (f.done) continue; const d = dist(p, f); if (d < bd) { bd = d; best = f; } }
      if (best) {
        held = best;
        held.t0 = performance.now(); held.p0 = p; held.off = { x: best.x - p.x, y: best.y - p.y };
        best.el.classList.remove('is-back', 'is-wiggle');
        best.el.classList.add('is-held');
        moveTo(best, p.x + held.off.x * 0.4, p.y + held.off.y * 0.4 - 10);
        sfx('tap');
        return true;
      }
      const a = animalAt(p);
      if (a) { S.bump(a.el.querySelector('.gf-body')); sfx('pop'); return true; }
      return false;
    });
    st.onMove((p) => {
      if (!held) return;
      moveTo(held, p.x + held.off.x * 0.4, p.y + held.off.y * 0.4 - 10);
      const a = animalAt(held);
      animals.forEach((q) => q.el.classList.toggle('is-want', q === a && q.want === held.id));
    });
    st.onUp((p) => {
      if (!held) return;
      const f = held;
      held = null;
      animals.forEach((q) => q.el.classList.remove('is-want'));
      const right = animals.find((q) => q.want === f.id);
      const tap = dist(p, f.p0) < 14 && performance.now() - f.t0 < 450;
      if (tap && right) { eat(f, right); return; }
      const a = animalAt(f);
      if (a && a === right) eat(f, a);
      else if (a) giggle(f, a);
      else goHome(f, false);
    });
    st.idle(() => {
      const f = foods.find((q) => !q.done);
      const a = f && animals.find((q) => q.want === f.id);
      return a ? { type: 'drag', at: { x: f.home.x, y: f.home.y }, to: mouthOf(a) } : null;
    }, 2600);
    S.fillRest = function () {
      animals.forEach((a) => { a.bub.classList.add('is-pop'); a.el.classList.add('is-happy'); });
      foods.forEach((f) => f.el.classList.add('is-eaten'));
      return 300;
    };
    S.onComplete = () => animals.forEach((a) => a.el.classList.add('is-happy', 'is-party'));
    st.layout(layout);
    newRound();
  }
};
