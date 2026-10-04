/* Learn screen: top bar (level chip), step bubbles, instruction, line cards and the action bar state.
   Step k = units 1..k (CONTRACTS "Flow per level – FINAL"): a card for every line touched so far; in the line of
   the newest unit (HELPPO / KESKITASO) the covered words show normally, the newest unit's words in the theme's deep
   colour, the words not reached yet very dim; the transliteration shows only the covered part. No decoration on
   the Arabic. OWNER: ui agent. */
import ART from '../art.js';
import { LEVEL_NAMES } from '../content/prompts.js';
import { reducedMotion } from '../util.js';
import { $, esc, replayClass } from './dom.js';

const EQ = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';
const MANY = 7; /* more steps than this: one row that scrolls sideways instead of wrapped rows */

/* Arabic of the newest unit's line with word classes: covered / newest unit / not reached yet */
function wordsHTML(ar, nu) {
  return ar.split(' ').map((w, i) => {
    const cls = i > nu.to ? 'w later' : i >= nu.from ? 'w new' : 'w';
    return '<span class="' + cls + '">' + esc(w) + '</span>';
  }).join(' ');
}

function titleOf(ctx) {
  const { sec, step: k, units, level, review } = ctx;
  if (review) return 'Sano koko ' + sec.name;
  if (k === 1) return 'Kuuntele ja sano perässä';
  if (level === 'hard') return 'Sano rivit 1–' + k;
  return k === units.length ? 'Sano koko ' + sec.name : 'Sano alusta asti';
}

function renderSteps(S, k, doneSteps, done) {
  const steps = $('steps');
  steps.classList.toggle('many', S > MANY);
  steps.style.setProperty('--cols', S);
  steps.style.setProperty('--cols-s', S <= 5 ? S : Math.ceil(S / 2));
  let s = '';
  for (let i = 1; i <= S; i++) {
    const open = done || i <= doneSteps + 1, ok = done || i <= doneSteps;
    s += '<button type="button" class="step jelly' + (ok ? ' done' : '') + (i === k ? ' current' : '') + '" id="step-' + i + '" data-k="' + i + '"' +
      (open ? '' : ' disabled') + (i === k ? ' aria-current="step"' : '') +
      ' aria-label="Vaihe ' + i + (ok ? ', tehty' : '') + (open ? '' : ', ei vielä auki') + '"><span class="step-dot" aria-hidden="true">' + i +
      (open ? '' : '<span class="step-lock">' + ART.icon('lock') + '</span>') + '</span></button>';
  }
  steps.innerHTML = s;
  if (S > MANY) {
    const b = $('step-' + k);
    if (b) steps.scrollLeft = b.offsetLeft - (steps.clientWidth - b.offsetWidth) / 2;
  }
}

