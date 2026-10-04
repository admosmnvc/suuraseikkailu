/* Shared Web Audio context for the whole app. OWNER: audio agent.

   One AudioContext, created lazily inside the first user tap (creating it earlier only yields a
   suspended context plus a browser warning). Two buses:
     voice bus  gain 1.0 -> destination                  (Web Audio fallback for voice clips, engine.js)
     sfx bus    limiter -> gain SFX_GAIN -> destination  (synthesized effects, clearly quieter)
   It also holds the "what is the voice channel playing" flag so sfx.js can stay silent during
   recitation without importing engine.js (no import cycle). While recitation plays, the sfx output
   is also muted, so the tail of an effect started just before never sounds over a Quran line. */

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

/* SFX level. Effects go: sfx bus (gain 1) -> limiter -> SFX_GAIN -> speakers. The limiter works on the
   full-scale sum (so many simultaneous pops cannot pile up) and its automatic makeup gain is constant;
   SFX_GAIN then sets the final level. Measured with tools/audio-test.cjs: recitation MP3s peak at about
   -4.5 dBFS, effects peak around -15 dBFS, i.e. roughly 10 dB under the recitation. */
const SFX_GAIN = 0.5;

const DUCK_S = 0.02;  /* sfx mute/unmute ramp when recitation starts/ends */

let ctx = null, voiceOut = null, sfxIn = null, sfxOut = null, primed = false, kind = null, unlockedAt = -1e9;
const stateCbs = [];

/* Audio Session API (iOS 17+): 'playback' keeps Web Audio audible when the silent switch is on;
   'play-and-record' while the microphone records (recorder.js). Safe to call often. */
export function setSessionType(type) {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type;
  } catch (e) { /* not supported */ }
}
export function setPlaybackSession() { setSessionType('playback'); }

export function isSupported() { return !!AC; }

/* The context if it exists (never creates one). */
export function get() { return ctx; }

/* Create the context and buses on first use. Returns null when Web Audio is unavailable. */
export function ensure() {
  if (ctx || !AC) return ctx;
  /* before any tap a context could only start suspended (and Chrome logs a warning): wait for the tap */
  try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null; } catch (e) { /* ignore */ }
  try {
    ctx = new AC();
  } catch (e) { ctx = null; return null; }
  try {
    voiceOut = ctx.createGain();
    voiceOut.gain.value = 1;
    voiceOut.connect(ctx.destination);

    sfxOut = ctx.createGain();
    sfxOut.gain.value = kind === 'recitation' ? 0 : SFX_GAIN;
    sfxOut.connect(ctx.destination);
    sfxIn = ctx.createGain();
    sfxIn.gain.value = 1;
    const lim = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
    if (lim) {
      lim.threshold.value = -4; lim.knee.value = 3; lim.ratio.value = 12;
      lim.attack.value = 0.002; lim.release.value = 0.12;
      sfxIn.connect(lim); lim.connect(sfxOut);
    } else {
      sfxIn.connect(sfxOut);
    }
  } catch (e) { /* buses stay null: callers check */ }
  const mine = ctx;
  const onState = () => {
    if (mine !== ctx) return; /* a replaced (closed) context */
    stateCbs.slice().forEach((cb) => { try { cb(state()); } catch (e) { /* ignore */ } });
  };
  try {
    if (ctx.addEventListener) ctx.addEventListener('statechange', onState);
    else ctx.onstatechange = onState;
  } catch (e) { /* ignore */ }
  return ctx;
}

/* Forget the current context (it is closed in the background); the next ensure() makes a new one. */
function drop() {
  const old = ctx;
  ctx = null; voiceOut = null; sfxIn = null; sfxOut = null; primed = false;
  try { const p = old.close(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}

/* 'running' | 'suspended' | 'interrupted' (iOS) | 'closed' | 'none' (not created) | 'unsupported' */
export function state() {
  if (!AC) return 'unsupported';
  return ctx ? String(ctx.state) : 'none';
}

/* SYNC, inside a user tap: create + resume the context and start a 1-sample silent buffer
   (that is what fully unlocks Web Audio on iOS Safari). Never throws.
   iOS can leave a context 'interrupted' for good after a call / Siri / alarm (resume() never
   settles); a new context created inside the tap works, so an interrupted one is replaced. */
export function unlock() {
  setPlaybackSession();
  if (ctx && (ctx.state === 'interrupted' || ctx.state === 'closed')) drop();
  const c = ensure();
  if (!c) return;
  unlockedAt = Date.now();
  try {
    if (c.state !== 'running' && c.state !== 'closed') {
      const p = c.resume();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* ignore */ }
  try {
    if (!primed || c.state !== 'running') {
      primed = true;
      const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource();
      src.buffer = b; src.connect(c.destination); src.start(0);
    }
  } catch (e) { /* ignore */ }
}

/* Try to resume; resolves true if the context is running within `ms`. */
export function resume(ms = 400) {
  const c = ctx;
  if (!c) return Promise.resolve(false);
  if (c.state === 'running') return Promise.resolve(true);
  if (c.state === 'closed') return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(c.state === 'running'); } };
    setTimeout(finish, ms);
    try {
      const p = c.resume();
      if (p && p.then) p.then(finish, finish);
    } catch (e) { finish(); }
  });
}

export function isRunning() { return !!ctx && ctx.state === 'running'; }

/* ms since the last unlock(): right after it a resume may still be pending (sounds then play on resume). */
export function sinceUnlock() { return Date.now() - unlockedAt; }

export function voiceBus() { return voiceOut; }
export function sfxBus() { return sfxIn; }

/* cb(state) whenever the context changes state (also for contexts created later). */
export function onStateChange(cb) { if (typeof cb === 'function') stateCbs.push(cb); }

/* Kind of clip the voice channel is busy with ('recitation' | 'voice' | null). Set by engine.js.
   Recitation mutes the sfx output (cuts tails of effects that started just before). */
export function setVoiceKind(k) {
  const was = kind === 'recitation';
  kind = k || null;
  const duck = kind === 'recitation';
  if (duck === was || !ctx || !sfxOut) return;
  try {
    const g = sfxOut.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(duck ? 0 : SFX_GAIN, t + DUCK_S);
  } catch (e) { /* ignore */ }
}
export function voiceKind() { return kind; }

setPlaybackSession();
