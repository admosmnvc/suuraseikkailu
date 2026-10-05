/* Suuraseikkailu v3 – art/intro.js: ART.intro(orientation) – one calm scene for the animated intro. OWNER: art agent.
   The ui animates it, so every element is its own group with a STABLE id / class (only one intro per page):
     #in-sky  #in-stars (.in-star)  #in-clouds (.in-cloud)  #in-crown  #in-hills  #in-mosque  #in-pony (on the hill
     next to the mosque)  #in-grass  #in-palms (.in-palm)  #in-road (.in-dashes)  #in-rocket (lifting off low on the
     right, crescent & star badge, smoke .art-puff)  #in-flowers (.in-flower)  #in-camel (.in-leg ×4)
     #in-car (.in-wheel ×2, crescent & star pennant)
   Pony, camel, rocket and car are drawn at their FINAL positions (the ui moves them in). The band 38–62 % of the height is
   kept clear for the logo and the start button. Values stay readable in greyscale (the intro starts grey).
   portrait viewBox 390x844, landscape 1600x900; preserveAspectRatio xMidYMid slice. No text, no humans. */
import { uid, f } from './common.js';
import { G, B, keep, lg, lgU, rg, drop, u, fit, cloud, twinkle, softStar, flower } from './soft.js';
import { pony, PONY_BOX, crown, mosque, MOSQUE_BOX } from './girl.js';
import { car, CAR_BOX, rocket, ROCKET_BOX } from './boy.js';
import { camel, CAMEL_BOX, palm, PALM_BOX } from './desert.js';

const L = {
  portrait: {
    w: 390, h: 844,
    back: 'M-20 320C60 296 130 286 195 286C260 286 330 296 410 316V860H-20Z',
    mid: 'M-20 470C90 440 200 446 410 430V860H-20Z',
    grass: 'M-20 568C100 540 280 538 410 556V860H-20Z',
    road: 'M-20 768C120 752 270 754 410 762', roadW: 54,
    mosque: [238, 210, 180], glow: [238, 210, 190],
    clouds: [[64, 66, 0.42], [330, 92, 0.4], [190, 40, 0.3]],
    stars: [[30, 128, 7, 's'], [130, 36, 6, 's'], [362, 160, 7, 's'], [104, 112, 5, 't'], [270, 40, 6, 't'], [18, 214, 5, 't'], [360, 232, 5, 't']],
    rocket: [334, 628, 152, 6], trail: 'M330 712C328 700 328 694 330 688',
    crown: [64, 166, 50, -12],
    pony: [86, 252, 128],
    camel: [96, 652, 160], palms: [[20, 736, 150], [376, 732, 124]],
    car: [254, 740, 172],
    flowers: [[176, 594, 0.65], [262, 610, 0.6], [60, 818, 0.75], [196, 826, 0.65], [330, 818, 0.7]]
  },
  landscape: {
    w: 1600, h: 900,
    back: 'M-20 392C300 346 560 322 800 322C1040 322 1300 346 1620 392V920H-20Z',
    mid: 'M-20 520C400 486 900 500 1620 470V920H-20Z',
    grass: 'M-20 600C400 572 1200 572 1620 600V920H-20Z',
    road: 'M-20 776C500 748 1100 752 1620 766', roadW: 66,
    mosque: [820, 212, 240], glow: [820, 212, 252],
    clouds: [[330, 150, 0.95], [1190, 116, 0.8], [1060, 262, 0.5], [1400, 250, 0.6]],
    stars: [[210, 86, 10, 's'], [610, 60, 7, 's'], [1060, 72, 9, 's'], [1440, 130, 10, 's'], [1290, 300, 6, 't'], [270, 300, 7, 't'], [930, 40, 6, 't']],
    rocket: [1296, 650, 214, 6], trail: 'M1288 770C1286 754 1286 744 1288 734',
    crown: [420, 196, 80, -12],
    pony: [586, 268, 176],
    camel: [380, 652, 214], palms: [[120, 742, 186], [760, 738, 168], [1470, 752, 186]],
    car: [1040, 722, 244],
    flowers: [[300, 628, 0.9], [560, 624, 0.9], [900, 630, 0.95], [262, 858, 0.95], [840, 852, 0.9], [1380, 860, 0.95]]
  }
};