/* ctx: { sec, color, units, step, doneSteps, done, review, level } */
export function renderLearn(ctx) {
  const { sec, units, step: k, doneSteps, done, review, level } = ctx;
  const nu = units[k - 1], L = nu.line, partial = !nu.last;
  $('learn').dataset.c = $('actionbar').dataset.c = String(ctx.color);
  $('learnName').textContent = sec.name;
  $('learnAr').textContent = sec.ar;
  $('levelIco').innerHTML = ART.levelIcon(level, 'level-chip-art');
  $('levelName').textContent = LEVEL_NAMES[level];
  $('levelBtn').setAttribute('aria-label', 'Taso ' + LEVEL_NAMES[level] + ': vaihda taso');
  renderSteps(units.length, k, doneSteps, done);
  $('instrTitle').textContent = titleOf(ctx);
  $('instrSub').textContent = 'Vaihe ' + k + '/' + units.length;

  /* Every line has the same two round buttons in its head (listen, meaning), so Sanoin! stays the one big action.
     A tap on the card itself plays that line (main.js). */
  let html = '';
  for (let j = 0; j <= L; j++) {
    const line = sec.lines[j];
    const isNew = j === L && !review;
    const unitWords = isNew && level !== 'hard';
    const ayah = (sec.quran && line.n > 0 && !(j === L && partial)) ? ART.ayah(line.n) : '';
    const tr = j === L && partial
      ? units.filter((u, i) => i < k && u.line === L).map((u, i, a) => (i === a.length - 1 ? '<b class="tr-new">' + esc(u.tr) + '</b>' : esc(u.tr))).join(' ')
      : esc(line.tr || '');
    html += '<li class="line' + (j === L && partial ? ' partial' : '') + '" id="line-' + j + '">' +
      '<div class="line-head"><span class="line-num">Rivi ' + (j + 1) + '</span>' + (isNew ? '<span class="badge-new">UUSI</span>' : '') +
        '<span class="line-acts">' + EQ +
          '<button type="button" class="round-btn line-btn jelly" data-act="one" data-i="' + j + '" aria-label="Kuuntele rivi ' + (j + 1) + '">' + ART.icon('play') + '</button>' +
          '<button type="button" class="round-btn line-btn jelly" data-act="mean" data-i="' + j + '" aria-label="Mitä rivi ' + (j + 1) + ' tarkoittaa?">' + ART.icon('speech') + '</button>' +
        '</span></div>' +
      '<p class="ar" dir="rtl" lang="ar">' + (unitWords ? wordsHTML(line.ar, nu) : esc(line.ar)) + ayah + '</p>' +
      (tr ? '<p class="tr">' + tr + '</p>' : '') +
      '<p class="fi" id="fi-' + j + '" lang="fi">' + esc(line.fi) + '</p>' +
      '</li>';
  }
  const box = $('lines');
  box.innerHTML = html;
  box.dataset.partial = partial ? String(L) : '';
}

function scrollByY(dy) {
  if (Math.abs(dy) < 2) return;
  try { window.scrollBy({ top: dy, behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { window.scrollBy(0, dy); }
}

/* Scrolls card c into the free room between the (sticky) top bar and the action bar, minus the caption bubble
   when it shows (bottom in portrait, top in landscape): centred when it fits, top-aligned when it is taller, so the
   Arabic at the card's top stays in view. */
function scrollToCard(c) {
  const top = document.querySelector('.learn-top');
  const bar = document.querySelector('.actionbar');
  let topEdge = (top && getComputedStyle(top).position === 'sticky' ? Math.max(0, top.getBoundingClientRect().bottom) : 0) + 8;
  let botEdge = (bar ? bar.getBoundingClientRect().top : innerHeight) - 12;
  const cap = $('caption');
  if (cap && cap.classList.contains('show')) {
    const q = cap.getBoundingClientRect();
    if (q.top > innerHeight / 2) botEdge = Math.min(botEdge, q.top - 10);
    else topEdge = Math.max(topEdge, q.bottom + 10);
  }
  const r = c.getBoundingClientRect(), room = botEdge - topEdge;
  scrollByY(r.height <= room ? (r.top + r.height / 2) - (topEdge + room / 2) : r.top - topEdge);
}

/* Highlights the card of line i (-1 = none) and scrolls it into view. */
export function setActive(i) {
  const cards = $('lines').children;
  let c = null;
  for (let j = 0; j < cards.length; j++) {
    const on = cards[j].id === 'line-' + i;
    cards[j].classList.toggle('active', on);
    if (on) c = cards[j];
  }
  if (c) scrollToCard(c);
}

/* "Your turn": the newest line's card in view, clear of the caption. */
export function showEnd() {
  const cards = $('lines').children;
  if (cards.length) scrollToCard(cards[cards.length - 1]);
}

/* Soft glow when a line card itself is tapped (no squash on the Quran text). */
export function glowLine(i) { replayClass($('line-' + i), 'glow'); }

/* Kuuntele shows sound bars while the voice plays (the label stays "Kuuntele"). */
export function setPlaying(on) { $('listenBtn').classList.toggle('playing', !!on); }

/* "Sanoin!" pulses when it is the child's turn. */
export function setNudge(on) { $('saidBtn').classList.toggle('nudge', !!on); }

export function fiEl(i) { return $('fi-' + i); }
