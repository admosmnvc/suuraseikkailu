/* Automated checks for src/audio/* (engine, recorder, context, tts, sfx).
   Usage (from the project root):  node tools/audio-test.cjs [--quick] [--shots <dir>]
   Serves the project root statically (real 404s, plus a second server that answers missing files
   with index.html like a single-page-app host) and drives tools/audio-test.html in Chromium.
   --quick skips the full 47 s Al-Fatiha chain and the 15 s recording auto-stop.
   --review runs only reviewChecks() (device-robustness regressions: SFX tails, stuck speech, IndexedDB
   hang / lost connection, interrupted AudioContext, stray media-key playback, restart/stop races). */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const REVIEW_ONLY = process.argv.includes('--review'); /* only the device-robustness checks (reviewChecks) */
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
const FLAGS = ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

function serve(spa) {
  const srv = http.createServer((q, r) => {
    const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    const slow = /[?&]slow=1/.test(q.url) ? 600 : 0; /* ?slow=1: answer late (a fetch still in flight) */
    setTimeout(() => fs.readFile(p, (e, b) => {
      if (e) {
        if (spa) { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><title>app</title>'); return; }
        r.writeHead(404); r.end(); return;
      }
      r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      r.end(b);
    }), slow);
  }).listen(0, '127.0.0.1');
  return new Promise((res) => srv.on('listening', () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port })));
}

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''));
}

async function open(browser, base, query) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const ready = page.waitForEvent('console', { predicate: (m) => m.text() === 'audio-test ready', timeout: 20000 });
  await page.goto(base + '/tools/audio-test.html' + (query || ''));
  await ready;
  return { page, errors };
}

/* console noise we cause on purpose: 404s of deliberately missing files */
function realErrors(errors) { return errors.filter((e) => !/Failed to load resource: the server responded with a status of 404/.test(e)); }

