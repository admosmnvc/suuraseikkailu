/* Suuraseikkailu v2 entry: fonts + styles, boot, sound gate, learning flow. OWNER: ui agent.

   Flow: gate ("Aloita", unlocks audio) -> home -> section -> step k: Kuuntele plays lines 1..k + "your turn"
   -> "Sanoin!" -> minigame (every step or every 2nd step) -> reward (gem into the crown, praise + name)
   -> "Jatka" -> step k+1 ... -> last step: finale + sticker. Audio locked again (background return)
   -> the gate comes back as "Jatketaan!" and the tap resumes where the child was. */
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/amiri-quran/arabic-400.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/games.css';

import DATA from './content/data.js';
import { PRAISE_IDS, GAME_COUNT, finaleId, gameId, promptText } from './content/prompts.js';
import ART from './art.js';
import * as engine from './audio/engine.js';
import { SFX } from './audio/sfx.js';
import { FX } from './fx.js';
import MiniGames from './games/index.js';
import * as settings from './ui/settings.js';
import * as pwa from './pwa.js';
import { loadState, saveState, resetProgress } from './state.js';
import { $, safe, toast, hideToast, replayClass, centerOf, focusEl } from './ui/dom.js';
import { initPress } from './ui/press.js';
import { initBackground } from './ui/background.js';
import { initCaption, speak, stopVoice } from './ui/voice.js';
import { renderHome, greetingText, initParentButton, forgetShown } from './ui/home.js';
import { renderLearn, setActive, setPlaying, setNudge, fiEl, showEnd, glowLine } from './ui/learn.js';
import {
  openOverlay, closeOverlay, isOpen, initGateArt, showGate, hideGate,
  renderReward, flyGem, cancelFlight, renderFinale
} from './ui/overlays.js';

/* ---------- data + state ---------- */
const SECTIONS = (DATA && Array.isArray(DATA.sections) ? DATA.sections : [])
  .filter((s) => s && s.id && Array.isArray(s.lines) && s.lines.length);
const IDS = SECTIONS.map((s) => s.id);
const byId = (id) => SECTIONS.find((s) => s.id === id) || null;

const state = loadState(IDS);
const save = () => saveState(state);
const prog = (sec) => Math.min(sec.lines.length, Math.max(0, state.progress[sec.id] || 0));
const isDone = (sec) => state.done[sec.id] === true;

/* ---------- view state ---------- */
let screen = 'home';
let cur = null;          /* open section */
let step = 1;            /* current step k (1..N) */
let started = false;     /* the gate has been passed once */
let chainTok = 0;        /* bumped whenever the learn voice (chain / single line / meaning) is cut */
let flow = false;        /* "Sanoin!" flow running (before game / reward) */
let flowAt = 0, flowTok = 0, timers = [], deferred = [], game = null;
let rewardK = 1;
let replay = null;       /* speaks the open reward/finale again (after the gate) */
let flowShownAt = 0;     /* when the reward/finale opened: stray taps right after it are ignored */
const STRAY_MS = 800;
let bg = { pause() {} };
/* A layer that vanishes under a fast double tap must not pass the 2nd tap to what lies below it
   (pointer clicks only: keyboard clicks have detail 0; pointerdown handlers are not affected). */
const TAP_BLOCK_MS = 450;
let tapBlockUntil = 0;
const blockTaps = () => { tapBlockUntil = Date.now() + TAP_BLOCK_MS; };
let gateAfterGame = false; /* audio got locked during a minigame: the gate waits until the game is done */

/* ---------- helpers ---------- */
function updateStars(bump) {
  ['homeStars', 'learnStars'].forEach((id) => {
    const el = $(id);
    el.setAttribute('aria-label', 'Tähtiä: ' + state.stars);
    el.querySelector('.stars-num').textContent = String(state.stars);
    if (bump && el.offsetParent) replayClass(el, 'bump');
  });
}

function homeCtx() { return { state, sections: SECTIONS, prog, isDone }; }

function showHome() {
  renderHome(homeCtx());
  updateStars(false);
}

function showLearn() {
  if (!cur) return;
  renderLearn({ sec: cur, step, prog: prog(cur), done: isDone(cur), review: isReview() });
  updateStars(false);
}

function isReview() { return !!(cur && isDone(cur) && step === cur.lines.length); }

