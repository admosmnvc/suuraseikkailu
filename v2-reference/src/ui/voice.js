/* Voice + caption: every spoken prompt is also shown as text with a small animation.
   speak(items) plays clips through engine.playSequence; an item may carry
     caption: text shown in the floating caption bubble while it plays, or
     el:      an on-screen element that gets class "speaking" while it plays (overlay texts, meanings).
   Text stays visible at least MIN_MS, so it is readable even when speech is switched off. OWNER: ui agent. */
import * as engine from '../audio/engine.js';

const MIN_MS = 1800;

let box = null, textEl = null;
let tok = 0;
let capAt = 0, capTimer = 0;
let marked = null, markAt = 0, markTimer = 0;

export function initCaption(el) {
  box = el;
  textEl = el ? el.querySelector('.caption-text') : null;
}

export function showCaption(text) {
  if (!box || !textEl || !text) return;
  clearTimeout(capTimer);
  textEl.textContent = text;
  box.classList.remove('show');
  void box.offsetWidth; /* re-pop for every new line */
  box.classList.add('show');
  capAt = Date.now();
}

/* now=true hides at once; otherwise after the caption has been visible MIN_MS. */
export function hideCaption(now) {
  if (!box) return;
  clearTimeout(capTimer);
  const left = now ? 0 : MIN_MS - (Date.now() - capAt);
  if (left <= 0) box.classList.remove('show');
  else capTimer = setTimeout(() => box.classList.remove('show'), left);
}

function mark(el) {
  unmark(true);
  if (!el) return;
  marked = el;
  markAt = Date.now();
  el.classList.add('speaking');
}

function unmark(now) {
  clearTimeout(markTimer);
  const el = marked;
  if (!el) return;
  const left = now ? 0 : MIN_MS - (Date.now() - markAt);
  if (left <= 0) { el.classList.remove('speaking'); marked = null; }
  else markTimer = setTimeout(() => { el.classList.remove('speaking'); if (marked === el) marked = null; }, left);
}

/* items: [{ clip, caption?, el? } | null]. Resolves true when everything played, false when interrupted. */
export function speak(items, opts = {}) {
  const t = ++tok;
  const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
  let shownEl = null;
  const p = engine.playSequence(list.map((it) => it.clip || null), {
    gapMs: opts.gapMs || 0,
    onItem: (i) => {
      if (t !== tok) return;
      const it = list[i] || {};
      if (it.caption) showCaption(it.caption);
      else hideCaption(false);
      if (it.el !== shownEl) { if (it.el) mark(it.el); else unmark(false); shownEl = it.el || null; }
      if (typeof opts.onItem === 'function') opts.onItem(i);
    }
  });
  return Promise.resolve(p).then((ok) => {
    if (t !== tok) return false;
    unmark(false);
    hideCaption(false);
    return !!ok;
  }, () => false);
}

/* Immediate silence: voice channel, caption and highlights. */
export function stopVoice() {
  tok++;
  try { engine.stop(); } catch (e) { /* ignore */ }
  unmark(true);
  hideCaption(true);
}
