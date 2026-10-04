/* Suuraseikkailu v3 – art/cover.js: ART.cover() ("two worlds" split by a soft white wave), ART.background(theme)
   and ART.appIcon() – soft premium style. OWNER: art agent.
   Cover: viewBox 1000x1000, xMidYMid slice, two compositions (CSS shows one per orientation):
   portrait  (.art-cv-p) – phones see the strip x 270..730: girl world on top, boy world below;
   landscape (.art-cv-l) – tablets / desktop see the band y 125..875: girl left, boy right.
   The band 45–55 % of the height stays clear in the middle for the ui's start button. No text, no humans. */
import { uid, f, mix, svgOpen } from './common.js';
import { G, B, keep, lg, lgU, rg, drop, blur, u, fit, cloud, twinkle, softStar, flower, puff } from './soft.js';
import { pony, crown, crown100, castle, CASTLE_BOX } from './girl.js';
import { rocket, car, ROCKET_BOX } from './boy.js';

/* ---------- girl world (scene box 600x520; the ground continues far beyond) ---------- */

function girlScene(id) {
  return '<defs>' + lg(id + '-hb', [[0, '#FFD9E3'], [1, '#FFC3D3']]) + lg(id + '-hf', [[0, '#A8EBD4'], [0.3, '#C2F3E3'], [1, '#F3FCF8']]) +
    rg(id + '-sun', [[0, '#FFFFFF', 0.95], [0.5, '#FFFFFF', 0.45], [1, '#FFFFFF', 0]], null, 0.5, 0.5, 0.5) +
    drop(id + '-sh', '#E0708F', 14, 14, 0.22) + drop(id + '-shc', '#D9A43A', 10, 9, 0.28) + '</defs>' +
    '<circle cx="340" cy="230" r="250" fill="' + u(id + '-sun') + '"/>' +
    cloud(500, 96, 1.05) + cloud(86, 70, 0.75) +
    '<path d="M-400 420C-100 340 150 330 300 362C450 392 600 330 1000 360V1000H-400Z" fill="' + u(id + '-hb') + '"/>' +
    '<g filter="' + u(id + '-sh') + '">' + castle(keep, id + '-cs') + '</g>' +
    '<path d="M-400 470C-150 402 120 382 330 396C520 410 700 380 1000 420V1000H-400Z" fill="' + u(id + '-hf') + '"/>' +
    '<path d="M-40 430C60 404 160 392 240 392" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" fill="none" opacity=".45"/>' +
    [[262, 476, 1], [520, 452, 0.85], [36, 488, 0.8], [430, 500, 0.7]].map((p) => flower(p[0], p[1], p[2])).join('') +
    '<g filter="' + u(id + '-sh') + '"><g transform="translate(62 296) scale(.98)">' + pony(keep, id + 'p') + '</g></g>' +
    '<g class="art-float" style="--art-d:-1.2s"><g filter="' + u(id + '-shc') + '" transform="translate(96 120) rotate(-12) scale(.86)">' + crown(keep, id + '-c') + '</g></g>' +
    twinkle(214, 126, 14, G.gold, -0.2) + twinkle(480, 216, 11, '#FFFFFF', -1.1) + twinkle(560, 300, 9, G.gold, -1.8) + twinkle(40, 220, 9, '#FFFFFF', -0.7);
}

/* ---------- boy world (scene box 600x520) ---------- */

function boyScene(id) {
  return '<defs>' + lg(id + '-gr', [[0, '#A2E6DD'], [0.3, '#C2F0EA'], [1, '#F1FBFB']]) +
    rg(id + '-puff', [[0, '#FFFFFF'], [1, '#E2EBFA']], null, 0.4, 0.3, 0.8) + lg(id + '-pad', [[0, '#E6EEFA'], [1, '#BCCBE6']]) +
    drop(id + '-sh', '#3C6FD8', 14, 14, 0.22) + drop(id + '-shr', '#D24B55', 12, 10, 0.25) + '</defs>' +
    cloud(110, 118, 0.9) + cloud(560, 330, 0.7) +
    softStar(226, 92, 15, B.yellow, -0.3) + softStar(556, 214, 10, B.yellow, -1.2) + softStar(80, 262, 9, '#FFFFFF', -0.8) + twinkle(320, 160, 10, '#FFFFFF', -1.6) +
    '<path d="M-400 440C-100 398 200 410 330 420C480 430 700 400 1000 430V1000H-400Z" fill="' + u(id + '-gr') + '"/>' +
    '<path d="M-400 492C-100 466 250 462 420 476C600 490 800 472 1000 470" stroke="#6C7CA6" stroke-width="54" fill="none" stroke-linecap="round"/>' +
    '<path d="M-400 492C-100 466 250 462 420 476C600 490 800 472 1000 470" stroke="#FFF6DA" stroke-width="6" fill="none" stroke-dasharray="34 30" stroke-linecap="round" opacity=".9"/>' +
    '<rect x="372" y="418" width="116" height="16" rx="8" fill="' + u(id + '-pad') + '"/>' +
    puff(370, 424, 26, id + '-puff', 0) + puff(492, 426, 28, id + '-puff', -0.4) + puff(330, 438, 18, id + '-puff', -0.8) + puff(534, 440, 18, id + '-puff', -1.1) +
    '<g class="art-float" style="--art-d:-.5s"><g filter="' + u(id + '-sh') + '">' + rocket(keep, id + '-r') + '</g></g>' +
    '<path d="M40 430H92M24 452H84" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".8"/>' +
    '<g filter="' + u(id + '-shr') + '">' + car(keep, id + '-car', { spin: true }) + '</g>';
}

