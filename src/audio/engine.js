/* Voice channel: recitation, Shahada, Finnish prompts, parent recordings. OWNER: audio agent.

   Design (see CONTRACTS.md "Audio API"):
   - ONE shared HTMLAudioElement plays every voice clip. On iOS it plays with the silent switch on,
     and once it has been play()ed inside a tap (unlock) it may play any later src.
   - A token-cancelled queue: every stop() bumps `token`, every async step re-checks it, and all
     pending promises resolve false at once. So two voices never overlap.
   - Clips are fetched into blob: URLs (cached), so playback never depends on HTTP Range support of
     a service worker. A failed fetch falls back to the plain URL.
   - Source order per clip: parent recording (IndexedDB) -> MP3 file -> device speech -> silent wait.
   - If the element refuses to play, the clip is played through Web Audio instead. If Web Audio is
     not running either, audio is "locked": onLockChange(true) tells the UI to show the gate again. */
import DATA from '../content/data.js';
import { promptText, meaningId } from '../content/prompts.js';
import * as context from './context.js';
import * as tts from './tts.js';
import * as recorder from './recorder.js';
import { SFX } from './sfx.js';

const SLOW_RATE = 0.8;
const AR_SILENT_MS = 4000;         /* no audio for an Arabic line: keep it highlighted so the parent can read it */
const GUARD_EXTRA_MS = 4000;       /* safety margin over the clip duration before we stop waiting for 'ended' */
const GUARD_UNKNOWN_MS = 30000;    /* ...before the duration is known */
const LOCK_CHECK_MS = 400;
const REC_WAIT_MS = 1500;          /* longest wait for IndexedDB before a clip uses its MP3 instead */
const AR_TTS_RATE = 0.75;          /* device voices read Arabic too fast for a child */

/* A tiny silent WAV (8 kHz, 8-bit mono, 100 ms) used to "bless" the element inside the tap. */
const SILENT_WAV = (function () {
  const rate = 8000, n = 800, b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  str(36, 'data'); dv.setUint32(40, n, true); b.fill(128, 44);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
})();

/* ---------- the shared element ---------- */
const el = new Audio();
el.setAttribute('playsinline', '');
el.setAttribute('webkit-playsinline', '');
el.preload = 'auto';
el.volume = 1;
/* Only the engine may start the element: a media key, headset button or lock-screen "play" would
   otherwise resume a stopped recitation while the app is idle (over effects and the next voice). */
let elActive = false;          /* a clip (or the bless) owns the element right now */
el.addEventListener('play', () => { if (!elActive) { try { el.pause(); } catch (e) { /* ignore */ } } });

let token = 0;                 /* bumped by stop(): stale async work compares against it */
let seqActive = false;         /* a playSequence() is running (also during gaps) */
let curKind = null;            /* kind of the clip being played */
let locked = true, everUnlocked = false;
let unlockGen = 0;             /* bumped by unlock(): a lock check started before it is stale */
let elementBlocked = false;    /* element play() was refused: use Web Audio until the next unlock() */
let blessSeq = 0;
let slow = false, speechOn = true;
let lastError = null;
const lockCbs = [];
const pending = new Set();     /* cancel functions of whatever is sounding or waiting right now */
const stats = { fileOk: false, fileVia: '', fileErr: null };

function setKind(k) { curKind = k; context.setVoiceKind(k); }

function setLocked(v) {
  if (locked === v) return;
  locked = v;
  lockCbs.slice().forEach((cb) => { try { cb(v); } catch (e) { /* ignore */ } });
}

/* true while a pre-slowed teacher file plays (Shahada MP3s are generated at -25 %): no extra slow-down */
let preSlowed = false;
function rateFor(kind) { return kind === 'recitation' && slow && !preSlowed ? SLOW_RATE : 1; }

