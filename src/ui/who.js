/* "Kuka pelaa tänään?" picker (one card per child in its own theme + "+ Lisää lapsi") and the new-player
   onboarding (big name field + two huge Tyttö / Poika cards; tapping a card with a name creates the child).
   A typed name (>= 2 letters, then 1.2 s without typing, Enter or leaving the field) gets 'nice-name' once per
   distinct name (a longer / shorter spelling of the same name in this view does not count as new).
   OWNER: ui agent. */
import ART from '../art.js';
import { NAME_MAX, MAX_CHILDREN } from '../profiles.js';
import { $, esc, focusEl, replayClass } from './dom.js';
import { promptText } from '../content/prompts.js';

let cb = null;          /* { onPick(id), onCreate(name, theme, praise), onName(name, el), onClose(), onBack() } */
let picked = null;      /* theme tapped before a name was typed */
const NAME_IDLE_MS = 1200, BLUR_MS = 250;
const praised = new Set(); /* names praised (lower case) */
let praisedHere = [], nameTimer = 0;

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

function say(msg) {
  const m = $('newMsg');
  m.textContent = msg;
  replayClass(m, 'pop');
}

/* the name deserves 'nice-name' (and is marked as praised) */
function praiseDue(name) {
  const n = name.toLowerCase();
  if (n.length < 2 || praised.has(n) || praisedHere.some((p) => p.startsWith(n) || n.startsWith(p))) return false;
  praised.add(n);
  praisedHere.push(n);
  return true;
}

function praiseName() {
  clearTimeout(nameTimer);
  nameTimer = 0;
  if ($('who').hidden || $('who').dataset.view !== 'new' || $('newForm').hidden) return false;
  const name = clean($('newName').value);
  if (!praiseDue(name)) return false;
  say(promptText('nice-name'));
  if (cb.onName) cb.onName(name, $('newMsg'));
  return true;
}

function create(theme) {
  clearTimeout(nameTimer);
  nameTimer = 0;
  const name = clean($('newName').value);
  if (!name) {
    picked = theme;
    ['pickGirl', 'pickBoy'].forEach((id) => $(id).setAttribute('aria-pressed', String($(id).dataset.pick === theme)));
    say('Kirjoita ensin nimi.');
    replayClass($('newName'), 'shake');
    focusEl($('newName'));
    return;
  }
  cb.onCreate(name, theme, praiseDue(name)); /* a praise still due comes first (the tap would cut it) */
}

export function initWho(callbacks) {
  cb = callbacks;
  $('pickGirl').querySelector('.theme-ava').innerHTML = ART.avatar('girl', 'theme-ava-art');
  $('pickBoy').querySelector('.theme-ava').innerHTML = ART.avatar('boy', 'theme-ava-art');
  $('whoGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.pk-card');
    if (!b) return;
    if (b.id === 'pkAdd') cb.onAdd();
    else cb.onPick(b.dataset.id);
  });
  $('whoClose').addEventListener('click', () => cb.onClose());
  $('newBack').addEventListener('click', () => cb.onBack());
  $('pickGirl').addEventListener('click', () => create('girl'));
  $('pickBoy').addEventListener('click', () => create('boy'));
  $('newName').addEventListener('input', () => {
    if ($('newMsg').textContent) $('newMsg').textContent = '';
    clearTimeout(nameTimer);
    nameTimer = clean($('newName').value).length >= 2 ? setTimeout(praiseName, NAME_IDLE_MS) : 0;
  });
  /* leaving the field: a little later, so a tap on Tyttö / Poika creates first (one sequence, nothing cut) */
  $('newName').addEventListener('blur', () => { clearTimeout(nameTimer); nameTimer = setTimeout(praiseName, BLUR_MS); });
  $('newForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (picked) { create(picked); return; }
    if (!clean($('newName').value)) { say('Kirjoita ensin nimi.'); return; }
    if (!praiseName()) say('Valitse tyttö tai poika.');
    ['pickGirl', 'pickBoy'].forEach((id) => replayClass($(id), 'wiggle'));
    try { $('newName').blur(); } catch (err) { /* ignore */ }
  });
}

/* children: store.children; opts: { closable } (opened from home: X goes back to the same child) */
export function renderPicker(children, opts) {
  let html = children.map((c) => '<button type="button" class="pk-card jelly" id="pk-' + esc(c.id) + '" data-id="' + esc(c.id) + '" data-theme="' + c.theme + '"' +
    ' aria-label="' + esc(c.name) + ', tähtiä ' + c.stars + '">' +
    '<span class="pk-ava" aria-hidden="true">' + ART.avatar(c.theme, 'pk-ava-art') + '</span>' +
    '<span class="pk-name">' + esc(c.name) + '</span>' +
    '<span class="pk-stars" aria-hidden="true">' + ART.icon('star', 'pk-star') + c.stars + '</span></button>').join('');
  if (children.length < MAX_CHILDREN) {
    html += '<button type="button" class="pk-card pk-add jelly" id="pkAdd"><span class="pk-plus" aria-hidden="true">' + ART.icon('plus') + '</span>' +
      '<span class="pk-name">Lisää lapsi</span></button>';
  }
  $('whoGrid').innerHTML = html;
  $('whoClose').hidden = !(opts && opts.closable);
}

/* view 'pick' | 'new'; opts.back: the onboarding can go back to the picker */
export function showView(view, opts) {
  $('who').dataset.view = view;
  $('newForm').hidden = view !== 'new';
  $('who').querySelector('.who-pick').hidden = view !== 'pick';
  clearTimeout(nameTimer);
  nameTimer = 0;
  if (view === 'new') {
    picked = null;
    praisedHere = [];
    $('newName').value = '';
    $('newMsg').textContent = '';
    ['pickGirl', 'pickBoy'].forEach((id) => $(id).setAttribute('aria-pressed', 'false'));
    $('newBack').hidden = !(opts && opts.back);
  }
}

export function viewFocus(view) {
  if (view === 'new') return $('newName');
  return $('whoGrid').querySelector('.pk-card') || $('who');
}