/* ---------- the two compositions ---------- */

function closeWave(d, corners) {
  return d + corners.map((p) => 'L' + p[0] + ' ' + p[1]).join('') + 'Z';
}

function layer(id, portrait) {
  const g = id + 'g', b = id + 'b';
  const wave = portrait
    ? 'M-60 548C140 470 330 566 500 500C670 434 860 520 1060 452'
    : 'M548 -60C470 140 566 330 500 500C434 670 520 860 452 1060';
  const gc = portrait ? closeWave(wave, [[1060, -60], [-60, -60]]) : closeWave(wave, [[-60, 1060], [-60, -60]]);
  const bc = portrait ? closeWave(wave, [[1060, 1060], [-60, 1060]]) : closeWave(wave, [[1060, 1060], [1060, -60]]);
  const girlT = portrait ? 'translate(314 92) scale(.76)' : 'translate(-16 330) scale(.78)';
  const boyT = portrait ? 'translate(254 540) scale(.8)' : 'translate(512 332) scale(.78)';
  return '<g class="' + (portrait ? 'art-cv-p' : 'art-cv-l') + '"' + (portrait ? '' : ' display="none"') + '>' +
    '<defs><clipPath id="' + g + '-c"><path d="' + gc + '"/></clipPath><clipPath id="' + b + '-c"><path d="' + bc + '"/></clipPath>' +
    lgU(g + '-sky', [[0, '#FFDCE6'], [1, G.cream]], null, 0, portrait ? 0 : 100, 0, portrait ? 520 : 900) +
    lgU(b + '-sky', [[0, '#CFE6FF'], [1, B.cream]], null, 0, portrait ? 480 : 100, 0, portrait ? 1000 : 900) +
    blur(id + '-gl', 10) + '</defs>' +
    '<g clip-path="url(#' + g + '-c)"><rect x="-60" y="-60" width="1120" height="1120" fill="' + u(g + '-sky') + '"/>' +
    '<g transform="' + girlT + '">' + girlScene(g) + '</g></g>' +
    '<g clip-path="url(#' + b + '-c)"><rect x="-60" y="-60" width="1120" height="1120" fill="' + u(b + '-sky') + '"/>' +
    '<g transform="' + boyT + '">' + boyScene(b) + '</g></g>' +
    '<path d="' + wave + '" fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" opacity=".7" filter="' + u(id + '-gl') + '"/>' +
    '<path d="' + wave + '" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>' +
    '</g>';
}

export function cover() {
  const id = uid('cv');
  return svgOpen('cover', '0 0 1000 1000', '', ' preserveAspectRatio="xMidYMid slice"') + layer(id + 'p', true) + layer(id + 'l', false) + '</svg>';
}

/* ---------- wide backdrops (1200x300, xMidYMax slice): very light, transparent sky, the centre carries the motif ---------- */

const pale = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? mix(c, '#FFFFFF', 0.42) : c);

