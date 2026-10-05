/* Parent settings sheet ("Vanhemmille") v3. OWNER: settings agent. Contract: CONTRACTS.md "Settings API v3".

   initSettings({ root, store, save, onChange, onReset, onChildrenChange, credits }) renders the whole sheet
   into the given overlay root (replacing its content):
     1 Lapset (a card per child + "Lisää lapsi")  2 Ääni ja näyttö  3 Minipeli  4 Omat äänitykset
     5 Testaa äänet  6 Vinkit  7 Lähteet ja lisenssit
   The sheet is a modal dialog: engine.stop() on open, Escape / backdrop tap / close button close it,
   focus moves into the sheet, Tab stays inside it, and focus returns to the opener on close.

   Children are changed only through the profiles.js helpers, then save() and onChildrenChange()
   (add / rename / theme / level / delete / "Pelaa nyt"). "Aloita alusta" for one child runs
   profiles.resetChild (idempotent, so an app that also resets is fine), save(), then onReset(childId) so the
   app can re-render. Each child card also has the child's own name recording (clip 'name-<childId>', recording
   only: without it device speech says the name); deleting a child removes that recording. Every recording row
   can also import an audio file from the device ("Tuo tiedosto": recorder.saveBlob, IndexedDB only, never
   uploaded). Shared settings live in
   store.settings (speech, slow, translit, sfx, every): mutated here, save(), then onChange(key).
   The store object is re-read on every open, so changes made elsewhere (cover, level picks) show up.
   Every call into engine/recorder/art is defensive: those modules are developed in parallel. */
import '../styles/settings.css';
import DATA from '../content/data.js';
import { RECORDABLE, THEMES, LEVELS, LEVEL_NAMES } from '../content/prompts.js';
import { addChild, updateChild, removeChild, setActive, resetChild, NAME_MAX, MAX_CHILDREN } from '../profiles.js';
import ART from '../art.js';
import * as engine from '../audio/engine.js';
import * as recorder from '../audio/recorder.js';

const DIAG_EVERY_MS = 1500;                                    /* live refresh of the sound status list */
const REC_MAX_S = Math.round((Number(recorder.MAX_MS) || 15000) / 1000);
const SECTIONS = DATA.sections || [];
const SECTION_IDS = SECTIONS.map((s) => s.id);
const SHAHADA = SECTIONS.find((s) => s.id === 'shahada') || null;

const THEME_INFO = { girl: { label: 'Tyttö', icon: 'crown' }, boy: { label: 'Poika', icon: 'car' } };
const LEVEL_INFO = { easy: { n: 1, sub: '1 sana' }, medium: { n: 2, sub: '2 sanaa' }, hard: { n: 3, sub: 'koko rivi' } };
const SWITCHES = [
  { key: 'speech', title: 'Puhe', sub: 'Suomenkieliset kehotteet ja kehut' },
  { key: 'slow', title: 'Hidas resitaatio', sub: 'Resitaatio soi hieman hitaammin' },
  { key: 'translit', title: 'Ääntämisapu', sub: 'Rivit myös latinalaisin kirjaimin' },
  { key: 'sfx', title: 'Ääniefektit', sub: 'Lyhyet poksahdukset ja kilahdukset' }
];
const TESTS = [
  { kind: 'recitation', label: 'Resitaatio', icon: 'play' },
  { kind: 'sfx', label: 'Efekti', icon: 'star' },
  { kind: 'fi', label: 'Suomen puhe', icon: 'speech' },
  { kind: 'ar', label: 'Arabian puhe', icon: 'sound' }
];
const STATUS_TEXT = { own: 'Oma ääni', file: 'Valmis ääni', none: 'Ei äänitystä' };
const MIC_HELP = 'Mikrofoni vaatii luvan ja HTTPS-osoitteen.';

/* Fallback strokes for icons the (parallel) art module may not draw yet. 24x24, currentColor, no humans. */
const OWN_ICONS = {
  folder: '<path d="M3.6 7.4a1.9 1.9 0 0 1 1.9-1.9h3.7l2 2.2h7.3a1.9 1.9 0 0 1 1.9 1.9v7.9a1.9 1.9 0 0 1-1.9 1.9H5.5a1.9 1.9 0 0 1-1.9-1.9z"/><path d="M12 10.6v5.2M9.6 13.4 12 15.8l2.4-2.4"/>',
  edit: '<path d="M4.6 19.4l.9-4.1L15.9 4.9a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.7 18.5z"/><path d="M13.7 7.1l3.2 3.2M4.6 19.4h5"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  car: '<path d="M3.6 15.6v-3.1l2.1-4.4a2 2 0 0 1 1.8-1.1h9a2 2 0 0 1 1.8 1.1l2.1 4.4v3.1a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1z"/>' +
    '<path d="M3.9 12.3h16.2"/><circle cx="7.6" cy="16.9" r="1.9"/><circle cx="16.4" cy="16.9" r="1.9"/>',
  crown: '<path d="M4.4 17.4 3.3 8.9l4.9 3.6L12 6.3l3.8 6.2 4.9-3.6-1.1 8.5z"/><path d="M4.8 20.6h14.4"/>',
  star: '<path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.1 5.9L12 16.5l-5.3 2.9 1.1-5.9-4.4-4.1 6-.7z"/>',
  user: '<path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.1 5.9L12 16.5l-5.3 2.9 1.1-5.9-4.4-4.1 6-.7z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>'
};
const STAR = '<svg class="lvl-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>';

let opts = null;            /* { root, store, save, onChange, onReset, onChildrenChange, credits } */
let root = null, sheet = null, body = null, kidsEl = null, kidsMsg = null;
let ac = null;              /* AbortController for this render's listeners (initSettings may run again) */
let open = false, lastFocus = null, diagTimer = 0, lastDiag = '';
let rec = null;             /* active recording: { id, row, t0, timer, saving } */
let fileInput = null, fileId = null, importing = null;   /* "Tuo tiedosto": shared picker, target clip id, row being saved */
let playTok = 0, testTok = 0, statusTok = 0;
let watchingRecorder = false;
let ownIds = new Set();     /* ids with an own recording (last recorder.list()), so re-rendered rows start right */
/* transient UI state of the Lapset section (the list is re-rendered from the store + this) */
let kid = freshKidUi();
function freshKidUi() {
  return { editId: null, draft: '', editErr: '', confirm: null, adding: false, addName: '', addTheme: null, addErr: '', newId: null };
}

/* ---------- small helpers ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function svgIcon(body) {
  return '<svg class="icon set-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"' +
    ' stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
}
function icon(name) {
  let s = '';
  try { s = String(ART.icon(name, 'set-ico') || ''); } catch (e) { s = ''; }
  if (/<(path|circle|rect|polygon|polyline|ellipse|line|use)\b/i.test(s)) return s;
  return OWN_ICONS[name] ? svgIcon(OWN_ICONS[name]) : s;
}
/* Call fn(...args) if it is a function; never throws. */
function call(fn, ...args) {
  try { return typeof fn === 'function' ? fn(...args) : undefined; } catch (e) { return undefined; }
}
/* Same, but always returns a Promise (rejections become `fallback`). fn runs synchronously, so a call
   made inside a tap handler (engine.play / engine.test) still counts as user-initiated on iOS. */