// place native art so its bottom centre sits at (x, baseY), height h
function fitBase(inner, box, x, baseY, h) {
  const k = h / box[3];
  return '<g transform="translate(' + f(x) + ' ' + f(baseY) + ') scale(' + f(Math.round(k * 10000) / 10000) + ') translate(' + f(-(box[0] + box[2] / 2)) + ' ' + f(-(box[1] + box[3])) + ')">' + inner + '</g>';
}

// little smoke puffs where the rocket lifts off
function puffs(r, id) {
  const y = r[1] + r[2] * 0.52, d = r[2] * 0.13;
  return [[-1.5, 0.9], [-0.6, 1.15], [0.5, 1.1], [1.4, 0.85]].map((p, i) => '<circle class="art-puff" style="--art-d:' + (-i * 0.4) + 's" cx="' + f(r[0] + p[0] * d * 1.4) + '" cy="' + f(y - (p[1] - 0.8) * d * 0.4) + '" r="' + f(d * p[1]) + '" fill="' + u(id + '-puff') + '"/>').join('');
}

function pick(orientation) {
  if (orientation === 'portrait' || orientation === 'landscape') return orientation;
  try {
    if (typeof window !== 'undefined' && window.matchMedia) return window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
  } catch (e) { /* no DOM */ }
  return 'portrait';
}

