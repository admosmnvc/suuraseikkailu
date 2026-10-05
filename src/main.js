/* Suuraseikkailu v3 entry: fonts + styles, boot, cover / audio gate, players, learning flow. OWNER: ui agent.

   Flow: intro (~5 s, ui/intro.js) -> "Aloita Suuraseikkailu" (unlocks audio) -> "Kuka pelaa tänään?" picker (or the new-player
   onboarding: name + Tyttö / Poika = theme) -> home of that child -> section -> level choice -> steps.
   The level sets the unit size (HELPPO word, KESKITASO word pair, VAIKEA line); step k = units 1..k from the
   start: Kuuntele plays them + "your turn" -> "Sanoin!" -> minigame (every / every 2nd step) -> reward (+1 star;
   a step that completes a line: gem into the crown / part into the rocket) -> "Jatka" -> step k+1 ... the last
   step (whole section) -> finale + sticker. Audio locked again (background return) -> "Jatketaan!" gate, the tap
   resumes where the child was. */
import '@fontsource/sniglet/latin-800.css';
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
import { PRAISE_IDS, GAME_COUNT, LEVELS, finaleId, levelId, promptText } from './content/prompts.js';
import * as P from './profiles.js';
import * as engine from './audio/engine.js';
import { SFX } from './audio/sfx.js';
import { FX } from './fx.js';
import MiniGames from './games/index.js';
import * as settings from './ui/settings.js';
import * as pwa from './pwa.js';
import ART from './art.js';
import { $, safe, toast, hideToast, centerOf, focusEl } from './ui/dom.js';
import { initPress } from './ui/press.js';
import { initBackground } from './ui/background.js';
import { initCaption, speak, speakGroups, stopVoice } from './ui/voice.js';
import { applyTheme, syncBar } from './ui/theme.js';
import { unitsOf, linesDoneBy, stepsBeforeLine, unitClips } from './ui/units.js';
import { prefixClips } from './content/chunks.js';
import { popPraise, randomWord } from './ui/praise.js';
import { initIntro, playIntro, introBusy, soundNow, wakeIntro } from './ui/intro.js';
import { initWho, renderPicker, showView, viewFocus } from './ui/who.js';
import { renderLevel } from './ui/level.js';
import { renderHome, initParentButton, forgetShown } from './ui/home.js';
import { renderLearn, setActive, setPlaying, setNudge, fiEl, showEnd, glowLine } from './ui/learn.js';
import {
  openOverlay, closeOverlay, isOpen, showGate, hideGate,
  renderReward, flyPiece, landPiece, cancelFlight, renderFinale, launchRocket, stopFinaleFx
} from './ui/overlays.js';

/* ---------- data + store ---------- */
const SECTIONS = (DATA && Array.isArray(DATA.sections) ? DATA.sections : [])
  .filter((s) => s && s.id && Array.isArray(s.lines) && s.lines.length);
const IDS = SECTIONS.map((s) => s.id);
const byId = (id) => SECTIONS.find((s) => s.id === id) || null;
const colorOf = (sec) => (SECTIONS.indexOf(sec) % 4) + 1;

const store = P.loadStore(IDS);
const save = () => P.saveStore(store);
let child = P.activeChild(store);   /* the child playing now (the picker confirms it after every launch) */
const theme = () => (child ? child.theme : 'girl');
const prog = (sec) => (child ? Math.min(sec.lines.length, Math.max(0, child.progress[sec.id] || 0)) : 0);
const isDone = (sec) => !!(child && child.done[sec.id] === true);

