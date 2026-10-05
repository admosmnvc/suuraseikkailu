/* Parent recordings: MediaRecorder -> IndexedDB. OWNER: audio agent.
   A recording replaces the voice clip with the same id (shahada-1, name, praise-2, ...).
   DB 'suuraseikkailu', store 'recordings', records { id, blob, type, created }.

   Errors thrown by start()/stopAndSave() carry a clear `name` and a Finnish `message`:
     NotSupportedError (no mic API / not HTTPS), NotAllowedError (permission denied),
     NotFoundError (no microphone), InvalidStateError (already recording), AbortError (cancel()
     during the permission prompt), plus the browser's own. */

import { setSessionType } from './context.js';

const DB_NAME = 'suuraseikkailu', STORE = 'recordings';
export const MAX_MS = 15000;
const OPEN_MS = 3000;  /* iOS 14.6 could leave the first indexedDB.open() unanswered: give up, retry next time */

let dbp = null, dbConn = null, session = null, starting = false, abortStart = false;
const cbs = [];

function named(name, message) { const e = new Error(message); e.name = name; return e; }

function emit(ev) { cbs.slice().forEach((cb) => { try { cb(ev); } catch (e) { /* ignore */ } }); }

/* cb({ type: 'saved'|'removed'|'start'|'autostop'|'cancel', id? }). Returns an unsubscribe function. */
export function onChange(cb) {
  if (typeof cb !== 'function') return () => {};
  cbs.push(cb);
  return () => { const i = cbs.indexOf(cb); if (i > -1) cbs.splice(i, 1); };
}

function openDb() {
  if (dbp) return dbp;
  const p = new Promise((resolve, reject) => {
    let req, done = false;
    const fail = (e) => { if (!done) { done = true; clearTimeout(timer); reject(e); } };
    const timer = setTimeout(() => fail(named('TimeoutError', 'Tallennustila ei vastaa.')), OPEN_MS);
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { fail(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      if (done) { try { db.close(); } catch (e) { /* ignore */ } return; } /* answered after the timeout */
      done = true;
      clearTimeout(timer);
      /* Safari drops connections ("Connection to Indexed Database server lost"): reopen next time */
      const forget = () => { if (dbConn === db) { dbConn = null; dbp = null; } };
      db.onclose = forget;
      db.onversionchange = () => { forget(); try { db.close(); } catch (e) { /* ignore */ } };
      dbConn = db;
      resolve(db);
    };
    req.onerror = () => fail(req.error || named('UnknownError', 'Tallennustila ei ole käytössä.'));
    req.onblocked = () => fail(named('InvalidStateError', 'Tallennustila on varattu.'));
  });
  dbp = p;
  p.catch(() => { if (dbp === p) dbp = null; }); /* allow a retry later (e.g. private mode toggled) */
  return p;
}

/* Run one request in a transaction and resolve with its result once the transaction completes.
   A dead connection (iOS after the app was in the background) is reopened once. */
async function run(mode, fn, retried) {
  const db = await openDb();
  try {
    return await runOn(db, mode, fn);
  } catch (e) {
    const n = e && e.name;
    if (retried || n === 'DataCloneError' || n === 'QuotaExceededError' || n === 'ConstraintError') throw e;
    if (dbConn === db) { dbConn = null; dbp = null; try { db.close(); } catch (x) { /* ignore */ } }
    return run(mode, fn, true);
  }
}

function runOn(db, mode, fn) {
  return new Promise((resolve, reject) => {
    let result;
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || req.error || named('AbortError', 'Tallennus keskeytyi.'));
  });
}

export function isSupported() {
  try {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.indexedDB);
  } catch (e) { return false; }
}

/* Sorted ids of all saved recordings ([] when storage is unavailable). */
export async function list() {
  try {
    const keys = await run('readonly', (s) => s.getAllKeys());
    return (keys || []).map(String).sort();
  } catch (e) { return []; }
}

export async function has(id) {
  try { return !!id && (await run('readonly', (s) => s.count(id))) > 0; } catch (e) { return false; }
}

export async function get(id) {
  if (!id) return null;
  let rec;
  try { rec = await run('readonly', (s) => s.get(id)); } catch (e) { return null; }
  if (!rec) return null;
  if (rec.blob instanceof Blob) return rec.blob;
  if (rec.data) return new Blob([rec.data], { type: rec.type || '' }); /* ArrayBuffer fallback, see save() */
  return null;
}

export async function remove(id) {
  if (!id) return;
  await run('readwrite', (s) => s.delete(id));
  emit({ type: 'removed', id });
}

/* Some Safari versions cannot store Blobs in IndexedDB; then store the bytes instead. */
async function save(id, blob) {
  const base = { id, type: blob.type, created: Date.now() };
  try {
    await run('readwrite', (s) => s.put(Object.assign({ blob }, base)));
  } catch (e) {
    const data = await blob.arrayBuffer();
    await run('readwrite', (s) => s.put(Object.assign({ data }, base)));
  }
}

/* Apple WebKit (every iOS browser, Safari): AAC in MP4 is the format it records and plays most
   reliably. Elsewhere Opus in WebM. Each candidate must be recordable AND playable here. */
function pickType() {
  const MR = window.MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  const apple = /apple/i.test(navigator.vendor || '');
  const order = apple
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  let probe = null;
  try { probe = document.createElement('audio'); } catch (e) { probe = null; }
  return order.find((t) => {
    try { return MR.isTypeSupported(t) && (!probe || probe.canPlayType(t.split(';')[0]) !== ''); } catch (e) { return false; }
  }) || '';
}

function stopTracks(stream) {
  try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
}

