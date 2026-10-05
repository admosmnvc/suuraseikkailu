/* Overlays: the cover / sound gate, the player picker (#who), the level choice, the reward card (a gem / rocket part
   flies into the crown / rocket) and the finale (girl: the sticker with sparkles, boy: countdown + rocket launch,
   then the sticker). Focus moves into the top layer and back; every other layer is inert while it is open.
   OWNER: ui agent. */
import ART from '../art.js';
import { SFX } from '../audio/sfx.js';
import { FX } from '../fx.js';
import { reducedMotion } from '../util.js';
import { $, focusEl, safe, centerOf } from './dom.js';

/* top first; the settings sheet manages its own modality and sits above everything but the gate */
const LAYERS = ['gate', 'who', 'levelPick', 'reward', 'finale'];
let lastFocus = null;
let inertSet = [];

function inertAllBut(keep) {
  inertSet.forEach((el) => el.removeAttribute('inert'));
  inertSet = [];
  if (!keep) return;
  Array.from(document.body.children).forEach((el) => {
    if (el === keep || el.hasAttribute('inert') || /^(SCRIPT|CANVAS)$/.test(el.tagName)) return;
    if (el.id === 'caption' || el.id === 'toast' || el.id === 'bg' || el.classList.contains('tap-spark') || el.classList.contains('praise-pop')) return;
    if (el.id === 'settings' && keep.id !== 'gate') return;
    el.setAttribute('inert', '');
    inertSet.push(el);
  });
}

function topLayer() {
  for (const id of LAYERS) { const el = $(id); if (el && !el.hidden) return el; }
  return null;
}
function syncLayers() {
  const top = topLayer();
  inertAllBut(top);
  document.documentElement.classList.toggle('ov-open', !!top);
  document.documentElement.classList.toggle('cover-up', !!top && (top.id === 'who' || (top.id === 'gate' && top.dataset.mode === 'start')));
}

export function isOpen(id) { const el = $(id); return !!el && !el.hidden; }

export function openOverlay(id, focusTarget) {
  if (!topLayer()) lastFocus = document.activeElement;
  $(id).hidden = false;
  syncLayers();
  if (topLayer() === $(id)) focusEl(focusTarget || $(id));
}

export function closeOverlay(id) {
  const el = $(id);
  if (!el || el.hidden) return;
  el.hidden = true;
  syncLayers();
  const top = topLayer();
  if (top) { focusEl(top.querySelector('.ov-actions .pb:last-child') || top.querySelector('button:not([hidden])') || top); return; }
  if (lastFocus && lastFocus.isConnected && lastFocus !== document.body) focusEl(lastFocus);
  lastFocus = null;
}

/* ---------- cover / gate ---------- */
/* mode 'start' = the intro scene + "Aloita Suuraseikkailu" (ui/intro.js draws the scene), 'resume' = audio got
   locked again ("Jatketaan!"). */
export function showGate(mode) {
  const gate = $('gate');
  gate.dataset.mode = mode;
  $('gateLabel').innerHTML = mode === 'resume' ? 'Jatketaan!' : '<span class="gl-1">Aloita</span> <span class="gl-2">Suuraseikkailu</span>';
  const hint = $('gateHint');
  hint.textContent = mode === 'resume' ? 'Napauta, niin ääni palaa.' : '';
  hint.hidden = mode !== 'resume';
  if (gate.hidden && !topLayer()) lastFocus = document.activeElement;
  gate.hidden = false;
  syncLayers();
  /* the first screen waits for a tap (Tab reaches the button: everything else is inert); no focus ring on it */
  if (mode === 'resume') focusEl($('gateBtn'));
}

export function hideGate() {
  $('gate').hidden = true;
  syncLayers();
  const top = topLayer();
  if (top) { focusEl(top.querySelector('.ov-actions .pb:last-child') || top.querySelector('button:not([hidden])') || top); return; }
  if (lastFocus && lastFocus.isConnected && lastFocus !== document.body) focusEl(lastFocus);
  lastFocus = null;
}

/* ---------- reward ---------- */
let flight = null;

/* o: { theme, slots, filled, slot (the line's slot, -1 = none), fresh (newly earned), heading, gemText, next } */
export function renderReward(o) {
  const art = $('rewardArt');
  art.dataset.theme = o.theme;
  art.innerHTML = ART.reward(o.theme, { slots: o.slots, filled: o.filled, cls: 'reward-pic' });
  if (o.fresh) {
    const s = art.querySelector('.slot[data-i="' + o.slot + '"]');
    if (s) s.classList.remove('on');
  }
  $('rewardTitle').textContent = o.heading;
  $('rewardGem').textContent = o.gemText;
  $('rewardNext').textContent = o.next;
}

function landOn(slot, slotIndex) {
  slot.classList.add('on');
  safe(() => SFX.chime(slotIndex));
  const c = centerOf(slot);
  safe(() => FX.sparkle(c.x, c.y));
}