/* ---------- view state ---------- */
let screen = 'none';     /* 'home' | 'learn' | 'none' (no child yet) */
let cur = null;          /* open section */
let level = 'hard';      /* level of the open section */
let units = [];          /* its units at that level (step k = units 1..k) */
let step = 1;            /* current step k (1..units.length) */
let started = false;     /* the cover has been passed once */
let chainTok = 0;        /* bumped whenever the learn voice (chain / single line / meaning) is cut */
let flow = false;        /* "Sanoin!" flow running (before game / reward) */
let flowAt = 0, flowTok = 0, timers = [], deferred = [], game = null;
let rewardK = 1;
let rewardPiece = null;  /* { slot } of the open reward's flying gem / rocket part */
let leaving = false;     /* Jatka tapped while the piece still flew: it lands first, then the next step */
let unshown = 0;         /* stars already granted (and saved) at Sanoin!, shown when the reward / finale opens */
let replay = null;       /* speaks the open reward/finale again (after the gate) */
let flowShownAt = 0;     /* when the reward/finale opened: stray taps right after it are ignored */
let levelSec = null, levelMode = 'start';
const STRAY_MS = 800;
const LINE_GAP = 250, CHUNK_GAP = 150;
let bg = { setTheme() {}, pause() {} };
/* A layer that vanishes under a fast double tap must not pass the 2nd tap to what lies below it
   (pointer clicks only: keyboard clicks have detail 0; pointerdown handlers are not affected). */
const TAP_BLOCK_MS = 450;
let tapBlockUntil = 0;
const blockTaps = () => { tapBlockUntil = Date.now() + TAP_BLOCK_MS; };
let gateAfterGame = false; /* audio got locked during a minigame: the gate waits until the game is done */
let titleSaid = false;     /* the intro said 'intro-title' (sound allowed, or a tap on the cover); else the start tap says it */
let titleBusy = false;     /* 'intro-title' is playing right now */
let lastPraise = '';       /* reward praise: never the same twice in a row */
let lastGameEnd = 0, lastGameDone = false; /* 'game-done': every other game when they come fast (every = 1, < 30 s) */
const GAME_FAST_MS = 30000;

/* ---------- helpers ---------- */
function updateStars(bump) {
  const n = child ? Math.max(0, child.stars - unshown) : 0;
  ['homeStars', 'learnStars'].forEach((id) => {
    const el = $(id);
    el.setAttribute('aria-label', 'Tähtiä: ' + n);
    el.querySelector('.stars-num').textContent = String(n);
    if (bump && el.offsetParent) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  });
}

function setThemeFromChild() {
  applyTheme(theme());
  bg.setTheme(theme());
  safe(() => FX.setTheme(theme())); /* confetti in the theme's colours */
  syncBar(isOpen('who') || (isOpen('gate') && $('gate').dataset.mode === 'start'));
}

function showHome() {
  if (!child) return;
  renderHome({ child, theme: theme(), sections: SECTIONS, prog, isDone, levelOf: (sec) => P.levelFor(child, sec.id) });
  updateStars(false);
}

const isReview = () => !!(cur && isDone(cur) && step === units.length);
const savedSteps = (sec, lv) => ((child.steps && child.steps[sec.id]) || {})[lv] || 0;
/* completed steps at the open level: VAIKEA = lines (v2), HELPPO / KESKITASO = saved steps, at least up to the lines done */
function doneSteps() {
  const fromLines = stepsBeforeLine(units, prog(cur));
  return level === 'hard' ? fromLines : Math.max(fromLines, Math.min(units.length, savedSteps(cur, level)));
}

function showLearn() {
  if (!cur) return;
  renderLearn({ sec: cur, color: colorOf(cur), units, step, doneSteps: doneSteps(), done: isDone(cur), review: isReview(), level });
  updateStars(false);
}

function showScreen(name) {
  if (name !== screen) blockTaps();
  screen = name;
  $('home').hidden = name !== 'home';
  $('learn').hidden = name !== 'learn';
  $('actionbar').hidden = name !== 'learn';
  document.documentElement.classList.toggle('in-learn', name === 'learn');
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}

function applyTranslit() { document.documentElement.classList.toggle('no-translit', !store.settings.translit); }

function applyAudioSettings() {
  safe(() => engine.setSlow(store.settings.slow));
  safe(() => engine.setSpeechEnabled(store.settings.speech));
  safe(() => SFX.setEnabled(store.settings.sfx));
}

const promptItem = (id, el) => ({ clip: engine.prompt(id), el, caption: el ? '' : promptText(id) });

/* Speaks one home prompt; the greeting glows while it plays (no floating caption over the cards). */
function sayPrompt(id) { return speak([promptItem(id, $('greet'))]); }

