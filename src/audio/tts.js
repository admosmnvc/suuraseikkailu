/* Device speech (speechSynthesis): the LAST resort for voice clips. OWNER: audio agent.
   Rules ported from v1: never speak with a voice of the wrong language (no Finnish text in an
   English voice), keep a reference to live utterances (browsers drop callbacks otherwise), and
   always resolve, also when 'end' never fires (safety timeout). */

const synth = (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis : null;
const hasUtter = typeof window !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';
const voices = { fi: null, ar: null };
const live = [];
let inited = false, used = false;
let seq = 0;  /* bumped per utterance and by cancel(): a stale timeout must not cancel a newer voice */

function langOf(v) { return String((v && v.lang) || '').toLowerCase().replace('_', '-'); }

function pick() {
  if (!synth) return;
  let list = [];
  try { list = synth.getVoices() || []; } catch (e) { list = []; }
  const fi = list.filter((v) => langOf(v).indexOf('fi') === 0);
  const ar = list.filter((v) => langOf(v).indexOf('ar') === 0);
  voices.fi = fi.find((v) => v.localService) || fi[0] || null;
  voices.ar = ar.find((v) => langOf(v) === 'ar-sa') || ar.find((v) => v.localService) || ar[0] || null;
}

/* Idempotent. Voices load late on Android/Chrome: listen to voiceschanged and re-pick a few times. */
export function init() {
  if (inited) return;
  inited = true;
  pick();
  if (!synth) return;
  try {
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pick);
    else synth.onvoiceschanged = pick;
  } catch (e) { /* ignore */ }
  [700, 2500, 6000].forEach((ms) => setTimeout(pick, ms));
}

export function isAvailable() { return !!(synth && hasUtter); }
/* Some Android builds load voices late without a voiceschanged event: look again when none was found. */
function ensureVoice(lang) { init(); if (!voices[lang]) pick(); return voices[lang]; }
export function hasVoice(lang) { return isAvailable() && !!ensureVoice(lang); }
/* Voice name for the test panel, or null. */
export function voiceName(lang) { const v = ensureVoice(lang); return v ? (v.name || v.lang) : null; }

export function cancel() {
  seq++;
  if (!synth || !used) return;
  try { if (synth.speaking || synth.pending) synth.cancel(); } catch (e) { /* ignore */ }
}

/* SYNC, inside a user tap (iOS wants the first utterance there). Zero volume, so nothing is heard. */
export function warm() {
  init();
  if (!isAvailable() || used) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    used = true;
    synth.speak(u);
  } catch (e) { /* ignore */ }
}

/* Resolves true when spoken, false when no voice of that language exists or speech failed. */
export function speak(text, lang, opts = {}) {
  return new Promise((resolve) => {
    const voice = ensureVoice(lang);
    if (!isAvailable() || !voice || !text) { resolve(false); return; }
    const rate = opts.rate || 1;
    const my = ++seq;
    let settled = false, timer = 0, u = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const i = live.indexOf(u);
      if (i > -1) live.splice(i, 1);
      resolve(ok);
    };
    try {
      u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.pitch = 1;
      u.volume = 1;
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      live.push(u);
      used = true;
      if (synth.paused) synth.resume(); /* Chrome can get stuck in a paused state */
      synth.speak(u);
    } catch (e) { finish(false); return; }
    /* 'end' never came (Chrome/Android sometimes lose it): stop this voice so it can neither
       talk over the next clip nor block the speech queue */
    timer = setTimeout(() => { finish(true); if (my === seq) cancel(); }, (2500 + 110 * text.length) / rate);
  });
}