(async () => {
  const main = await serve(false), spa = await serve(true);
  const browser = await chromium.launch({ args: FLAGS });

  /* ================= main page: fake device voices fi + ar ================= */
  const { page, errors } = await open(browser, main.url, '?tts=fake');
  await page.click('#bUnlock');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  if (REVIEW_ONLY) {
    await reviewChecks(browser, main, ev);
    check('no console errors on main page (besides deliberate 404s)', realErrors(errors).length === 0, realErrors(errors));
    await browser.close(); main.srv.close(); spa.srv.close();
    return summary();
  }

  check('unlock -> not locked, context running', await ev(() => !T.engine.isLocked() && T.context.state() === 'running'));
  check('Shahada lines are recitation clips (always on, slow applies)', await ev(() => T.engine.line(T.shahada, 0).kind === 'recitation' && T.engine.line(T.shahada, 0).id === 'shahada-1'));
  check('prompt/meaning clip shape', await ev(() => {
    const p = T.engine.prompt('turn-1'), m = T.engine.meaning(T.fatiha, 2), n = T.engine.prompt('name');
    return p.src === 'audio/fi/turn-1.mp3' && p.kind === 'voice' && p.lang === 'fi' && p.text.length > 0 &&
      m.id === 'mean-fatiha-2' && m.text === T.fatiha.lines[2].fi && n.src === null && n.text === '';
  }));

  /* ---- 1. Al-Fatiha chain 1..7 in order, never overlapping ---- */
  if (!QUICK) {
    const r = await ev(async () => {
      T.resetMax();
      const from = T.log.length, t = performance.now();
      const ok = await T.chain(7, 250);
      const evs = T.log.slice(from);
      return { ok, ms: Math.round(performance.now() - t), max: T.maxSounding,
        playing: evs.filter((e) => e.ev === 'playing').map((e) => e.detail.split(' ')[0]),
        items: evs.filter((e) => e.ev === 'item').map((e) => +e.detail),
        seq: evs.filter((e) => /^sound/.test(e.ev)).map((e) => e.ev) };
    });
    const want = [1, 2, 3, 4, 5, 6, 7].map((n) => '/public/audio/00100' + n + '.mp3');
    check('Fatiha chain resolves true', r.ok, r.ms + ' ms');
    check('Fatiha chain plays 001001..001007 in order', JSON.stringify(r.playing) === JSON.stringify(want), r.playing);
    check('onItem called 0..6 in order', JSON.stringify(r.items) === '[0,1,2,3,4,5,6]', r.items);
    check('never two voices at once (max sounding = 1)', r.max === 1, { max: r.max });
    check('sound start/stop strictly alternate', r.seq.every((s, i) => s === (i % 2 ? 'sound-' : 'sound+')), r.seq.length);
  }

  /* ---- 2. stop() mid-chain cancels instantly ---- */
  {
    const r = await ev(async () => {
      const p = T.chain(7, 250);
      await new Promise((res) => setTimeout(res, 2500));
      const t = performance.now();
      T.engine.stop();
      const ok = await p;
      const dt = performance.now() - t;
      const busy = T.engine.isBusy();
      const from = T.log.length;
      await new Promise((res) => setTimeout(res, 1500));
      return { ok, dt, busy, after: T.log.slice(from).filter((e) => e.ev === 'playing' || e.ev === 'play()').length, sounding: T.sounding };
    });
    check('stop() mid-chain resolves false', r.ok === false);
    check('stop() resolves within 50 ms', r.dt < 50, Math.round(r.dt) + ' ms');
    check('nothing plays after stop()', r.after === 0 && r.sounding === 0 && !r.busy, r);
  }

  /* ---- 3. restart from line 1 (Kuuntele again) ---- */
  {
    const r = await ev(async () => {
      const p1 = T.chain(3, 250);
      await new Promise((res) => setTimeout(res, 7000)); /* now in line 2 */
      const from = T.log.length;
      const p2 = T.chain(3, 250);
      const ok1 = await p1;
      await new Promise((res) => setTimeout(res, 1200));
      const evs = T.log.slice(from);
      T.engine.stop();
      const ok2 = await p2;
      return { ok1, ok2, first: (evs.find((e) => e.ev === 'playing') || {}).detail, item: (evs.find((e) => e.ev === 'item') || {}).detail, max: T.maxSounding };
    });
    check('restart: old chain resolves false', r.ok1 === false);
    check('restart: new chain starts at line 1', /001001\.mp3/.test(r.first || '') && r.item === '0', r.first);
    check('restart: still no overlap', r.max === 1, { max: r.max });
  }

  /* ---- 4. slow mode ---- */
  {
    const r = await ev(async () => {
      T.engine.setSlow(true);
      const from = T.log.length, t = performance.now();
      const ok = await T.engine.play(T.engine.line(T.fatiha, 2)); /* 4.73 s file */
      const ms = performance.now() - t;
      const playing = T.log.slice(from).filter((e) => e.ev === 'playing').map((e) => e.detail);
      const from2 = T.log.length;
      const ok2 = await T.engine.play({ kind: 'voice', src: 'audio/112002.mp3', text: '', lang: 'fi' });
      const voice = T.log.slice(from2).filter((e) => e.ev === 'playing').map((e) => e.detail);
      T.engine.setSlow(false);
      return { ok, ms, playing, ok2, voice };
    });
    check('slow: recitation at rate 0.8 with preservesPitch', r.ok && /rate=0\.8 pitch=true/.test(r.playing[0] || ''), r.playing);
    check('slow: duration stretched (~5.9 s)', r.ms > 5600 && r.ms < 6600, Math.round(r.ms) + ' ms');
    check('slow: voice clips stay at rate 1', r.ok2 && /rate=1 /.test(r.voice[0] || ''), r.voice);
  }

  /* ---- 5. missing MP3 -> device speech -> silent wait ---- */
  {
    const r = await ev(async () => {
      const from = T.log.length;
      const ok = await T.engine.play({ kind: 'voice', id: null, src: 'audio/fi/does-not-exist.mp3', text: 'Hei kaikki', lang: 'fi' });
      const tts = T.log.slice(from).filter((e) => e.ev === 'tts-start').map((e) => e.detail);
      const from2 = T.log.length;
      const okAr = await T.engine.play({ kind: 'recitation', id: null, src: 'audio/nope-ar.mp3', text: 'أَشْهَدُ', lang: 'ar' });
      const ttsAr = T.log.slice(from2).filter((e) => e.ev === 'tts-start').map((e) => e.detail);
      let busyKind = null;
      setTimeout(() => { busyKind = T.engine.busyKind(); }, 1000);
      const t = performance.now();
      const okSilent = await T.engine.play({ kind: 'recitation', id: null, src: 'audio/nope-quran.mp3', text: '', lang: 'ar' });
      const silentMs = performance.now() - t;
      const t2 = performance.now();
      await T.engine.play({ kind: 'voice', id: null, src: 'audio/fi/nope2.mp3', text: '', lang: 'fi' });
      const fiSilentMs = performance.now() - t2;
      return { ok, tts, okAr, ttsAr, okSilent, silentMs, busyKind, fiSilentMs, missing: T.engine.diagnostics().missing };
    });
    check('missing fi MP3 falls through to Finnish device voice', r.ok && /^fi-FI "Hei kaikki".*voice=FakeSatu/.test(r.tts[0] || ''), r.tts);
    check('missing ar file falls through to Arabic voice at rate 0.75', r.okAr && /^ar-SA .*rate=0\.75 voice=FakeMaged/.test(r.ttsAr[0] || ''), r.ttsAr);
    check('no file + no text (Quran line): silent wait ~4 s', r.okSilent && r.silentMs > 3900 && r.silentMs < 4500, Math.round(r.silentMs) + ' ms');
    check('busyKind() = recitation during the silent wait', r.busyKind === 'recitation', r.busyKind);
    check('Finnish clip with nothing to play resolves at once', r.fiSilentMs < 150, Math.round(r.fiSilentMs) + ' ms');
    check('diagnostics lists missing files', r.missing.includes('audio/fi/does-not-exist.mp3'), r.missing);
  }

  /* ---- 6. speech setting ---- */
  {
    const r = await ev(async () => {
      T.engine.setSpeechEnabled(false);
      const from = T.log.length, t = performance.now();
      const ok = await T.engine.play({ kind: 'voice', id: null, src: 'audio/fi/does-not-exist.mp3', text: 'Hei', lang: 'fi' });
      const ms = performance.now() - t;
      const spoke = T.log.slice(from).some((e) => e.ev === 'tts-start' || e.ev === 'play()');
      const from2 = T.log.length;
      const p = T.engine.play(T.engine.line(T.fatiha, 3));
      await new Promise((res) => setTimeout(res, 800));
      const lineplayed = T.log.slice(from2).some((e) => e.ev === 'playing' && /001004/.test(e.detail));
      T.engine.stop(); await p;
      const from3 = T.log.length;
      const okAlways = await T.engine.play(Object.assign(T.engine.prompt('x-preview'), { src: 'audio/fi/nope-preview.mp3', text: 'Esikuuntelu', always: true }));
      const always = T.log.slice(from3).some((e) => e.ev === 'tts-start');
      T.engine.setSpeechEnabled(true);
      return { ok, ms, spoke, linePlayed: lineplayed, okAlways, always };
    });
    check('speech off: Finnish prompt silent, resolves immediately', r.ok && !r.spoke && r.ms < 50, Math.round(r.ms) + ' ms');
    check('speech off: recitation lines still play', r.linePlayed);
    check('speech off: clip.always (settings preview) still plays', r.okAlways && r.always);
  }

  /* ---- 7. play() rejected -> Web Audio fallback ---- */
  {
    const r = await ev(async () => {
      window.__rejectPlay = true;
      const from = T.log.length;
      const ok = await T.engine.play(T.engine.line(T.fatiha, 3));
      await new Promise((res) => setTimeout(res, 50)); /* the test's own 'ended' listener runs after the engine's */
      const evs = T.log.slice(from).map((e) => e.ev + ' ' + e.detail);
      const d = T.engine.diagnostics();
      /* stop during Web Audio playback */
      const p = T.chain(3, 250);
      await new Promise((res) => setTimeout(res, 1000));
      const t = performance.now();
      T.engine.stop();
      const okStop = await p;
      const dt = performance.now() - t;
      await new Promise((res) => setTimeout(res, 100));
      const sounding = T.sounding;
      window.__rejectPlay = false;
      T.engine.unlock();
      const from2 = T.log.length;
      const ok3 = await T.engine.play({ kind: 'voice', src: 'audio/112002.mp3', text: '', lang: 'fi' });
      const backToElement = T.log.slice(from2).some((e) => e.ev === 'playing' && /112002/.test(e.detail));
      return { ok, evs, mp3: d.mp3, lastError: d.lastError, okStop, dt, sounding, ok3, backToElement, locked: T.engine.isLocked() };
    });
    check('play() rejected: clip plays via Web Audio', r.ok && r.evs.some((e) => /^wa-start dur=4\.[67]/.test(e)) && r.evs.some((e) => /^wa-ended/.test(e)), r.evs.filter((e) => /^wa|^play/.test(e)));
    check('play() rejected: diagnostics report it', r.mp3 === 'MP3: OK (Web Audio)' && r.lastError === 'Virhe: NotAllowedError', [r.mp3, r.lastError]);
    check('stop() silences the Web Audio fallback at once', r.okStop === false && r.dt < 50 && r.sounding === 0, { dt: Math.round(r.dt), sounding: r.sounding });
    check('after unlock() the element is used again', r.ok3 && r.backToElement && !r.locked);
  }

  /* ---- 8. lock detection ---- */
  {
    const r = await ev(async () => {
      const c = T.context.get(), origResume = c.resume;
      const locks = [];
      const off = T.engine.onLockChange((v) => locks.push(v));
      c.resume = () => new Promise(() => {}); /* the browser refuses to resume (iOS after background) */
      const p = T.chain(3, 250);
      await new Promise((res) => setTimeout(res, 800));
      await c.suspend();
      await new Promise((res) => setTimeout(res, 700));
      /* the element does not need the context: the clip must keep playing, lock decided when idle */
      const keptPlaying = T.engine.isBusy() && !T.engine.isLocked() && T.sounding === 1;
      T.engine.stop(); /* e.g. "Sanoin!" */
      const okChain = await p;
      await new Promise((res) => setTimeout(res, 600));
      const lockedAfterSuspend = T.engine.isLocked();
      c.resume = origResume;
      T.engine.unlock();
      await new Promise((res) => setTimeout(res, 300));
      const state = T.context.state();
      /* play() refused AND context not running -> locked */
      c.resume = () => new Promise(() => {});
      await c.suspend();
      await new Promise((res) => setTimeout(res, 600));
      c.resume = origResume; T.engine.unlock(); await new Promise((res) => setTimeout(res, 200));
      window.__rejectPlay = true;
      c.resume = () => new Promise(() => {});
      await c.suspend();
      await new Promise((res) => setTimeout(res, 600)); /* statechange lock fires here */
      c.resume = origResume; T.engine.unlock(); await new Promise((res) => setTimeout(res, 200));
      const locks2 = locks.length;
      c.resume = () => new Promise(() => {});
      await c.suspend(); /* no statechange check while hidden: simulate a direct play attempt */
      const okBlocked = await T.engine.play(T.engine.line(T.fatiha, 3));
      const lockedByPlay = T.engine.isLocked();
      window.__rejectPlay = false;
      c.resume = origResume;
      T.engine.unlock();
      await new Promise((res) => setTimeout(res, 300));
      off();
      return { locks, locks2, keptPlaying, okChain, lockedAfterSuspend, state, okBlocked, lockedByPlay, final: T.engine.isLocked(), finalState: T.context.state() };
    });
    check('context dies during a clip: the element keeps playing (no cut)', r.keptPlaying === true);
    check('...and once idle -> onLockChange(true)', r.okChain === false && r.lockedAfterSuspend && r.locks[0] === true, r.locks);
    check('unlock() -> onLockChange(false), context running again', r.locks[1] === false && r.state === 'running', { locks: r.locks, state: r.state });
    check('play() refused + context not running -> locked', r.okBlocked === false && r.lockedByPlay, r);
    check('unlocked again at the end', !r.final && r.finalState === 'running', r);
  }

  /* ---- 9. background: hidden stops the voice; visible re-checks the lock ---- */
  {
    const r = await ev(async () => {
      const setHidden = (h) => {
        Object.defineProperty(document, 'hidden', { value: h, configurable: true });
        Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const p = T.chain(3, 250);
      await new Promise((res) => setTimeout(res, 800));
      setHidden(true);
      const ok = await p;
      const c = T.context.get(), origResume = c.resume;
      c.resume = () => new Promise(() => {});
      await c.suspend(); /* iOS suspends audio in the background */
      await new Promise((res) => setTimeout(res, 600));
      const lockedWhileHidden = T.engine.isLocked();
      setHidden(false);
      await new Promise((res) => setTimeout(res, 700));
      const lockedOnReturn = T.engine.isLocked();
      c.resume = origResume;
      T.engine.unlock();
      await new Promise((res) => setTimeout(res, 200));
      delete document.hidden; delete document.visibilityState;
      return { ok, lockedWhileHidden, lockedOnReturn, final: T.engine.isLocked() };
    });
    check('hidden: voice channel stops', r.ok === false);
    check('hidden: no lock flag while in background', r.lockedWhileHidden === false);
    check('visible again with a dead context -> locked (gate shows)', r.lockedOnReturn === true);
    check('gate tap unlocks again', r.final === false);
  }

  /* ---- 10. recording roundtrip (fake mic) ---- */
  {
    const r = await ev(async () => {
      const events = [];
      const off = T.recorder.onChange((e) => events.push(e.type));
      const supported = T.recorder.isSupported();
      const chainP = T.chain(2, 250);
      await new Promise((res) => setTimeout(res, 500));
      await T.recorder.start();
      const stoppedVoice = (await chainP) === false && !T.engine.isBusy();
      const rec = T.recorder.isRecording();
      let dup = null;
      try { await T.recorder.start(); } catch (e) { dup = e.name; }
      await new Promise((res) => setTimeout(res, 2000));
      const blob = await T.recorder.stopAndSave('shahada-1');
      await T.engine.refreshRecordings();
      const list = await T.recorder.list();
      const has = await T.recorder.has('shahada-1');
      const got = await T.recorder.get('shahada-1');
      const diagRec = T.engine.diagnostics().recordings;
      const from = T.log.length, t = performance.now();
      const ok = await T.engine.play(T.engine.line(T.shahada, 0));
      const ms = performance.now() - t;
      const playing = T.log.slice(from).filter((e) => e.ev === 'playing').map((e) => e.detail);
      const test = await T.engine.test('ar');
      await T.recorder.remove('shahada-1');
      await T.engine.refreshRecordings();
      const list2 = await T.recorder.list();
      const from2 = T.log.length;
      const ok2 = await T.engine.play(T.engine.line(T.shahada, 0));
      const after = T.log.slice(from2).filter((e) => e.ev === 'playing' || e.ev === 'tts-start').map((e) => e.ev + ' ' + e.detail);
      off();
      return { supported, stoppedVoice, rec, dup, size: blob && blob.size, type: blob && blob.type, list, has, gotSize: got && got.size, diagRec, ok, ms, playing, test, list2, ok2, after, events };
    });
    check('recorder supported + recording', r.supported && r.rec);
    check('recording start silences the voice channel', r.stoppedVoice);
    check('second start() rejects with InvalidStateError', r.dup === 'InvalidStateError', r.dup);
    check('stopAndSave returns a non-empty audio blob', r.size > 1000 && /^audio\//.test(r.type), { size: r.size, type: r.type });
    check('saved in IndexedDB (list/has/get)', r.list.includes('shahada-1') && r.has && r.gotSize === r.size, r.list);
    check('engine knows the recording', r.diagRec.includes('shahada-1'), r.diagRec);
    check('Shahada line plays the parent recording first', r.ok && /^blob\(audio\//.test(r.playing[0] || '') && r.ms > 1500, { playing: r.playing, ms: Math.round(r.ms) });
    check('test("ar") reports the own recording', r.test.ok && r.test.detail === 'Oma äänitys: OK', r.test);
    check('remove() deletes it', !r.list2.includes('shahada-1'));
    check('after remove: falls back to file / device voice', r.ok2 && !r.after.some((e) => /blob\(audio/.test(e)) && r.after.length > 0, r.after);
    check('onChange events', ['start', 'saved', 'removed'].every((t) => r.events.includes(t)), r.events);
  }

  if (!QUICK) {
    const r = await ev(async () => {
      let auto = 0;
      await T.recorder.start({ onAutoStop: () => { auto++; } });
      await new Promise((res) => setTimeout(res, T.recorder.MAX_MS + 700));
      const rec = T.recorder.isRecording();
      const blob = await T.recorder.stopAndSave('name');
      const a = new Audio(URL.createObjectURL(blob));
      await new Promise((res) => { a.onloadedmetadata = res; a.onerror = res; setTimeout(res, 3000); });
      await T.recorder.remove('name');
      return { auto, rec, size: blob && blob.size };
    });
    check('recording auto-stops after 15 s and the take is kept', r.auto === 1 && !r.rec && r.size > 1000, r);
  }

  /* ---- 11. SFX: levels, never over recitation, no melodies ---- */
  {
    const r = await ev(async () => {
      const c = T.context.get();
      const tap = c.__tap;
      const buf = new Float32Array(tap.fftSize);
      const peakOf = async (fn, ms = 1400) => {
        let peak = 0;
        fn();
        const end = performance.now() + ms;
        while (performance.now() < end) {
          tap.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > peak) peak = v; }
          await new Promise((res) => setTimeout(res, 60));
        }
        return peak;
      };
      const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120);
      await new Promise((res) => setTimeout(res, 800)); /* let the analyser window clear */
      const names = ['pop', 'ding', 'chime', 'plop', 'whoosh', 'boom', 'sparkle', 'success', 'tap'];
      const sfx = {};
      for (const n of names) sfx[n] = +db(await peakOf(() => T.SFX[n](0))).toFixed(1);
      /* a burst of simultaneous effects (fast tapping in a game) must stay under the recitation too */
      const burst = +db(await peakOf(() => { for (let k = 0; k < 12; k++) setTimeout(() => { T.SFX.pop(); T.SFX.ding(k); }, k * 15); })).toFixed(1);
      /* recitation peak level straight from the files */
      let recPeak = 0, recRmsSum = 0, recN = 0;
      for (let n = 1; n <= 7; n++) {
        const ab = await (await fetch('audio/00100' + n + '.mp3')).arrayBuffer();
        const b = await c.decodeAudioData(ab);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > recPeak) recPeak = v; recRmsSum += d[i] * d[i]; recN++; }
      }
      /* skipped while recitation plays */
      const p = T.engine.play(T.engine.line(T.fatiha, 3));
      await new Promise((res) => setTimeout(res, 400));
      const before = window.__oscCount;
      T.SFX.pop(); T.SFX.success(); T.SFX.ding(1);
      const during = window.__oscCount - before;
      T.engine.stop(); await p;
      const b2 = window.__oscCount; T.SFX.pop(); const afterStop = window.__oscCount - b2;
      /* pitch of single clinks for i = 0..5 */
      const firstFreq = (fn) => { window.__oscFreqs = []; fn(); return window.__oscFreqs[0]; };
      const chime = [0, 1, 2, 3, 4, 5].map((i) => firstFreq(() => T.SFX.chime(i)));
      const ding = [0, 1, 2, 3, 4, 5].map((i) => firstFreq(() => T.SFX.ding(i)));
      window.__oscFreqs = []; T.SFX.success(); const succ = window.__oscFreqs.slice();
      T.SFX.setEnabled(false); const b3 = window.__oscCount; T.SFX.pop(); const disabled = window.__oscCount - b3;
      const test = await T.engine.test('sfx'); const forced = window.__oscCount - b3;
      T.SFX.setEnabled(true);
      return { sfx, burst, recPeakDb: +db(recPeak).toFixed(1), recRmsDb: +db(Math.sqrt(recRmsSum / recN)).toFixed(1), during, afterStop, chime, ding, succ, disabled, forced, test };
    });
    const loudest = Math.max(...Object.values(r.sfx));
    check('SFX peaks ~10 dB under recitation peak (8..14 dB)', loudest <= r.recPeakDb - 8 && loudest >= r.recPeakDb - 14, { recitationPeak: r.recPeakDb, recitationRms: r.recRmsDb, sfxPeaks: r.sfx });
    check('burst of 12 pops+dings is limited (still under recitation peak)', r.burst < r.recPeakDb - 2, { burst: r.burst });
    check('every SFX is audible (> -45 dBFS)', Object.values(r.sfx).every((v) => v > -45), r.sfx);
    check('SFX skipped while recitation plays', r.during === 0 && r.afterStop > 0, { during: r.during, afterStop: r.afterStop });
    const semis = (arr) => arr.map((f) => 12 * Math.log2(f / arr[0]));
    const noRun = (arr) => !(arr[1] > arr[0] && arr[2] > arr[1]);
    const cs = semis(r.chime), ds = semis(r.ding);
    check('chime(i): one clink, pitch wobble < 1.6 semitone, no rising run', Math.max(...cs) - Math.min(...cs) < 1.6 && noRun(r.chime), cs.map((v) => v.toFixed(2)));
    check('ding(i): one clink, pitch wobble < 1.6 semitone, no rising run', Math.max(...ds) - Math.min(...ds) < 1.6 && noRun(r.ding), ds.map((v) => v.toFixed(2)));
    const tonal = r.succ.filter((f) => f < 3000);
    check('success(): one clink + high glitter (no arpeggio)', tonal.length === 1 && r.succ.filter((f) => f >= 3000).length >= 6, { tonalUnder3k: tonal, total: r.succ.length });
    check('setEnabled(false) mutes, test("sfx") still plays', r.disabled === 0 && r.forced > 0 && r.test.ok && r.test.detail === 'AudioContext: running', r.test);
  }

  /* ---- 12. parent test panel ---- */
  {
    const r = await ev(async () => ({
      rec: await T.engine.test('recitation'),
      fi: await T.engine.test('fi'),
      ar: await T.engine.test('ar'),
      diag: T.engine.diagnostics()
    }));
    check('test("recitation")', r.rec.ok && /^MP3: OK · AudioContext: running$/.test(r.rec.detail), r.rec);
    check('test("fi") (file or device voice)', r.fi.ok && /Suomi-MP3: OK|Suomen puheääni: löytyi/.test(r.fi.detail), r.fi);
    check('test("ar") (file or device voice)', r.ar.ok && /Shahada-MP3: OK|Arabian puheääni: löytyi/.test(r.ar.detail), r.ar);
    check('diagnostics strings', /^MP3: OK/.test(r.diag.mp3) && r.diag.context === 'AudioContext: running' && /^Suomen puheääni: /.test(r.diag.fiVoice) && /^Arabian puheääni: /.test(r.diag.arVoice) && Array.isArray(r.diag.recordings), r.diag);
  }
  /* ---- 13. real teacher-voice files (made by tools/make_voices.py), when present ---- */
  {
    const have = ['shahada-1.mp3', 'shahada-2.mp3', 'fi/turn-all.mp3', 'fi/praise-1.mp3'].every((f) => fs.existsSync(path.join(ROOT, 'public/audio', f)));
    if (!have) {
      check('teacher-voice files: not generated yet (skipped)', true);
    } else {
      const r = await ev(async () => {
        T.resetMax();
        const from = T.log.length;
        const clips = [T.engine.line(T.shahada, 0), T.engine.line(T.shahada, 1), T.engine.prompt('turn-all'), T.engine.prompt('praise-1'), T.engine.prompt('name')];
        await T.engine.preload(clips);
        const ok = await T.engine.playSequence(clips, { gapMs: 200 });
        const evs = T.log.slice(from);
        /* one entry per play() call (a 'playing' after a 'waiting' stall is a resume, not a new clip) */
        return { ok, max: T.maxSounding, playing: evs.filter((e) => e.ev === 'play()').map((e) => e.detail.split(' ')[0]),
          evs: evs.filter((e) => !/^sound/.test(e.ev)).map((e) => e.ev + ' ' + e.detail.split(' ')[0]) };
      });
      const want = ['/public/audio/shahada-1.mp3', '/public/audio/shahada-2.mp3', '/public/audio/fi/turn-all.mp3', '/public/audio/fi/praise-1.mp3'];
      check('Shahada files + Finnish prompts play in order, no overlap ("name" without recording = nothing)', r.ok && r.max === 1 && JSON.stringify(r.playing) === JSON.stringify(want), r.ok && r.max === 1 && JSON.stringify(r.playing) === JSON.stringify(want) ? r.playing : r);
    }
  }
  await reviewChecks(browser, main, ev);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, 'audio-test-page.png'), fullPage: true }); }
  check('no console errors on main page (besides deliberate 404s)', realErrors(errors).length === 0, realErrors(errors));
  await page.close();

  /* ================= only a Finnish voice: never Arabic with a wrong voice ================= */
  {
    const { page: p2, errors: e2 } = await open(browser, main.url, '?tts=fake-fi');
    await p2.click('#bUnlock');
    const r = await p2.evaluate(async () => {
      const from = T.log.length, t = performance.now();
      const ok = await T.engine.play({ kind: 'recitation', id: null, src: 'audio/nope-ar.mp3', text: 'أَشْهَدُ', lang: 'ar' });
      const ms = performance.now() - t;
      const spoke = T.log.slice(from).filter((e) => e.ev === 'tts-start');
      const test = await T.engine.test('ar');
      return { ok, ms, spoke: spoke.length, test, ar: T.engine.diagnostics().arVoice };
    });
    check('no Arabic voice: never speaks Arabic with another voice, waits ~4 s', r.ok && r.spoke === 0 && r.ms > 3900, { ms: Math.round(r.ms) });
    check('diagnostics: Arabian puheääni: ei löytynyt', r.ar === 'Arabian puheääni: ei löytynyt', r.ar);
    check('test("ar") without file/voice reports why', /Shahada-MP3: OK/.test(r.test.detail) ? r.test.ok : (!r.test.ok && /Shahada-MP3: puuttuu · Arabian puheääni: ei löytynyt/.test(r.test.detail)), r.test);
    check('no console errors (fi-only page)', realErrors(e2).length === 0, realErrors(e2));
    await p2.close();
  }

  /* ================= single-page-app host: missing files come back as index.html ================= */
  {
    const { page: p3, errors: e3 } = await open(browser, spa.url, '?tts=fake');
    await p3.click('#bUnlock');
    const r = await p3.evaluate(async () => {
      const from = T.log.length;
      const ok = await T.engine.play({ kind: 'voice', id: null, src: 'audio/fi/does-not-exist.mp3', text: 'Hei', lang: 'fi' });
      const evs = T.log.slice(from).map((e) => e.ev);
      return { ok, evs, missing: T.engine.diagnostics().missing };
    });
    check('SPA host: HTML answer counts as missing -> device voice', r.ok && r.evs.includes('tts-start') && !r.evs.includes('play()') && r.missing.includes('audio/fi/does-not-exist.mp3'), r.evs);
    check('no console errors (SPA host)', realErrors(e3).length === 0, realErrors(e3));
    await p3.close();
  }
  await browser.close();

  /* ================= default autoplay policy: nothing before the tap, everything after ================= */
  {
    const b2 = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required', '--use-fake-device-for-media-stream'] });
    /* (page.evaluate counts as a user gesture in Playwright, so the page itself tries to play on load) */
    const { page: p4, errors: e4 } = await open(b2, main.url, '?tts=fake&autoplay');
    const before = await p4.evaluate(() => window.__autoplay);
    check('before the gate tap: locked, playback refused cleanly', !before.userActivation && !before.ok && before.locked && before.lastError === 'Virhe: NotAllowedError', before);
    await p4.click('#bUnlock');
    const after = await p4.evaluate(async () => {
      const from = T.log.length;
      const ok = await T.engine.play({ kind: 'voice', src: 'audio/112002.mp3', text: '', lang: 'fi' });
      return { ok, locked: T.engine.isLocked(), ctx: T.context.state(), el: T.log.slice(from).some((e) => e.ev === 'playing') };
    });
    check('after the gate tap: unlocked, element plays, context running', after.ok && !after.locked && after.el && after.ctx === 'running', after);
    const denied = await p4.evaluate(async () => {
      const orig = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      let r;
      try { await T.recorder.start(); r = 'started'; } catch (e) { r = e.name + ': ' + e.message; }
      navigator.mediaDevices.getUserMedia = orig;
      return { r, recording: T.recorder.isRecording() };
    });
    check('microphone denied -> NotAllowedError with Finnish message', /^NotAllowedError: Mikrofonin käyttö estettiin/.test(denied.r) && !denied.recording, denied);
    const after2 = await p4.evaluate(async () => { try { await T.recorder.start(); T.recorder.cancel(); return 'ok'; } catch (e) { return e.name; } });
    check('recorder usable again after a denial', after2 === 'ok' || after2 === 'NotAllowedError' || after2 === 'NotSupportedError', after2);
    check('no console errors (default policy)', realErrors(e4).length === 0, realErrors(e4));
    await b2.close();
  }

  main.srv.close(); spa.srv.close();
  summary();
})().catch((e) => { console.error(e); process.exit(2); });

