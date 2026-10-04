/* Overlays: the "Aloita" sound gate, the reward card (gem flies into the crown) and the finale.
   Focus moves into an overlay and back to where it was; the layers below are inert while it is open.
   OWNER: ui agent. */
import ART from '../art.js';
import { SFX } from '../audio/sfx.js';
import { FX } from '../fx.js';
import { reducedMotion } from '../util.js';
import { $, focusEl, safe, centerOf } from './dom.js';

/* Gem colours of the reward crown, slot i uses GEM_COLORS[i % 5]. */
export const GEM_COLORS = ['#2F6FE0', '#B45FE0', '#FF9FD6', '#7FD3F2', '#9A7BFF'];

const FLOW_IDS = ['reward', 'finale'];
let lastFocus = null;
let inertSet = [];

/* Makes every top-level layer except `keep` (and passive layers) inert; null restores. */
function inertAllBut(keep) {
  inertSet.forEach((el) => el.removeAttribute('inert'));
  inertSet = [];
  if (!keep) return;
  Array.from(document.body.children).forEach((el) => {
    if (el === keep || el.hasAttribute('inert') || /^(SCRIPT|CANVAS)$/.test(el.tagName)) return;
    if (el.id === 'caption' || el.id === 'toast' || el.id === 'bg' || el.classList.contains('tap-spark')) return;
    el.setAttribute('inert', '');
    inertSet.push(el);
  });
}

function topLayer() {
  if (!$('gate').hidden) return $('gate');
  for (const id of FLOW_IDS) if (!$(id).hidden) return $(id);
  return null;
}
function syncLayers() {
  inertAllBut(topLayer());
  document.documentElement.classList.toggle('ov-open', !!topLayer());
}

export function isOpen(id) { const el = $(id); return !!el && !el.hidden; }

export function openOverlay(id, focusTarget) {
  if (!topLayer()) lastFocus = document.activeElement;
  $(id).hidden = false;
  syncLayers();
  if (isOpen('gate')) return;
  focusEl(focusTarget);
}

export function closeOverlay(id) {
  const el = $(id);
  if (!el || el.hidden) return;
  el.hidden = true;
  syncLayers();
  if (!topLayer() && lastFocus && lastFocus.isConnected && lastFocus !== document.body) focusEl(lastFocus);
  if (!topLayer()) lastFocus = null;
}

/* ---------- gate ---------- */
export function initGateArt() {
  $('gateArt').innerHTML = ART.crown({ slots: 5, filled: 5 });
}

/* mode 'start' = first screen ("Aloita"), 'resume' = audio got locked again ("Jatketaan!"). */
export function showGate(mode) {
  const gate = $('gate');
  gate.dataset.mode = mode;
  $('gateLabel').textContent = mode === 'resume' ? 'Jatketaan!' : 'Aloita';
  $('gateHint').textContent = mode === 'resume' ? 'Napauta kuplaa, niin ääni palaa.' : 'Napauta kuplaa!';
  if (gate.hidden && !topLayer()) lastFocus = document.activeElement;
  gate.hidden = false;
  syncLayers();
  focusEl($('gateBtn'));
}

export function hideGate() {
  $('gate').hidden = true;
  syncLayers();
  const top = topLayer();
  if (top) { focusEl(top.querySelector('.ov-actions .bb:last-child') || top); return; }
  if (lastFocus && lastFocus.isConnected && lastFocus !== document.body) focusEl(lastFocus);
  lastFocus = null;
}

/* ---------- reward ---------- */
let flight = null;

/* o: { slots, filled, slot (index of this step's gem), fresh (slot newly earned), heading, gemText, next } */
export function renderReward(o) {
  const crown = $('rewardCrown');
  crown.innerHTML = ART.crown({ slots: o.slots, filled: o.filled, colors: GEM_COLORS });
  if (o.fresh) {
    const s = crown.querySelector('.crown-slot[data-i="' + o.slot + '"]');
    if (s) s.classList.remove('on');
  }
  $('rewardTitle').textContent = o.heading;
  $('rewardGem').textContent = o.gemText;
  $('rewardNext').textContent = o.next;
}

/* The step's gem flies from below the card into its crown socket, then the socket lights up. */
export function flyGem(slotIndex) {
  cancelFlight();
  const crown = $('rewardCrown');
  const slot = crown.querySelector('.crown-slot[data-i="' + slotIndex + '"]');
  if (!slot) return;
  const land = () => {
    slot.classList.add('on');
    safe(() => SFX.chime(slotIndex));
    const c = centerOf(slot);
    safe(() => FX.sparkle(c.x, c.y));
  };
  const g = document.createElement('div');
  if (reducedMotion() || typeof g.animate !== 'function') { land(); return; }
  const size = 64;
  const to = centerOf(slot);
  const from = centerOf($('rewardGo'));
  const x0 = from.x - size / 2, y0 = from.y - size / 2 - 30;
  const x1 = to.x - size / 2, y1 = to.y - size / 2;
  const s1 = Math.max(0.3, (to.r.width * 1.25) / size);
  g.className = 'fly-gem';
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = ART.gem(GEM_COLORS[slotIndex % GEM_COLORS.length]);
  document.body.appendChild(g);
  const midX = (x0 + x1) / 2 + (x1 >= x0 ? 60 : -60), midY = Math.min(y0, y1) - 40;
  const anim = g.animate([
    { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.3) rotate(-40deg)', opacity: 0 },
    { transform: 'translate(' + x0 + 'px,' + (y0 - 50) + 'px) scale(1.35) rotate(0deg)', opacity: 1, offset: 0.28 },
    { transform: 'translate(' + midX + 'px,' + midY + 'px) scale(1.1) rotate(200deg)', opacity: 1, offset: 0.68 },
    { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(' + s1.toFixed(3) + ') rotate(360deg)', opacity: 1 }
  ], { duration: 1150, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  safe(() => SFX.whoosh());
  flight = { el: g, anim };
  anim.onfinish = () => {
    if (!flight || flight.anim !== anim) return;
    g.remove();
    flight = null;
    land();
  };
}

export function cancelFlight() {
  if (!flight) return;
  const f = flight;
  flight = null;
  try { f.anim.cancel(); } catch (e) { /* ignore */ }
  f.el.remove();
}

/* ---------- finale ---------- */
/* o: { secId, text, stickerText, plus, palace (bonus sticker also earned) } */
export function renderFinale(o) {
  $('finaleArt').innerHTML =
    '<span class="finale-sticker"><span class="finale-rays"></span>' + ART.sticker(o.secId, true) + '</span>' +
    (o.palace ? '<span class="finale-sticker finale-bonus"><span class="finale-rays"></span>' + ART.sticker('palace', true) + '</span>' : '');
  $('finaleText').textContent = o.text;
  const st = $('finaleSticker');
  st.textContent = o.stickerText || '';
  st.hidden = !o.stickerText;
  $('finalePlus').textContent = o.plus;
}