/* Safari resets playbackRate on every load, so this runs after each src change and on 'play'. */
function applyRate(kind) {
  const r = rateFor(kind);
  try {
    el.preservesPitch = true;
    el.webkitPreservesPitch = true;
    el.mozPreservesPitch = true;
    if (el.defaultPlaybackRate !== r) el.defaultPlaybackRate = r;
    if (el.playbackRate !== r) el.playbackRate = r;
  } catch (e) { /* ignore */ }
}

/* p, or `fallback` after ms (IndexedDB can hang on iOS: never let a clip wait for it forever). */
function within(p, ms, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    Promise.resolve(p).then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

/* Cancellable sleep: resolves true after ms, false at once on stop(). */
function sleep(ms, t) {
  if (t !== token) return Promise.resolve(false);
  if (!(ms > 0)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const cancel = () => { clearTimeout(timer); pending.delete(cancel); resolve(false); };
    const timer = setTimeout(() => { pending.delete(cancel); resolve(t === token); }, ms);
    pending.add(cancel);
  });
}

/* ---------- loading: files -> blob URLs ---------- */
const files = new Map();     /* absolute URL -> Promise<{ url } | { missing: true }> */
const missing = new Set();   /* relative srcs that do not exist (diagnostics) */

function absUrl(src) {
  try { return new URL(src, document.baseURI).href; } catch (e) { return src; }
}

function loadSrc(src) {
  const abs = absUrl(src);
  if (files.has(abs)) return files.get(abs);
  const p = (async () => {
    let res;
    try { res = await fetch(abs); } catch (e) { return { url: abs, direct: true }; }
    if (res.status === 404 || res.status === 410) return { missing: true };
    if (!res.ok) return { url: abs, direct: true };
    /* Single-page-app hosts answer unknown paths with index.html (200): that is "file missing". */
    if (/text\/html/i.test(res.headers.get('content-type') || '')) return { missing: true };
    let blob = await res.blob();
    if (!blob.size) return { missing: true };
    if (!/^audio\//i.test(blob.type)) blob = new Blob([blob], { type: 'audio/mpeg' }); /* Safari needs a type */
    return { url: URL.createObjectURL(blob) };
  })().catch(() => ({ url: abs, direct: true }));
  files.set(abs, p);
  p.then((r) => {
    if (r.direct) files.delete(abs);  /* network trouble is not final: retry next time */
    if (r.missing) missing.add(src); else missing.delete(src);
  });
  return p;
}

/* Warm the cache (fetch -> blob URLs). Accepts srcs or clips. Resolves when all are loaded. */
export function preload(srcs) {
  const list = (Array.isArray(srcs) ? srcs : [srcs])
    .map((s) => (s && typeof s === 'object' ? s.src : s))
    .filter((s) => typeof s === 'string' && s);
  return Promise.all(list.map((s) => loadSrc(s).catch(() => null))).then(() => undefined);
}

/* ---------- parent recordings ---------- */
let recIds = new Set();
let recUrls = new Map();     /* id -> Promise<string|null> (blob URL) */
let recReady = Promise.resolve();

export function refreshRecordings() {
  recReady = recorder.list().then((ids) => {
    const old = recUrls;
    recIds = new Set(ids);
    recUrls = new Map();
    old.forEach((p) => p.then((u) => { if (u && el.src !== u) URL.revokeObjectURL(u); }));
    return ids;
  }).catch(() => []);
  return recReady;
}

/* The Blob is copied into memory first: Safari's IndexedDB-backed Blobs can become unreadable
   later (WebKitBlobResource error), and a copy also proves the data is readable now.
   A failed read is not cached, so the next play tries IndexedDB again. */
function recordingUrl(id) {
  if (!recUrls.has(id)) {
    const map = recUrls;
    const p = recorder.get(id)
      .then((b) => {
        if (!b || !b.size) return null;
        const read = typeof b.arrayBuffer === 'function' ? b.arrayBuffer() : new Response(b).arrayBuffer();
        return read.then((ab) => new Blob([ab], { type: b.type || 'audio/mp4' }), () => b);
      })
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null);
    map.set(id, p);
    p.then((u) => { if (!u && map.get(id) === p) map.delete(id); });
  }
  return recUrls.get(id);
}
function forgetRecordingUrl(id, url) {
  const p = recUrls.get(id);
  if (!p) return;
  recUrls.delete(id);
  p.then((u) => { if (u && u === url && el.src !== u) URL.revokeObjectURL(u); });
}

