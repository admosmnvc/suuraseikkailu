/* App state saved on the device. OWNER: ui agent.
   Shape is v1-compatible (localStorage key 'suuraseikkailu-v1'):
   { progress: { shahada, fatiha, ikhlas, kawthar }, done: {}, stars, name, speech, slow, translit, sfx, every: 1|2, game } */

export const KEY = 'suuraseikkailu-v1';
export const NAME_MAX = 24;

export function defaults(ids) {
  const progress = { shahada: 0, fatiha: 0, ikhlas: 0, kawthar: 0 };
  (ids || []).forEach((id) => { if (!(id in progress)) progress[id] = 0; });
  return { progress, done: {}, stars: 0, name: '', speech: true, slow: false, translit: true, sfx: true, every: 1, game: 0 };
}

function int(v) { return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.floor(v)) : null; }

/* Reads the saved state; anything missing or malformed falls back to the default. */
export function loadState(ids) {
  const s = defaults(ids);
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object') return s;
  if (raw.progress && typeof raw.progress === 'object') {
    Object.keys(s.progress).forEach((k) => { const v = int(raw.progress[k]); if (v !== null) s.progress[k] = v; });
  }
  if (raw.done && typeof raw.done === 'object') {
    Object.keys(s.progress).forEach((k) => { if (raw.done[k] === true) s.done[k] = true; });
  }
  if (int(raw.stars) !== null) s.stars = int(raw.stars);
  if (typeof raw.name === 'string') s.name = raw.name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  ['speech', 'slow', 'translit', 'sfx'].forEach((k) => { if (typeof raw[k] === 'boolean') s[k] = raw[k]; });
  if (raw.every === 1 || raw.every === 2) s.every = raw.every;
  if (int(raw.game) !== null) s.game = int(raw.game);
  return s;
}

export function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable: keep going in memory */ }
}

/* "Aloita alusta": progress, stickers, stars and the minigame turn. Settings (name, switches) stay. */
export function resetProgress(s, ids) {
  const d = defaults(ids);
  s.progress = d.progress;
  s.done = {};
  s.stars = 0;
  s.game = 0;
}
