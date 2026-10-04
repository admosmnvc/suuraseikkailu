/* MiniGames - short reward games (10-20 s, no losing, big forgiving targets). OWNER: games agent.

   import MiniGames from './games/index.js'
     MiniGames.count  === 8
     MiniGames.titles  = PROMPTS['game-0'..'game-7'] (src/content/prompts.js)
     MiniGames.play({ index, onDone, say }) -> { abort() }
       index  any integer, used modulo 8
       say    called once at start with the prompt id 'game-<i>' (the UI plays engine.prompt(id))
       onDone called once when the game is finished (always a success; auto-finish at ~18 s).
              While the page is hidden the time limit pauses and onDone waits until it is visible again.
   Framework: ./core.js, art: ./svg.js, one file per game. */
import { PROMPTS, GAME_COUNT, gameId } from '../content/prompts.js';
import { startSession } from './core.js';
import * as balloons from './balloons.js';
import * as snowflakes from './snowflakes.js';
import * as bubbles from './bubbles.js';
import * as lanterns from './lanterns.js';
import * as fruits from './fruits.js';
import * as sky from './sky.js';
import * as crown from './crown.js';
import * as palace from './palace.js';

/* index order is fixed by PROMPTS game-0..7 */
const GAMES = [balloons, snowflakes, bubbles, lanterns, fruits, sky, crown, palace];
if (GAMES.length !== GAME_COUNT && window.console) console.warn('MiniGames: expected ' + GAME_COUNT + ' games');

function play(opts) {
  opts = opts || {};
  const onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
  let idx = Math.floor(+opts.index) || 0;
  idx = ((idx % GAMES.length) + GAMES.length) % GAMES.length;
  const S = startSession(idx, GAMES[idx].GOAL, GAMES[idx].game, onDone);
  if (!S) { /* no document body: finish right away */
    let t = onDone ? setTimeout(onDone, 0) : 0;
    return { abort: () => { if (t) clearTimeout(t); t = 0; } };
  }
  if (typeof opts.say === 'function') {
    try { opts.say(gameId(idx)); } catch (e) { /* speech is optional */ }
  }
  return { abort: () => S.abort() };
}

export const MiniGames = {
  count: GAMES.length,
  titles: GAMES.map((g, i) => PROMPTS[gameId(i)]),
  play: play
};
export default MiniGames;
