/* Children's profiles + shared settings, saved on the device (FOUNDATION v3; ui owns it from now on).
   localStorage 'suuraseikkailu-v3':
   { version: 3,
     children: [{ id, name, theme: 'girl'|'boy', level: 'easy'|'medium'|'hard',
                  levelBySection: { <secId>: level },        // last level picked at a surah's start
                  progress: { <secId>: linesDone },                 // completed LINES (castle windows / rocket parts)
                  steps: { <secId>: { easy: n, medium: n } },       // completed cumulative steps per chunk level
                  done: { <secId>: true }, stars, game }],
     activeId,                                               // child playing now (null = none yet)
     settings: { speech, slow, translit, sfx, every: 1|2 } }
   A v1/v2 save ('suuraseikkailu-v1', one child) is migrated once into the first child (theme 'girl'). */
import { THEMES, LEVELS } from './content/prompts.js';

export const KEY = 'suuraseikkailu-v3';
const OLD_KEY = 'suuraseikkailu-v1';
export const NAME_MAX = 24;
export const MAX_CHILDREN = 8;

const int = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.floor(v)) : null);
const cleanName = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

function defaultSettings() { return { speech: true, slow: false, translit: true, sfx: true, every: 1 }; }

function newId() { return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

export function newChild(name, theme, sectionIds) {
  const progress = {};
  (sectionIds || []).forEach((id) => { progress[id] = 0; });
  return {
    id: newId(), name: cleanName(name), theme: THEMES.includes(theme) ? theme : 'girl', level: 'easy',
    levelBySection: {}, progress, steps: {}, done: {}, stars: 0, game: 0
  };
}

function sanitizeChild(raw, sectionIds) {
  if (!raw || typeof raw !== 'object') return null;
  const c = newChild(raw.name, raw.theme, sectionIds);
  if (typeof raw.id === 'string' && raw.id) c.id = raw.id.slice(0, 40);
  if (LEVELS.includes(raw.level)) c.level = raw.level;
  if (raw.levelBySection && typeof raw.levelBySection === 'object') {
    sectionIds.forEach((k) => { if (LEVELS.includes(raw.levelBySection[k])) c.levelBySection[k] = raw.levelBySection[k]; });
  }
  if (raw.progress && typeof raw.progress === 'object') {
    sectionIds.forEach((k) => { const v = int(raw.progress[k]); if (v !== null) c.progress[k] = v; });
  }
  if (raw.steps && typeof raw.steps === 'object') {
    sectionIds.forEach((k) => {
      const v = raw.steps[k];
      if (!v || typeof v !== 'object') return;
      ['easy', 'medium'].forEach((lv) => { const n = int(v[lv]); if (n !== null) (c.steps[k] = c.steps[k] || {})[lv] = n; });
    });
  }
  if (raw.done && typeof raw.done === 'object') sectionIds.forEach((k) => { if (raw.done[k] === true) c.done[k] = true; });
  if (int(raw.stars) !== null) c.stars = int(raw.stars);
  if (int(raw.game) !== null) c.game = int(raw.game);
  return c;
}

function sanitizeSettings(raw) {
  const s = defaultSettings();
  if (!raw || typeof raw !== 'object') return s;
  ['speech', 'slow', 'translit', 'sfx'].forEach((k) => { if (typeof raw[k] === 'boolean') s[k] = raw[k]; });
  if (raw.every === 1 || raw.every === 2) s.every = raw.every;
  return s;
}

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }

/* Loads (and migrates) the store. Always returns a valid object. */
export function loadStore(sectionIds) {
  const ids = sectionIds || [];
  const raw = readJSON(KEY);
  if (raw && typeof raw === 'object' && Array.isArray(raw.children)) {
    const children = raw.children.map((c) => sanitizeChild(c, ids)).filter(Boolean).slice(0, MAX_CHILDREN);
    const seen = new Set();
    children.forEach((c) => { while (seen.has(c.id)) c.id = newId(); seen.add(c.id); });
    const activeId = children.some((c) => c.id === raw.activeId) ? raw.activeId : (children[0] ? children[0].id : null);
    return { version: 3, children, activeId, settings: sanitizeSettings(raw.settings) };
  }
  const store = { version: 3, children: [], activeId: null, settings: defaultSettings() };
  const old = readJSON(OLD_KEY);
  if (old && typeof old === 'object') {
    store.settings = sanitizeSettings(old);
    const hasProgress = old.progress && Object.values(old.progress).some((v) => int(v) > 0);
    if (cleanName(old.name) || hasProgress) {
      /* v2 played whole lines: keep that level for the migrated child */
      const c = sanitizeChild(Object.assign({}, old, { theme: 'girl', level: 'hard', name: cleanName(old.name) || 'Lapsi 1' }), ids);
      store.children.push(c);
      store.activeId = c.id;
    }
  }
  return store;
}

export function saveStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage unavailable: keep going in memory */ }
}

export function activeChild(store) { return store.children.find((c) => c.id === store.activeId) || null; }

/* Adds a child, makes it active, returns it (null when the name is empty or the list is full). */
export function addChild(store, name, theme, sectionIds) {
  if (!cleanName(name) || store.children.length >= MAX_CHILDREN) return null;
  const c = newChild(name, theme, sectionIds);
  store.children.push(c);
  store.activeId = c.id;
  return c;
}

/* patch: { name?, theme?, level? } – progress is never touched here. */
export function updateChild(store, id, patch) {
  const c = store.children.find((x) => x.id === id);
  if (!c || !patch) return null;
  if (patch.name != null && cleanName(patch.name)) c.name = cleanName(patch.name);
  if (THEMES.includes(patch.theme)) c.theme = patch.theme;
  if (LEVELS.includes(patch.level)) c.level = patch.level;
  return c;
}

export function removeChild(store, id) {
  store.children = store.children.filter((c) => c.id !== id);
  if (store.activeId === id) store.activeId = store.children[0] ? store.children[0].id : null;
}

export function setActive(store, id) {
  if (store.children.some((c) => c.id === id)) store.activeId = id;
}

/* Level for a surah: last pick at that surah's start, else the child's default. */
export function levelFor(child, sectionId) {
  return (child && child.levelBySection && LEVELS.includes(child.levelBySection[sectionId]))
    ? child.levelBySection[sectionId] : (child && LEVELS.includes(child.level) ? child.level : 'easy');
}

/* "Aloita alusta" for one child: progress, stickers, stars, minigame turn. Name/theme/levels stay. */
export function resetChild(child, sectionIds) {
  child.progress = {};
  (sectionIds || []).forEach((id) => { child.progress[id] = 0; });
  child.steps = {};
  child.done = {};
  child.stars = 0;
  child.game = 0;
}