export function background(theme) {
  const t = theme === 'boy' ? 'boy' : 'girl', id = uid('bg');
  const open = '<svg xmlns="http://www.w3.org/2000/svg" class="art art-background art-background-' + t + '" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" aria-hidden="true" focusable="false">';
  if (t === 'girl') {
    const far = 'M-10 310V214C150 172 300 178 450 198C560 212 640 206 700 196C820 176 1000 168 1210 196V310Z';
    const near = 'M-10 310V256C140 228 300 238 450 252C600 266 750 236 900 240C1050 244 1150 236 1210 240V310Z';
    return open + '<defs>' + lg(id + '-f', [[0, '#FFE3EA'], [1, '#FFD6E0']]) + lg(id + '-n', [[0, '#DDF6EC'], [1, '#CDF1E3']]) + '</defs>' +
      cloud(230, 84, 0.7) + cloud(985, 62, 0.6) +
      twinkle(420, 70, 9, G.gold, -0.3) + twinkle(800, 100, 7, G.rose, -1.2) + twinkle(96, 150, 7, G.gold, -2) + twinkle(1120, 130, 8, G.lavender, -0.8) +
      '<path d="' + far + '" fill="' + u(id + '-f') + '"/>' +
      '<g opacity=".8">' + fit(castle(pale, id + '-c'), CASTLE_BOX, 600, 172, 112) + '</g>' +
      '<path d="' + near + '" fill="' + u(id + '-n') + '"/>' +
      '<path d="M120 252C200 238 280 236 350 240" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/>' +
      flower(300, 272, 0.55) + flower(860, 262, 0.5, '#FFFFFF', G.coral) + flower(540, 284, 0.45) +
      '</svg>';
  }
  const far = 'M-10 310V220C150 190 300 196 450 206C600 216 750 186 900 192C1050 198 1150 214 1210 206V310Z';
  const near = 'M-10 310V258C150 238 300 244 450 254C600 264 750 240 900 244C1050 248 1150 244 1210 246V310Z';
  return open + '<defs>' + lg(id + '-f', [[0, '#DFEDFF'], [1, '#CFE3FF']]) + lg(id + '-n', [[0, '#DAF4F0'], [1, '#C6EEE8']]) + '</defs>' +
    cloud(250, 80, 0.7) + cloud(960, 66, 0.6) +
    softStar(420, 64, 8, B.yellow, -0.3) + softStar(820, 96, 6, B.yellow, -1.2) + twinkle(110, 140, 7, '#9FCBFF', -2) + twinkle(1110, 128, 8, '#9FCBFF', -0.8) +
    '<path d="M520 214C556 196 590 174 612 156" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" fill="none" opacity=".75"/>' +
    '<g opacity=".85">' + fit(rocket(pale, id + '-r'), ROCKET_BOX, 640, 132, 86, 52) + '</g>' +
    '<path d="' + far + '" fill="' + u(id + '-f') + '"/>' +
    '<path d="' + near + '" fill="' + u(id + '-n') + '"/>' +
    '<path d="M-10 282C200 268 400 270 600 278C800 286 1000 276 1210 272" stroke="#D3DDF0" stroke-width="14" stroke-linecap="round" fill="none"/>' +
    '<path d="M-10 282C200 268 400 270 600 278C800 286 1000 276 1210 272" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="22 20" stroke-linecap="round" fill="none"/>' +
    '</svg>';
}

/* ---------- app icon: 512x512, soft split, no text, content inside the central 80 % circle (maskable-safe) ---------- */

export function appIcon() {
  const id = uid('app');
  const wave = 'M560 -40C430 90 360 170 256 256C152 342 82 422 -48 552';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' +
    '<defs>' + lgU(id + '-g', [[0, '#FFE6EE'], [1, '#FFC2D3']], null, 0, 0, 300, 300) + lgU(id + '-b', [[0, '#CFE6FF'], [1, '#8EC8FF']], null, 220, 220, 512, 512) +
    '<clipPath id="' + id + '-cg"><path d="' + closeWave(wave, [[-60, -60]]) + '"/></clipPath>' +
    '<clipPath id="' + id + '-cb"><path d="' + closeWave(wave, [[-60, 580], [580, 580], [580, -40]]) + '"/></clipPath>' +
    drop(id + '-sg', '#D9A43A', 12, 12, 0.3) + drop(id + '-sb', '#2F5FCF', 14, 14, 0.3) + blur(id + '-gl', 8) + '</defs>' +
    '<g clip-path="url(#' + id + '-cg)"><rect width="512" height="512" fill="' + u(id + '-g') + '"/>' + cloud(318, 84, 0.55) + '</g>' +
    '<g clip-path="url(#' + id + '-cb)"><rect width="512" height="512" fill="' + u(id + '-b') + '"/>' + cloud(214, 452, 0.6) + '</g>' +
    '<path d="' + wave + '" fill="none" stroke="#FFFFFF" stroke-width="30" opacity=".6" filter="' + u(id + '-gl') + '"/>' +
    '<path d="' + wave + '" fill="none" stroke="#FFFFFF" stroke-width="13"/>' +
    twinkle(112, 300, 16, '#FFFFFF', 0, false) + twinkle(332, 132, 12, G.gold, 0, false) +
    softStar(424, 236, 14, B.yellow, 0, false) + twinkle(250, 430, 11, '#FFFFFF', 0, false) +
    '<g filter="' + u(id + '-sg') + '">' + '<g transform="translate(176 180) rotate(-10) scale(1.9) translate(-50 -50)">' + crown100(keep, id + '-cr') + '</g></g>' +
    '<g filter="' + u(id + '-sb') + '">' + fit(rocket(keep, id + '-ro'), ROCKET_BOX, 340, 336, 250, 45) + '</g>' +
    '</svg>';
}
