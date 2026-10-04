/* Small helpers shared by the boy games. OWNER: games-boy. */

/* centre an element on (x, y) arena px with size w x h */
export function put(el, x, y, w, h) {
  const s = el.style;
  if (w != null) s.width = Math.round(w) + 'px';
  if (h != null) s.height = Math.round(h) + 'px';
  const ww = w != null ? w : el.offsetWidth, hh = h != null ? h : el.offsetHeight;
  s.left = Math.round(x - ww / 2) + 'px';
  s.top = Math.round(y - hh / 2) + 'px';
}

/* "tööt tööt": two short blips (no honk in SFX; see report) */
export function honk(S) {
  S.snd('tap');
  S.later(() => S.snd('tap'), 150);
}

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }

/* restart a CSS animation class without forcing layout: remove now, add on the next frame
   (only for decoration that may start a frame later; touch feedback uses S.bump or direct styles) */
export function replay(S, el, cls) {
  el.classList.remove(cls);
  const id = requestAnimationFrame(() => { if (!S.dead) el.classList.add(cls); });
  S.own(() => cancelAnimationFrame(id));
}

/* eyes look towards a client point (pupils .bx-pupil inside el) */
export function lookAt(el, cx, cy, max) {
  if (!el) return;
  const r = el.getBoundingClientRect(), m = max || 4;
  const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, d / 200) * m;
  const t = (dx / d * k).toFixed(1) + 'px ' + (dy / d * k).toFixed(1) + 'px';
  el.querySelectorAll('.bx-pupil').forEach((p) => { p.style.translate = t; });
}

/* the car's eyes follow the finger (one rAF per burst of pointer moves; decoration only) */
export function eyesFollow(S, el) {
  let raf = 0, px = 0, py = 0;
  const go = (e) => {
    px = e.clientX; py = e.clientY;
    if (raf || S.rm) return;
    raf = requestAnimationFrame(() => { raf = 0; if (!S.dead) lookAt(el, px, py, 3.5); });
  };
  S.on(S.arena, 'pointerdown', go, { passive: true });
  S.on(S.arena, 'pointermove', go, { passive: true });
  S.own(() => { if (raf) cancelAnimationFrame(raf); raf = 0; });
}