function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
}

/* ================= device-robustness checks (adversarial review) =================
   Each block reproduces a failure seen (or documented) on real phones/tablets, simulated in Chromium. */
async function reviewChecks(browser, main, ev) {
  /* pages that need their own setup; opened first so that > 6 s have passed when they are checked */
  const late = await open(browser, main.url, '?tts=fake-late');
  const lateT0 = Date.now();
  const hang = await open(browser, main.url, '?tts=fake&idb=hang');

  /* R1. SFX tails (a boom or success shimmer triggered just before) must not sound over recitation */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const clip = T.engine.line(T.fatiha, 3);
      await T.engine.preload([clip]);
      const c = T.context.get();
      const a = c.createAnalyser(); a.fftSize = 512; c.__tap.connect(a); /* ~11 ms window */
      const buf = new Float32Array(a.fftSize);
      const peakFor = async (ms) => {
        let peak = 0; const end = performance.now() + ms;
        while (performance.now() < end) { a.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i])); await sleep(5); }
        return peak > 0 ? +(20 * Math.log10(peak)).toFixed(1) : -120;
      };
      await sleep(900);
      const from = T.log.length;
      T.SFX.success(); T.SFX.boom();
      const p = T.engine.play(clip);
      const t0 = performance.now();
      while (!T.log.slice(from).some((e) => e.ev === 'playing') && performance.now() - t0 < 3000) await sleep(2);
      const startMs = Math.round(performance.now() - t0);
      await sleep(45);
      const during = await peakFor(350);
      T.engine.stop(); await p;
      await sleep(60);
      T.SFX.pop();
      const after = await peakFor(250);
      a.disconnect();
      return { startMs, during, after };
    });
    check('R1 SFX tails are silenced while recitation sounds (< -60 dBFS)', r.during < -60, r);
    check('R1 SFX level is back after the recitation', r.after > -30, r);
  }

  /* R2. Device speech that never fires 'end' (Chrome/Android) must not keep talking over the next clip */
  {
    const r = await ev(async () => {
      T.resetMax();
      window.__ttsStuckOnce = true;
      const from = T.log.length, t = performance.now();
      const ok = await T.engine.playSequence([
        { kind: 'voice', id: null, src: 'audio/fi/nope-stuck.mp3', text: 'Hei taas', lang: 'fi' },
        { kind: 'voice', id: null, src: 'audio/112002.mp3', text: '', lang: 'fi' }
      ]);
      const ms = Math.round(performance.now() - t);
      const max = T.maxSounding;
      const evs = T.log.slice(from).filter((e) => /^tts|^playing|^sound/.test(e.ev)).map((e) => e.ev + ' ' + e.detail);
      T.engine.stop();
      return { ok, ms, max, evs };
    });
    check('R2 stuck device speech is cancelled before the next clip (max sounding 1)', r.ok && r.max === 1, r);
  }

  /* R3. Interrupted/stuck AudioContext (iOS after a call/Siri: state 'interrupted', resume() never settles):
         the gate tap must bring Web Audio back, not leave the effects dead for the whole session */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const c = T.context.get();
      c.resume = () => new Promise(() => {});
      await c.suspend();
      Object.defineProperty(c, 'state', { get: () => 'interrupted', configurable: true });
      c.dispatchEvent(new Event('statechange'));
      await sleep(1600);
      const lockedBefore = T.engine.isLocked();
      T.engine.unlock(); /* the gate tap */
      await sleep(400);
      const c2 = T.context.get();
      const res = { lockedBefore, recreated: c2 !== c, state: c2 && c2.state, locked: T.engine.isLocked() };
      if (c2 && c2.__tap) {
        const buf = new Float32Array(c2.__tap.fftSize);
        let peak = 0;
        T.SFX.pop();
        const end = performance.now() + 500;
        while (performance.now() < end) { c2.__tap.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i])); await sleep(40); }
        res.sfxDb = peak > 0 ? +(20 * Math.log10(peak)).toFixed(1) : -120;
      }
      delete c.state;
      await sleep(100);
      res.oldState = c.state;
      res.diag = T.engine.diagnostics().context;
      return res;
    });
    check('R3 interrupted context: gate shown (locked)', r.lockedBefore === true, r);
    check('R3 gate tap recreates a running AudioContext, SFX audible again', r.recreated && r.state === 'running' && !r.locked && r.sfxDb > -40, r);
    check('R3 old context is closed', r.oldState === 'closed', r.oldState);
  }

  /* R4. A media key / lock-screen "play" while the app is idle must not resume a stopped recitation */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const p = T.chain(2, 250);
      await sleep(900);
      T.engine.stop(); await p;
      const el = window.__el;
      const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
      await sleep(500);
      const res = { paused: el.paused, sounding: T.sounding, busy: T.engine.isBusy() };
      el.pause();
      await sleep(50);
      /* the engine itself still plays normally afterwards */
      res.ok = await T.engine.play({ kind: 'voice', id: null, src: 'audio/112002.mp3', text: '', lang: 'fi' });
      return res;
    });
    check('R4 stray play() on the idle element is paused at once', r.paused && r.sounding === 0 && !r.busy, r);
    check('R4 engine playback unaffected', r.ok === true, r);
  }

  /* R5. Kuuntele tapped again during line 1: restarts line 1 from the beginning */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const p1 = T.engine.play(T.engine.line(T.fatiha, 1));
      await sleep(1800);
      const posBefore = window.__el.currentTime;
      const p2 = T.engine.play(T.engine.line(T.fatiha, 1));
      await sleep(250);
      const pos = window.__el.currentTime;
      T.engine.stop();
      return { ok1: await p1, ok2: await p2, posBefore, pos };
    });
    check('R5 same line restarts from 0 (Kuuntele again)', r.ok1 === false && r.posBefore > 1 && r.pos < 0.6, r);
  }

  /* R6. Five fast Kuuntele taps: only one voice, every old chain resolves false */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      T.resetMax();
      const from = T.log.length, ps = [];
      for (let k = 0; k < 5; k++) { ps.push(T.chain(2, 250)); await sleep(12); }
      await sleep(1500);
      const playing = T.log.slice(from).filter((e) => e.ev === 'playing').map((e) => e.detail.split(' ')[0]);
      const max = T.maxSounding;
      T.engine.stop();
      const res = await Promise.all(ps);
      await sleep(100); /* the element's 'pause' event is a task after stop() */
      return { res, max, last: playing[playing.length - 1], sounding: T.sounding };
    });
    check('R6 rapid taps: one voice at a time, all chains resolve false on stop', r.max === 1 && r.res.every((v) => v === false) && /001001/.test(r.last || '') && r.sounding === 0, r);
  }

  /* R7. "Sanoin!" while the clip is still being fetched: nothing may start afterwards */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const from = T.log.length;
      const p = T.engine.play({ kind: 'recitation', id: null, src: 'audio/108002.mp3?slow=1', text: '', lang: 'ar' });
      await sleep(150);
      T.engine.stop();
      const ok = await p;
      await sleep(1200);
      return { ok, started: T.log.slice(from).filter((e) => e.ev === 'play()' || e.ev === 'playing').length, sounding: T.sounding };
    });
    check('R7 stop() during fetch: resolves false, nothing starts later', r.ok === false && r.started === 0 && r.sounding === 0, r);
  }

  /* R8. iOS "Connection to Indexed Database server lost" after background: recordings must still play */
  {
    const r = await ev(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      await T.recorder.start();
      await sleep(1200);
      await T.recorder.stopAndSave('shahada-2');
      await T.engine.refreshRecordings();
      const orig = IDBDatabase.prototype.transaction;
      let dead = null;
      IDBDatabase.prototype.transaction = function () {
        if (dead === null) dead = this;
        if (this === dead) throw new DOMException('The database connection is closing.', 'InvalidStateError');
        return orig.apply(this, arguments);
      };
      const from = T.log.length;
      const ok = await T.engine.play(T.engine.line(T.shahada, 1));
      const playing = T.log.slice(from).filter((e) => e.ev === 'playing').map((e) => e.detail.split(' ')[0]);
      const list = await T.recorder.list();
      IDBDatabase.prototype.transaction = orig;
      await T.recorder.remove('shahada-2');
      await T.engine.refreshRecordings();
      return { ok, playing, list };
    });
    check('R8 lost IndexedDB connection: reconnects, own recording still plays', r.ok && /^blob\(audio\//.test(r.playing[0] || '') && r.list.includes('shahada-2'), r);
  }

  /* R9. indexedDB.open never answers (iOS 14.6 first-open hang): Finnish prompts must not hang forever */
  {
    await hang.page.click('#bUnlock');
    const r = await hang.page.evaluate(async () => {
      const t = performance.now(), from = T.log.length;
      const to = (p) => Promise.race([p, new Promise((res) => setTimeout(() => res('hang'), 9000))]);
      const ok = await to(T.engine.play(T.engine.prompt('turn-1')));
      const ms = Math.round(performance.now() - t);
      const played = T.log.slice(from).some((e) => e.ev === 'playing' && /turn-1/.test(e.detail));
      const list = await to(T.recorder.list());
      const ms2 = Math.round(performance.now() - t);
      return { ok, ms, played, list, ms2 };
    });
    check('R9 IndexedDB hang: prompt still plays (no endless wait)', r.ok === true && r.played && r.ms < 4000, r);
    check('R9 IndexedDB hang: recorder.list() gives up with []', Array.isArray(r.list) && r.list.length === 0, r);
    check('R9 no console errors (IndexedDB hang page)', realErrors(hang.errors).length === 0, realErrors(hang.errors));
    await hang.page.close();
  }

  /* R10. Device voices that appear late without a voiceschanged event (some Android builds) */
  {
    const wait = 6800 - (Date.now() - lateT0);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    await late.page.click('#bUnlock');
    const r = await late.page.evaluate(async () => {
      const before = T.tts.hasVoice('fi');
      window.__addVoice({ name: 'FakeLate', lang: 'fi-FI', localService: true, default: false, voiceURI: 'late' });
      const from = T.log.length;
      const ok = await T.engine.play({ kind: 'voice', id: null, src: 'audio/fi/nope-late.mp3', text: 'Moi', lang: 'fi' });
      return { before, ok, spoke: T.log.slice(from).some((e) => e.ev === 'tts-start' && /FakeLate/.test(e.detail)), diag: T.engine.diagnostics().fiVoice };
    });
    check('R10 late device voice is found without voiceschanged', r.before === false && r.ok && r.spoke && /FakeLate/.test(r.diag), r);
    await late.page.close();
  }
}