export function intro(orientation) {
  const o = pick(orientation), sp = L[o], id = uid('in'), W = sp.w, H = sp.h;
  // each star sits on a faint white halo so it still reads when the scene is greyscaled
  const star = (s, i) => '<g class="in-star"><circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + f(s[2] * 2.2) + '" fill="' + u(id + '-halo') + '"/>' +
    (s[3] === 's' ? softStar(s[0], s[1], s[2], i % 2 ? '#FFC93C' : '#F7B731', -i * 0.5) : twinkle(s[0], s[1], s[2] * 1.2, '#FFFFFF', -i * 0.5)) + '</g>';
  const m = sp.mosque, p = sp.pony, c = sp.car, r = sp.rocket, cr = sp.crown;
  return '<svg xmlns="http://www.w3.org/2000/svg" class="art art-intro art-intro-' + o + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
    '<defs>' +
    lgU(id + '-sky', [[0, '#AFD4FF'], [0.42, '#DCEAFF'], [0.7, '#FFEFF3'], [1, G.cream]], null, 0, 0, 0, H * 0.62) +
    lg(id + '-back', [[0, '#E7C6EC'], [1, '#D9B9E8']]) + lg(id + '-mid', [[0, '#BDEBDC'], [1, '#A9E3D0']]) +
    lg(id + '-grass', [[0, '#9EE3CB'], [0.45, '#B8EEDB'], [1, '#E2F8EF']]) +
    rg(id + '-sun', [[0, '#FFFFFF', 0.9], [0.5, '#FFFFFF', 0.4], [1, '#FFFFFF', 0]], null, 0.5, 0.5, 0.5) +
    rg(id + '-halo', [[0, '#FFFFFF', 0.95], [0.45, '#FFFFFF', 0.55], [1, '#FFFFFF', 0]], null, 0.5, 0.5, 0.5) +
    rg(id + '-puff', [[0, '#FFFFFF'], [1, '#E2EBFA']], null, 0.4, 0.3, 0.8) +
    drop(id + '-sh', '#9A6FB8', 10, 12, 0.22) + drop(id + '-shr', '#B04450', 10, 10, 0.25) + drop(id + '-shp', '#C0708A', 8, 10, 0.22) +
    drop(id + '-shc', '#C7942A', 8, 8, 0.28) + drop(id + '-shm', '#9C6A3A', 8, 9, 0.24) + drop(id + '-shg', '#3E8A64', 6, 8, 0.18) + '</defs>' +
    '<g id="in-sky"><rect x="-40" y="-40" width="' + (W + 80) + '" height="' + (H + 80) + '" fill="' + u(id + '-sky') + '"/>' +
    '<circle cx="' + f(sp.glow[0]) + '" cy="' + f(sp.glow[1]) + '" r="' + f(sp.glow[2]) + '" fill="' + u(id + '-sun') + '"/></g>' +
    '<g id="in-stars">' + sp.stars.map(star).join('') + '</g>' +
    '<g id="in-clouds">' + sp.clouds.map((q) => '<g class="in-cloud">' + cloud(q[0], q[1], q[2]) + '</g>').join('') + '</g>' +
    '<g id="in-crown"><g filter="' + u(id + '-shc') + '"><g transform="translate(' + f(cr[0]) + ' ' + f(cr[1]) + ') rotate(' + cr[3] + ') scale(' + f(cr[2] / 100) + ') translate(-50 -40)">' + crown(keep, id + '-cr') + '</g></g></g>' +
    '<g id="in-hills"><path d="' + sp.back + '" fill="' + u(id + '-back') + '"/><path d="' + sp.mid + '" fill="' + u(id + '-mid') + '"/></g>' +
    '<g id="in-mosque"><g filter="' + u(id + '-sh') + '">' + fit(mosque(keep, id + '-ms'), MOSQUE_BOX, m[0], m[1], m[2]) + '</g></g>' +
    '<g id="in-pony"><g filter="' + u(id + '-shp') + '">' + fit(pony(keep, id + '-po'), PONY_BOX, p[0], p[1], p[2]) + '</g></g>' +
    '<g id="in-grass"><path d="' + sp.grass + '" fill="' + u(id + '-grass') + '"/></g>' +
    '<g id="in-palms">' + sp.palms.map((q, i) => '<g class="in-palm"><g filter="' + u(id + '-shg') + '">' + fitBase(palm(keep, id + '-pa' + i), PALM_BOX, q[0], q[1], q[2]) + '</g></g>').join('') + '</g>' +
    '<g id="in-road"><path d="' + sp.road + '" stroke="#8C96B6" stroke-width="' + sp.roadW + '" stroke-linecap="round" fill="none"/>' +
    '<path d="' + sp.road + '" stroke="#A3ACC8" stroke-width="' + f(sp.roadW * 0.18) + '" stroke-linecap="round" fill="none" transform="translate(0 ' + f(-sp.roadW * 0.36) + ')" opacity=".6"/>' +
    '<path class="in-dashes" d="' + sp.road + '" stroke="#FFFFFF" stroke-width="' + f(sp.roadW * 0.11) + '" stroke-dasharray="' + f(sp.roadW * 0.6) + ' ' + f(sp.roadW * 0.55) + '" stroke-linecap="round" fill="none" opacity=".9"/></g>' +
    '<g id="in-rocket"><path d="' + sp.trail + '" stroke="#FFFFFF" stroke-width="' + f(r[2] * 0.06) + '" stroke-linecap="round" fill="none" opacity=".8"/>' +
    '<ellipse cx="' + f(r[0]) + '" cy="' + f(r[1] + r[2] * 0.56) + '" rx="' + f(r[2] * 0.3) + '" ry="' + f(r[2] * 0.05) + '" fill="#3E4C78" opacity=".14"/>' +
    '<g filter="' + u(id + '-sh') + '">' + fit(rocket(keep, id + '-ro', { decal: true }), ROCKET_BOX, r[0], r[1], r[2], r[3]) + '</g>' +
    puffs(r, id) + '</g>' +
    '<g id="in-flowers">' + sp.flowers.map((q, i) => '<g class="in-flower">' + flower(q[0], q[1], q[2], i % 3 === 1 ? '#FFD3DF' : '#FFFFFF', i % 3 === 2 ? G.coral : G.gold) + '</g>').join('') + '</g>' +
    '<g id="in-camel"><g filter="' + u(id + '-shm') + '">' + fit(camel(keep, id + '-ca', { legCls: 'in-leg' }), CAMEL_BOX, sp.camel[0], sp.camel[1], sp.camel[2]) + '</g></g>' +
    '<g id="in-car"><g filter="' + u(id + '-shr') + '">' + fit(car(keep, id + '-car', { wheelCls: 'in-wheel', pennant: true }), CAR_BOX, c[0], c[1], c[2]) + '</g></g>' +
    '</svg>';
}

export const INTRO_IDS = ['in-sky', 'in-stars', 'in-clouds', 'in-crown', 'in-hills', 'in-mosque', 'in-pony', 'in-grass', 'in-palms', 'in-road', 'in-rocket', 'in-flowers', 'in-camel', 'in-car'];