export function isRecording() { return !!(session && session.rec.state === 'recording'); }

/* Ask for the microphone and start recording. Auto-stops after MAX_MS (the take is kept until
   stopAndSave() or cancel()). opts.onAutoStop() is called when that happens. */
export async function start(opts = {}) {
  if (starting || isRecording()) throw named('InvalidStateError', 'Äänitys on jo käynnissä.');
  if (!isSupported()) throw named('NotSupportedError', 'Tämä selain ei tue äänitystä (tarvitaan HTTPS-osoite).');
  if (session) cancel(); /* an auto-stopped take nobody saved: a new take replaces it */
  let stream;
  starting = true;
  abortStart = false;
  setSessionType('play-and-record'); /* iOS: an explicit 'playback' session would not allow capture */
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    starting = false;
    setSessionType('playback');
    const n = (e && e.name) || 'Error';
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
      throw named('NotAllowedError', 'Mikrofonin käyttö estettiin. Salli mikrofoni selaimen asetuksista.');
    }
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') {
      throw named('NotFoundError', 'Mikrofonia ei löytynyt.');
    }
    throw named(n, 'Mikrofonia ei saatu käyttöön.');
  }
  starting = false;
  if (abortStart) { /* cancel() was called while the permission prompt was open */
    stopTracks(stream); setSessionType('playback');
    throw named('AbortError', 'Äänitys peruttiin.');
  }

  const type = pickType();
  let rec;
  try { rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream); } catch (e) {
    stopTracks(stream);
    setSessionType('playback');
    throw named((e && e.name) || 'NotSupportedError', 'Äänitystä ei voitu aloittaa.');
  }
  const s = { stream, rec, chunks: [], timer: 0, stopped: null };
  s.stopped = new Promise((resolve) => { rec.onstop = resolve; rec.onerror = resolve; });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) s.chunks.push(e.data); };
  session = s;
  /* no timeslice: one complete file at stop() (Safari's fragmented MP4 chunks are less reliable) */
  try { rec.start(); } catch (e) {
    session = null; stopTracks(stream); setSessionType('playback');
    throw named((e && e.name) || 'InvalidStateError', 'Äänitystä ei voitu aloittaa.');
  }
  s.timer = setTimeout(() => {
    if (session !== s || rec.state === 'inactive') return;
    finish(s);
    emit({ type: 'autostop' });
    if (typeof opts.onAutoStop === 'function') { try { opts.onAutoStop(); } catch (e) { /* ignore */ } }
  }, MAX_MS);
  emit({ type: 'start' });
}

/* Stop recorder + microphone; resolves after the final chunk arrived. */
function finish(s) {
  clearTimeout(s.timer);
  try { if (s.rec.state !== 'inactive') s.rec.stop(); } catch (e) { /* ignore */ }
  stopTracks(s.stream);
  setSessionType('playback'); /* back to loudspeaker playback */
  return s.stopped;
}

/* Stop (if still recording) and save the take as recording `id`. Returns the Blob, or null when
   nothing was recorded. */
export async function stopAndSave(id) {
  const s = session;
  if (!s) return null;
  if (!id) throw named('TypeError', 'Äänitykseltä puuttuu tunniste.');
  await finish(s);
  if (session === s) session = null;
  const blob = new Blob(s.chunks, { type: s.rec.mimeType || (s.chunks[0] && s.chunks[0].type) || 'audio/webm' });
  if (!blob.size) return null;
  await save(id, blob);
  emit({ type: 'saved', id });
  return blob;
}

/* Save an audio file the parent picked (settings "Tuo tiedosto") as recording `id`, in the same format
   as stopAndSave(). Accepts audio/* up to ~2 MB; a file without a type (some Android / iOS pickers) is
   accepted by its audio extension. The bytes are copied into memory first, so the stored copy never
   depends on the picked file staying readable. Returns the stored Blob; throws Errors with a Finnish
   message: TypeError (no id), NotFoundError (empty file), TypeMismatchError (not audio),
   QuotaExceededError (too big, or storage full), plus storage errors. */
export async function saveBlob(id, blob) {
  const MAX_BYTES = 2 * 1024 * 1024;
  const EXT = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg',
    oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', caf: 'audio/x-caf', flac: 'audio/flac', aif: 'audio/aiff', aiff: 'audio/aiff' };
  if (!id) throw named('TypeError', 'Äänitykseltä puuttuu tunniste.');
  if (!blob || typeof blob.size !== 'number' || !blob.size) throw named('NotFoundError', 'Tiedosto on tyhjä.');
  const ext = (/\.([a-z0-9]+)$/i.exec(String(blob.name || '')) || [])[1];
  const byExt = ext ? EXT[ext.toLowerCase()] : '';
  const type = /^audio\//i.test(blob.type || '') ? blob.type : (!blob.type && byExt ? byExt : '');
  if (!type) throw named('TypeMismatchError', 'Tiedosto ei ole äänitiedosto. Valitse esimerkiksi MP3- tai M4A-tiedosto.');
  if (blob.size > MAX_BYTES) throw named('QuotaExceededError', 'Tiedosto on liian suuri (enintään 2 Mt). Valitse lyhyempi äänite.');
  let data;
  try {
    data = typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
  } catch (e) {
    throw named('NotReadableError', 'Tiedostoa ei voitu lukea. Yritä uudelleen.');
  }
  const copy = new Blob([data], { type });
  await save(id, copy);
  emit({ type: 'saved', id });
  return copy;
}

/* Discard the current take and release the microphone. */
export function cancel() {
  if (starting) abortStart = true;
  const s = session;
  if (!s) return;
  session = null;
  finish(s);
  emit({ type: 'cancel' });
}