function showScreen(name) {
  if (name !== screen) blockTaps();
  screen = name;
  $('home').hidden = name !== 'home';
  $('learn').hidden = name !== 'learn';
  $('actionbar').hidden = name !== 'learn';
  document.documentElement.classList.toggle('in-learn', name === 'learn');
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}

function applyTranslit() { document.documentElement.classList.toggle('no-translit', !state.translit); }

function applyAudioSettings() {
  safe(() => engine.setSlow(state.slow));
  safe(() => engine.setSpeechEnabled(state.speech));
  safe(() => SFX.setEnabled(state.sfx));
}

/* Speaks one home prompt; the greeting glows while it plays (no floating caption over the cards). */
function sayPrompt(id) {
  return speak([{ clip: engine.prompt(id), el: $('greeting').parentElement }]);
}

function gateOpen() { return isOpen('gate'); }

/* Runs fn now, or after the app is visible and unlocked again (never speak into a hidden page). */
function whenActive(fn) {
  if (document.hidden || gateOpen()) deferred.push(fn);
  else fn();
}
function flushDeferred() {
  const list = deferred;
  deferred = [];
  list.forEach((fn) => fn());
  return list.length > 0;
}

/* ---------- learn voice ---------- */
function stopAll() {
  chainTok++;
  stopVoice();
  setPlaying(false);
  setActive(-1);
}

/* Lines 1..k then "your turn". Starts synchronously, so it may run inside a tap. Restarts from line 1. */
function playChain() {
  if (!cur) return;
  stopAll();
  const sec = cur, k = step, turn = k === 1 ? 'turn-1' : 'turn-all';
  const items = [];
  for (let i = 0; i < k; i++) items.push({ clip: engine.line(sec, i) });
  items.push({ clip: engine.prompt(turn), caption: promptText(turn) });
  const t = ++chainTok;
  setPlaying(true);
  setNudge(false);
  speak(items, {
    gapMs: 250,
    onItem: (i) => {
      if (t !== chainTok) return;
      if (i < k) { setActive(i); return; }
      setActive(-1);
      showEnd();
      setPlaying(false);
      setNudge(true);
    }
  }).then((ok) => {
    if (t !== chainTok) return;
    setActive(-1);
    setPlaying(false);
    if (ok) setNudge(true);
  });
}

function playSingle(i) {
  if (!cur || !cur.lines[i]) return;
  stopAll();
  const t = ++chainTok;
  setActive(i);
  speak([{ clip: engine.line(cur, i) }]).then(() => { if (t === chainTok) setActive(-1); });
}

function explain(i) {
  if (!cur || !cur.lines[i]) return;
  stopAll();
  speak([{ clip: engine.meaning(cur, i), el: fiEl(i) }]);
}

function preloadSection(sec) {
  const clips = sec.lines.map((l, i) => engine.line(sec, i));
  ['turn-1', 'turn-all'].concat(PRAISE_IDS, ['gem', finaleId(sec.id), 'sticker', gameId(state.game % GAME_COUNT)])
    .forEach((id) => clips.push(engine.prompt(id)));
  sec.lines.forEach((l, i) => clips.push(engine.meaning(sec, i)));
  safe(() => engine.preload(clips));
}