function gateOpen() { return isOpen('gate'); }

/* greeting by the time of day: 5-10 morning, 10-17 day, else evening */
function greetId() {
  const h = new Date().getHours();
  return h >= 5 && h < 10 ? 'greet-morning' : h >= 10 && h < 17 ? 'greet-day' : 'greet-evening';
}

/* intro voice cues (intro.js, only when sound may start before a tap): never once the start button was tapped */
function onIntroCue(name) {
  if (started || document.hidden || !gateOpen() || $('gate').dataset.mode !== 'start' || safe(() => settings.isSettingsOpen())) return;
  if (name === 'title') {
    if (titleSaid) return; /* once (a key press on the button during the intro must not say it twice) */
    titleSaid = titleBusy = true;
    speak([promptItem('intro-title', $('introLogo'))]).then(() => { titleBusy = false; });
  }
  else if (name === 'go') speak([promptItem('intro-go')]); /* caption above the gate */
}

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

/* The partly covered line up to the end of unit u: the recitation from the line start (content prefixClips: one
   prefix cut; a section without cuts: its covered teacher chunk clips, 150 ms apart). */
function partialGroup(u, pauseMs) {
  return { items: prefixClips(cur.id, u.line, u.to, level).map((clip) => ({ clip })), gapMs: CHUNK_GAP, pauseMs };
}

/* Voice groups of units 0..k-1: each fully covered line as its line clip (250 ms apart), then the partly covered
   line as its prefix (partialGroup). lines[g] = line of group g. */
function unitGroups(k) {
  const groups = [], lines = [];
  const last = units[k - 1];
  for (let i = 0; i < k; i++) {
    const u = units[i];
    if (u.last && (u.line < last.line || last.last)) { groups.push({ items: [{ clip: engine.line(cur, u.line) }], pauseMs: LINE_GAP }); lines.push(u.line); }
  }
  if (!last.last) { groups.push(partialGroup(last, LINE_GAP)); lines.push(last.line); }
  return { groups, lines };
}

