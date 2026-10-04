/* Home of the playing child: player chip (-> picker), greeting, section cards, the progress picture
   (girl: castle windows light up, boy: rocket built part by part), sticker album, parent long-press button.
   OWNER: ui agent. */
import ART from '../art.js';
import { SFX } from '../audio/sfx.js';
import { LEVEL_NAMES } from '../content/prompts.js';
import { reducedMotion } from '../util.js';
import { $, esc, safe } from './dom.js';

const HOLD_MS = 800;
const TEXT = {
  girl: { title: 'Linna', note: 'Jokainen rivi sytyttää yhden ikkunan.', full: 'Linna loistaa!', aria: (d, t) => 'Linna: ' + d + '/' + t + ' ikkunaa loistaa' },
  boy: { title: 'Raketti', note: 'Jokainen rivi tuo raketille uuden osan.', full: 'Raketti on valmis!', aria: (d, t) => 'Raketti: ' + d + '/' + t + ' osaa valmiina' }
};

let shown = null;               /* { id, lit, stickers }: what this child's home showed last (null = first render) */
let progTimers = [];

export function greetingText(name) { return name ? 'Hei, ' + name + '!' : 'Hei!'; }

/* Forget what was shown (reset / other child): the next render draws without "new" animations. */
export function forgetShown() { shown = null; }

function cardHTML(sec, p, done, level, next) {
  const N = sec.lines.length;
  let dots = '';
  for (let i = 0; i < N; i++) dots += '<i' + (i < p ? ' class="on"' : '') + '></i>';
  return '<span class="sec-orb" aria-hidden="true">' + ART.icon('play') + '</span>' +
    '<span class="sec-body">' +
      (next ? '<span class="sec-next" aria-hidden="true">' + (p > 0 ? 'Jatka tästä' : 'Aloita tästä') + '</span>' : '') +
      '<span class="sec-row"><span class="sec-name">' + esc(sec.name) + '</span>' +
      '<span class="sec-ar" lang="ar" dir="rtl">' + esc(sec.ar) + '</span></span>' +
      '<span class="sec-sub">' + esc(sec.sub) + '</span>' +
      '<span class="sec-prog" aria-hidden="true"><span class="sec-dots">' + dots + '</span>' +
        '<span class="sec-count">' + (done ? 'Valmis!' : p + '/' + N) + '</span>' +
        '<span class="sec-level" title="' + LEVEL_NAMES[level] + '">' + ART.levelIcon(level, 'sec-level-art') + '</span></span>' +
    '</span>' +
    (done ? '<span class="sec-done" aria-hidden="true">' + ART.icon('check', 'sec-done-ico') + '</span>' : '');
}

/* The first section not finished yet is the screen's hero (.next: full width, bigger, "Jatka tästä"). */
function renderCards(ctx) {
  const box = $('secGrid');
  box.textContent = '';
  const hero = ctx.sections.find((s) => !ctx.isDone(s)) || null;
  ctx.sections.forEach((sec, i) => {
    const N = sec.lines.length, p = ctx.prog(sec), done = ctx.isDone(sec), level = ctx.levelOf(sec), next = sec === hero;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sec-card jelly' + (done ? ' done' : '') + (next ? ' next' : '');
    b.id = 'card-' + sec.id;
    b.dataset.id = sec.id;
    b.dataset.c = String((i % 4) + 1);
    b.setAttribute('aria-label', sec.name + ', ' + sec.sub + ', ' + p + '/' + N + (done ? ', valmis' : '') + ', taso ' + LEVEL_NAMES[level] +
      (next ? ', ' + (p > 0 ? 'jatka tästä' : 'aloita tästä') : ''));
    b.innerHTML = cardHTML(sec, p, done, level, next);
    box.appendChild(b);
  });
}

function renderProgress(ctx, first) {
  const theme = ctx.theme, tx = TEXT[theme] || TEXT.girl;
  const total = ctx.sections.reduce((n, s) => n + s.lines.length, 0);
  const lit = ctx.sections.reduce((n, s) => n + ctx.prog(s), 0);
  progTimers.forEach(clearTimeout);
  progTimers = [];
  const from = first || shown.lit > lit || reducedMotion() ? lit : shown.lit;
  const art = $('progArt');
  art.dataset.theme = theme;
  art.innerHTML = ART.progress(theme, { total, done: from, cls: 'prog-pic' });
  art.setAttribute('aria-label', tx.aria(lit, total));
  $('progTitle').textContent = tx.title;
  $('progNote').textContent = tx.note;
  $('progCount').textContent = lit >= total ? tx.full : lit + '/' + total;
  /* newly earned windows / rocket parts light up one by one */
  for (let i = from, j = 0; i < lit; i++, j++) {
    progTimers.push(setTimeout(() => {
      const w = art.querySelector('[data-i="' + i + '"]');
      if (w) w.classList.add('on');
      safe(() => SFX.ding(i));
    }, 650 + j * 420));
  }
  return lit;
}

function renderAlbum(ctx, first) {
  const theme = ctx.theme;
  const items = ctx.sections.map((sec) => ({ id: sec.id, name: sec.name, earned: ctx.isDone(sec) }));
  items.push({ id: 'bonus', name: 'Bonus', earned: ctx.sections.length > 0 && ctx.sections.every(ctx.isDone) });
  const before = first ? null : shown.stickers;
  $('album').innerHTML = items.map((it) => {
    const fresh = it.earned && before && !before.has(it.id);
    return '<li class="album-item' + (it.earned ? ' earned' : ' ghost') + (fresh ? ' fresh' : '') + '" data-id="' + it.id + '">' +
      '<span class="album-art" aria-hidden="true">' + ART.sticker(theme, it.id, it.earned) + '</span>' +
      '<span class="album-name">' + esc(it.name) + '<span class="vh">' + (it.earned ? ': tarra ansaittu' : ': tarra vielä ansaitsematta') + '</span></span></li>';
  }).join('');
  $('albumCount').textContent = items.filter((it) => it.earned).length + '/' + items.length;
  return new Set(items.filter((it) => it.earned).map((it) => it.id));
}

/* ctx: { child, theme, sections, prog(sec), isDone(sec), levelOf(sec) } */
export function renderHome(ctx) {
  const c = ctx.child;
  const first = !shown || shown.id !== c.id;
  $('whoAva').innerHTML = ART.avatar(ctx.theme, 'who-ava-art');
  $('whoName').textContent = c.name;
  $('whoBtn').setAttribute('aria-label', c.name + ': vaihda pelaajaa');
  $('greeting').textContent = greetingText(c.name);
  renderCards(ctx);
  const lit = renderProgress(ctx, first);
  const stickers = renderAlbum(ctx, first);
  shown = { id: c.id, lit, stickers };
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