/* ---------- playing one url ---------- */
const MEDIA_ERRORS = ['', 'MEDIA_ERR_ABORTED', 'MEDIA_ERR_NETWORK', 'MEDIA_ERR_DECODE', 'MEDIA_ERR_SRC_NOT_SUPPORTED'];

/* Shared element. Resolves { r: 'ended' | 'stopped' | 'failed', err? }. */
function playOnElement(url, kind, guardMs) {
  return new Promise((resolve) => {
    let settled = false, guard = 0;
    const arm = (ms) => {
      clearTimeout(guard);
      guard = setTimeout(() => { lastError = 'Timeout'; try { el.pause(); } catch (e) { /* ignore */ } finish({ r: 'ended' }); }, ms);
    };
    /* guard = remaining time at the current rate + margin (re-armed when duration or rate changes) */
    const onTiming = () => {
      const d = el.duration;
      if (isFinite(d) && d > 0) arm(Math.max(0, d - (el.currentTime || 0)) * 1000 / (el.playbackRate || 1) + GUARD_EXTRA_MS);
    };
    const onMeta = () => { applyRate(kind); onTiming(); };
    const onPlay = () => applyRate(kind);
    const onEnded = () => finish({ r: 'ended' });
    const onError = () => finish({ r: 'failed', err: MEDIA_ERRORS[(el.error && el.error.code) || 0] || 'MediaError' });
    const cancel = () => finish({ r: 'stopped' });
    function finish(res) {
      if (settled) return;
      settled = true;
      elActive = false;
      clearTimeout(guard);
      pending.delete(cancel);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('ratechange', onTiming);
      el.removeEventListener('play', onPlay);
      resolve(res);
    }
    pending.add(cancel);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('ratechange', onTiming);
    el.addEventListener('play', onPlay);
    arm(guardMs || GUARD_UNKNOWN_MS);
    blessSeq++; /* a pending bless must not pause this clip */
    elActive = true;
    try {
      el.src = url;
      applyRate(kind);
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { stats.fileOk = true; stats.fileVia = ''; }, (e) => finish({ r: 'failed', err: (e && e.name) || 'Error' }));
      }
    } catch (e) { finish({ r: 'failed', err: (e && e.name) || 'Error' }); }
  });
}

const decoded = new Map();   /* url -> Promise<AudioBuffer|null>, the few most recent (buffers are big) */
const DECODED_MAX = 8;

function decode(url) {
  const c = context.get();
  if (!decoded.has(url)) {
    const p = fetch(url).then((r) => r.arrayBuffer()).then((ab) => new Promise((resolve, reject) => {
      /* both forms: old Safari only has the callback version */
      const q = c.decodeAudioData(ab, resolve, reject);
      if (q && typeof q.then === 'function') q.then(resolve, reject);
    })).catch(() => { decoded.delete(url); return null; });
    decoded.set(url, p);
    if (decoded.size > DECODED_MAX) decoded.delete(decoded.keys().next().value);
  }
  return decoded.get(url);
}

/* Web Audio fallback through the voice bus. Plays at normal speed: Web Audio cannot slow down
   without lowering the pitch, and a pitch-shifted recitation is worse than a normal-speed one. */
