/* MiniGames v3 – short reward games (10–20 s, no losing, instant response). OWNER: games-core.

   import MiniGames from './games/index.js'
     MiniGames.count(theme)  === 6
     MiniGames.titles(theme)  -> the 6 PROMPTS texts 'game-<theme>-0..5' (src/content/prompts.js)
     MiniGames.play({ theme, index, onDone, say }) -> { abort() }
       theme  'girl' | 'boy' (default: <html data-theme>, else 'girl')
       index  any integer, used modulo 6
       say    called once at start with gameId(theme, idx) (the UI plays engine.prompt(id)); later also with short
              exclamation ids from FX_IDS ('fx-vroom', …) when a game calls S.say (rate-limited, max 1 per 2.5 s)
       onDone called once when the game is finished (always a success; auto-finish by ~20 s).
              While the page is hidden the time limit pauses and onDone waits until it is visible again.
   Games: src/games/<theme>/index.js exports an array of 6 modules { id, title, goal?, start(S) } in prompt order.
   A missing / broken theme module or game falls back to a simple built-in "pop the stars/hearts" game. */
import { PROMPTS, GAME_COUNT, gameId } from '../content/prompts.js';
import { startSession } from './core.js';
import '../styles/games.css';

/* eager globs: a theme folder that does not exist yet simply yields {} (no build error) */
const BOY = import.meta.glob('./boy/index.js', { eager: true });
const GIRL = import.meta.glob('./girl/index.js', { eager: true });

function listOf(mods) {
  const m = mods['./boy/index.js'] || mods['./girl/index.js'];
  const arr = m && (Array.isArray(m.default) ? m.default : (Array.isArray(m.games) ? m.games : null));
  return arr || [];
}
const GAMES = { boy: listOf(BOY), girl: listOf(GIRL) };

function themeOf(t) {
  if (t === 'boy' || t === 'girl') return t;
  const h = (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset.theme) || '';
  return h === 'boy' ? 'boy' : 'girl';
}
function valid(g) { return g && typeof g.start === 'function'; }

/* Fallback: pop 10 soft theme stars (boy) / hearts (girl) that appear one after another. */
const STAR = 'M50 7C53 7 55 9 56.5 12.5L64 29 82 31.5C89 32.5 91.5 40 86.5 45L73.5 57.5 76.5 75.5C77.5 82.5 71 87 65 84L50 75.5 35 84C29 87 22.5 82.5 23.5 75.5L26.5 57.5 13.5 45C8.5 40 11 32.5 18 31.5L36 29 43.5 12.5C45 9 47 7 50 7Z';
const HEART = 'M50 88C24 70 8 55 8 35 8 20 19 10 32 10 40 10 46 14 50 21 54 14 60 10 68 10 81 10 92 20 92 35 92 55 76 70 50 88Z';
let fbId = 0;
const FALLBACK = {
  id: 'fallback', goal: 10,
  start(S) {
    let n = 0, cur = null;
    const d = S.theme === 'boy' ? STAR : HEART;
    function spawn() {
      if (!S.active()) return;
      const sz = Math.round(Math.max(80, Math.min(130, Math.min(S.W, S.H) * 0.3)));
      const id = 'mgfb' + (++fbId), c = S.colors[n % 4];
      const el = S.el('button', 'mg-fb mg-pop-in', '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="' + id +
        '" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="' + c +
        '"/><stop offset="1" stop-color="' + c + '"/></radialGradient></defs><path d="' + d + '" fill="url(#' + id + ')"/></svg>');
      el.type = 'button';
      el.setAttribute('aria-label', 'Napauta');
      el.style.width = el.style.height = sz + 'px';
      el.style.left = Math.round(8 + Math.random() * Math.max(0, S.W - sz - 16)) + 'px';
      el.style.top = Math.round(8 + Math.random() * Math.max(0, S.H - sz - 16)) + 'px';
      cur = el;
      S.tap(el, () => {
        if (el.classList.contains('is-gone')) return;
        el.classList.add('is-gone');
        S.burst({ x: el.offsetLeft + sz / 2, y: el.offsetTop + sz / 2 });
        S.snd('pop');
        n++;
        S.point();
        S.later(() => el.remove(), 200);
        S.later(spawn, 220);
      });
      if (n === 0) S.hint({ type: 'tap', at: { x: el.offsetLeft + sz / 2, y: el.offsetTop + sz / 2 } });
    }
    S.idleHint(() => { if (cur) S.hint({ type: 'tap', at: cur }); });
    S.later(spawn, 300);
  }
};

function gameFor(theme, idx) {
  const g = GAMES[theme][idx];
  return valid(g) ? g : FALLBACK;
}

function play(opts) {
  opts = opts || {};
  const theme = themeOf(opts.theme);
  const onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
  let idx = Math.floor(+opts.index) || 0;
  idx = ((idx % GAME_COUNT) + GAME_COUNT) % GAME_COUNT;
  const id = gameId(theme, idx);
  const say = typeof opts.say === 'function' ? opts.say : null;
  const S = startSession({ theme: theme, index: idx, id: id, title: PROMPTS[id] || '', game: gameFor(theme, idx), onDone: onDone, say: say });
  if (!S) { /* no document body: finish right away */
    let t = onDone ? setTimeout(onDone, 0) : 0;
    return { abort: () => { if (t) clearTimeout(t); t = 0; } };
  }
  if (typeof opts.say === 'function') {
    try { opts.say(id); } catch (e) { /* speech is optional */ }
  }
  return { abort: () => S.abort() };
}

export const MiniGames = {
  count: () => GAME_COUNT,
  titles: (theme) => { const t = themeOf(theme); return Array.from({ length: GAME_COUNT }, (_, i) => PROMPTS[gameId(t, i)]); },
  play: play
};
export default MiniGames;
