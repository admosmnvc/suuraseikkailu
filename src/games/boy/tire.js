/* boy 0 – Vaihda auton renkaat! Car on a jack with a flat front tire. The camera zooms to the wheel:
   tap 4 nuts off (a tap anywhere on the wheel spins the nearest nut off), drag the flat tire away,
   drag the shiny new tire onto the hub, tap 4 nuts back on; zoom out, car drops off the jack and bounces. */
import { carSideSVG, wheelSVG, nutSVG, jackSVG, CAR_COLORS } from './art.js';
import { put, honk, clamp, eyesFollow } from './kit.js';

const ANG = [Math.PI * 1.25, Math.PI * 1.75, Math.PI * 0.25, Math.PI * 0.75]; /* bolt angles: TL, TR, BR, BL */
const RING = 0.18;  /* bolt ring radius / wheel box */
const RAISE = 16;   /* car lift on the jack (stage units) */

export default {
  id: 'tire',
  goal: 10,
  start(S) {
    let phase = 'intro', L = null, nutsOff = 0, nutsOn = 0, outroT = 0;
    const stage = S.el('div', 'bt-stage');
    S.el('div', 'bt-ground', '', stage);
    const jack = S.el('div', 'bt-jack', jackSVG(), stage);
    const car = S.el('div', 'bt-car up', '', stage);
    const inner = S.el('div', 'bt-car-in', '', car);
    S.el('div', 'bt-body', carSideSVG({ color: CAR_COLORS[0], hubs: true }), inner);
    S.el('div', 'bt-wheel bt-rear', wheelSVG('normal', true), inner);
    const deco = S.el('div', 'bt-wheel bt-front', wheelSVG('flat', true), inner);
    const target = S.el('div', 'bt-target');
    target.hidden = true;
    const pile = S.el('div', 'bt-pile');
    pile.hidden = true;
    /* ready from the start in the lower area: the shiny spare tyre and the tray the nuts go into */
    const spare = S.el('div', 'bt-spare', wheelSVG('new', true));
    const tray = S.el('div', 'bt-tray', '<i></i><i></i><i></i><i></i>');
    const trayNuts = Array.from(tray.children);
    trayNuts.forEach((t) => { t.innerHTML = nutSVG(); });
    const tire = S.el('button', 'bt-tire');
    tire.type = 'button';
    tire.setAttribute('aria-label', 'Rengas');
    tire.hidden = true;
    const skin = S.el('div', 'bt-skin', wheelSVG('flat', false), tire);
    const nuts = ANG.map((a) => {
      const n = S.el('div', 'bt-nut', nutSVG(), tire);
      n.style.left = (50 + Math.cos(a) * RING * 100) + '%';
      n.style.top = (50 + Math.sin(a) * RING * 100) + '%';
      n.__on = true;
      return n;
    });

    function layout() {
      const W = S.W, H = S.H, portrait = W < H * 1.1;
      /* portrait: wheel in the upper middle (car's eyes stay in view), spare + nut tray in the lower area */
      const Rt = clamp(Math.min(W * (portrait ? 0.33 : 0.36), H * (portrait ? 0.25 : 0.34)), 78, 190); /* tyre radius px when zoomed */
      const box = Rt / 0.45;                                                        /* wheel box px */
      const s = box / 92;
      const hub = portrait ? { x: W * 0.55, y: H * 0.42 } : { x: W * 0.42, y: H * 0.5 };
      const s0 = Math.min(W * 0.9 / 400, H * 0.62 / 240);
      L = {
        Rt, box, s, hub,
        zoom: { s, x: hub.x - 300 * s, y: hub.y - (182 - RAISE) * s },
        wide: { s: s0, x: (W - 400 * s0) / 2, y: H * 0.52 - 130 * s0 },
        pile: portrait ? { x: W * 0.17, y: H * 0.85 } : { x: W * 0.1, y: H * 0.8 },
        spare: portrait ? { x: W * 0.79, y: H * 0.85 } : { x: W * 0.86, y: H * 0.56 },
        tray: portrait ? { x: W * 0.45, y: H * 0.9 } : { x: W * 0.1, y: H * 0.26 },
        small: portrait ? Math.min(0.55, (H * 0.25) / box) : 0.6,
        pileK: portrait ? 0.42 : 0.5
      };
      L.trayW = portrait ? Math.min(W * 0.26, 140) : Math.min(W * 0.15, 130);
      /* each nut flies from its bolt into its slot in the tray */
      nuts.forEach((n, i) => {
        const q = nutPos(i), t = { x: L.tray.x + (i - 1.5) * L.trayW * 0.22, y: L.tray.y };
        n.style.setProperty('--ox', (t.x - q.x).toFixed(0) + 'px');
        n.style.setProperty('--oy', (t.y - q.y).toFixed(0) + 'px');
      });
    }
    function setStage(view, animate) {
      const v = L[view];
      stage.classList.toggle('zoomt', !!animate && !S.rm);
      stage.style.transform = 'translate(' + v.x.toFixed(1) + 'px,' + v.y.toFixed(1) + 'px) scale(' + v.s.toFixed(4) + ')';
    }
    function placeTire() {
      const at = phase === 'push' ? L.spare : L.hub;
      put(tire, at.x, at.y, L.box, L.box);
      tire.style.scale = phase === 'push' && !tire.classList.contains('is-dragging') ? String(L.small) : '';
      put(target, L.hub.x, L.hub.y, L.Rt * 2.15, L.Rt * 2.15);
      put(pile, L.pile.x, L.pile.y, L.box * L.pileK, L.box * L.pileK);
      put(spare, L.spare.x, L.spare.y, L.box * L.small, L.box * L.small);
      put(tray, L.tray.x, L.tray.y, L.trayW, L.trayW * 0.36);
    }
    function nutPos(i) {
      const a = ANG[i];
      return { x: L.hub.x + Math.cos(a) * RING * L.box, y: L.hub.y + Math.sin(a) * RING * L.box };
    }
    function nearestNut(p, want) {
      let best = -1, bd = Infinity;
      nuts.forEach((n, i) => {
        if (n.__on !== want) return;
        const q = nutPos(i), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    function showHint() {
      if (phase === 'off') { const i = nearestNut({ x: 0, y: 0 }, true); if (i >= 0) S.hint({ type: 'tap', at: nutPos(i) }); }
      else if (phase === 'pull') S.hint({ type: 'drag', at: L.hub, to: L.pile });
      else if (phase === 'push') S.hint({ type: 'drag', at: L.spare, to: L.hub });
      else if (phase === 'on') { const i = nearestNut({ x: 0, y: 0 }, false); if (i >= 0) S.hint({ type: 'tap', at: nutPos(i) }); }
    }

    /* tap on the wheel: nearest nut off / on */
    S.tap(tire, (p) => {
      const at = S.local(p.x, p.y);
      if (phase === 'off') {
        const i = nearestNut(at, true);
        if (i < 0) return;
        const n = nuts[i];
        n.__on = false;
        n.classList.add('off');
        S.later(() => trayNuts[i].classList.add('on'), S.rm ? 60 : 460);
        S.snd('pop');
        S.snd('ding', nutsOff);
        S.bump(skin, 0.25);
        S.burst(nutPos(i), null, 8);
        nutsOff++;
        S.point();
        if (nutsOff === 4) {
          phase = 'pull';
          tire.classList.add('loose');
          pile.hidden = false;
          pile.classList.add('spot'); /* where the old tyre goes */
          S.comic('Irti!', { x: L.hub.x, y: L.hub.y - L.Rt * 1.05 });
          S.later(showHint, 500);
        }
      } else if (phase === 'on') {
        const i = nearestNut(at, false);
        if (i < 0) return;
        const n = nuts[i];
        n.__on = true;
        n.classList.remove('off', 'hole');
        n.classList.add('back');
        trayNuts[i].classList.remove('on');
        S.snd('ding', nutsOn + 2);
        S.snd('tap');
        S.bump(skin, 0.2);
        S.sparkle(nutPos(i));
        nutsOn++;
        S.point();
        if (nutsOn === 4) { phase = 'done'; S.later(outro, 380); }
      }
    });

    S.drag(tire, {
      enabled: () => phase === 'pull' || phase === 'push',
      onStart() {
        tire.classList.remove('loose', 'roll-in');
        if (phase === 'push') { tire.style.scale = '1'; S.snd('tap'); }
        else S.snd('plop');
      },
      onEnd(p) {
        const c = S.local(p.cx, p.cy);
        if (phase === 'pull') {
          if (S.dist(c, L.hub) < L.Rt * 0.5) { tire.classList.add('loose'); return false; }
          phase = 'away';
          S.point();
          S.snd('whoosh');
          const fromHub = { x: c.x - L.hub.x, y: c.y - L.hub.y };
          tire.style.translate = fromHub.x.toFixed(0) + 'px ' + fromHub.y.toFixed(0) + 'px';
          tire.classList.add('to-pile');
          requestAnimationFrame(() => {
            if (S.dead) return;
            tire.style.translate = (L.pile.x - L.hub.x).toFixed(0) + 'px ' + (L.pile.y - L.hub.y).toFixed(0) + 'px';
            tire.style.scale = '0.5';
          });
          S.later(newTire, S.rm ? 120 : 420);
          return true;
        }
        if (phase === 'push') {
          if (S.dist(c, L.hub) > L.Rt * 0.95) { tire.style.scale = String(L.small); return false; }
          phase = 'on';
          S.clearDrag(tire);
          tire.style.scale = '';
          placeTire();
          target.hidden = true;
          tire.classList.add('snap');
          S.snd('pop');
          S.snd('ding', 5);
          S.burst(L.hub, null, 16);
          S.comic('Klik!', { x: L.hub.x, y: L.hub.y - L.Rt * 1.05 });
          nuts.forEach((n) => { n.classList.remove('off', 'back'); n.classList.add('hole'); });
          S.point();
          S.later(showHint, 450);
          return true;
        }
        return false;
      }
    });

    function newTire() {
      if (S.dead) return;
      pile.hidden = false;
      pile.classList.remove('spot');
      pile.innerHTML = wheelSVG('flat', false);
      tire.classList.remove('to-pile', 'loose');
      S.clearDrag(tire);
      skin.innerHTML = wheelSVG('new', true);
      phase = 'push';
      placeTire();
      spare.hidden = true;           /* the waiting spare is now the tyre you drag */
      target.hidden = false;
      tire.classList.add('snap');
      S.snd('pop');
      S.later(showHint, S.rm ? 100 : 300);
      S.progress();
    }

    function outro() {
      if (outroT) return;
      outroT = 1;
      phase = 'done';
      S.hideHint();
      target.hidden = true;
      deco.innerHTML = wheelSVG('new', true);
      tire.hidden = true;
      pile.classList.add('fade');
      tray.classList.add('fade');
      spare.hidden = true;
      setStage('wide', true);
      S.later(() => {
        car.classList.remove('up');
        jack.classList.add('down');
        inner.classList.add('bounce', 'happy');
        honk(S);
        S.snd('boom');
        const r = car.getBoundingClientRect(), a = S.local(r.left + r.width / 2, r.top + r.height * 0.4);
        S.burst(a, null, 24);
        S.later(() => S.finish(), S.rm ? 200 : 500);       /* praise while the happy car bounces */
        S.later(() => { car.classList.add('drive'); S.snd('whoosh'); }, S.rm ? 900 : 1500); /* then off it goes */
      }, S.rm ? 150 : 720);
    }

    S.fillRest = () => { outro(); return 1200; };
    S.resize = () => {
      layout();
      stage.classList.remove('zoomt');
      setStage(phase === 'intro' || outroT ? 'wide' : 'zoom', false);
      placeTire();
    };
    eyesFollow(S, inner);
    S.idleHint(showHint, 2600);
    S.endWait = 1700;
    S.autoFinish = false; /* the outro calls S.finish() */

    layout();
    setStage('wide', false);
    placeTire();
    /* intro: the car on the jack with the flat tire, then the camera zooms in to the wheel */
    S.later(() => { setStage('zoom', true); S.snd('whoosh'); }, 650);
    S.later(() => {
      phase = 'off';
      deco.classList.add('gone');
      tire.hidden = false;
      showHint();
      S.progress();
    }, S.rm ? 700 : 1400);
  }
};
