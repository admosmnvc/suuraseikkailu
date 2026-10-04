/* Soft clay-style animals with cute faces + foods (OWNER: games-girl). SVG strings, viewBox only, no outlines.
   Faces carry two states toggled by CSS on an ancestor: .gg-eat / .is-want (mouth open) and .is-happy (happy eyes).
   Fills use the shared gradients of kit.js (G(key) = url(#gg-key)). */
import { INK, C, G, HL, svg, heartD } from './kit.js';

const LINE = (w) => ' fill="none" stroke="' + INK + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';

/* big shiny eye at (x, y) + happy arc variant */
export function eye(x, y, r) {
  return '<g class="ga-eye"><ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 1.18) + '" fill="' + INK + '"/>' +
    '<circle cx="' + (x - r * 0.32) + '" cy="' + (y - r * 0.42) + '" r="' + (r * 0.4) + '" fill="#fff"/>' +
    '<circle cx="' + (x + r * 0.38) + '" cy="' + (y + r * 0.42) + '" r="' + (r * 0.17) + '" fill="#fff" opacity=".9"/></g>' +
    '<path class="ga-joy" d="M' + (x - r) + ' ' + (y + r * 0.25) + 'Q' + x + ' ' + (y - r * 1.25) + ' ' + (x + r) + ' ' + (y + r * 0.25) + '"' + LINE(r * 0.5) + '/>';
}
export function cheeks(x1, x2, y, r) {
  return '<ellipse cx="' + x1 + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 0.7) + '" fill="url(#gg-blush)"/>' +
    '<ellipse cx="' + x2 + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 0.7) + '" fill="url(#gg-blush)"/>';
}
/* closed smile + open munching mouth */
export function mouth(x, y, w) {
  return '<path class="ga-smile" d="M' + (x - w) + ' ' + y + 'Q' + (x - w / 2) + ' ' + (y + w * 0.7) + ' ' + x + ' ' + y +
    'Q' + (x + w / 2) + ' ' + (y + w * 0.7) + ' ' + (x + w) + ' ' + y + '"' + LINE(3.2) + '/>' +
    '<g class="ga-open"><ellipse cx="' + x + '" cy="' + (y + w * 0.45) + '" rx="' + (w * 0.8) + '" ry="' + (w * 0.75) + '" fill="#B8456A"/>' +
    '<ellipse cx="' + x + '" cy="' + (y + w * 0.85) + '" rx="' + (w * 0.5) + '" ry="' + (w * 0.3) + '" fill="' + C.coral + '"/></g>';
}

