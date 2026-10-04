/* hint.js – the animated cartoon hand that shows a 4-year-old what to do. OWNER: games-core.
   Soft friendly glove (white with gentle shading, theme-coloured cuff, soft shadow, no outline); no face, no person.
   Used through S.hint / S.idleHint (core.js); this module only draws and removes it.

   show({ type: 'tap'|'drag'|'rub'|'hold', at, to?, size? })
     at / to: arena px {x, y} or an Element (its centre). The fingertip sits exactly on `at`.
     tap  = finger comes in, presses, ring pops        drag = press at `at`, slide along a dotted arrow to `to`
     rub  = finger scrubs back and forth around `at`    hold = press and stay down while a ring charges
   Reduced motion: the glove stands still on `at` (drag: plus the dotted arrow) and only pulses softly. */

let hid = 0;
function handSVG() {
  const id = 'mgh' + (++hid);
  const palm = 'M38 54V14Q38 4 46 4Q54 4 54 14V50Q54 42 61 42Q68 42 68 50V54Q68 46 75 46Q82 46 82 54V59Q82 52 88 53Q94 54 94 61V78Q94 101 72 102H50Q37 102 31 92L16 71Q12 64 18 60Q24 56 30 62L38 71Z';
  return '<svg viewBox="0 0 100 124" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="' + id + 'p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9EEF8"/></linearGradient>' +
    '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--mg-c1,#5AB4FF)"/><stop offset="1" stop-color="var(--mg-c2,#2F6BFF)"/></linearGradient></defs>' +
    '<rect x="36" y="98" width="44" height="22" rx="10" fill="url(#' + id + 'c)"/>' +
    '<path d="' + palm + '" fill="url(#' + id + 'p)"/>' +
    '<path d="M54 50V60M68 54V63M82 59V67" stroke="#C9D3E6" stroke-width="3.2" stroke-linecap="round" fill="none"/>' +
    '<path d="M41.5 13V32" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M86 64V80Q86 94 72 95" stroke="#D5DDED" stroke-width="4" stroke-linecap="round" fill="none"/></svg>';
}

function centreOf(arena, at) {
  if (at && typeof at.getBoundingClientRect === 'function') {
    const a = arena.getBoundingClientRect(), r = at.getBoundingClientRect();
    return { x: r.left + r.width / 2 - a.left, y: r.top + r.height / 2 - a.top };
  }
  return { x: (at && +at.x) || 0, y: (at && +at.y) || 0 };
}

export function createHint(arena) {
  let el = null;
  function hide() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }
  function show(spec) {
    hide();
    spec = spec || {};
    const type = /^(tap|drag|rub|hold)$/.test(spec.type) ? spec.type : 'tap';
    const at = centreOf(arena, spec.at);
    el = document.createElement('div');
    el.className = 'mg-hint mg-hint--' + type;
    el.setAttribute('aria-hidden', 'true');
    el.style.left = at.x.toFixed(1) + 'px';
    el.style.top = at.y.toFixed(1) + 'px';
    if (spec.size) el.style.setProperty('--hw', Math.round(spec.size) + 'px');
    let html = '';
    if (type === 'drag') {
      const to = centreOf(arena, spec.to || { x: at.x + 120, y: at.y });
      const dx = to.x - at.x, dy = to.y - at.y, len = Math.hypot(dx, dy);
      el.style.setProperty('--dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--dy', dy.toFixed(1) + 'px');
      html += '<div class="mg-hint-path" style="width:' + len.toFixed(1) + 'px;rotate:' + Math.atan2(dy, dx).toFixed(4) + 'rad"><i></i></div>' +
        '<div class="mg-hint-goal" style="left:' + dx.toFixed(1) + 'px;top:' + dy.toFixed(1) + 'px"></div>';
    }
    if (type === 'rub' && spec.r) el.style.setProperty('--rx', Math.round(spec.r) + 'px');
    html += '<div class="mg-hint-ring"></div><div class="mg-hand">' + handSVG() + '</div>';
    el.innerHTML = html;
    arena.appendChild(el);
    return el;
  }
  return { show: show, hide: hide, get visible() { return !!el; } };
}

export default createHint;