/* The step's gem (girl) / rocket part (boy) flies from the Jatka button into its slot, then the slot lights up. */
export function flyPiece(theme, slotIndex) {
  cancelFlight();
  const slot = $('rewardArt').querySelector('.slot[data-i="' + slotIndex + '"]');
  if (!slot) return;
  const land = () => landOn(slot, slotIndex);
  const g = document.createElement('div');
  if (reducedMotion() || typeof g.animate !== 'function') { land(); return; }
  const size = 64;
  const to = centerOf(slot), from = centerOf($('rewardGo'));
  const x0 = from.x - size / 2, y0 = from.y - size / 2 - 30;
  const x1 = to.x - size / 2, y1 = to.y - size / 2;
  const s1 = Math.max(0.3, (to.r.width * 1.3) / size);
  g.className = 'fly-piece';
  g.dataset.theme = theme;
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = ART.icon(theme === 'boy' ? 'rocket' : 'gem', 'fly-ico');
  document.body.appendChild(g);
  const midX = (x0 + x1) / 2 + (x1 >= x0 ? 60 : -60), midY = Math.min(y0, y1) - 40;
  const anim = g.animate([
    { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.3) rotate(-40deg)', opacity: 0 },
    { transform: 'translate(' + x0 + 'px,' + (y0 - 50) + 'px) scale(1.35) rotate(0deg)', opacity: 1, offset: 0.28 },
    { transform: 'translate(' + midX + 'px,' + midY + 'px) scale(1.1) rotate(200deg)', opacity: 1, offset: 0.68 },
    { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(' + s1.toFixed(3) + ') rotate(360deg)', opacity: 1 }
  ], { duration: 1050, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  safe(() => SFX.whoosh());
  flight = { el: g, anim };
  anim.onfinish = () => {
    if (!flight || flight.anim !== anim) return;
    g.remove();
    flight = null;
    land();
  };
}

/* Lands the piece at once (Jatka tapped while it still flew or before it took off). true = it had not landed yet. */
export function landPiece(slotIndex) {
  const slot = $('rewardArt').querySelector('.slot[data-i="' + slotIndex + '"]');
  if (!slot || slot.classList.contains('on')) return false;
  cancelFlight();
  landOn(slot, slotIndex);
  return true;
}

export function cancelFlight() {
  if (!flight) return;
  const f = flight;
  flight = null;
  try { f.anim.cancel(); } catch (e) { /* ignore */ }
  f.el.remove();
}

/* ---------- finale ---------- */
let launchTimers = [];
function cancelLaunch() { launchTimers.forEach(clearTimeout); launchTimers = []; }
const at = (ms, fn) => launchTimers.push(setTimeout(fn, ms));

/* o: { theme, secId, slots, text, stickerText, plus, bonus (bonus sticker also earned) }
   One hero: the new sticker (the bonus one tucked on its corner) with a glow and twinkles. */
export function renderFinale(o) {
  cancelLaunch();
  const stickers = '<span class="finale-sticker"><span class="finale-rays"></span>' + ART.sticker(o.theme, o.secId, true) +
    '<span class="fin-twinkles"><i></i><i></i><i></i><i></i><i></i></span>' +
    (o.bonus ? '<span class="finale-bonus">' + ART.sticker(o.theme, 'bonus', true) + '</span>' : '') + '</span>';
  const art = $('finaleArt');
  art.dataset.theme = o.theme;
  art.classList.remove('launched', 'go');
  if (o.theme === 'boy') {
    /* the section's rocket, one part per line, all on: the art rumbles with its flame until .art-launch */
    art.innerHTML = '<div class="fin-pad"><span class="fin-rocket">' + ART.progress('boy', { total: o.slots, done: o.slots, cls: 'fin-rocket-pic' }) +
      '</span><span class="fin-count" aria-hidden="true"></span></div>' +
      '<div class="fin-stickers">' + stickers + '</div>';
  } else {
    art.innerHTML = '<div class="fin-stickers">' + stickers + '</div>';
  }
  $('finaleText').textContent = o.text;
  const st = $('finaleSticker');
  st.textContent = o.stickerText || '';
  st.hidden = !o.stickerText;
  $('finalePlus').textContent = o.plus;
}

/* Boy finale: 3 · 2 · 1 on the pad, the rocket blasts off out of the card, then the sticker pops in. */
export function launchRocket() {
  cancelLaunch();
  const art = $('finaleArt'), count = art.querySelector('.fin-count');
  if (!count) return;
  if (reducedMotion()) { art.classList.add('go', 'launched'); return; } /* the art shows the finished rocket, no flight */
  ['3', '2', '1'].forEach((n, i) => at(150 + i * 750, () => {
    count.textContent = n;
    count.classList.remove('tick');
    void count.offsetWidth;
    count.classList.add('tick');
    safe(() => SFX.pop());
  }));
  at(150 + 3 * 750, () => {
    count.textContent = '';
    art.classList.add('go');
    const pic = art.querySelector('.fin-rocket-pic');
    if (pic) pic.classList.add('art-launch');
    safe(() => SFX.boom());
    const r = art.querySelector('.fin-rocket');
    if (r) { const c = centerOf(r); safe(() => FX.burst(c.x, c.r.bottom - 20, ['#FF9A3C', '#FFD54A', '#FF5A5F', '#FFFFFF'], 22)); }
  });
  at(150 + 3 * 750 + 1700, () => { art.classList.add('launched'); safe(() => SFX.sparkle()); });
}

export function stopFinaleFx() { cancelLaunch(); }