async function playOnWebAudio(url, t) {
  const c = context.get(), bus = context.voiceBus();
  if (!c || !bus || c.state !== 'running') return { r: 'failed', err: 'AudioContext: ' + context.state() };
  const buf = await decode(url);
  if (t !== token) return { r: 'stopped' };
  if (!buf) return { r: 'failed', err: 'DecodeError' };
  return new Promise((resolve) => {
    let settled = false, src = null, guard = 0;
    const cancel = () => { try { src.stop(); } catch (e) { /* ignore */ } finish({ r: 'stopped' }); };
    function finish(res) {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      pending.delete(cancel);
      resolve(res);
    }
    try {
      src = c.createBufferSource();
      src.buffer = buf;
      src.connect(bus);
      src.onended = () => finish({ r: 'ended' });
      pending.add(cancel);
      guard = setTimeout(() => finish({ r: 'ended' }), buf.duration * 1000 + GUARD_EXTRA_MS);
      src.start(0);
      stats.fileOk = true;
      stats.fileVia = 'Web Audio';
    } catch (e) { finish({ r: 'failed', err: (e && e.name) || 'Error' }); }
  });
}

/* Element first, Web Audio second. 'locked' = nothing may play until the next tap. */
async function playUrl(url, kind, t, guardMs) {
  let res = { r: 'failed', err: 'NotAllowedError' };
  if (!elementBlocked) {
    res = await playOnElement(url, kind, guardMs);
    if (res.r !== 'failed' || t !== token) return t === token ? res : { r: 'stopped' };
    lastError = res.err;
    stats.fileErr = res.err;
    if (res.err === 'NotAllowedError') elementBlocked = true;
  }
  if (!context.isRunning()) {
    if (res.err !== 'NotAllowedError') return res;
    const gen = unlockGen;
    const ok = await context.resume(LOCK_CHECK_MS);
    if (t !== token) return { r: 'stopped' };
    if (!ok) {
      if (gen !== unlockGen) return playUrl(url, kind, t, guardMs); /* a tap unlocked meanwhile: retry */
      stop(); setLocked(true); return { r: 'stopped' };
    }
  }
  const wa = await playOnWebAudio(url, t);
  if (wa.r === 'failed') lastError = wa.err;
  return t === token ? wa : { r: 'stopped' };
}

/* Device speech, cancellable by stop(). */
function speak(text, lang, rate, t) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => { if (!settled) { settled = true; pending.delete(cancel); resolve(ok && t === token); } };
    const cancel = () => { tts.cancel(); finish(false); };
    pending.add(cancel);
    tts.speak(text, lang, { rate }).then(finish, () => finish(false));
  });
}

/* ---------- one clip, all sources ---------- */
/* Resolves { ok, source }: ok=false means stopped. source: recording|file|tts|silent|off|none */
async function playClip(clip, t, opts = {}) {
  if (!clip) return { ok: t === token, source: 'none' };
  const kind = clip.kind === 'recitation' ? 'recitation' : 'voice';
  /* speech setting silences Finnish prompts only; data lines (line()) always play,
     and clip.always (e.g. a recording preview in settings) ignores the setting too */
  if (kind === 'voice' && !speechOn && !opts.force && !clip.always) return { ok: t === token, source: 'off' };
  setKind(kind);
  preSlowed = false;
  const stopped = { ok: false, source: 'stopped' };

  if (clip.id) {
    await within(recReady, REC_WAIT_MS, null);
    if (t !== token) return stopped;
    if (recIds.has(clip.id)) {
      const url = await within(recordingUrl(clip.id), REC_WAIT_MS, null);
      if (t !== token) return stopped;
      if (url) {
        /* recordings often report no duration (WebM): the guard uses the 15 s recording limit */
        const res = await playUrl(url, kind, t, (recorder.MAX_MS + GUARD_EXTRA_MS) / rateFor(kind));
        if (res.r !== 'failed') return res.r === 'ended' ? { ok: true, source: 'recording' } : stopped;
        forgetRecordingUrl(clip.id, url); /* unreadable now: read it from IndexedDB again next time */
      }
    }
  }

  if (clip.src) {
    const f = await loadSrc(clip.src);
    if (t !== token) return stopped;
    if (!f.missing) {
      preSlowed = false; /* v3: no pre-slowed TTS files any more (the Shahada is a human recording): slow mode applies */
      const res = await playUrl(f.url, kind, t);
      preSlowed = false;
      if (res.r !== 'failed') return res.r === 'ended' ? { ok: true, source: 'file' } : stopped;
    }
  }

  if (clip.text && tts.hasVoice(clip.lang)) {
    const rate = (clip.lang === 'ar' ? AR_TTS_RATE : 1) * rateFor(kind);
    if (await speak(clip.text, clip.lang, rate, t)) return { ok: true, source: 'tts' };
    if (t !== token) return stopped;
  }

  if (opts.noSilent) return { ok: t === token, source: 'none' };
  const ok = await sleep(clip.lang === 'ar' ? AR_SILENT_MS / rateFor(kind) : 0, t);
  return { ok, source: 'silent' };
}