/* ---------- wake lock (screen stays on while learning) ---------- */
let wakeLock = null, wantWake = false, wakePending = null;
async function requestWake() {
  wantWake = true;
  /* one request at a time: a 2nd sentinel would never be released */
  if (wakeLock || wakePending || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
  try {
    wakePending = navigator.wakeLock.request('screen');
    const wl = await wakePending;
    if (!wantWake || wakeLock) { wl.release().catch(() => {}); return; }
    wakeLock = wl;
    wl.addEventListener('release', () => { if (wakeLock === wl) wakeLock = null; });
  } catch (e) { /* not allowed here: fine */ } finally { wakePending = null; }
}
function releaseWake() {
  wantWake = false;
  const wl = wakeLock;
  wakeLock = null;
  if (wl) { try { wl.release().catch(() => {}); } catch (e) { /* ignore */ } }
}

/* ---------- flow ---------- */
function later(ms, fn) {
  const t = flowTok;
  const id = setTimeout(() => {
    timers = timers.filter((x) => x !== id);
    whenActive(() => { if (t === flowTok) fn(); });
  }, ms);
  timers.push(id);
}

function cancelFlow() {
  flowTok++;
  timers.forEach(clearTimeout);
  timers = [];
  deferred = [];
  flow = false;
  const g = game;
  game = null;
  if (g && typeof g.abort === 'function') { try { g.abort(); } catch (e) { /* ignore */ } }
  if (g) { learnInert(false); gateIfLocked(); }
  bg.pause(false);
}

function closeFlowOverlays() {
  if (isOpen('reward') || isOpen('finale')) blockTaps();
  cancelFlight();
  replay = null;
  closeOverlay('reward');
  closeOverlay('finale');
}

/* A tap on the learning UI cancels a stale flow, but not one that has just started. */
function interrupt() {
  if (flow && Date.now() - flowAt < 1500) return false;
  cancelFlow();
  return true;
}

/* Must stay synchronous up to playChain(): it runs inside the tap handler (iOS audio rule). */
function openSection(sec, k, autoplay) {
  const a = document.activeElement;
  const fromHome = !a || a === document.body || $('home').contains(a); /* keyboard focus would be lost on the hidden home */
  stopAll();
  cancelFlow();
  closeFlowOverlays();
  safe(() => FX.clear());
  cur = sec;
  step = Math.max(1, Math.min(sec.lines.length, Math.floor(Number(k)) || 1));
  showLearn();
  showScreen('learn');
  if (fromHome) focusEl($('listenBtn'));
  requestWake();
  if (autoplay) playChain();
  preloadSection(sec);
}

function goHome() {
  stopAll();
  cancelFlow();
  closeFlowOverlays();
  safe(() => FX.clear());
  setNudge(false);
  const from = cur;
  cur = null;
  releaseWake();
  showHome();
  showScreen('home');
  /* keyboard focus back on the section's own card (the learn screen it was on is hidden now) */
  if (from && !safe(() => settings.isSettingsOpen())) focusEl($('card-' + from.id));
}

function onSaid() {
  if (!cur || flow) return;
  const sec = cur, k = step, N = sec.lines.length, before = prog(sec);
  stopAll();
  setNudge(false);
  state.progress[sec.id] = Math.max(before, k);
  save();
  safe(() => SFX.success());
  const c = centerOf($('saidBtn'));
  safe(() => FX.sparkle(c.x, c.y)); /* small, stays on the button: no particles over the Arabic lines */
  const wantGame = k < N && (state.every === 1 || k % 2 === 0) && MiniGames && typeof MiniGames.play === 'function';
  flow = true;
  flowAt = Date.now();
  showLearn();
  /* confetti only once the reward / finale card is open: never over the Arabic lines, never into a minigame */
  const confetti = (id) => { if (isOpen(id)) safe(() => FX.confetti(40)); };
  if (k >= N) { later(700, () => { showFinale(sec); confetti('finale'); }); return; }
  if (wantGame) later(650, () => startGame(sec, k, before));
  else later(650, () => { showReward(sec, k, before); confetti('reward'); });
}

function startGame(sec, k, before) {
  const idx = ((state.game % GAME_COUNT) + GAME_COUNT) % GAME_COUNT;
  state.game = (idx + 1) % GAME_COUNT;
  save();
  const t = flowTok;
  const done = () => {
    if (t === flowTok) gateIfLocked(); /* the reward then waits for the gate tap (whenActive) */
    whenActive(() => {
      if (t !== flowTok) return;
      game = null;
      learnInert(false);
      bg.pause(false);
      showReward(sec, k, before);
    });
  };
  bg.pause(true);
  safe(() => FX.clear()); /* no leftover particles floating over the game (they look like targets) */
  try {
    game = MiniGames.play({
      index: idx,
      say: (id) => { if (t === flowTok) speak([{ clip: engine.prompt(id) }]); }, /* the game shows its own title */
      onDone: done
    });
  } catch (e) {
    game = null;
    done();
    return;
  }
  /* keyboard / screen reader: the learn screen behind the game is out of reach, focus goes into the game */
  const mg = game && document.querySelector('.mg');
  if (mg && !mg.hidden) {
    learnInert(true);
    if (!mg.hasAttribute('tabindex')) mg.setAttribute('tabindex', '-1');
    focusEl(mg);
  }
}

function learnInert(on) {
  ['app', 'actionbar'].forEach((id) => { const el = $(id); if (el) el.inert = !!on; });
}

function showReward(sec, k, before) {
  flow = false;
  if (screen !== 'learn' || cur !== sec) return;
  state.stars += 1;
  save();
  const N = sec.lines.length;
  const praiseId = PRAISE_IDS[Math.floor(Math.random() * PRAISE_IDS.length)];
  const praise = promptText(praiseId).replace(/[!.]+$/, '');
  renderReward({
    slots: N,
    filled: prog(sec),
    slot: k - 1,
    fresh: k > before,
    heading: praise + (state.name ? ', ' + state.name : '') + '!',
    gemText: promptText('gem'),
    next: k + 1 >= N ? 'Seuraavaksi: koko ' + sec.name : 'Seuraavaksi: rivit 1–' + (k + 1)
  });
  rewardK = k;
  flowShownAt = Date.now();
  openOverlay('reward', $('rewardGo'));
  updateStars(true);
  const title = $('rewardTitle'), gemText = $('rewardGem');
  replay = () => speak([
    { clip: engine.prompt(praiseId), el: title },
    /* parent's recording of the name -> device Finnish speech of the typed name -> silent */
    { clip: state.name ? Object.assign({}, engine.prompt('name'), { text: state.name }) : engine.prompt('name'), el: title },
    { clip: engine.prompt('gem'), el: gemText }
  ], { gapMs: 150 });
  replay();
  later(620, () => flyGem(k - 1));
}

function showFinale(sec) {
  flow = false;
  if (screen !== 'learn' || cur !== sec) return;
  const first = !isDone(sec);
  const allBefore = SECTIONS.every(isDone);
  state.done[sec.id] = true;
  state.stars += first ? 3 : 1;
  save();
  const palace = !allBefore && SECTIONS.every(isDone);
  renderFinale({
    secId: sec.id,
    text: promptText(finaleId(sec.id)),
    stickerText: first ? promptText('sticker') : '',
    plus: first ? '+3 tähteä' : '+1 tähti',
    palace
  });
  showLearn();
  flowShownAt = Date.now();
  openOverlay('finale', $('finaleAgain'));
  updateStars(true);
  safe(() => FX.show(5200));
  const text = $('finaleText'), stickerText = $('finaleSticker');
  replay = () => speak([
    { clip: engine.prompt(finaleId(sec.id)), el: text },
    first ? { clip: engine.prompt('sticker'), el: stickerText } : null
  ], { gapMs: 200 });
  replay();
}

/* ---------- gate ---------- */
function onGateTap() {
  /* SYNC inside the tap: unlock every audio channel before anything else */
  safe(() => engine.unlock());
  safe(() => SFX.unlock());
  const resume = started;
  started = true;
  const c = centerOf($('gateBtn'));
  hideGate();
  blockTaps();
  safe(() => FX.burst(c.x, c.y, ['#C8B6FF', '#7FD3F2', '#FF9FD6', '#FFFFFF'], 30));
  safe(() => SFX.sparkle());
  if (!resume) { sayPrompt('welcome'); return; }
  resumeAfterUnlock();
}

function resumeAfterUnlock() {
  const ran = flushDeferred();
  if (settings.isSettingsOpen && safe(() => settings.isSettingsOpen())) return;
  /* the reward/finale speaks again, unless a deferred step (e.g. the reward itself) already started speaking */
  if ((isOpen('reward') || isOpen('finale')) && replay && !safe(() => engine.isBusy())) { replay(); return; }
  if (ran) return;
  if (screen === 'learn' && cur && !flow && !game) playChain();
  else if (screen === 'home') sayPrompt('next');
}

function onLock(locked) {
  if (!locked || !started) return;
  chainTok++;
  stopVoice();
  setPlaying(false);
  setActive(-1);
  if (game && !gateOpen()) { gateAfterGame = true; return; } /* minigames need no voice: the child plays on, the gate comes after */
  showGate('resume');
}

/* The minigame ended (done or aborted): show the gate it held back, if audio is still locked. */
function gateIfLocked() {
  if (!gateAfterGame) return;
  gateAfterGame = false;
  if (started && !gateOpen() && safe(() => engine.isLocked())) showGate('resume');
}

/* ---------- wiring ---------- */
function wire() {
  document.addEventListener('click', (e) => {
    if (e.detail > 0 && Date.now() < tapBlockUntil && !$('gate').contains(e.target)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  $('gateBtn').addEventListener('click', onGateTap);

  $('secGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.sec-card');
    const sec = b ? byId(b.dataset.id) : null;
    if (!sec) return;
    const N = sec.lines.length;
    openSection(sec, isDone(sec) ? N : Math.min(N, prog(sec) + 1), true);
  });

  $('homeBtn').addEventListener('click', goHome);
  $('listenBtn').addEventListener('click', () => { if (interrupt()) playChain(); });
  $('saidBtn').addEventListener('click', onSaid);

  $('steps').addEventListener('click', (e) => {
    const b = e.target.closest('.step');
    if (!b || b.disabled || !cur || !interrupt()) return;
    step = Math.max(1, Math.min(cur.lines.length, Number(b.dataset.k) || 1));
    showLearn();
    playChain();
    if (e.detail === 0) { const nb = $('step-' + step); if (nb) nb.focus({ preventScroll: true }); }
  });

  $('lines').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    /* a tap on the card itself (Arabic text, transliteration, meaning) plays that line */
    const card = b ? null : e.target.closest('.line');
    if ((!b && !card) || !cur) return;
    if (card) { const sel = window.getSelection && window.getSelection(); if (sel && !sel.isCollapsed) return; }
    if (!interrupt()) return;
    const i = b ? Number(b.dataset.i) : Number(card.id.replace('line-', ''));
    if (card) { playSingle(i); glowLine(i); }
    else if (b.dataset.act === 'one') playSingle(i);
    else explain(i);
  });

  /* a fast child taps on while the card pops in: those taps must not skip the reward */
  const stray = () => Date.now() - flowShownAt < STRAY_MS;
  $('rewardGo').addEventListener('click', () => {
    if (stray()) return;
    if (!cur) { closeFlowOverlays(); goHome(); return; }
    stopAll();
    cancelFlow();
    closeFlowOverlays();
    safe(() => FX.clear()); /* no confetti left falling over the Arabic lines */
    step = Math.min(cur.lines.length, rewardK + 1);
    showLearn();
    playChain();
    try { $('saidBtn').focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  });
  $('finaleHome').addEventListener('click', () => { if (!stray()) goHome(); });
  $('finaleAgain').addEventListener('click', () => {
    if (stray()) return;
    const sec = cur;
    if (sec) openSection(sec, 1, true);
    else goHome();
  });

  initParentButton($('parentBtn'), {
    onOpen: () => {
      hideToast();
      stopVoice();
      if (typeof settings.openSettings === 'function') settings.openSettings();
    },
    onHint: () => toast('Pidä painettuna, niin asetukset aukeavat.')
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAll();
      return;
    }
    if (screen === 'learn' && wantWake) requestWake();
    setTimeout(() => {
      if (!document.hidden && !gateOpen() && !safe(() => engine.isLocked())) flushDeferred();
    }, 700);
  });
}