function callAsync(fn, fallback, ...args) {
  let r;
  try { r = typeof fn === 'function' ? fn(...args) : fallback; } catch (e) { return Promise.resolve(fallback); }
  return Promise.resolve(r).catch(() => fallback);
}
function focusEl(el) {
  if (!el) return;
  try { el.focus({ preventScroll: false }); } catch (e) { try { el.focus(); } catch (e2) { /* ignore */ } }
}
const $ = (sel) => (root ? root.querySelector(sel) : null);
const $$ = (sel) => (root ? Array.from(root.querySelectorAll(sel)) : []);
function normName(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); }
function recSupported() { return !!call(recorder.isSupported); }
function cssEsc(s) {
  try { if (window.CSS && CSS.escape) return CSS.escape(s); } catch (e) { /* ignore */ }
  return String(s).replace(/["\\\]]/g, '\\$&');
}

/* ---------- store access ---------- */
function store() { return opts.store; }
function kids() { const s = store(); return Array.isArray(s.children) ? s.children : (s.children = []); }
function kidById(id) { return kids().find((c) => c.id === id) || null; }
function shared() {
  const s = store();
  if (!s.settings || typeof s.settings !== 'object') s.settings = { speech: true, slow: false, translit: true, sfx: true, every: 1 };
  return s.settings;
}
const NAME_PREFIX = 'name-';
function isNameId(id) { return String(id).indexOf(NAME_PREFIX) === 0; }
function themeOf(c) { return THEMES.includes(c && c.theme) ? c.theme : 'girl'; }
function levelOf(c) { return LEVELS.includes(c && c.level) ? c.level : 'easy'; }

/* ---------- markup ---------- */
function card(key, ico, title, inner) {
  return '<section class="set-card set-card-' + key + '" aria-labelledby="setH-' + key + '">' +
    '<h3 class="set-h" id="setH-' + key + '"><span class="set-h-ico" aria-hidden="true">' + icon(ico) + '</span>' + esc(title) + '</h3>' +
    inner + '</section>';
}

function kidsCard() {
  return card('kids', 'user', 'Lapset',
    '<p class="set-hint">Jokaisella lapsella on omat tähdet, tarrat ja edistyminen. Taso on oletus: sen voi vaihtaa myös suuran alussa.</p>' +
    '<div class="kids" data-kids></div>' +
    '<p class="set-msg kids-msg" data-kids-msg role="status" aria-live="polite"></p>');
}

function avatar(theme, name) {
  let s = '';
  try { s = typeof ART.avatar === 'function' ? String(ART.avatar(theme, 'kid-av-art') || '') : ''; } catch (e) { s = ''; }
  if (/<svg[\s>]/i.test(s)) return s;
  const ch = Array.from(String(name || '').trim())[0];
  return ch ? '<span class="kid-initial">' + esc(ch.toUpperCase()) + '</span>' : icon(THEME_INFO[theme].icon);
}

function metaText(c) {
  const stars = Number(c.stars) || 0;
  const done = SECTION_IDS.filter((id) => c.done && c.done[id] === true).length;
  return stars + (stars === 1 ? ' tähti' : ' tähteä') + ' · ' + done + '/' + SECTION_IDS.length + ' valmiina';
}

function themeSeg(c, cid) {
  const t = themeOf(c);
  return '<div class="kid-row">' +
    '<span class="kid-lbl" id="kidT-' + cid + '">Teema</span>' +
    '<div class="kid-seg kid-seg-2" role="group" aria-labelledby="kidT-' + cid + ' kidN-' + cid + '">' +
      THEMES.map((th) => '<button type="button" class="kid-opt kid-opt-' + th + '" data-kact="theme" data-v="' + th + '" aria-pressed="' + (t === th) + '">' +
        '<span class="kid-opt-ico" aria-hidden="true">' + icon(THEME_INFO[th].icon) + '</span><span class="kid-opt-name">' + THEME_INFO[th].label + '</span>' +
        '<span class="kid-tick" aria-hidden="true">' + icon('check') + '</span></button>').join('') +
    '</div></div>';
}

function levelSeg(c, cid) {
  const l = levelOf(c);
  return '<div class="kid-row">' +
    '<span class="kid-lbl" id="kidL-' + cid + '">Taso</span>' +
    '<div class="kid-seg kid-seg-3" role="group" aria-labelledby="kidL-' + cid + ' kidN-' + cid + '">' +
      LEVELS.map((lv) => '<button type="button" class="kid-opt kid-lvl" data-kact="level" data-v="' + lv + '" aria-pressed="' + (l === lv) + '">' +
        '<span class="lvl-stars" aria-hidden="true">' + STAR.repeat(LEVEL_INFO[lv].n) + '</span>' +
        '<span class="lvl-name">' + esc(LEVEL_NAMES[lv]) + '</span><small class="lvl-sub">' + esc(LEVEL_INFO[lv].sub) + '</small>' +
        '<span class="kid-tick" aria-hidden="true">' + icon('check') + '</span></button>').join('') +
    '</div></div>';
}

function kidConfirm(c, cid, kind) {
  const del = kind === 'del';
  return '<div class="set-confirm kid-confirm" role="group" aria-labelledby="kidQ-' + cid + ' kidN-' + cid + '">' +
    '<p id="kidQ-' + cid + '">' + (del ? 'Poistetaanko ' + esc(c.name) + '?' : 'Aloitetaanko alusta?') + '</p>' +
    '<p class="set-confirm-sub">' + (del ? 'Tähdet, tarrat ja edistyminen poistuvat pysyvästi.'
      : 'Tähdet, tarrat ja edistyminen nollataan. Nimi, teema, taso ja omat äänitykset säilyvät.') + '</p>' +
    '<div class="set-confirm-row">' +
      '<button type="button" class="sbtn sbtn-danger" data-kact="' + (del ? 'delyes' : 'resetyes') + '">' + (del ? 'Kyllä, poista' : 'Kyllä, aloita alusta') + '</button>' +
      '<button type="button" class="sbtn sbtn-soft" data-kact="confirmno">Peru</button>' +
    '</div></div>';
}

function kidCard(c) {
  const cid = esc(c.id);
  const st = store();
  const active = st.activeId === c.id;
  const editing = kid.editId === c.id;
  const conf = kid.confirm && kid.confirm.id === c.id ? kid.confirm.kind : null;
  const theme = themeOf(c);
  const top = editing
    ? '<div class="kid-editbox">' +
        '<label class="set-sr" for="kidI-' + cid + '">Uusi nimi</label>' +
        '<input class="set-input kid-input" id="kidI-' + cid + '" data-input="rename" type="text" maxlength="' + NAME_MAX + '" value="' + esc(kid.draft) + '"' +
        ' autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done">' +
      '</div>'
    : '<div class="kid-id">' +
        '<h4 class="kid-name" id="kidN-' + cid + '">' + esc(c.name) + '</h4>' +
        '<p class="kid-meta">' + esc(metaText(c)) + '</p>' +
        (active ? '<span class="kid-chip">' + icon('check') + '<span>Pelaamassa</span></span>' : '') +
      '</div>' +
      '<button type="button" class="kid-edit" data-kact="edit" aria-label="Vaihda nimi: ' + esc(c.name) + '" title="Vaihda nimi">' + icon('edit') + '</button>';
  const editRow = editing
    ? '<p class="kid-err" role="alert">' + esc(kid.editErr) + '</p>' +
      '<div class="set-confirm-row kid-editrow">' +
        '<button type="button" class="sbtn sbtn-go" data-kact="editok">' + icon('check') + '<span>Tallenna</span></button>' +
        '<button type="button" class="sbtn sbtn-soft" data-kact="editno">Peru</button>' +
      '</div>'
    : '';
  const actions = conf ? kidConfirm(c, cid, conf)
    : '<div class="kid-actions">' +
        (active ? '' : '<button type="button" class="sbtn sbtn-go kid-play" data-kact="play">' + icon('play') + '<span>Pelaa nyt</span></button>') +
        '<button type="button" class="sbtn sbtn-ghost kid-reset" data-kact="reset">' + icon('replay') + '<span>Aloita alusta</span></button>' +
        '<button type="button" class="sbtn sbtn-ghost kid-del" data-kact="del">' + icon('trash') + '<span>Poista lapsi</span></button>' +
      '</div>';
  /* editing: the heading id lives on the hidden name so aria-labelledby keeps working */
  return '<article class="kid' + (active ? ' is-active' : '') + (kid.newId === c.id ? ' is-new' : '') + '" data-kid="' + cid + '" data-kt="' + theme + '"' +
    ' aria-labelledby="kidN-' + cid + '">' +
    (editing ? '<h4 class="set-sr" id="kidN-' + cid + '">' + esc(c.name) + '</h4>' : '') +
    '<div class="kid-top"><span class="kid-av" aria-hidden="true">' + avatar(theme, c.name) + '</span>' + top + '</div>' +
    editRow + themeSeg(c, cid) + levelSeg(c, cid) + nameRecRow(c) + actions +
  '</article>';
}

function addBlock(n) {
  if (kid.adding) {
    return '<div class="kid kid-new" role="group" aria-labelledby="kidNewH">' +
      '<h4 class="kid-new-h" id="kidNewH">' + icon('plus') + '<span>Uusi lapsi</span></h4>' +
      '<label class="kid-lbl" for="kidNewName">Nimi</label>' +
      '<input class="set-input" id="kidNewName" data-input="addname" type="text" maxlength="' + NAME_MAX + '" value="' + esc(kid.addName) + '"' +
      ' placeholder="Lapsen nimi" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="next">' +
      '<span class="kid-lbl" id="kidNewT">Tyttö vai poika?</span>' +
      '<div class="kid-seg kid-seg-2 kid-pick" role="group" aria-labelledby="kidNewT">' +
        THEMES.map((th) => '<button type="button" class="kid-opt kid-opt-' + th + '" data-kact="addtheme" data-v="' + th + '" aria-pressed="' + (kid.addTheme === th) + '">' +
          '<span class="kid-pick-av" data-kt="' + th + '" aria-hidden="true">' + avatar(th, '') + '</span><span class="kid-opt-name">' + THEME_INFO[th].label + '</span>' +
          '<span class="kid-tick" aria-hidden="true">' + icon('check') + '</span></button>').join('') +
      '</div>' +
      '<p class="kid-err" role="alert">' + esc(kid.addErr) + '</p>' +
      '<div class="set-confirm-row">' +
        '<button type="button" class="sbtn sbtn-go" data-kact="addok">' + icon('plus') + '<span>Lisää</span></button>' +
        '<button type="button" class="sbtn sbtn-soft" data-kact="addno">Peru</button>' +
      '</div></div>';
  }
  if (n >= MAX_CHILDREN) return '<p class="set-hint kids-full">Lapsia voi olla enintään ' + MAX_CHILDREN + '.</p>';
  return '<button type="button" class="kid-add" data-kact="add"><span class="kid-add-ico" aria-hidden="true">' + icon('plus') + '</span><span>Lisää lapsi</span></button>';
}

function soundCard() {
  const rows = SWITCHES.map((s) =>
    '<label class="set-switch">' +
      '<span class="set-switch-text"><span class="set-switch-title">' + esc(s.title) + '</span><small>' + esc(s.sub) + '</small></span>' +
      '<input class="set-switch-input" type="checkbox" role="switch" data-key="' + s.key + '">' +
      '<span class="set-track" aria-hidden="true"></span>' +
    '</label>').join('');
  return card('sound', 'sound', 'Ääni ja näyttö', '<p class="set-hint">Koskee kaikkia lapsia.</p><div class="set-switches">' + rows + '</div>');
}

function gameCard() {
  return card('game', 'star', 'Minipeli',
    '<div class="set-seg" role="group" aria-labelledby="setH-game">' +
      '<button type="button" data-every="1" aria-pressed="false"><span>Joka vaiheen jälkeen</span><span class="kid-tick" aria-hidden="true">' + icon('check') + '</span></button>' +
      '<button type="button" data-every="2" aria-pressed="false"><span>Joka toisen vaiheen jälkeen</span><span class="kid-tick" aria-hidden="true">' + icon('check') + '</span></button>' +
    '</div>');
}

function recRow(item) {
  const id = esc(item.id);
  const lid = 'setRecL-' + id;
  const st = ownIds.has(item.id) ? 'own' : (isNameId(item.id) ? 'none' : 'file');
  return '<li class="rec-row" data-id="' + id + '" data-st="' + st + '">' +
    '<div class="rec-top">' +
      '<span class="rec-label" id="' + lid + '">' + esc(item.label) + '</span>' +
      '<span class="rec-status">' + STATUS_TEXT[st] + '</span>' +
    '</div>' +
    (item.hint ? '<p class="rec-hint">' + esc(item.hint) + '</p>' : '') +
    '<div class="rec-actions">' +
      '<button type="button" class="sbtn sbtn-rec" data-act="rec" aria-describedby="' + lid + '">' + icon('mic') + '<span>Nauhoita</span></button>' +
      '<button type="button" class="sbtn sbtn-play" data-act="play" aria-describedby="' + lid + '">' + icon('play') + '<span>Kuuntele</span></button>' +
      '<button type="button" class="sbtn sbtn-file" data-act="file" aria-describedby="' + lid + '">' + icon('folder') + '<span>Tuo tiedosto</span></button>' +
      '<button type="button" class="sbtn sbtn-del" data-act="del" aria-describedby="' + lid + '"' + (st === 'own' ? '' : ' hidden') + '>' + icon('trash') + '<span>Poista oma ääni</span></button>' +
    '</div>' +
    '<div class="rec-live" hidden>' +
      '<button type="button" class="sbtn-stop" data-act="stoprec">' + icon('stop') + '<span>Lopeta</span></button>' +
      '<div class="rec-meter" aria-hidden="true">' +
        '<span class="rec-time"><span class="rec-dot"></span><span><span class="rec-sec">0 s</span> / ' + REC_MAX_S + ' s</span></span>' +
        '<span class="rec-bar"><i></i></span>' +
      '</div>' +
    '</div>' +
    '<div class="set-confirm rec-confirm" role="group" aria-label="Poistetaanko oma ääni?" hidden>' +
      '<p>' + (isNameId(item.id) ? 'Poistetaanko oma ääni?' : 'Poistetaanko oma ääni? Tilalle tulee valmis ääni.') + '</p>' +
      '<div class="set-confirm-row">' +
        '<button type="button" class="sbtn sbtn-danger" data-act="delyes">Poista</button>' +
        '<button type="button" class="sbtn sbtn-soft" data-act="delno">Peru</button>' +
      '</div>' +
    '</div>' +
    '<p class="rec-msg" role="status" aria-live="polite"></p>' +
  '</li>';
}

/* The child's own name, recorded per child (played after praise). Lives in the child's card. */
function nameRecRow(c) {
  return '<ul class="rec-list kid-rec">' + recRow({ id: NAME_PREFIX + c.id, label: 'Nimi omalla äänellä',
    hint: 'Kuuluu kehujen jälkeen. Ilman äänitystä laite sanoo nimen.' }) + '</ul>';
}

/* RECORDABLE grouped in order of appearance; long groups (> 2 clips) fold into <details>. */
function recordingsCard() {
  const groups = [];
  RECORDABLE.forEach((item) => {
    let g = groups.find((x) => x.name === item.group);
    if (!g) groups.push(g = { name: item.group, items: [] });
    g.items.push(item);
  });
  const html = groups.map((g) => {
    const list = '<ul class="rec-list">' + g.items.map(recRow).join('') + '</ul>';
    if (g.items.length > 2) {
      return '<details class="set-details rec-group" data-group="' + esc(g.name) + '"><summary><span>' + esc(g.name) + '</span>' +
        '<span class="set-count">' + g.items.length + '</span></summary>' + list + '</details>';
    }
    /* a single clip's own label already says what it is ("Lapsen nimi (...)") */
    return '<div class="rec-group" data-group="' + esc(g.name) + '">' + (g.items.length > 1 ? '<h4 class="rec-group-h">' + esc(g.name) + '</h4>' : '') + list + '</div>';
  }).join('');
  return card('rec', 'mic', 'Omat äänitykset',
    '<p class="set-hint">Voit korvata valmiin äänen omalla äänelläsi: nauhoita tai tuo äänitiedosto laitteelta. Oma ääni soi valmiin äänen sijaan kaikille lapsille. Tiedostot pysyvät vain tässä laitteessa.</p>' +
    '<p class="set-note" data-rec-note hidden>Äänitys ei toimi tässä selaimessa. ' + MIC_HELP + ' Voit silti tuoda valmiin äänitiedoston.</p>' +
    html);
}

function testCard() {
  const btns = TESTS.map((t) =>
    '<button type="button" class="tbtn" data-test="' + t.kind + '">' +
      '<span class="tbtn-ico" aria-hidden="true">' + icon(t.icon) + '</span><span>' + esc(t.label) + '</span>' +
    '</button>').join('');
  return card('test', 'speech', 'Testaa äänet',
    '<p class="set-hint">Napauta nappia ja kuuntele. Alla näkyy, mitä laite löysi.</p>' +
    '<div class="test-grid">' + btns + '</div>' +
    '<p class="test-result" role="status" aria-live="polite" hidden></p>' +
    '<ul class="diag" aria-label="Äänen tila"></ul>' +
    '<p class="set-hint">Laitteen puheääni on vain varalla: valmiit äänitiedostot toimivat ilman sitä.</p>');
}

function tipsCard() {
  return card('tips', 'star', 'Vinkit',
    '<details class="set-details"><summary><span>Lapset ja tasot</span></summary><ul class="set-list">' +
      '<li><b>Uusi lapsi:</b> napauta <i>Lisää lapsi</i>, kirjoita nimi ja valitse <i>Tyttö</i> tai <i>Poika</i>. Valinta päättää pelin teeman.</li>' +
      '<li><b>Vaihda pelaajaa:</b> napauta lapsen kortissa <i>Pelaa nyt</i>.</li>' +
      '<li><b>HELPPO</b> = sana kerrallaan, <b>KESKITASO</b> = kaksi sanaa kerrallaan, <b>VAIKEA</b> = koko rivi kerrallaan.</li>' +
      '<li><b>Taso</b> valitaan myös jokaisen suuran alussa. Viimeisin valinta muistetaan suurakohtaisesti.</li>' +
    '</ul></details>' +
    '<details class="set-details"><summary><span>Asennus ja äänet</span></summary><ul class="set-list">' +
      '<li><b>iPhone ja iPad:</b> avaa Safarissa, napauta <i>Jaa</i> ja valitse <i>Lisää Koti-valikkoon</i>.</li>' +
      '<li><b>Android:</b> avaa Chromessa, napauta <i>⋮</i> ja valitse <i>Asenna sovellus</i> tai <i>Lisää aloitusnäytölle</i>.</li>' +
      '<li><b>Ilman nettiä:</b> kun peli on avattu kerran verkossa, se toimii myös ilman yhteyttä.</li>' +
      '<li><b>Ei ääntä?</b> Tarkista äänenvoimakkuus ja kokeile <i>Testaa äänet</i>.</li>' +
      '<li><b>Aloita-nappi</b> avaa äänet. Jos <i>Jatketaan!</i>-nappi näkyy, napauta sitä.</li>' +
      '<li><b>Asetukset</b> aukeavat, kun pidät asetusnappia hetken painettuna.</li>' +
    '</ul></details>' +
    '<details class="set-details"><summary><span>Ääntämisavun merkit</span></summary><ul class="set-list">' +
      '<li><b>‘</b> = kurkusta tuleva äänne (<span class="set-ar" lang="ar" dir="rtl">ع</span>)</li>' +
      '<li><b>dh</b> = kuin englannin sanassa ”this” (<span class="set-ar" lang="ar" dir="rtl">ذ</span>)</li>' +
      '<li><b>gh</b> = kurkussa sorahtava r (<span class="set-ar" lang="ar" dir="rtl">غ</span>)</li>' +
      '<li><b>q</b> = syvältä kurkusta lausuttu k (<span class="set-ar" lang="ar" dir="rtl">ق</span>)</li>' +
      '<li><b>aa, ii, uu</b> = pitkä vokaali</li>' +
      '<li><b>viiva</b> yhdistää sanat, jotka lausutaan yhteen</li>' +
    '</ul></details>');
}

function creditsCard(credits) {
  const list = (Array.isArray(credits) ? credits : (credits ? [credits] : [])).map(String);
  return card('credits', 'check', 'Lähteet ja lisenssit',
    '<ul class="set-credits">' + list.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>');
}

function markup(credits) {
  return '<div class="set-sheet" role="dialog" aria-modal="true" aria-labelledby="setTitle" tabindex="-1">' +
    '<header class="set-head">' +
      '<span class="set-head-badge" aria-hidden="true">' + icon('gear') + '</span>' +
      '<h2 class="set-title" id="setTitle">Vanhemmille</h2>' +
      '<button type="button" class="set-close" data-act="close" aria-label="Sulje asetukset">' + icon('close') + '</button>' +
    '</header>' +
    '<div class="set-body">' +
      kidsCard() + soundCard() + gameCard() + recordingsCard() + testCard() + tipsCard() + creditsCard(credits) +
    '</div>' +
  '</div>' +
  '<input type="file" accept="audio/*" class="set-sr" data-file tabindex="-1" aria-hidden="true">';
}

/* ---------- Lapset ---------- */
function kidSel(cid, inner) { return '[data-kid="' + cssEsc(cid) + '"] ' + inner; }

/* Re-renders the children list from the store + `kid`; focusSel (inside the list) gets focus afterwards. */
function renderKids(focusSel) {
  if (!kidsEl) return;
  const list = kids();
  if (rec && kidsEl.contains(rec.row)) cancelRec();   /* (kid buttons are locked while recording; Enter in a field is not) */
  if (kid.editId && !kidById(kid.editId)) kid.editId = null;
  if (kid.confirm && !kidById(kid.confirm.id)) kid.confirm = null;
  kidsEl.innerHTML = list.map(kidCard).join('') +
    (list.length ? '' : '<p class="kids-empty">Ei vielä lapsia. Lisää lapsi, niin seikkailu voi alkaa.</p>') +
    addBlock(list.length);
  kid.newId = null;
  updateRowButtons();
  if (!focusSel) return;
  const el = kidsEl.querySelector(focusSel);
  focusEl(el);
  if (el && el.dataset && el.dataset.input === 'rename') { try { el.select(); } catch (e) { /* ignore */ } }
}

function announce(text) { if (kidsMsg) kidsMsg.textContent = text || ''; }

function childrenChanged() {
  call(opts.save);
  call(opts.onChildrenChange);
}

/* Saves a pending rename without UI (sheet closing, another card's action). Invalid drafts are dropped. */
function settleEdit() {
  const cid = kid.editId;
  if (!cid) return;
  const v = normName(kid.draft);
  kid.editId = null;
  kid.editErr = '';
  const c = kidById(cid);
  if (c && v && v !== c.name) { updateChild(store(), cid, { name: v }); childrenChanged(); }
}

function startEdit(cid) {
  const c = kidById(cid);
  if (!c) return;
  if (kid.editId !== cid) settleEdit();
  kid.confirm = null;
  kid.editId = cid;
  kid.draft = c.name;
  kid.editErr = '';
  announce('');
  renderKids(kidSel(cid, '[data-input="rename"]'));
}

function commitEdit() {
  const cid = kid.editId;
  if (!cid) return;
  if (!normName(kid.draft)) {
    kid.editErr = 'Kirjoita nimi.';
    renderKids(kidSel(cid, '[data-input="rename"]'));
    return;
  }
  settleEdit();
  renderKids(kidSel(cid, '[data-kact="edit"]'));
}

function cancelEdit() {
  const cid = kid.editId;
  kid.editId = null;
  kid.editErr = '';
  renderKids(cid ? kidSel(cid, '[data-kact="edit"]') : null);
}

function patchKid(cid, patch, focusInner) {
  const c = kidById(cid);
  if (!c) return;
  const before = c.name + '\n' + c.theme + '\n' + c.level;
  updateChild(store(), cid, patch);
  if (c.name + '\n' + c.theme + '\n' + c.level !== before) childrenChanged();
  renderKids(kidSel(cid, focusInner));
}

function askConfirm(cid, kind) {
  if (!kidById(cid)) return;
  settleEdit();
  kid.confirm = { id: cid, kind };
  announce('');
  renderKids(kidSel(cid, '[data-kact="confirmno"]'));
}

function cancelConfirm() {
  const k = kid.confirm;
  kid.confirm = null;
  renderKids(k ? kidSel(k.id, '[data-kact="' + k.kind + '"]') : null);
}

function doReset(cid) {
  const c = kidById(cid);
  kid.confirm = null;
  if (!c) { renderKids(); return; }
  resetChild(c, SECTION_IDS); /* before onReset: the app re-renders from the reset child */
  call(opts.save);
  call(opts.onReset, cid);
  renderKids(kidSel(cid, '[data-kact="reset"]'));
  announce(c.name + ': tähdet ja edistyminen nollattiin.');
}

function doDelete(cid) {
  const c = kidById(cid);
  kid.confirm = null;
  if (!c) { renderKids(); return; }
  const idx = kids().indexOf(c);
  removeChild(store(), cid);
  childrenChanged();
  /* the child's own name recording goes too */
  callAsync(recorder.remove, null, NAME_PREFIX + cid)
    .then(() => callAsync(engine.refreshRecordings, null))
    .then(() => { if (open) refreshStatuses(); });
  const list = kids();
  const next = list[Math.min(idx, list.length - 1)];
  renderKids(next ? kidSel(next.id, '[data-kact="edit"]') : '[data-kact="add"]');
  announce('Poistettu: ' + c.name + '.');
}

function playNow(cid) {
  if (!kidById(cid)) return;
  settleEdit();
  setActive(store(), cid);
  childrenChanged();
  closeSettings();
}

function startAdd() {
  if (kids().length >= MAX_CHILDREN) return;
  settleEdit();
  kid.confirm = null;
  kid.adding = true;
  kid.addName = '';
  kid.addTheme = null;
  kid.addErr = '';
  announce('');
  renderKids('#kidNewName');
}

function cancelAdd() {
  kid.adding = false;
  kid.addErr = '';
  renderKids('[data-kact="add"]');
}

function pickAddTheme(btn) {
  kid.addTheme = THEMES.includes(btn.dataset.v) ? btn.dataset.v : null;
  $$('[data-kact="addtheme"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === kid.addTheme)));
  if (kid.addErr) { kid.addErr = ''; const e = $('.kid-new .kid-err'); if (e) e.textContent = ''; }
}

function submitAdd() {
  const name = normName(kid.addName);
  if (!name) { kid.addErr = 'Kirjoita lapsen nimi.'; renderKids('#kidNewName'); return; }
  if (!THEMES.includes(kid.addTheme)) { kid.addErr = 'Valitse Tyttö tai Poika.'; renderKids('[data-kact="addtheme"]'); return; }
  const st = store();
  const prev = st.activeId;
  const c = addChild(st, name, kid.addTheme, SECTION_IDS);
  if (!c) { kid.addErr = 'Lapsia voi olla enintään ' + MAX_CHILDREN + '.'; renderKids('[data-kact="addno"]'); return; }
  /* addChild makes the new child active: the child playing now stays active until "Pelaa nyt" */
  if (prev && prev !== c.id && kidById(prev)) setActive(st, prev);
  kid.adding = false;
  kid.addName = '';
  kid.addTheme = null;
  kid.addErr = '';
  kid.newId = c.id;
  childrenChanged();
  renderKids(kidSel(c.id, st.activeId === c.id ? '[data-kact="edit"]' : '[data-kact="play"]'));
  announce('Lisätty: ' + c.name + '.');
}

function onKidClick(btn) {
  const act = btn.dataset.kact;
  const host = btn.closest('[data-kid]');
  const cid = host ? host.dataset.kid : null;
  if (act === 'edit') startEdit(cid);
  else if (act === 'editok') commitEdit();
  else if (act === 'editno') cancelEdit();
  else if (act === 'theme') patchKid(cid, { theme: btn.dataset.v }, '[data-kact="theme"][data-v="' + btn.dataset.v + '"]');
  else if (act === 'level') patchKid(cid, { level: btn.dataset.v }, '[data-kact="level"][data-v="' + btn.dataset.v + '"]');
  else if (act === 'play') playNow(cid);
  else if (act === 'reset' || act === 'del') askConfirm(cid, act);
  else if (act === 'confirmno') cancelConfirm();
  else if (act === 'resetyes') doReset(cid);
  else if (act === 'delyes') doDelete(cid);
  else if (act === 'add') startAdd();
  else if (act === 'addtheme') pickAddTheme(btn);
  else if (act === 'addok') submitAdd();
  else if (act === 'addno') cancelAdd();
}

/* ---------- shared settings <-> controls ---------- */
function sync() {
  const s = shared();
  $$('.set-switch-input').forEach((el) => { el.checked = !!s[el.dataset.key]; });
  $$('[data-every]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.every) === (s.every === 2 ? 2 : 1))));
}
function changed(key) {
  call(opts.save);
  call(opts.onChange, key);
}

/* ---------- own recordings ---------- */
function rowOf(el) { return el && el.closest ? el.closest('.rec-row') : null; }

/* Clip for a recordable id. Shahada rows play the data line (recording -> shahada MP3 -> speech). */
function clipFor(id) {
  if (isNameId(id)) {
    /* recording-only clip: without a recording the device speech says the child's name */
    const c = kidById(id.slice(NAME_PREFIX.length));
    const base = call(engine.prompt, id) || { kind: 'voice', id, src: null, lang: 'fi' };
    return c ? Object.assign({}, base, { text: c.name }) : null;
  }
  if (/^shahada-/.test(id) && SHAHADA) {
    let i = SHAHADA.lines.findIndex((l) => l.rec === id);
    if (i < 0) i = Number(id.split('-')[1]) - 1;
    return call(engine.line, SHAHADA, i) || null;
  }
  return call(engine.prompt, id) || null;
}

function setRowStatus(row, own) {
  const id = row.dataset.id;
  const st = own ? 'own' : (isNameId(id) ? 'none' : 'file');
  row.dataset.st = st;
  row.querySelector('.rec-status').textContent = STATUS_TEXT[st];
  row.querySelector('[data-act="del"]').hidden = !own;
  if (!own) row.querySelector('.rec-confirm').hidden = true;
  updateRowButtons();
}

/* Re-read which ids have an own recording (async; a newer call wins). */
function refreshStatuses() {
  const tok = ++statusTok;
  return callAsync(recorder.list, []).then((ids) => {
    if (tok !== statusTok || !root) return;
    const own = new Set(Array.isArray(ids) ? ids.map(String) : []);
    ownIds = own;
    $$('.rec-row').forEach((row) => setRowStatus(row, own.has(row.dataset.id)));
  });
}

/* Enable/disable row + test buttons for the current recording state. */
function updateRowButtons() {
  const can = recSupported();
  const note = $('[data-rec-note]');
  if (note) note.hidden = can;
  const canFile = importSupported();
  $$('.rec-row').forEach((row) => {
    const busy = !!rec || !!importing;
    const mine = !!(rec && rec.row === row) || importing === row;
    row.querySelector('[data-act="rec"]').disabled = !can || busy;
    row.querySelector('[data-act="play"]').disabled = busy;
    row.querySelector('[data-act="file"]').disabled = !canFile || busy;
    row.querySelector('[data-act="del"]').disabled = busy;
    row.classList.toggle('is-dim', busy && !mine);
  });
  $$('[data-test]').forEach((b) => { b.disabled = !!rec; });
  /* a re-render of the children list would drop a running take in a name row: lock it meanwhile */
  $$('[data-kact]').forEach((b) => { b.disabled = !!rec || !!importing; });
}

function rowMsg(row, text, tone) {
  const m = row.querySelector('.rec-msg');
  m.textContent = text || '';
  m.dataset.tone = tone || '';
}

/* recorder.js throws plain Errors with a Finnish message; the browser's own errors (DOMException,
   TypeError...) often carry English text, so only their name is used. */
function ownMessage(e) { return e && e.constructor === Error && typeof e.message === 'string' ? e.message : ''; }

function micErrorText(e) {
  const own = ownMessage(e);
  if (own) return own;
  const n = (e && e.name) || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Mikrofonin käyttö estettiin. Salli mikrofoni selaimen asetuksista.';
  if (n === 'NotFoundError') return 'Mikrofonia ei löytynyt.';
  if (n === 'NotSupportedError') return 'Tämä selain ei tue äänitystä.';
  if (n === 'InvalidStateError') return 'Äänitys on jo käynnissä.';
  return 'Mikrofonia ei saatu käyttöön (' + (n || 'virhe') + ').';
}

function showLive(row, on) {
  row.querySelector('.rec-actions').hidden = on;
  row.querySelector('.rec-live').hidden = !on;
  row.classList.toggle('is-recording', on);
}

function tick() {
  if (!rec || !rec.t0) return;
  const ms = Math.min(REC_MAX_S * 1000, Date.now() - rec.t0);
  rec.row.querySelector('.rec-sec').textContent = Math.floor(ms / 1000) + ' s';
  rec.row.querySelector('.rec-bar i').style.transform = 'scaleX(' + (ms / (REC_MAX_S * 1000)).toFixed(3) + ')';
}

async function startRec(row) {
  if (rec || !recSupported()) return;
  stopPlayback();
  testTok++;
  const r = { id: row.dataset.id, row, t0: 0, timer: 0, saving: false };
  rec = r;
  row.querySelector('.rec-confirm').hidden = true;
  rowMsg(row, 'Salli mikrofoni, jos selain kysyy.', '');
  updateRowButtons();
  try {
    /* start() runs synchronously inside the tap, so iOS sees the permission prompt as user-initiated */
    await recorder.start({ onAutoStop: () => { if (rec === r) finishRec(true); } });
  } catch (e) {
    if (rec === r) { rec = null; updateRowButtons(); }
    rowMsg(row, e && e.name === 'AbortError' ? '' : micErrorText(e), 'warn');
    return;
  }
  if (rec !== r) { call(recorder.cancel); return; } /* sheet closed while the prompt was open */
  r.t0 = Date.now();
  rowMsg(row, 'Äänitys käynnissä. Puhu selkeästi ja napauta Lopeta.', 'live');
  showLive(row, true);
  tick();
  r.timer = setInterval(tick, 200);
  focusEl(row.querySelector('[data-act="stoprec"]'));
}

/* Save the take (Lopeta, or the recorder's 15 s auto-stop). */
async function finishRec(auto) {
  const r = rec;
  if (!r || r.saving) return;
  r.saving = true;
  clearInterval(r.timer);
  const stopBtn = r.row.querySelector('[data-act="stoprec"]');
  stopBtn.disabled = true;
  let blob = null, err = null;
  try { blob = await recorder.stopAndSave(r.id); } catch (e) { err = e; }
  await callAsync(engine.refreshRecordings, null);
  if (rec === r) rec = null;
  stopBtn.disabled = false;
  showLive(r.row, false);
  await refreshStatuses();
  updateRowButtons();
  if (err) rowMsg(r.row, 'Tallennus ei onnistunut. ' + (ownMessage(err) || 'Yritä uudelleen (' + ((err && err.name) || 'virhe') + ').'), 'warn');
  else if (!blob) rowMsg(r.row, 'Ääntä ei tallentunut. Yritä uudelleen.', 'warn');
  else rowMsg(r.row, (auto ? REC_MAX_S + ' sekuntia täynnä, tallennettu. ' : 'Tallennettu! ') + 'Kuuntele ja tarkista.', 'ok');
  if (open && r.row.isConnected) focusEl(r.row.querySelector('[data-act="play"]'));
}

/* Discard a running take (sheet closed / re-rendered). */
function cancelRec() {
  const r = rec;
  if (!r) return;
  rec = null;
  clearInterval(r.timer);
  call(recorder.cancel);
  if (r.row.isConnected) { showLive(r.row, false); rowMsg(r.row, '', ''); }
  updateRowButtons();
}

async function removeRec(row) {
  row.querySelector('.rec-confirm').hidden = true;
  stopPlayback();
  try { await recorder.remove(row.dataset.id); } catch (e) {
    rowMsg(row, 'Poisto ei onnistunut.', 'warn');
    return;
  }
  await callAsync(engine.refreshRecordings, null);
  await refreshStatuses();
  rowMsg(row, 'Oma ääni poistettiin.', 'ok');
  focusEl(row.querySelector('[data-act="rec"]'));
}

/* ---------- "Tuo tiedosto": an audio file from the device becomes the recording ---------- */
function importSupported() {
  try { return typeof recorder.saveBlob === 'function' && !!window.indexedDB; } catch (e) { return false; }
}

/* Opens the device's file picker (iPhone Files, Android files / recorder apps). input.click() runs inside
   the tap: iOS and Android open the picker only for a user-initiated call. */
function pickFile(row) {
  if (!fileInput || rec || importing || !importSupported()) return;
  stopPlayback();
  testTok++;
  fileId = row.dataset.id;                    /* by id: the row may be re-rendered while the picker is open */
  row.querySelector('.rec-confirm').hidden = true;
  rowMsg(row, '', '');
  fileInput.value = '';                       /* the same file picked twice still fires change */
  try { fileInput.click(); } catch (e) { fileId = null; rowMsg(row, 'Tiedoston valinta ei avautunut.', 'warn'); }
}

async function importFile(file) {
  const id = fileId;
  fileId = null;
  if (fileInput) fileInput.value = '';
  const row = id != null ? $('.rec-row[data-id="' + cssEsc(id) + '"]') : null;
  if (!file || !row || rec || importing) return;
  importing = row;
  rowMsg(row, 'Tuodaan tiedostoa…', '');
  updateRowButtons();
  let err = null;
  try { await recorder.saveBlob(id, file); } catch (e) { err = e; }
  await callAsync(engine.refreshRecordings, null);
  importing = null;
  await refreshStatuses();
  updateRowButtons();
  const now = $('.rec-row[data-id="' + cssEsc(id) + '"]') || row;
  if (err) rowMsg(now, ownMessage(err) || 'Tiedostoa ei voitu tuoda (' + ((err && err.name) || 'virhe') + ').', 'warn');
  else rowMsg(now, 'Tiedosto tuotu! Kuuntele ja tarkista.', 'ok');
  if (open && now.isConnected) focusEl(now.querySelector(err ? '[data-act="file"]' : '[data-act="play"]'));
}

/* ---------- playback (Kuuntele) ---------- */
function setPlaying(btn, on) {
  btn.classList.toggle('is-playing', on);
  btn.innerHTML = icon(on ? 'stop' : 'play') + '<span>' + (on ? 'Pysäytä' : 'Kuuntele') + '</span>';
}
function stopPlayback() {
  playTok++;
  call(engine.stop);
  $$('.sbtn-play.is-playing').forEach((b) => setPlaying(b, false));
}
function playRow(row, btn) {
  if (btn.classList.contains('is-playing')) { stopPlayback(); return; }
  stopPlayback();
  const clip = clipFor(row.dataset.id);
  if (!clip) return;
  const tok = ++playTok;
  setPlaying(btn, true);
  /* always: a preview plays even when the "Puhe" switch is off. Called inside the tap (iOS). */
  callAsync(engine.play, false, Object.assign({}, clip, { always: true }))
    .then(() => { if (tok === playTok) setPlaying(btn, false); });
}

/* ---------- Testaa äänet ---------- */
/* "MP3: OK" -> "OK"; strings without a short "label: " prefix stay whole. */
function valueOf(s) {
  const str = String(s == null ? '' : s);
  const i = str.indexOf(': ');
  return i > 0 && i < 24 ? str.slice(i + 2) : str;
}
function tone(v) {
  if (/^(ok|running|löytyi|ei virheitä)/i.test(v)) return 'ok';
  /* a missing device voice is only informative: it is the last fallback after the MP3 files */
  if (/(virhe|puuttuu|ei tuettu|suspended|interrupted|closed|error)/i.test(v)) return 'warn';
  return 'wait';
}
function refreshDiag() {
  const list = $('.diag');
  if (!list) return;
  const d = call(engine.diagnostics) || {};
  const rows = [
    ['MP3', d.mp3],
    ['AudioContext', d.context],
    ['Suomen puheääni', d.fiVoice],
    ['Arabian puheääni', d.arVoice]
  ];
  if (d.shahada) rows.push(['Shahada', d.shahada]);
  rows.push(['Viimeisin virhe', d.lastError || 'ei virheitä']);
  const html = rows.map(([k, raw]) => {
    const v = raw == null || raw === '' ? '–' : valueOf(raw);
    const t = tone(v);
    return '<li data-tone="' + t + '"><span class="diag-dot" aria-hidden="true">' + (t === 'ok' ? icon('check') : '') + '</span>' +
      '<span class="diag-txt"><span class="diag-k">' + esc(k) + '</span> <span class="diag-v">' + esc(v) + '</span></span></li>';
  }).join('');
  if (html !== lastDiag) { list.innerHTML = html; lastDiag = html; }
}
function showTest(t, res) {
  const box = $('.test-result');
  box.hidden = false;
  box.dataset.tone = res == null ? 'wait' : (res.ok ? 'ok' : 'warn');
  const detail = res == null ? 'Soitetaan…' : (String(res.detail || '') || (res.ok ? 'OK' : 'Ei ääntä'));
  box.innerHTML = '<span class="test-ico" aria-hidden="true">' + (res && res.ok ? icon('check') : '') + '</span>' +
    '<span><b>' + esc(t.label) + ':</b> ' + esc(detail) + '</span>';
}
function runTest(btn) {
  const t = TESTS.find((x) => x.kind === btn.dataset.test);
  if (!t || rec) return;
  stopPlayback();
  const tok = ++testTok;
  $$('[data-test]').forEach((b) => b.classList.toggle('is-busy', b === btn));
  showTest(t, null);
  /* engine.test() unlocks audio synchronously, so it must be called inside this tap handler */
  callAsync(engine.test, { ok: false, detail: 'Äänitestiä ei ole saatavilla' }, t.kind).then((res) => {
    if (tok !== testTok || !root) return;
    btn.classList.remove('is-busy');
    showTest(t, res && typeof res === 'object' ? res : { ok: false, detail: 'Ei tulosta' });
    refreshDiag();
  });
}

/* ---------- events ---------- */
function onClick(e) {
  const t = e.target;
  const btn = t.closest ? t.closest('button') : null;
  if (!btn || !root.contains(btn) || btn.disabled) return;
  if (btn.dataset.kact) { onKidClick(btn); return; }
  const row = rowOf(btn);
  const act = btn.dataset.act;
  if (btn.dataset.every) {
    shared().every = Number(btn.dataset.every) === 2 ? 2 : 1;
    sync();
    changed('every');
  } else if (btn.dataset.test) runTest(btn);
  else if (act === 'close') closeSettings();
  else if (act === 'rec' && row) startRec(row);
  else if (act === 'stoprec') finishRec(false);
  else if (act === 'play' && row) playRow(row, btn);
  else if (act === 'del' && row) {
    row.querySelector('.rec-confirm').hidden = false;
    focusEl(row.querySelector('[data-act="delno"]'));
  } else if (act === 'delyes' && row) removeRec(row);
  else if (act === 'file' && row) pickFile(row);
  else if (act === 'delno' && row) {
    row.querySelector('.rec-confirm').hidden = true;
    focusEl(row.querySelector('[data-act="del"]'));
  }
}

function focusables() {
  return Array.from(sheet.querySelectorAll('button, input, summary, [href], [tabindex]:not([tabindex="-1"])'))
    .filter((el) => !el.disabled && el.getClientRects().length > 0);
}

function onKey(e) {
  if (!open || e.defaultPrevented || (e.key !== 'Escape' && e.key !== 'Tab')) return;
  const cur = document.activeElement;
  /* a layer above us (e.g. the sound gate, which makes this root inert) owns the keys */
  if (root.inert || (cur && cur !== document.body && !root.contains(cur))) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSettings(); return; }
  const f = focusables();
  if (!f.length) { e.preventDefault(); focusEl(sheet); return; }
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (cur === first || cur === sheet || !sheet.contains(cur))) { e.preventDefault(); focusEl(last); }
  else if (!e.shiftKey && (cur === last || !sheet.contains(cur))) { e.preventDefault(); focusEl(first); }
}

function bind() {
  const sig = { signal: ac.signal };
  let downOnBackdrop = false;
  root.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === root; }, sig);
  root.addEventListener('click', (e) => {
    if (e.target === root) { if (downOnBackdrop) closeSettings(); downOnBackdrop = false; return; }
    downOnBackdrop = false;
    onClick(e);
  }, sig);
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.classList.contains('set-switch-input')) {
      shared()[el.dataset.key] = !!el.checked;
      changed(el.dataset.key);
    }
  }, sig);
  /* name fields: the draft lives in `kid` so a re-render keeps what was typed */
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.input) return;
    if (el.dataset.input === 'rename') kid.draft = el.value;
    else if (el.dataset.input === 'addname') {
      kid.addName = el.value;
      if (kid.addErr && normName(el.value)) { kid.addErr = ''; const m = $('.kid-new .kid-err'); if (m) m.textContent = ''; }
    }
  }, sig);
  /* Enter = done, Escape = cancel the field (handled here first, so the sheet itself stays open) */
  root.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.input || e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (el.dataset.input === 'rename') commitEdit();
      else if (!normName(kid.addName) || THEMES.includes(kid.addTheme)) submitAdd();
      else focusEl($('[data-kact="addtheme"]'));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (el.dataset.input === 'rename') cancelEdit();
      else cancelAdd();
    }
  }, sig);
  fileInput.addEventListener('change', () => { importFile(fileInput.files && fileInput.files[0]); }, sig);
  /* the picker was closed without a choice (where the browser reports it) */
  fileInput.addEventListener('cancel', () => { fileId = null; }, sig);
  document.addEventListener('keydown', onKey, sig);
  /* leaving the app mid-take: discard it (iOS may cut the microphone in the background anyway) */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !rec || rec.saving || !rec.t0) return;
    const row = rec.row;
    cancelRec();
    rowMsg(row, 'Äänitys keskeytyi. Yritä uudelleen.', 'warn');
  }, sig);
}