/* ---------- public API ---------- */

/* SYNC: call inside the gate tap handler. Never throws. */
export function unlock() {
  try {
    everUnlocked = true;
    unlockGen++;
    elementBlocked = false;
    context.unlock();     /* audioSession 'playback' + AudioContext create/resume + silent buffer */
    blessElement();
    tts.warm();
  } catch (e) { /* never throw from a tap handler */ }
  setLocked(false);
}

/* play() the shared element inside the tap so iOS lets it play any later src without a tap. */
function blessElement() {
  if (!el.paused) return; /* already playing: it is allowed */
  const my = ++blessSeq, gen = unlockGen;
  try {
    el.src = SILENT_WAV;
    elActive = true;
    const p = el.play();
    if (!p || typeof p.then !== 'function') { elActive = false; return; }
    p.then(() => {
      if (my === blessSeq) { elActive = false; try { el.pause(); } catch (e) { /* ignore */ } }
    }, (e) => {
      if (my === blessSeq) elActive = false;
      const name = (e && e.name) || 'Error';
      if (name === 'AbortError' || my !== blessSeq) return; /* a real clip took over: fine */
      lastError = name;
      if (name !== 'NotAllowedError') return;
      elementBlocked = true;
      /* the element refused even inside the tap: only Web Audio is left */
      context.resume(LOCK_CHECK_MS).then((ok) => { if (!ok && gen === unlockGen) { stop(); setLocked(true); } });
    });
  } catch (e) { if (my === blessSeq) elActive = false; }
}

export function isLocked() { return locked; }

/* cb(locked). Returns an unsubscribe function. */
export function onLockChange(cb) {
  if (typeof cb !== 'function') return () => {};
  lockCbs.push(cb);
  return () => { const i = lockCbs.indexOf(cb); if (i > -1) lockCbs.splice(i, 1); };
}

function findSection(sec) { return typeof sec === 'string' ? DATA.sections.find((s) => s.id === sec) : sec; }

/* Clip of a data line. Quran lines have no device-speech text on purpose: a synthetic voice must not
   recite Quran, so a missing file means a silent, highlighted pause instead. */
export function line(sec, i) {
  const s = findSection(sec);
  const l = s && s.lines && s.lines[i];
  if (!l) return null;
  return { kind: 'recitation', id: l.rec || null, src: l.audio || null, text: l.tts || '', lang: 'ar' };
}

/* Finnish clip by PROMPTS id / meaning id; 'name' exists only as a parent recording. */
/* 'name' and 'name-<childId>' are recording-only clips (a child's name): no file, no fixed text. */
const isNameId = (id) => id === 'name' || /^name-/.test(String(id));
export function prompt(id) {
  const nameClip = isNameId(id);
  return { kind: 'voice', id, src: nameClip ? null : 'audio/fi/' + id + '.mp3', text: nameClip ? '' : promptText(id), lang: 'fi' };
}