/* ---------- feeding friends: 160 x 170 busts ---------- */
export function bunny() {
  return svg('0 0 160 170',
    '<g class="ga-ears"><ellipse cx="58" cy="40" rx="16" ry="40" transform="rotate(-10 58 40)" fill="' + G('white') + '"/>' +
    '<ellipse cx="58" cy="44" rx="8" ry="28" transform="rotate(-10 58 44)" fill="' + G('rose') + '"/>' +
    '<ellipse cx="102" cy="40" rx="16" ry="40" transform="rotate(12 102 40)" fill="' + G('white') + '"/>' +
    '<ellipse cx="102" cy="44" rx="8" ry="28" transform="rotate(12 102 44)" fill="' + G('rose') + '"/></g>' +
    '<ellipse cx="80" cy="168" rx="52" ry="34" fill="' + G('white') + '"/>' +
    '<circle cx="80" cy="100" r="48" fill="' + G('white') + '"/>' + HL(62, 74, 20, 12, -20) +
    eye(62, 94, 8) + eye(98, 94, 8) + cheeks(48, 112, 114, 11) +
    '<ellipse cx="80" cy="108" rx="7" ry="5" fill="' + C.coral + '"/>' +
    '<g class="ga-smile"><path d="M80 113v4M70 117q10 8 20 0"' + LINE(3) + '/><rect x="75" y="120" width="10" height="9" rx="3" fill="#fff" stroke="#E4DAF5" stroke-width="1.5"/></g>' +
    '<g class="ga-open"><ellipse cx="80" cy="124" rx="11" ry="10" fill="#B8456A"/><rect x="75" y="114" width="10" height="7" rx="3" fill="#fff"/></g>');
}
export function kitten() {
  return svg('0 0 160 170',
    '<path d="M34 84Q34 40 42 26Q58 34 78 58Z" fill="' + G('gold') + '"/><path d="M44 68Q44 46 48 40Q58 46 66 58Z" fill="' + G('rose') + '"/>' +
    '<path d="M126 84Q126 40 118 26Q102 34 82 58Z" fill="' + G('gold') + '"/><path d="M116 68Q116 46 112 40Q102 46 94 58Z" fill="' + G('rose') + '"/>' +
    '<ellipse cx="80" cy="168" rx="50" ry="32" fill="' + G('gold') + '"/>' +
    '<ellipse cx="80" cy="98" rx="52" ry="46" fill="' + G('gold') + '"/>' + HL(60, 70, 20, 11, -15) +
    '<path d="M66 56q-3 10 1 16M80 54v16M94 56q3 10-1 16" fill="none" stroke="#F2A93F" stroke-width="6" stroke-linecap="round" opacity=".8"/>' +
    eye(60, 94, 9) + eye(100, 94, 9) + cheeks(44, 116, 112, 11) +
    '<ellipse cx="80" cy="108" rx="7" ry="5" fill="' + C.coral + '"/>' +
    mouth(80, 114, 9) +
    '<path d="M22 104l22 3M24 118l20-4M138 104l-22 3M136 118l-20-4" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" opacity=".4"/>');
}
/* pony bust for the feeding game: side view (long horse muzzle, ears up, short mane on the neck only) */
export function ponyBust() {
  const HEAD = 'M78 36C100 30 122 44 122 64C122 80 112 90 100 96C88 104 72 116 60 124C44 134 22 128 18 112C14 96 26 86 36 80C50 70 60 46 78 36Z';
  return svg('0 0 160 170',
    /* neck + chest */
    '<ellipse cx="96" cy="168" rx="50" ry="30" fill="' + G('snow') + '"/>' +
    '<path d="M72 104C64 130 58 150 56 166Q96 182 140 166C138 136 132 108 120 84Z" fill="' + G('snow') + '"/>' +
    /* short mane along the back of the neck (one side only) */
    '<path d="M110 44Q136 50 138 80Q144 106 136 136Q126 116 122 98Q116 78 104 64Z" fill="' + G('coral') + '"/>' +
    '<path d="M122 76Q142 100 134 128Q128 112 124 100Z" fill="' + G('rose') + '"/>' +
    /* ears, clearly above the head */
    '<path d="M104 46Q110 20 122 8Q128 28 120 50Z" fill="' + G('wall') + '"/>' +
    '<path d="M90 42Q94 16 104 4Q114 22 110 44Z" fill="' + G('snow') + '"/><path d="M96 38Q99 22 104 14Q109 26 106 38Z" fill="' + G('rose') + '"/>' +
    /* head with a long muzzle */
    '<path d="' + HEAD + '" fill="' + G('snow') + '"/>' + HL(92, 50, 16, 8, -20) +
    '<ellipse cx="34" cy="110" rx="21" ry="17" transform="rotate(-25 34 110)" fill="' + G('peach') + '"/>' +
    /* small forelock tuft between the ears */
    '<path d="M98 40Q84 32 74 42Q84 42 88 52Q96 46 98 40Z" fill="' + G('coral') + '"/>' +
    eye(82, 66, 9) +
    '<ellipse cx="68" cy="88" rx="11" ry="7" fill="url(#gg-blush)"/>' +
    '<ellipse cx="24" cy="104" rx="3.5" ry="5" transform="rotate(-20 24 104)" fill="' + INK + '" opacity=".7"/>' +
    mouth(38, 120, 8));
}

