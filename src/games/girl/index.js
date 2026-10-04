/* Girl minigames v3 (OWNER: games-girl): six game modules { id, title, goal, start(S) } in PROMPTS order
   game-girl-0..5 (src/content/prompts.js). Premium soft clay look, princess mood with cute animals; no humans.
   Shared stage / input / feedback helpers: ./kit.js, animal + food art: ./animals.js.
   Styles: src/styles/games-girl.css (fonts: Fredoka from the app). */
import '../../styles/games-girl.css';
import brush from './brush.js';
import feed from './feed.js';
import bath from './bath.js';
import cake from './cake.js';
import meadow from './meadow.js';
import castle from './castle.js';

export default [brush, feed, bath, cake, meadow, castle];