export function meaning(sec, i) {
  const s = findSection(sec);
  return prompt(meaningId(s ? s.id : String(sec), i));
}

/* Stops current playback, then plays the clips one by one. true = all finished, false = interrupted. */
export function playSequence(clips, opts = {}) {
  stop();
  const t = token;
  const list = Array.isArray(clips) ? clips : [clips];
  const gap = Math.max(0, Number(opts.gapMs) || 0);
  seqActive = true;
  return (async () => {
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && !(await sleep(gap, t))) return false;
      if (t !== token) return false;
      if (typeof opts.onItem === 'function') { try { opts.onItem(i); } catch (e) { /* ignore */ } }
      const res = await playClip(list[i], t);
      if (!res.ok || t !== token) return false;
    }
    if (t !== token) return false;
    seqActive = false;
    setKind(null);
    idleCheck();
    return true;
  })();
}

export function play(clip) { return playSequence([clip]); }

/* Immediate silence of the voice channel: queue, element, Web Audio fallback, speech. */
export function stop() {
  token++;
  seqActive = false;
  setKind(null);
  try { el.pause(); } catch (e) { /* ignore */ }
  Array.from(pending).forEach((cancel) => cancel());
  pending.clear();
  tts.cancel();
  idleCheck();
}

export function isBusy() { return seqActive; }
export function busyKind() { return seqActive ? curKind : null; }

export function setSlow(on) {
  slow = !!on;
  if (seqActive && curKind && el.src !== SILENT_WAV) applyRate(curKind);
}

export function setSpeechEnabled(on) { speechOn = !!on; }

/* ---------- lock detection ---------- */
let checking = false, recheckWhenIdle = false;

/* The element is audibly playing a clip right now (it does not need the AudioContext). */
function elementSounding() { return !el.paused && !el.ended && el.src !== SILENT_WAV; }

/* Context suspended/interrupted: try to resume; if that fails, audio is locked (gate again).
   Never cut a clip the element is happily playing: decide when the voice channel is idle. */
function checkLock() {
  if (!everUnlocked || locked || checking) return;
  const s = context.state();
  if (s !== 'suspended' && s !== 'interrupted') return;
  checking = true;
  const gen = unlockGen;
  context.resume(LOCK_CHECK_MS).then((ok) => {
    checking = false;
    if (ok || gen !== unlockGen || document.hidden) return;
    if (elementSounding()) { recheckWhenIdle = true; return; }
    stop(); setLocked(true);
  });
}
function idleCheck() { if (recheckWhenIdle) { recheckWhenIdle = false; checkLock(); } }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else checkLock();
});
window.addEventListener('pageshow', () => { if (!document.hidden) checkLock(); });
context.onStateChange((s) => { if (s !== 'running' && !document.hidden) checkLock(); });

/* ---------- diagnostics for the parent "Testaa äänet" panel ---------- */
const SHAHADA = (findSection('shahada') || { lines: [] }).lines.map((l) => l.audio).filter(Boolean);
let shahadaChecked = false;

function ctxLabel() {
  const s = context.state();
  if (s === 'none') return 'AudioContext: ei vielä käynnistetty';
  if (s === 'unsupported') return 'AudioContext: ei tuettu';
  return 'AudioContext: ' + s;
}

