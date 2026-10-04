/* SFX: short synthesized sound effects (Web Audio, no files). OWNER: audio agent.
   Ported from v1 games.js, same names. Rules:
   - All effects go through the shared context's SFX bus (context.js), clearly quieter than voice.
   - Skipped while the voice channel plays recitation (never over a Quran line).
   - No music: no scale runs, no arpeggios. success() is a shimmer + one soft clink; ding(i)/chime(i)
     are single clinks whose pitch only wobbles slightly with i (a few tenths of a semitone). */
import { rand } from '../util.js';
import * as context from './context.js';

/* Pitch wobble in semitones for ding(i)/chime(i). Zig-zag, never a rising run for i = 0, 1, 2... */
const WOBBLE = [0, -0.6, 0.4, -0.3, 0.7, -0.8, 0.2, -0.45, 0.55];
/* High glitter pings of the shimmer: deliberately unordered, inharmonic frequencies (Hz). */
const GLITTER = [5200, 4300, 6100, 3900, 5650, 4700, 6400, 4100, 5000];

export const SFX = (function () {
  let enabled = true, noiseBuf = null;
  let c = null, out = null; /* context + bus for the effect being scheduled */

  function env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function osc(type, f0, f1, t, attack, decay, peak, glide) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + (glide || attack + decay));
    env(g, t, attack, peak, decay);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + attack + decay + 0.03);
  }
  function getNoise() {
    if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
      const len = Math.floor(c.sampleRate * 2);
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noise(t, dur, peak, type, f0, f1, q, attack) {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    const a = attack || 0.004;
    src.buffer = getNoise();
    f.type = type; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, peak, Math.max(0.01, dur - a));
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.2);
    src.stop(t + dur + 0.05);
  }
  /* A glassy clink: sine body + two inharmonic partials (bell-like, not a musical note run). */
  function clink(t, f, peak, decay) {
    osc('sine', f, 0, t, 0.003, decay, peak);
    osc('sine', f * 2.76, 0, t, 0.002, decay * 0.35, peak * 0.22);
    osc('sine', f * 5.4, 0, t, 0.001, decay * 0.14, peak * 0.1);
  }
  /* Glitter: n tiny high pings, quickly fading, plus a soft airy noise swell. */
  function shimmer(t, n, peak, spacing) {
    for (let k = 0; k < n; k++) {
      osc('sine', GLITTER[k % GLITTER.length] * rand(0.97, 1.03), 0, t + k * spacing, 0.002, 0.07, peak * (1 - k / (n + 2)));
    }
    noise(t, 0.08 + n * spacing, peak * 0.7, 'highpass', 6500, 9000, 0.7, 0.03);
  }
  function wobble(i, base) {
    const k = Math.abs(Math.round(+i || 0)) % WOBBLE.length;
    return base * Math.pow(2, WOBBLE[k] / 12);
  }

  /* Schedule fn(t) on the SFX bus if allowed. force = parent test button (ignores the settings switch). */
  function play(fn, force) {
    if (!force && (!enabled || context.voiceKind() === 'recitation')) return;
    const ctx = context.get(), bus = context.sfxBus();
    if (!ctx || !bus || ctx.state === 'closed') return;
    if (ctx.state !== 'running') {
      try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      /* right after unlock() the resume is still pending: schedule anyway, it sounds on resume */
      if (context.sinceUnlock() > 800) return;
    }
    c = ctx; out = bus;
    try { fn(ctx.currentTime + 0.005); } catch (e) { /* audio node trouble: stay silent */ }
  }

  function success(force) {
    play((t) => {
      clink(t, 1975.5, 0.2, 0.6);
      shimmer(t + 0.03, 8, 0.06, 0.04);
    }, force);
  }

  return {
    unlock: function () { context.unlock(); },
    setEnabled: function (b) { enabled = !!b; },
    pop: function () {
      play((t) => {
        noise(t, 0.05, 0.2, 'bandpass', 2600, 900, 1.2, 0.002);
        osc('sine', 820, 180, t, 0.004, 0.1, 0.25, 0.075);
      });
    },
    ding: function (i) {
      play((t) => {
        const f = wobble((Math.round(+i) || 0) + 3, 1760); /* offset: ding and chime wobble differently */
        clink(t, f, 0.24, 0.42);
        osc('triangle', f * 2, 0, t, 0.002, 0.06, 0.03);
      });
    },
    chime: function (i) {
      play((t) => {
        const f = wobble(i, 1318.5);
        osc('sine', f, 0, t, 0.01, 0.6, 0.16);
        osc('sine', f * 2.4, 0, t, 0.006, 0.26, 0.05);
        osc('sine', f * 4.1, 0, t, 0.003, 0.1, 0.02);
      });
    },
    plop: function () {
      play((t) => {
        osc('sine', 360, 105, t, 0.004, 0.14, 0.32, 0.1);
        noise(t, 0.05, 0.12, 'lowpass', 700, 300, 0.7, 0.003);
      });
    },
    whoosh: function () {
      play((t) => { noise(t, 0.5, 0.3, 'bandpass', 380, 2800, 1.3, 0.2); });
    },
    boom: function () {
      play((t) => {
        osc('sine', 110, 40, t, 0.01, 0.42, 0.3, 0.3);
        noise(t, 0.36, 0.17, 'lowpass', 800, 150, 0.7, 0.008);
        for (let k = 0; k < 7; k++) {
          noise(t + 0.12 + Math.random() * 0.36, 0.025, 0.04 + Math.random() * 0.04, 'highpass', 4200, 0, 0.7, 0.001);
        }
      });
    },
    sparkle: function () {
      play((t) => { shimmer(t, 4, 0.09, 0.045); });
    },
    success: function () { success(false); },
    tap: function () {
      play((t) => { osc('triangle', 1500, 900, t, 0.001, 0.03, 0.12, 0.03); });
    },
    /* parent "Testaa äänet": plays even when effects are switched off in settings */
    test: function () { success(true); }
  };
})();

export default SFX;