/* ---------- public API ---------- */
export function initSettings(o) {
  if (!o || !o.root || !o.store || typeof o.store !== 'object') return;
  if (ac) { if (open) closeSettings(); ac.abort(); }
  opts = o;
  root = o.root;
  root.classList.add('set-root');
  root.innerHTML = markup(o.credits);
  sheet = root.querySelector('.set-sheet');
  body = root.querySelector('.set-body');
  kidsEl = root.querySelector('[data-kids]');
  kidsMsg = root.querySelector('[data-kids-msg]');
  fileInput = root.querySelector('[data-file]');
  fileId = null;
  importing = null;
  ac = new AbortController();
  lastDiag = '';
  kid = freshKidUi();
  bind();
  sync();
  renderKids();
  updateRowButtons();
  if (!watchingRecorder) {
    /* saves/removals from anywhere keep the status chips right (subscribed once, for the page's lifetime) */
    watchingRecorder = true;
    call(recorder.onChange, () => { if (open && !rec) refreshStatuses(); });
  }
  root.hidden = !open;
}

export function openSettings() {
  if (!root || open) return;
  open = true;
  lastFocus = document.activeElement;
  call(engine.stop);
  kid = freshKidUi();
  announce('');
  renderKids();
  sync();
  $$('.rec-msg').forEach((m) => { m.textContent = ''; });
  $$('.rec-confirm').forEach((c) => { c.hidden = true; });
  const res = $('.test-result');
  if (res) res.hidden = true;
  root.hidden = false;
  document.documentElement.classList.add('settings-open');
  body.scrollTop = 0;
  refreshStatuses();
  refreshDiag();
  clearInterval(diagTimer);
  diagTimer = setInterval(refreshDiag, DIAG_EVERY_MS);
  try { sheet.focus({ preventScroll: true }); } catch (e) { focusEl(sheet); }
}

export function closeSettings() {
  if (!root || !open) return;
  open = false;
  settleEdit();                 /* a typed new name is kept even when the sheet is closed with X */
  fileId = null;
  kid = freshKidUi();
  cancelRec();
  stopPlayback();
  testTok++;
  $$('[data-test]').forEach((b) => b.classList.remove('is-busy'));
  clearInterval(diagTimer);
  diagTimer = 0;
  root.hidden = true;
  document.documentElement.classList.remove('settings-open');
  const back = lastFocus;
  lastFocus = null;
  if (back && back !== document.body && back.isConnected) {
    try { back.focus({ preventScroll: true }); } catch (e) { focusEl(back); }
  }
}

export function isSettingsOpen() { return open; }