function shahadaLabel() {
  if (!shahadaChecked) { shahadaChecked = true; preload(SHAHADA); return 'Shahada-MP3: tarkistetaan…'; }
  const miss = SHAHADA.filter((s) => missing.has(s));
  if (!miss.length) return 'Shahada-MP3: OK';
  return 'Shahada-MP3: puuttuu (' + miss.map((s) => s.replace(/^.*\//, '')).join(', ') + ')';
}

function voiceLabel(lang) {
  const name = tts.voiceName(lang);
  return (lang === 'fi' ? 'Suomen' : 'Arabian') + ' puheääni: ' + (name ? 'löytyi (' + name + ')' : 'ei löytynyt');
}

export function diagnostics() {
  let session = 'Äänisessio: ei tuettu';
  try { if (navigator.audioSession) session = 'Äänisessio: ' + navigator.audioSession.type; } catch (e) { /* ignore */ }
  return {
    mp3: stats.fileOk ? 'MP3: OK' + (stats.fileVia ? ' (' + stats.fileVia + ')' : '')
      : (stats.fileErr ? 'MP3: virhe (' + stats.fileErr + ')' : 'MP3: ei vielä soitettu'),
    context: ctxLabel(),
    lastError: lastError ? 'Virhe: ' + lastError : null,
    fiVoice: voiceLabel('fi'),
    arVoice: voiceLabel('ar'),
    shahada: shahadaLabel(),
    session,
    locked,
    missing: Array.from(missing),
    recordings: Array.from(recIds)
  };
}

/* Plays one clip as a standalone test (stops anything else). */
async function runTest(clip, opts) {
  stop();
  const t = token;
  seqActive = true;
  const res = await playClip(clip, t, opts);
  if (t === token) { seqActive = false; setKind(null); }
  return res;
}

/* Test buttons of the parent panel. Call inside the tap (it unlocks first). */
export async function test(kind) {
  unlock();
  lastError = null; /* the panel should show what this test found, not an old error */
  stats.fileErr = null;
  if (kind === 'sfx') {
    stop();
    const ok = await context.resume(LOCK_CHECK_MS);
    if (ok) SFX.test();
    return { ok, detail: ctxLabel() + (ok ? '' : ' · Efektit eivät voi soida') };
  }
  if (kind === 'recitation') {
    const src = line('fatiha', 0).src;
    const res = await runTest({ kind: 'recitation', id: null, src, text: '', lang: 'ar' }, { noSilent: true });
    if (res.source === 'file') return { ok: true, detail: 'MP3: OK' + (stats.fileVia ? ' (' + stats.fileVia + ')' : '') + ' · ' + ctxLabel() };
    if (res.source === 'stopped') return { ok: false, detail: locked ? 'Ääni lukittui: napauta Aloita' : 'Keskeytetty' };
    if (missing.has(src)) return { ok: false, detail: 'MP3: puuttuu (' + src + ')' };
    return { ok: false, detail: 'Virhe: ' + (lastError || 'tuntematon') + ' · ' + ctxLabel() };
  }
  if (kind === 'fi' || kind === 'ar') {
    const clip = kind === 'fi' ? prompt('test-fi') : line('shahada', 0);
    const res = await runTest(clip, { force: true, noSilent: true });
    const fileLabel = kind === 'fi' ? 'Suomi-MP3' : 'Shahada-MP3';
    if (res.source === 'recording') return { ok: true, detail: 'Oma äänitys: OK' };
    if (res.source === 'file') return { ok: true, detail: fileLabel + ': OK' };
    if (res.source === 'tts') return { ok: true, detail: fileLabel + ': puuttuu · ' + voiceLabel(kind) };
    if (res.source === 'stopped') return { ok: false, detail: locked ? 'Ääni lukittui: napauta Aloita' : 'Keskeytetty' };
    const fileState = missing.has(clip.src) ? fileLabel + ': puuttuu' : fileLabel + ': virhe' + (lastError ? ' (' + lastError + ')' : '');
    return { ok: false, detail: fileState + ' · ' + voiceLabel(kind) };
  }
  return { ok: false, detail: 'Tuntematon testi: ' + kind };
}

/* ---------- startup ---------- */
tts.init();
refreshRecordings();
recorder.onChange((ev) => {
  if (!ev) return;
  if (ev.type === 'start') stop(); /* never record the app's own voice */
  if (ev.type === 'saved' || ev.type === 'removed') refreshRecordings();
});
