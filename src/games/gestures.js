/* gestures.js – instant pointer gestures for the minigames. OWNER: games-core.

   Every handler runs synchronously inside the pointer event, so the first visual change (a class, a
   translate, whatever the callback does) lands in the same frame as the touch. No easing, no debounce,
   no queues. Pointer capture keeps a gesture alive when the finger slides off the element.
   Only one pointer per element at a time (a second finger on the same element is ignored).

   Each function returns off() (removes the listeners, ends a running gesture). Inside a game use the
   session versions S.tap / S.drag / S.rub / S.hold – they are cleaned up automatically.

   Points p (all client / viewport px; S.local(p.x, p.y) gives arena px):
     { x, y,        pointer now
       dx, dy,      pointer offset from the pointerdown
       cx, cy,      centre of the element now (drag: start centre + offset)
       el, e }      the element, the raw event

   tap(el, fn(p))                        pointerdown = tap (keyboard Enter/Space also calls fn)
   drag(el, { onStart(p), onMove(p), onEnd(p) -> keep?, follow = true, enabled() })
        follow: the element follows the finger 1:1 via the CSS `translate` property (composes with the
        element's own transform / animations). onEnd returning true keeps it where it was dropped;
        anything else glides it back home (class mg-back, ~0.2 s). To snap it somewhere: position the
        element yourself, call clearDrag(el), return true.
   rub(el, { onStart(p), onRub(dist, x, y, p), onEnd(p), enabled() })
        dist = px the pointer travelled since the last move event (x, y = client px)
   hold(el, { onStart(p), onHold(ms, dt, p), onRelease(ms, p), enabled() })
        onHold runs every animation frame while pressed (ms = total held this press, dt = frame ms)

   While a gesture runs the element has the class is-down (+ is-dragging / is-rubbing / is-holding).
   Events a gesture used get e.__mgUsed = true (the core then skips its generic "empty tap" sparkle). */

const ACTIVE = { passive: false };