function initSettingsSheet() {
  if (typeof settings.initSettings !== 'function') return;
  settings.initSettings({
    root: $('settings'),
    state,
    save,
    credits: DATA.credits,
    onChange: (key) => {
      if (key === 'name') $('greeting').textContent = greetingText(state.name);
      else if (key === 'slow') safe(() => engine.setSlow(state.slow));
      else if (key === 'speech') safe(() => engine.setSpeechEnabled(state.speech));
      else if (key === 'sfx') safe(() => SFX.setEnabled(state.sfx));
      else if (key === 'translit') applyTranslit();
    },
    onReset: () => {
      resetProgress(state, IDS);
      save();
      forgetShown();
      if (screen === 'home') showHome();
      else goHome();
      toast('Tähdet ja edistyminen nollattiin.');
    }
  });
}

function fillStaticArt() {
  document.querySelectorAll('[data-icon]').forEach((el) => { if (!el.firstElementChild) el.innerHTML = ART.icon(el.dataset.icon); });
  document.querySelectorAll('[data-art]').forEach((el) => {
    if (el.firstElementChild) return;
    el.innerHTML = el.dataset.art === 'tiara' ? ART.tiara('#B45FE0') : ART.crystal();
  });
  initGateArt();
}

function boot() {
  bg = initBackground($('bg'));
  initPress();
  initCaption($('caption'));
  fillStaticArt();
  applyAudioSettings();
  applyTranslit();
  initSettingsSheet();
  wire();
  showHome();
  showScreen('home');
  showGate('start');
  safe(() => engine.onLockChange(onLock));
  safe(() => engine.preload([engine.prompt('welcome')]));
  if (typeof pwa.registerSW === 'function') safe(() => pwa.registerSW());
}

boot();
