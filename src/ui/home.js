/* Home screen: greeting, section cards, ice palace progress picture, sticker album, parent button.
   OWNER: ui agent. */
import ART from '../art.js';
import { SFX } from '../audio/sfx.js';
import { reducedMotion } from '../util.js';
import { $, esc, secVars, safe } from './dom.js';

const SILVER = '#DCE7F3';
const HOLD_MS = 800;

let shownLit = null;            /* palace windows lit the last time home was shown (null = first render) */
let shownStickers = null;       /* sticker ids earned the last time home was shown */
let palaceTimers = [];

export function greetingText(name) { return name ? 'Hei, ' + name + '!' : 'Hei!'; }

/* Forget what was shown (after a reset): the next render draws without "new" animations. */
export function forgetShown() { shownLit = null; shownStickers = null; }

function cardHTML(sec, p, done) {
  const N = sec.lines.length;
  let gems = '';
  for (let i = 0; i < N; i++) {
    gems += '<span class="sec-gem' + (i < p ? '' : ' off') + '">' + (i < p ? ART.gem(sec.color) : ART.gem(SILVER)) + '</span>';
  }
  const status = done
    ? '<span class="sec-done">' + ART.icon('check') + 'Valmis!</span>'
    : '<span class="sec-count">' + p + '/' + N + '</span>';
  return '<span class="sec-orb" aria-hidden="true">' + ART.gem(sec.color, 'sec-orb-gem') +
      (done ? '<span class="sec-tiara">' + ART.tiara(sec.color) + '</span>' : '') + '</span>' +
    '<span class="sec-body">' +
      '<span class="sec-row"><span class="sec-name">' + esc(sec.name) + '</span>' +
      '<span class="sec-ar" lang="ar" dir="rtl">' + esc(sec.ar) + '</span></span>' +
      '<span class="sec-sub">' + esc(sec.sub) + '</span>' +
      '<span class="sec-prog" aria-hidden="true"><span class="sec-gems">' + gems + '</span>' + status + '</span>' +
    '</span>';
}

function renderCards(ctx) {
  const box = $('secGrid');
  box.textContent = '';
  ctx.sections.forEach((sec) => {
    const N = sec.lines.length, p = ctx.prog(sec), done = ctx.isDone(sec);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sec-card jelly' + (done ? ' done' : '');
    b.id = 'card-' + sec.id;
    b.dataset.id = sec.id;
    b.setAttribute('aria-label', sec.name + ', ' + sec.sub + ', ' + p + '/' + N + (done ? ', valmis' : ''));
    secVars(b, sec.color);
    b.innerHTML = cardHTML(sec, p, done);
    box.appendChild(b);
  });
}

function renderPalace(ctx) {
  const total = ctx.sections.reduce((n, s) => n + s.lines.length, 0);
  const lit = ctx.sections.reduce((n, s) => n + ctx.prog(s), 0);
  palaceTimers.forEach(clearTimeout);
  palaceTimers = [];
  const from = shownLit === null || shownLit > lit || reducedMotion() ? lit : shownLit;
  const art = $('palaceArt');
  art.innerHTML = ART.palace({ windows: total, lit: from });
  art.setAttribute('aria-label', 'Jääpalatsi: ' + lit + '/' + total + ' ikkunaa loistaa');
  $('palaceCount').textContent = lit >= total ? 'Palatsi loistaa!' : lit + '/' + total;
  /* newly earned windows light up one by one */
  for (let i = from, j = 0; i < lit; i++, j++) {
    palaceTimers.push(setTimeout(() => {
      const w = art.querySelector('.pw[data-i="' + i + '"]');
      if (w) w.classList.add('on');
      safe(() => SFX.ding(i));
    }, 650 + j * 420));
  }
  shownLit = lit;
}

function renderAlbum(ctx) {
  const items = ctx.sections.map((sec) => ({ id: sec.id, name: sec.name, earned: ctx.isDone(sec) }));
  items.push({ id: 'palace', name: 'Palatsi', earned: ctx.sections.length > 0 && ctx.sections.every(ctx.isDone) });
  const before = shownStickers;
  $('album').innerHTML = items.map((it) => {
    const fresh = it.earned && before && !before.has(it.id);
    return '<li class="album-item jelly' + (it.earned ? ' earned' : ' ghost') + (fresh ? ' fresh' : '') + '">' +
      '<span class="album-art" aria-hidden="true">' + ART.sticker(it.id, it.earned) + '</span>' +
      '<span class="album-name">' + esc(it.name) + '<span class="vh">' + (it.earned ? ': tarra ansaittu' : ': tarra vielä ansaitsematta') + '</span></span></li>';
  }).join('');
  const n = items.filter((it) => it.earned).length;
  $('albumCount').textContent = n + '/' + items.length;
  shownStickers = new Set(items.filter((it) => it.earned).map((it) => it.id));
}

/* ctx: { state, sections, prog(sec), isDone(sec) } */
export function renderHome(ctx) {
  $('greeting').textContent = greetingText(ctx.state.name);
  renderCards(ctx);
  renderPalace(ctx);
  renderAlbum(ctx);
}

/* Parent button: hold 800 ms (ring fills) -> onOpen(); a short tap -> onHint(). Keyboard click opens directly. */
export function initParentButton(btn, { onOpen, onHint }) {
  let timer = 0, opened = false, sx = 0, sy = 0, pid = null;
  const clearHold = () => { clearTimeout(timer); timer = 0; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    opened = false;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY;
    clearHold();
    void btn.offsetWidth; /* restart the ring fill */
    btn.classList.add('holding');
    timer = setTimeout(() => {
      timer = 0;
      opened = true;
      btn.classList.remove('holding');
      onOpen();
    }, HOLD_MS);
  });
  btn.addEventListener('pointermove', (e) => {
    if (timer && e.pointerId === pid && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 16) clearHold();
  });
  btn.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pid) return;
    const short = !!timer;
    clearHold();
    if (short && !opened) onHint();
  });
  btn.addEventListener('pointercancel', clearHold);
  btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') clearHold(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => { if (e.detail === 0) onOpen(); });
}