function add(el, type, fn, offs) {
  el.addEventListener(type, fn, ACTIVE);
  offs.push(() => el.removeEventListener(type, fn, ACTIVE));
}
function capture(el, id) { try { el.setPointerCapture(id); } catch (e) { /* synthetic pointer */ } }
function release(el, id) { try { if (el.hasPointerCapture && el.hasPointerCapture(id)) el.releasePointerCapture(id); } catch (e) { /* gone */ } }
function centre(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function ok(o) { return !o.enabled || o.enabled(); }
function call(fn, a, b, c, d) { if (typeof fn === 'function') return fn(a, b, c, d); return undefined; }

/* the base translate a kept drag left behind */
function baseOf(el) { return el.__mgBase || (el.__mgBase = { x: 0, y: 0 }); }
export function clearDrag(el) {
  if (!el) return;
  el.__mgBase = { x: 0, y: 0 };
  el.style.translate = '';
  el.classList.remove('mg-back');
}

/* Pointer session shared by drag / rub / hold: down -> capture -> moves -> up/cancel. */
function track(el, o, cls, h) {
  const offs = [];
  let id = null, sx = 0, sy = 0, c0 = null, lastX = 0, lastY = 0;
  function pt(e) {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    return { x: e.clientX, y: e.clientY, dx: dx, dy: dy, cx: c0.x + dx, cy: c0.y + dy, el: el, e: e };
  }
  function down(e) {
    if (id !== null || (e.button != null && e.button > 0) || !ok(o)) return;
    if (e.cancelable) e.preventDefault();
    e.__mgUsed = true;
    id = e.pointerId;
    capture(el, id);
    sx = lastX = e.clientX; sy = lastY = e.clientY;
    c0 = centre(el);
    el.classList.add('is-down', cls);
    h.start(pt(e));
  }
  function move(e) {
    if (e.pointerId !== id) return;
    if (e.cancelable) e.preventDefault();
    e.__mgUsed = true;
    const p = pt(e), d = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    h.move(p, d);
  }
  function end(e) {
    if (e.pointerId !== id) return;
    e.__mgUsed = true;
    const p = pt(e);
    release(el, id);
    id = null;
    el.classList.remove('is-down', cls);
    h.end(p, e.type === 'pointercancel');
  }
  add(el, 'pointerdown', down, offs);
  add(el, 'pointermove', move, offs);
  add(el, 'pointerup', end, offs);
  add(el, 'pointercancel', end, offs);
  add(el, 'lostpointercapture', end, offs);
  return function off() {
    if (id !== null) { release(el, id); id = null; el.classList.remove('is-down', cls); if (h.stop) h.stop(); }
    while (offs.length) offs.pop()();
  };
}

export function tap(el, fn) {
  const offs = [];
  let lastDown = -1e9;
  add(el, 'pointerdown', (e) => {
    if ((e.button != null && e.button > 0)) return;
    if (e.cancelable) e.preventDefault();
    e.__mgUsed = true;
    lastDown = performance.now();
    const c = centre(el);
    call(fn, { x: e.clientX, y: e.clientY, dx: 0, dy: 0, cx: c.x, cy: c.y, el: el, e: e });
  }, offs);
  add(el, 'click', (e) => {
    /* keyboard activation only: a pointer tap already ran on pointerdown (touch clicks can have detail 0) */
    if (e.pointerType || performance.now() - lastDown < 2000) return;
    const c = centre(el);
    call(fn, { x: c.x, y: c.y, dx: 0, dy: 0, cx: c.x, cy: c.y, el: el, e: e });
  }, offs);
  return function off() { while (offs.length) offs.pop()(); };
}

export function drag(el, o) {
  o = o || {};
  const follow = o.follow !== false;
  let b = null, backT = 0;
  return track(el, o, 'is-dragging', {
    start(p) {
      if (backT) { clearTimeout(backT); backT = 0; }
      el.classList.remove('mg-back');
      b = baseOf(el);
      /* c0 was measured with the base translate applied: p.cx/cy already include it */
      call(o.onStart, p);
    },
    move(p) {
      if (follow) el.style.translate = (b.x + p.dx) + 'px ' + (b.y + p.dy) + 'px';
      call(o.onMove, p);
    },
    end(p, cancelled) {
      const keep = cancelled ? false : call(o.onEnd, p) === true;
      if (!follow) return;
      if (keep) {
        if (el.__mgBase === b) { b.x += p.dx; b.y += p.dy; } /* (clearDrag in onEnd replaced the base) */
        return;
      }
      el.classList.add('mg-back');
      el.style.translate = b.x + 'px ' + b.y + 'px';
      backT = setTimeout(() => { backT = 0; el.classList.remove('mg-back'); }, 260);
    },
    stop() { if (backT) { clearTimeout(backT); backT = 0; } }
  });
}

export function rub(el, o) {
  o = o || {};
  return track(el, o, 'is-rubbing', {
    start(p) { call(o.onStart, p); },
    move(p, d) { if (d > 0) call(o.onRub, d, p.x, p.y, p); },
    end(p) { call(o.onEnd, p); }
  });
}

export function hold(el, o) {
  o = o || {};
  let raf = 0, t0 = 0, last = 0, held = 0, cur = null;
  function frame(ts) {
    raf = 0;
    const dt = Math.min(64, Math.max(0, ts - last));
    last = ts;
    held = ts - t0;
    call(o.onHold, held, dt, cur);
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  return track(el, o, 'is-holding', {
    start(p) {
      cur = p;
      t0 = last = performance.now();
      held = 0;
      call(o.onStart, p);
      call(o.onHold, 0, 0, p); /* same-frame response */
      stopLoop();
      raf = requestAnimationFrame(frame);
    },
    move(p) { cur = p; },
    end(p) { stopLoop(); call(o.onRelease, held, p); },
    stop() { stopLoop(); }
  });
}

export const gestures = { tap, drag, rub, hold, clearDrag };
export default gestures;
