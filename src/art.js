/* Suuraseikkailu v3 – art.js: every piece of artwork as an inline SVG string, PREMIUM soft style
   (clay / 3D-lite: gentle gradients, soft coloured shadows, no outlines, no halftone).
   OWNER: art agent. Contract: CONTRACTS.md "Art API v3". Implementation lives in src/art/*.js:
   common.js (utilities, geometry, CSS), soft.js (palettes, gradients, shadows), icons.js, girl.js, boy.js,
   pieces.js (stickers, avatars, badge, bubble, levels, verse marker), cover.js (cover, backgrounds, app icon),
   intro.js (the animated intro scene, stable ids #in-*).

   Rules: no humans or human faces anywhere (animals may have faces), no brands, no text inside the art
   (except Arabic-Indic digits in the verse marker). Runtime state is CSS-driven via `.on`:
     progress girl  .pw[data-i]    mosque window glows (last = .pw-heart star window)             progress boy  .rp[data-i]   rocket part springs in
     reward (both)  .slot[data-i]  gem / rocket part springs in
   When every part is on, `.art-done-fx` (halo / flame / smoke) shows: class `art-complete` at render time,
   or live via :has() when the ui switches the last part on. Boy progress: add class `art-launch` to the SVG to
   fly the rocket away. All motion respects prefers-reduced-motion. */
import { injectCSS, arabicDigits, starPath, themeOf, svgOpen, isHex, esc, sparklePath, uid } from './art/common.js';
import { G, keep, ghost, lg, u } from './art/soft.js';
import { icon, ICON_NAMES } from './art/icons.js';
import { mosqueProgress, crownReward, gem as gemMotif, tiara as tiaraMotif } from './art/girl.js';
import { rocketProgress, rocketReward } from './art/boy.js';
import { sticker as stickerV3, avatar, burst, bubble, levelIcon, ayah, MOTIFS } from './art/pieces.js';
import { cover, background, appIcon } from './art/cover.js';
import { intro, INTRO_IDS } from './art/intro.js';

injectCSS();

/* ---------- Art API v3 ---------- */

function progress(theme, opts) {
  const o = opts || {};
  return themeOf(theme) === 'boy' ? rocketProgress(o) : mosqueProgress(o);
}

function reward(theme, opts) {
  const o = opts || {};
  return themeOf(theme) === 'boy' ? rocketReward(o) : crownReward(o);
}

// v3: sticker(theme, id, earned); v2 call sticker(id, earned) still works (theme from <html data-theme>)
function sticker(a, b, c) {
  if (a === 'girl' || a === 'boy') return stickerV3(a, b, c);
  return stickerV3(themeOf(), a, b);
}

// extra: any single motif as a standalone SVG (100x100): pony, pony-head, pony-crown, bunny, tiara, crown, mosque (castle = alias),
// gem, heart, car, rocket, trophy, helmet, flag (aliases horse, horse-crown). earned === false = soft ghost.
function motif(name, cls, earned) {
  const fn = MOTIFS[name];
  if (!fn) return '';
  return svgOpen('motif', '0 0 100 100', 'art-motif-' + esc(name) + (cls ? ' ' + esc(cls) : '')) +
    fn(earned === false ? ghost : keep, uid('mot')) + '</svg>';
}

/* ---------- v2 compatibility (thin wrappers, removed once every caller is on v3) ---------- */

function gem(color, cls) {
  return svgOpen('gem', '0 0 100 100', cls) + gemMotif(keep, uid('gem'), isHex(color) ? color : G.lavender) + '</svg>';
}
function crystal(cls) { return gem('#8FD3FF', cls); }
function tiara(color, cls) {
  return svgOpen('tiara', '0 0 100 100', cls) + tiaraMotif(keep, uid('tia'), isHex(color) ? color : G.coral) + '</svg>';
}
function crown(opts) { return crownReward(opts || {}); }
function palace(opts) {
  const o = opts || {};
  return mosqueProgress({ total: o.windows, done: o.lit, cls: o.cls });
}
function palaceSilhouette() { return background(themeOf()); }
function snowflake(cls) {
  const id = uid('spk');
  return svgOpen('sparkle', '0 0 100 100', cls) + '<defs>' + lg(id, [[0, '#FFFFFF'], [1, '#FFE7A6']]) + '</defs>' +
    '<path d="' + sparklePath(50, 50, 44) + '" fill="' + u(id) + '"/></svg>';
}

export const ART = {
  // v3
  icon, cover, intro, avatar, progress, reward, sticker, burst, bubble, background, levelIcon, ayah, arabicDigits, appIcon,
  // extras
  motif, starPath, ICON_NAMES, INTRO_IDS,
  // v2 wrappers
  crystal, gem, tiara, crown, palace, palaceSilhouette, snowflake
};
export default ART;