/* ---------- foods 100 x 100 ---------- */
export const FOODS = {
  carrot: () => svg('0 0 100 100',
    '<ellipse cx="48" cy="18" rx="9" ry="18" transform="rotate(-30 48 18)" fill="' + G('leaf') + '"/>' +
    '<ellipse cx="66" cy="20" rx="8" ry="17" transform="rotate(40 66 20)" fill="' + G('mint') + '"/>' +
    '<ellipse cx="58" cy="14" rx="7" ry="15" fill="' + G('leaf') + '"/>' +
    '<path d="M38 30Q70 20 74 40L30 94Q20 100 20 88Z" fill="' + G('orange') + '"/>' +
    '<path d="M44 44l10 4M36 60l10 4M30 76l8 3" fill="none" stroke="#E57F38" stroke-width="3.5" stroke-linecap="round" opacity=".55"/>' +
    HL(50, 36, 12, 5, -25)),
  apple: () => svg('0 0 100 100',
    '<path d="M52 26q2-14 10-18" fill="none" stroke="#9C6B4E" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M55 21q14-16 28-8q-12 14-28 8z" fill="' + G('leaf') + '"/>' +
    '<path d="M50 28C30 14 8 30 12 54C16 80 34 94 50 86C66 94 84 80 88 54C92 30 70 14 50 28z" fill="' + G('red') + '"/>' +
    HL(31, 44, 9, 13, 25)),
  fish: () => svg('0 0 100 100',
    '<path d="M68 50L92 30Q98 50 92 70z" fill="' + G('lav') + '"/>' +
    '<path d="M8 50Q30 18 62 26Q78 38 74 50Q78 62 62 74Q30 82 8 50z" fill="' + G('mint') + '"/>' +
    '<path d="M38 66Q48 74 60 70Q50 60 38 66z" fill="' + G('lav') + '" opacity=".8"/>' +
    HL(36, 36, 16, 6, -10) +
    '<circle cx="24" cy="46" r="5" fill="' + INK + '"/><circle cx="22.5" cy="44.5" r="1.8" fill="#fff"/>' +
    '<path d="M14 56q5 4 10 2"' + ' fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>'),
  strawberry: () => svg('0 0 100 100',
    '<path d="M50 30C26 18 8 36 16 58C24 78 42 92 50 94C58 92 76 78 84 58C92 36 74 18 50 30z" fill="' + G('red') + '"/>' +
    '<path d="M30 24Q40 34 50 30Q60 34 70 24Q66 36 50 38Q34 36 30 24Z" fill="' + G('leaf') + '"/>' +
    [[34, 50], [50, 47], [66, 50], [40, 66], [58, 66], [50, 80], [28, 62], [72, 62]].map((p) =>
      '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="2.6" ry="3.8" fill="' + C.gold + '"/>').join('') +
    HL(30, 42, 6, 10, 30)),
  hay: () => svg('0 0 100 100',
    '<path d="M24 20Q50 8 76 20L84 82Q50 96 16 82z" fill="' + G('gold') + '"/>' +
    '<path d="M32 24L28 80M44 18V86M56 18V86M68 24L72 80" fill="none" stroke="#E9B24A" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M16 50Q50 62 84 50L84 62Q50 74 16 62z" fill="' + G('coral') + '"/>' +
    '<path d="M46 58Q34 44 26 48Q26 62 46 58ZM54 58Q66 44 74 48Q74 62 54 58Z" fill="' + G('rose') + '"/>' + HL(40, 26, 12, 5)),
  milk: () => svg('0 0 100 100',
    '<path d="M10 46Q14 86 50 86Q86 86 90 46Z" fill="' + G('rose') + '"/>' +
    '<ellipse cx="50" cy="46" rx="40" ry="12" fill="' + G('white') + '"/>' +
    '<path d="' + heartD(50, 70, 7) + '" fill="#fff" opacity=".9"/>' +
    HL(34, 44, 12, 3))
};

/* thought bubble 120 x 110 (puffs trail down to the animal); the wish icon goes on top in HTML */
export function thought() {
  return svg('0 0 120 110',
    '<circle cx="34" cy="100" r="6" fill="#fff"/><circle cx="46" cy="87" r="9" fill="#fff"/>' +
    '<path d="M24 64Q4 60 10 40Q8 18 32 18Q42 2 62 8Q80 0 92 16Q116 16 112 40Q118 62 96 66Q84 80 62 74Q42 82 24 64z" fill="#fff"/>');
}

/* ---------- butterfly with a cute face (meadow) 100 x 80 ---------- */
export function butterfly(c1, c2) {
  return svg('0 0 100 80',
    '<g class="gb-wl"><path d="M48 40Q20 -6 6 16Q0 34 28 40Q4 50 14 68Q30 80 48 46z" fill="' + G(c1) + '"/>' +
    '<circle cx="22" cy="24" r="6" fill="' + G(c2) + '"/>' + HL(20, 18, 8, 5, -30) + '</g>' +
    '<g class="gb-wr"><path d="M52 40Q80 -6 94 16Q100 34 72 40Q96 50 86 68Q70 80 52 46z" fill="' + G(c1) + '"/>' +
    '<circle cx="78" cy="24" r="6" fill="' + G(c2) + '"/>' + HL(80, 18, 8, 5, 30) + '</g>' +
    '<path d="M46 14Q40 2 34 4M54 14Q60 2 66 4" fill="none" stroke="' + C.plum + '" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="50" cy="48" rx="7" ry="22" fill="' + G('plum') + '"/>' +
    '<circle cx="50" cy="22" r="11" fill="' + G('plum') + '"/>' +
    '<circle cx="46" cy="21" r="2.6" fill="#fff"/><circle cx="54" cy="21" r="2.6" fill="#fff"/>' +
    '<path d="M46 27q4 3 8 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>');
}