/* [pre...] then units 1..k then "your turn". Starts synchronously, so it may run inside a tap. */
function playChain(pre) {
  if (!cur) return;
  stopAll();
  const turn = step === 1 ? 'turn-1' : 'turn-all';
  const { groups, lines } = unitGroups(step);
  const all = [{ items: pre || [], gapMs: 0 }].concat(groups, [{ items: [promptItem(turn)], pauseMs: LINE_GAP }]);
  /* item index -> line card to light (null = a prompt) */
  const owner = (pre || []).map(() => null);
  groups.forEach((g, i) => g.items.forEach(() => owner.push(lines[i])));
  const t = ++chainTok;
  setPlaying(true);
  setNudge(false);
  speakGroups(all, {
    onItem: (i) => {
      if (t !== chainTok) return;
      if (i < owner.length) { if (owner[i] !== null) setActive(owner[i]); return; }
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

/* One line card: its line clip; the partly covered line: its prefix up to the newest unit. */
function playSingle(i) {
  if (!cur || !cur.lines[i]) return;
  stopAll();
  const t = ++chainTok;
  const nu = units[step - 1];
  const partial = i === nu.line && !nu.last;
  const groups = partial ? [partialGroup(nu, 0)] : [{ items: [{ clip: engine.line(cur, i) }] }];
  setActive(i);
  speakGroups(groups).then(() => { if (t === chainTok) setActive(-1); });
}

function explain(i) {
  if (!cur || !cur.lines[i]) return;
  stopAll();
  speak([{ clip: engine.meaning(cur, i), el: fiEl(i) }]);
}

function preloadSection(sec) {
  const clips = sec.lines.map((l, i) => engine.line(sec, i)).concat(unitClips(units));
  const reward = theme() === 'boy' ? ['rocket-part', 'rocket-launch'] : ['gem'];
  ['turn-1', 'turn-all'].concat(PRAISE_IDS, reward, [finaleId(sec.id), 'sticker']).forEach((id) => clips.push(engine.prompt(id)));
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
  leaving = false;
  if (unshown) { unshown = 0; updateStars(false); } /* left before the reward / finale: the stars are already saved */
  const g = game;
  game = null;
  if (g && typeof g.abort === 'function') { try { g.abort(); } catch (e) { /* ignore */ } }
  if (g) { learnInert(false); gateIfLocked(); }
  bg.pause(false);
}

function closeFlowOverlays() {
  if (isOpen('reward') || isOpen('finale')) blockTaps();
  cancelFlight();
  stopFinaleFx();
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

function enterStep(k, pre) {
  step = Math.max(1, Math.min(units.length, Math.floor(Number(k)) || 1));
  showLearn();
  playChain(pre);
}

/* Reopening resumes at the next step; a finished section opens in review (the last step). */
function startStep(sec) {
  if (isDone(sec)) return units.length;
  const fromLines = stepsBeforeLine(units, prog(sec)) + 1;
  return level === 'hard' ? fromLines : Math.max(fromLines, savedSteps(sec, level) + 1);
}

function setLevel(sec, lv) {
  level = lv;
  units = unitsOf(sec, lv);
}

/* Must stay synchronous up to playChain(): it runs inside the tap handler (iOS audio rule). */
function openSection(sec, k, pre) {
  const a = document.activeElement;
  const fromHome = !a || a === document.body || $('home').contains(a) || $('levelPick').contains(a);
  stopAll();
  cancelFlow();
  closeFlowOverlays();
  safe(() => FX.clear());
  cur = sec;
  setLevel(sec, P.levelFor(child, sec.id));
  showScreen('learn');
  enterStep(k == null ? startStep(sec) : typeof k === 'function' ? k() : k, pre);
  if (fromHome) focusEl($('listenBtn'));
  requestWake();
  preloadSection(sec);
}

function goHome() {
  stopAll();
  cancelFlow();
  closeFlowOverlays();
  closeLevel();
  safe(() => FX.clear());
  setNudge(false);
  const from = cur;
  cur = null;
  releaseWake();
  showHome();
  showScreen(child ? 'home' : 'none');
  /* keyboard focus back on the section's own card (the learn screen it was on is hidden now) */
  if (from && !safe(() => settings.isSettingsOpen())) focusEl($('card-' + from.id));
}

/* Everything the step earns is granted and saved right here (progress, steps, the star; last step: done + 3/1
   stars), so leaving or reloading before the reward / finale shows loses nothing; those overlays only display. */
function onSaid() {
  if (!cur || flow) return;
  const sec = cur, k = step, last = k === units.length, before = prog(sec);
  const u = units[k - 1];
  const first = !isDone(sec), allBefore = SECTIONS.every(isDone);
  stopAll();
  setNudge(false);
  child.progress[sec.id] = Math.max(before, linesDoneBy(units, k));
  if (level !== 'hard') {
    child.steps[sec.id] = child.steps[sec.id] || {};
    child.steps[sec.id][level] = Math.max(savedSteps(sec, level), k);
  }
  const plus = last ? (first ? 3 : 1) : 1;
  if (last) child.done[sec.id] = true;
  child.stars += plus;
  unshown = plus;
  save();
  safe(() => SFX.success());
  const b = $('saidBtn'), c = centerOf(b);
  safe(() => FX.sparkle(c.x, c.y)); /* small, stays on the button: no particles over the Arabic lines */
  popPraise(c.r, randomWord());
  const every = store.settings.every;
  const wantGame = !last && (every === 1 || k % 2 === 0) && MiniGames && typeof MiniGames.play === 'function';
  /* the step completed a line: its gem / rocket part (slot = line index) */
  const piece = u.last ? { slot: u.line, fresh: u.line + 1 > before } : null;
  flow = true;
  flowAt = Date.now();
  showLearn();
  /* confetti only once the reward / finale card is open: never over the Arabic lines, never into a minigame */
  const confetti = (id) => { if (isOpen(id)) safe(() => FX.confetti(40)); };
  if (last) { const fin = { first, bonus: !allBefore && SECTIONS.every(isDone) }; later(700, () => { showFinale(sec, fin); confetti('finale'); }); return; }
  if (wantGame) later(650, () => startGame(sec, k, piece));
  else later(650, () => { showReward(sec, k, piece); confetti('reward'); });
}

function startGame(sec, k, piece) {
  const idx = ((child.game % GAME_COUNT) + GAME_COUNT) % GAME_COUNT;
  child.game = (idx + 1) % GAME_COUNT;
  save();
  const t = flowTok;
  const done = () => {
    if (t === flowTok) gateIfLocked(); /* the reward then waits for the gate tap (whenActive) */
    const now = Date.now();
    const said = !(store.settings.every === 1 && now - lastGameEnd < GAME_FAST_MS && lastGameDone);
    lastGameEnd = now;
    lastGameDone = said;
    whenActive(() => {
      if (t !== flowTok) return;
      game = null;
      learnInert(false);
      bg.pause(false);
      showReward(sec, k, piece, said);
    });
  };
  bg.pause(true);
  safe(() => FX.clear()); /* no leftover particles floating over the game (they look like targets) */
  try {
    game = MiniGames.play({
      theme: child.theme,
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

/* The parent's recording of this child's name ('name-<id>', recording only) -> device speech of the name. */
function nameClip() {
  return Object.assign({}, engine.prompt('name-' + child.id), { text: child.name });
}

function nextText(sec, k) {
  if (k >= units.length) return 'Seuraavaksi: koko ' + sec.name;
  return level === 'hard' ? 'Seuraavaksi: rivit 1–' + k : 'Seuraavaksi: vaihe ' + k + '/' + units.length;
}

/* piece: { slot, fresh } when the step completed a line (gem / rocket part flies in), else null;
   gameDone: a minigame just ended, 'game-done' comes first */
function showReward(sec, k, piece, gameDone) {
  flow = false;
  if (screen !== 'learn' || cur !== sec) return;
  unshown = 0;
  const th = theme();
  const pool = PRAISE_IDS.length > 1 ? PRAISE_IDS.filter((id) => id !== lastPraise) : PRAISE_IDS;
  const praiseId = pool[Math.floor(Math.random() * pool.length)];
  lastPraise = praiseId;
  const praise = promptText(praiseId).replace(/[!.]+$/, '');
  const pieceId = th === 'boy' ? 'rocket-part' : 'gem';
  renderReward({
    theme: th,
    slots: sec.lines.length,
    filled: prog(sec),
    slot: piece ? piece.slot : -1,
    fresh: !!(piece && piece.fresh),
    heading: praise + ', ' + child.name + '!',
    gemText: piece ? promptText(pieceId) : '',
    next: nextText(sec, k + 1)
  });
  rewardK = k;
  rewardPiece = piece;
  flowShownAt = Date.now();
  openOverlay('reward', $('rewardGo'));
  updateStars(true);
  const title = $('rewardTitle'), gemText = $('rewardGem');
  const items = (first) => [
    first && gameDone ? promptItem('game-done') : null,
    { clip: engine.prompt(praiseId), el: title },
    { clip: nameClip(), el: title },
    piece ? { clip: engine.prompt(pieceId), el: gemText } : null
  ];
  replay = () => speak(items(false), { gapMs: 150 });
  speak(items(true), { gapMs: 150 });
  if (piece) later(450, () => flyPiece(th, piece.slot));
}

/* fin: { first (the section's first finale: sticker + 3 stars), bonus (the bonus sticker was earned too) } */
function showFinale(sec, fin) {
  flow = false;
  if (screen !== 'learn' || cur !== sec) return;
  const first = fin.first;
  unshown = 0;
  const th = theme();
  renderFinale({
    theme: th,
    secId: sec.id,
    slots: sec.lines.length,
    text: promptText(finaleId(sec.id)),
    stickerText: first ? promptText('sticker') : '',
    plus: first ? '+3 tähteä' : '+1 tähti',
    bonus: fin.bonus
  });
  showLearn();
  flowShownAt = Date.now();
  openOverlay('finale', $('finaleAgain'));
  updateStars(true);
  if (th === 'boy') { launchRocket(); later(2400, () => safe(() => FX.show(4200))); }
  else safe(() => FX.show(5200));
  const text = $('finaleText'), stickerText = $('finaleSticker');
  replay = () => speak([
    th === 'boy' ? { clip: engine.prompt('rocket-launch'), el: text } : null,
    { clip: engine.prompt(finaleId(sec.id)), el: text },
    first ? { clip: engine.prompt('sticker'), el: stickerText } : null
  ], { gapMs: 200 });
  replay();
}

/* ---------- level choice ---------- */
/* mode 'start' (section card on home) | 'change' (level chip in the learn top bar) */
function openLevel(sec, mode) {
  levelSec = sec;
  levelMode = mode;
  const target = renderLevel(sec, mode === 'change' ? level : P.levelFor(child, sec.id));
  blockTaps();
  openOverlay('levelPick', target);
  speak([{ clip: engine.prompt('pick-level'), el: $('levelTitle') }]);
}

function closeLevel() {
  if (!isOpen('levelPick')) return;
  blockTaps();
  closeOverlay('levelPick');
  levelSec = null;
}

/* Runs inside the tap: the level's own prompt, then step playback starts synchronously. A new unit size (from the
   chip or at the surah start) resumes at the first unit of the first line not done yet; the same level resumes at
   its next step. */
function onLevelPick(lv) {
  const sec = levelSec, mode = levelMode;
  if (!sec || !child || !LEVELS.includes(lv)) return;
  const inLearn = mode === 'change' && cur === sec && screen === 'learn';
  const changed = lv !== (inLearn ? level : P.levelFor(child, sec.id));
  child.levelBySection[sec.id] = lv;
  save();
  stopVoice();
  closeLevel();
  const pre = [promptItem(levelId(lv), $('instrTitle'))];
  const atLine = () => (isDone(sec) ? units.length : stepsBeforeLine(units, prog(sec)) + 1);
  if (inLearn) {
    cancelFlow();
    setLevel(sec, lv);
    enterStep(changed ? atLine() : step, pre);
    preloadSection(sec);
  } else {
    openSection(sec, changed && !isDone(sec) ? () => atLine() : null, pre);
  }
}

/* ---------- players ---------- */
function openWho(view, closable, pre, silent) {
  if (view === 'pick') renderPicker(store.children, { closable });
  showView(view, { back: store.children.length > 0 });
  blockTaps();
  openOverlay('who', viewFocus(view));
  syncBar(true);
  if (silent) return;
  /* spoken on the titles (no floating caption over the cards) */
  const el = view === 'pick' ? $('whoTitle') : $('newThemeLabel');
  const ids = (pre || []).concat([view === 'pick' ? 'who' : 'ask-theme']);
  const elFor = (id, i) => (id === 'intro-title' ? null : i === ids.length - 1 ? el : (view === 'pick' ? el : $('newTitle'))); /* null: caption */
  whenActive(() => speak(ids.map((id, i) => promptItem(id, elFor(id, i)))));
}

function closeWho() {
  if (!isOpen('who')) return;
  blockTaps();
  closeOverlay('who');
  syncBar(false);
}

/* pre: what is said before the home greeting (picker: the child's name + 'welcome-back', then only the time-of-day
   greeting; new child: 'welcome-new', then the greeting + 'welcome') */
function pickChild(id, pre) {
  P.setActive(store, id);
  const c = P.activeChild(store);
  if (!c) return;
  save();
  stopVoice();
  if (!child || child.id !== c.id) forgetShown();
  child = c;
  setThemeFromChild();
  goHome();
  closeWho();
  const greet = $('greet');
  const first = pre || [{ clip: nameClip(), el: greet }, promptItem('welcome-back')];
  /* home entry: the time-of-day greeting (then 'welcome', except after 'welcome-back': two "Hei" lines) */
  speak(first.concat([promptItem(greetId()), pre ? promptItem('welcome', greet) : null]), { gapMs: 150 });
}

/* praise: the name was not praised yet ('nice-name' comes first) */
function createChild(name, th, praise) {
  const c = P.addChild(store, name, th, IDS);
  if (!c) { toast('Pelaajia voi olla enintään ' + P.MAX_CHILDREN + '.'); return; }
  save();
  safe(() => SFX.success());
  pickChild(c.id, [praise ? promptItem('nice-name') : null, promptItem('welcome-new')]);
}

/* Settings changed the children (add / rename / theme / level / delete / "Pelaa nyt"). The playing child was
   deleted -> the picker waits under the settings sheet; another child made active -> its home; else re-render. */
function childrenChanged() {
  const still = child ? store.children.find((c) => c.id === child.id) : null;
  const active = P.activeChild(store);
  if (still && active && active.id !== still.id) {
    forgetShown();
    child = active;
    setThemeFromChild();
    goHome();
    return;
  }
  if (still) {
    child = still;
    setThemeFromChild();
    if (screen === 'learn') showLearn();
    else showHome();
    return;
  }
  child = null;
  stopAll();
  cancelFlow();
  closeFlowOverlays();
  closeLevel();
  releaseWake();
  cur = null;
  showScreen('none');
  setThemeFromChild();
  openWho(store.children.length ? 'pick' : 'new', false, null, true);
}

/* ---------- cover / gate ---------- */
function onGateTap() {
  if ($('gate').dataset.mode === 'start' && introBusy()) return; /* the intro's skip tap is not a start */
  /* SYNC inside the tap: unlock every audio channel before anything else */
  safe(() => engine.unlock());
  safe(() => SFX.unlock());
  const resume = started;
  started = true;
  const c = centerOf($('gateBtn'));
  hideGate();
  blockTaps();
  safe(() => FX.burst(c.x, c.y, ['#FF7A9A', '#5AB4FF', '#FFD36E', '#8EE3C8', '#FFFFFF'], 26));
  safe(() => SFX.sparkle());
  /* the title heard -> 'cover'; still playing (a quick tap) -> straight on (same words twice otherwise); never said -> the title */
  if (!resume) { openWho(store.children.length ? 'pick' : 'new', false, !titleSaid ? ['intro-title'] : titleBusy ? [] : ['cover']); return; }
  syncBar(isOpen('who'));
  resumeAfterUnlock();
}

/* Any tap on the cover that does not start (the "Kosketa!" tap, the intro's skip tap, a tap beside the button) still
   unlocks audio: a waiting intro (no sound before a tap: iOS, a browser tab) now plays with sound; later taps speak
   from here on ('title', then 'go'). */
function onCoverTap() {
  if (started || $('gate').dataset.mode !== 'start') return;
  safe(() => engine.unlock());
  safe(() => SFX.unlock());
  const c = centerOf($('introWake'));
  const w = safe(() => wakeIntro());
  if (w === 'woke') { /* instant answer to the tap: sparkles, the world wakes */
    safe(() => FX.burst(c.x, c.y, ['#FF7A9A', '#5AB4FF', '#FFD36E', '#8EE3C8', '#FFFFFF'], 22));
    safe(() => SFX.sparkle());
  }
  if (w) return;
  safe(() => soundNow());
  if (!titleSaid && store.settings.speech !== false) onIntroCue('title');
}

function resumeAfterUnlock() {
  const ran = flushDeferred();
  if (safe(() => settings.isSettingsOpen())) return;
  /* the reward/finale speaks again, unless a deferred step (e.g. the reward itself) already started speaking */
  if ((isOpen('reward') || isOpen('finale')) && replay && !safe(() => engine.isBusy())) { replay(); return; }
  if (ran || isOpen('who') || isOpen('levelPick')) return;
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
  syncBar(false);
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
    if (e.detail > 0 && Date.now() < tapBlockUntil && !$('gate').contains(e.target) && !$('settings').contains(e.target)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  $('gateBtn').addEventListener('click', onGateTap);
  $('gate').addEventListener('click', onCoverTap); /* after onGateTap (bubbling): a start has set started */

  $('whoBtn').addEventListener('click', () => {
    stopVoice();
    openWho('pick', true);
  });

  $('secGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.sec-card');
    const sec = b ? byId(b.dataset.id) : null;
    if (sec && child) openLevel(sec, 'start');
  });
  $('levelList').addEventListener('click', (e) => {
    const b = e.target.closest('.level-opt');
    if (b) onLevelPick(b.dataset.level);
  });
  $('levelClose').addEventListener('click', () => { stopVoice(); closeLevel(); });
  $('levelBtn').addEventListener('click', () => {
    if (!cur || !interrupt()) return;
    stopAll();
    openLevel(cur, 'change');
  });

  $('homeBtn').addEventListener('click', () => { if (!flow || Date.now() - flowAt >= 1500) goHome(); }); /* like the other learn controls */
  $('listenBtn').addEventListener('click', () => { if (interrupt()) playChain(); });
  $('saidBtn').addEventListener('click', onSaid);

  $('steps').addEventListener('click', (e) => {
    const b = e.target.closest('.step');
    if (!b || b.disabled || !cur || !interrupt()) return;
    enterStep(Number(b.dataset.k) || 1);
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
  const nextStep = () => {
    stopAll();
    cancelFlow();
    closeFlowOverlays();
    safe(() => FX.clear()); /* no confetti left falling over the Arabic lines */
    enterStep(rewardK + 1);
    try { $('saidBtn').focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  };
  $('rewardGo').addEventListener('click', () => {
    if (stray() || leaving) return;
    if (!cur) { closeFlowOverlays(); goHome(); return; }
    /* the gem / rocket part still flying (or not yet off): it lands now, so the child sees it, then the next step */
    if (rewardPiece && landPiece(rewardPiece.slot)) { leaving = true; later(420, nextStep); return; }
    nextStep();
  });
  $('finaleHome').addEventListener('click', () => {
    if (stray()) return;
    goHome();
    speak([promptItem('bye')]);
  });
  $('finaleAgain').addEventListener('click', () => {
    if (stray()) return;
    const sec = cur;
    if (sec) openSection(sec, 1);
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || safe(() => settings.isSettingsOpen()) || gateOpen()) return;
    if (isOpen('levelPick')) { stopVoice(); closeLevel(); }
    else if (isOpen('who') && !$('whoClose').hidden && $('who').dataset.view === 'pick') closeWho();
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
    store,
    save,
    credits: DATA.credits,
    onChange: (key) => {
      if (key === 'translit') applyTranslit();
      else applyAudioSettings();
    },
    onReset: (childId) => {
      if (child && child.id === childId) {
        forgetShown();
        if (screen === 'learn') goHome();
        else showHome();
      }
      toast('Tähdet ja edistyminen nollattiin.');
    },
    onChildrenChange: childrenChanged
  });
}

function boot() {
  bg = initBackground($('bg'));
  initPress();
  initCaption($('caption'));
  document.querySelectorAll('[data-icon]').forEach((el) => { if (!el.firstElementChild) el.innerHTML = ART.icon(el.dataset.icon); });
  applyAudioSettings();
  applyTranslit();
  initWho({
    onPick: pickChild,
    onCreate: createChild,
    onName: (name, el) => speak([promptItem('nice-name', el)]),
    onAdd: () => {
      showView('new', { back: true });
      focusEl(viewFocus('new'));
      speak([promptItem('ask-theme', $('newThemeLabel'))]);
    },
    onBack: () => {
      stopVoice();
      renderPicker(store.children, { closable: !!child && screen !== 'none' });
      showView('pick');
      focusEl(viewFocus('pick'));
    },
    onClose: () => { stopVoice(); closeWho(); }
  });
  initSettingsSheet();
  wire();
  setThemeFromChild();
  if (child) { showHome(); showScreen('home'); } else showScreen('none');
  initIntro($('coverArt'), $('gate'));
  showGate('start');
  playIntro({ sfx: store.settings.sfx !== false, cue: store.settings.speech !== false ? onIntroCue : null });
  syncBar(true);
  safe(() => engine.onLockChange(onLock));
  safe(() => engine.preload(['intro-title', 'intro-go', 'cover', 'who', 'ask-theme', 'welcome'].map((id) => engine.prompt(id))));
  if (typeof pwa.registerSW === 'function') safe(() => pwa.registerSW());
}

boot();
