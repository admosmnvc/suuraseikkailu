/* Learn screen: top bar, step bubbles, instruction, line cards and the bottom action bar state.
   OWNER: ui agent. */
import ART from '../art.js';
import { reducedMotion } from '../util.js';
import { $, esc, secVars, replayClass } from './dom.js';

const EQ = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';

/* ctx: { sec, step, prog, done, review } */
export function renderLearn(ctx) {
  const { sec, step: k, prog: p, done, review } = ctx;
  const N = sec.lines.length;
  [$('learn'), $('actionbar')].forEach((el) => secVars(el, sec.color));
  $('learnName').textContent = sec.name;
  $('learnAr').textContent = sec.ar;

  const steps = $('steps');
  steps.style.setProperty('--cols', N);
  steps.style.setProperty('--cols-s', N <= 5 ? N : Math.ceil(N / 2));
  let s = '';
  for (let i = 1; i <= N; i++) {
    const open = done || i <= p + 1;
    s += '<button type="button" class="step jelly' + (i <= p ? ' done' : '') + (i === k ? ' current' : '') + '" id="step-' + i + '" data-k="' + i + '"' +
      (open ? '' : ' disabled') + (i === k ? ' aria-current="step"' : '') +
      ' aria-label="Vaihe ' + i + (i <= p ? ', tehty' : '') + (open ? '' : ', ei vielä auki') + '"><span class="step-dot" aria-hidden="true">' + i +
      (open ? '' : '<span class="step-lock">' + ART.icon('snowflake') + '</span>') + '</span></button>';
  }
  steps.innerHTML = s;

  $('instrTitle').textContent = review ? 'Sano koko ' + sec.name : (k === 1 ? 'Kuuntele ja sano perässä' : 'Sano rivit 1–' + k);
  $('instrSub').textContent = 'Vaihe ' + k + '/' + N;

  /* Only the newest line gets the two wide chips; older lines get two small round bubbles in their head,
     so Sanoin! stays the one big action. A tap on the card itself also plays the line (main.js). */
  let html = '';
  for (let j = 0; j < k; j++) {
    const line = sec.lines[j];
    const ayah = (sec.quran && line.n > 0) ? ART.ayah(line.n) : '';
    const isNew = j === k - 1 && !review;
    html += '<li class="line" id="line-' + j + '">' +
      '<div class="line-head"><span class="line-num">Rivi ' + (j + 1) + '</span>' +
      (isNew ? '<span class="badge-new">UUSI</span>' + EQ
        : '<span class="line-acts">' + EQ +
          '<button type="button" class="round-btn line-btn jelly" data-act="one" data-i="' + j + '" aria-label="Kuuntele rivi ' + (j + 1) + '">' + ART.icon('play') + '</button>' +
          '<button type="button" class="round-btn line-btn jelly" data-act="mean" data-i="' + j + '" aria-label="Mitä rivi ' + (j + 1) + ' tarkoittaa?">' + ART.icon('speech') + '</button>' +
          '</span>') + '</div>' +
      '<p class="ar" dir="rtl" lang="ar">' + esc(line.ar) + ayah + '</p>' +
      (line.tr ? '<p class="tr">' + esc(line.tr) + '</p>' : '') +
      '<p class="fi" id="fi-' + j + '" lang="fi">' + esc(line.fi) + '</p>' +
      (isNew ? '<div class="tools">' +
        '<button type="button" class="chip jelly" data-act="one" data-i="' + j + '">' + ART.icon('play') + '<span>Kuuntele tämä</span></button>' +
        '<button type="button" class="chip jelly" data-act="mean" data-i="' + j + '">' + ART.icon('speech') + '<span>Mitä tämä tarkoittaa?</span></button>' +
        '</div>' : '') +
      '</li>';
  }
  $('lines').innerHTML = html;
}

function scrollByY(dy) {
  if (Math.abs(dy) < 2) return;
  try { window.scrollBy({ top: dy, behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { window.scrollBy(0, dy); }
}

/* Scrolls card c into the free room between the (sticky) top bar and the action bar:
   centred when it fits, top-aligned when it is taller (never hidden under the bar). */
function scrollToCard(c) {
  const top = document.querySelector('.learn-top');
  const bar = document.querySelector('.actionbar-in');
  const topEdge = (top && getComputedStyle(top).position === 'sticky' ? Math.max(0, top.getBoundingClientRect().bottom) : 0) + 8;
  const botEdge = (bar ? bar.getBoundingClientRect().top : innerHeight) - 12;
  const r = c.getBoundingClientRect(), room = botEdge - topEdge;
  scrollByY(r.height <= room ? (r.top + r.height / 2) - (topEdge + room / 2) : r.top - topEdge);
}

/* Highlights line i (-1 = none) and scrolls it into view. */
export function setActive(i) {
  const cards = $('lines').children;
  for (let j = 0; j < cards.length; j++) cards[j].classList.toggle('active', j === i);
  const c = i >= 0 ? cards[i] : null;
  if (c) scrollToCard(c);
}

/* Scrolls to the end, so the newest line sits above the "your turn" caption (only padding is under it). */
export function showEnd() {
  scrollByY(document.documentElement.scrollHeight - innerHeight - window.scrollY);
}

/* Soft glow when a line card itself is tapped (no squash on the Quran text). */
export function glowLine(i) { replayClass($('line-' + i), 'glow'); }

export function setPlaying(on) {
  const b = $('listenBtn');
  b.classList.toggle('playing', !!on);
  const l = b.querySelector('.bb-label');
  if (l) l.textContent = on ? 'Kuuntelee…' : 'Kuuntele'; /* as in v1 */
}

/* "Sanoin!" pulses when it is the child's turn. */
export function setNudge(on) { $('saidBtn').classList.toggle('nudge', !!on); }

export function fiEl(i) { return $('fi-' + i); }
