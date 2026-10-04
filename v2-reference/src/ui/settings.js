/* Parent settings sheet ("Vanhemmille"). OWNER: settings agent. Contract: CONTRACTS.md "Settings API".

   initSettings() renders the whole sheet into the given overlay root (replacing its content):
     1 child's name   2 sound & display switches   3 minigame frequency   4 own recordings
     5 "Testaa äänet" panel   6 tips   7 reset with confirmation   8 sources & licences
   The sheet is a modal dialog: engine.stop() on open, Escape / backdrop tap / close button close it,
   focus moves into the sheet, Tab stays inside it, and focus returns to the opener on close.

   Settings only mutates `state` (name, speech, slow, translit, sfx, every), calls save() and then
   onChange(key); the app applies the change (audio rate, speech, SFX, greeting...).
   Every call into engine/recorder is defensive: those modules are developed in parallel. */
import '../styles/settings.css';
import DATA from '../content/data.js';
import { RECORDABLE } from '../content/prompts.js';
import ART from '../art.js';
import * as engine from '../audio/engine.js';
import * as recorder from '../audio/recorder.js';

const NAME_MAX = 24;
const DIAG_EVERY_MS = 1500;                                    /* live refresh of the sound status list */
const REC_MAX_S = Math.round((Number(recorder.MAX_MS) || 15000) / 1000);
const SHAHADA = (DATA.sections || []).find((s) => s.id === 'shahada') || null;

const SWITCHES = [
  { key: 'speech', title: 'Puhe', sub: 'Suomenkieliset kehotteet ja kehut' },
  { key: 'slow', title: 'Hidas resitaatio', sub: 'Resitaatio soi hieman hitaammin' },
  { key: 'translit', title: 'Ääntämisapu', sub: 'Rivit myös latinalaisin kirjaimin' },
  { key: 'sfx', title: 'Ääniefektit', sub: 'Lyhyet poksahdukset ja kilahdukset' }
];
const TESTS = [
  { kind: 'recitation', label: 'Resitaatio', icon: 'play' },
  { kind: 'sfx', label: 'Efekti', icon: 'sparkle' },
  { kind: 'fi', label: 'Suomen puhe', icon: 'speech' },
  { kind: 'ar', label: 'Arabian puhe', icon: 'sound' }
];
const MIC_HELP = 'Mikrofoni vaatii luvan ja HTTPS-osoitteen.';

let opts = null;            /* { root, state, save, onChange, onReset, credits } */
let root = null, sheet = null, body = null;
let ac = null;              /* AbortController for this render's listeners (initSettings may run again) */
let open = false, lastFocus = null, diagTimer = 0, lastDiag = '';
let rec = null;             /* active recording: { id, row, t0, timer, saving } */
let playTok = 0, testTok = 0, statusTok = 0;
let watchingRecorder = false;

/* ---------- small helpers ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function icon(name) {
  try { return ART.icon(name, 'set-ico') || ''; } catch (e) { return ''; }
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
  try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* ignore */ } }
}
const $ = (sel) => (root ? root.querySelector(sel) : null);
const $$ = (sel) => (root ? Array.from(root.querySelectorAll(sel)) : []);
function normName(v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); }
function recSupported() { return !!call(recorder.isSupported); }

/* ---------- markup ---------- */
function card(key, ico, title, inner, extraCls) {
  return '<section class="set-card set-card-' + key + (extraCls ? ' ' + extraCls : '') + '" aria-labelledby="setH-' + key + '">' +
    '<h3 class="set-h" id="setH-' + key + '"><span class="set-h-ico" aria-hidden="true">' + icon(ico) + '</span>' + esc(title) + '</h3>' +
    inner + '</section>';
}

function nameCard() {
  return card('name', 'sparkle', 'Lapsen nimi',
    '<input class="set-input" id="setName" type="text" maxlength="' + NAME_MAX + '" placeholder="esim. Amina" autocomplete="off"' +
    ' autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-labelledby="setH-name" aria-describedby="setNameHint">' +
    '<p class="set-hint" id="setNameHint">Näkyy tervehdyksessä ja kehuissa.</p>');
}

function soundCard() {
  const rows = SWITCHES.map((s) =>
    '<label class="set-switch">' +
      '<span class="set-switch-text"><span class="set-switch-title">' + esc(s.title) + '</span><small>' + esc(s.sub) + '</small></span>' +
      '<input class="set-switch-input" type="checkbox" role="switch" data-key="' + s.key + '">' +
      '<span class="set-track" aria-hidden="true"></span>' +
    '</label>').join('');
  return card('sound', 'sound', 'Ääni ja näyttö', '<div class="set-switches">' + rows + '</div>');
}

function gameCard() {
  return card('game', 'gem', 'Minipeli',
    '<div class="set-seg" role="group" aria-labelledby="setH-game">' +
      '<button type="button" data-every="1" aria-pressed="false">' + icon('check') + '<span>Joka vaiheen jälkeen</span></button>' +
      '<button type="button" data-every="2" aria-pressed="false">' + icon('check') + '<span>Joka toisen vaiheen jälkeen</span></button>' +
    '</div>');
}

function recRow(item) {
  const id = esc(item.id);
  const lid = 'setRecL-' + id;
  return '<li class="rec-row" data-id="' + id + '" data-st="file">' +
    '<div class="rec-top">' +
      '<span class="rec-label" id="' + lid + '">' + esc(item.label) + '</span>' +
      '<span class="rec-status">Valmis ääni</span>' +
    '</div>' +
    '<div class="rec-actions">' +
      '<button type="button" class="sbtn sbtn-rec" data-act="rec" aria-describedby="' + lid + '">' + icon('mic') + '<span>Nauhoita</span></button>' +
      '<button type="button" class="sbtn sbtn-play" data-act="play" aria-describedby="' + lid + '">' + icon('play') + '<span>Kuuntele</span></button>' +
      '<button type="button" class="sbtn sbtn-del" data-act="del" aria-describedby="' + lid + '" hidden>' + icon('trash') + '<span>Poista oma ääni</span></button>' +
    '</div>' +
    '<div class="rec-live" hidden>' +
      '<button type="button" class="sbtn-stop" data-act="stoprec">' + icon('stop') + '<span>Lopeta</span></button>' +
      '<div class="rec-meter" aria-hidden="true">' +
        '<span class="rec-time"><span class="rec-dot"></span><span><span class="rec-sec">0 s</span> / ' + REC_MAX_S + ' s</span></span>' +
        '<span class="rec-bar"><i></i></span>' +
      '</div>' +
    '</div>' +
    '<div class="set-confirm rec-confirm" role="group" aria-label="Poistetaanko oma ääni?" hidden>' +
      '<p>' + (item.id === 'name' ? 'Poistetaanko oma ääni?' : 'Poistetaanko oma ääni? Tilalle tulee valmis ääni.') + '</p>' +
      '<div class="set-confirm-row">' +
        '<button type="button" class="sbtn sbtn-danger" data-act="delyes">Poista</button>' +
        '<button type="button" class="sbtn sbtn-soft" data-act="delno">Peru</button>' +
      '</div>' +
    '</div>' +
    '<p class="rec-msg" role="status" aria-live="polite"></p>' +
  '</li>';
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
      return '<details class="set-details rec-group"><summary><span>' + esc(g.name) + '</span>' +
        '<span class="set-count">' + g.items.length + '</span></summary>' + list + '</details>';
    }
    /* a single clip's own label already says what it is ("Lapsen nimi (...)") */
    return '<div class="rec-group">' + (g.items.length > 1 ? '<h4 class="rec-group-h">' + esc(g.name) + '</h4>' : '') + list + '</div>';
  }).join('');
  return card('rec', 'mic', 'Omat äänitykset',
    '<p class="set-hint">Voit korvata valmiin äänen omalla äänelläsi. Oma ääni soi valmiin äänen sijaan.</p>' +
    '<p class="set-note" data-rec-note hidden>Äänitys ei toimi tässä selaimessa. ' + MIC_HELP + '</p>' +
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
  return card('tips', 'snowflake', 'Vinkit',
    '<details class="set-details"><summary><span>Asennus ja äänet</span></summary><ul class="set-list">' +
      '<li><b>iPhone ja iPad:</b> avaa Safarissa, napauta <i>Jaa</i> ja valitse <i>Lisää Koti-valikkoon</i>.</li>' +
      '<li><b>Android:</b> avaa Chromessa, napauta <i>⋮</i> ja valitse <i>Asenna sovellus</i> tai <i>Lisää aloitusnäytölle</i>.</li>' +
      '<li><b>Ilman nettiä:</b> kun peli on avattu kerran verkossa, se toimii myös ilman yhteyttä.</li>' +
      '<li><b>Ei ääntä?</b> Tarkista äänenvoimakkuus ja kokeile <i>Testaa äänet</i>.</li>' +
      '<li><b>Aloita-kupla</b> avaa äänet. Jos kupla näkyy, napauta sitä.</li>' +
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

function resetCard() {
  return card('reset', 'replay', 'Aloita alusta',
    '<p class="set-hint">Nollaa tähdet ja edistymisen. Omat äänitykset säilyvät.</p>' +
    '<button type="button" class="sbtn sbtn-ghost set-reset-btn" data-act="reset">' + icon('replay') + '<span>Aloita alusta</span></button>' +
    '<div class="set-confirm" id="setResetConfirm" role="group" aria-labelledby="setResetQ" hidden>' +
      '<p id="setResetQ">Nollataanko kaikki tähdet ja edistyminen?</p>' +
      '<div class="set-confirm-row">' +
        '<button type="button" class="sbtn sbtn-danger" data-act="resetyes">Kyllä, nollaa</button>' +
        '<button type="button" class="sbtn sbtn-soft" data-act="resetno">Peru</button>' +
      '</div>' +
    '</div>' +
    '<p class="set-msg" data-reset-msg role="status" aria-live="polite"></p>');
}

function creditsCard(credits) {
  const list = Array.isArray(credits) ? credits : (credits ? [credits] : []);
  return card('credits', 'star', 'Lähteet ja lisenssit',
    '<ul class="set-credits">' + list.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>');
}

function markup(credits) {
  return '<div class="set-sheet" role="dialog" aria-modal="true" aria-labelledby="setTitle" tabindex="-1">' +
    '<header class="set-head">' +
      '<span class="set-head-crown" aria-hidden="true">' + icon('crown') + '</span>' +
      '<h2 class="set-title" id="setTitle">Vanhemmille</h2>' +
      '<button type="button" class="set-close" data-act="close" aria-label="Sulje asetukset">' + icon('close') + '</button>' +
    '</header>' +
    '<div class="set-body">' +
      nameCard() + soundCard() + gameCard() + recordingsCard() + testCard() + tipsCard() + resetCard() + creditsCard(credits) +
    '</div>' +
  '</div>';
}

/* ---------- state <-> controls ---------- */
function sync() {
  const st = opts.state;
  const input = $('#setName');
  if (input && document.activeElement !== input) input.value = st.name || '';
  $$('.set-switch-input').forEach((el) => { el.checked = !!st[el.dataset.key]; });
  $$('[data-every]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.every) === (st.every === 2 ? 2 : 1))));
}
function changed(key) {
  call(opts.save);
  call(opts.onChange, key);
}

/* ---------- own recordings ---------- */
function rowOf(el) { return el && el.closest ? el.closest('.rec-row') : null; }

/* Clip for a recordable id. Shahada rows play the data line (recording -> shahada MP3 -> speech). */
function clipFor(id) {
  if (/^shahada-/.test(id) && SHAHADA) {
    let i = SHAHADA.lines.findIndex((l) => l.rec === id);
    if (i < 0) i = Number(id.split('-')[1]) - 1;
    return call(engine.line, SHAHADA, i) || null;
  }
  return call(engine.prompt, id) || null;
}

function setRowStatus(row, own) {
  const id = row.dataset.id;
  const st = own ? 'own' : (id === 'name' ? 'none' : 'file');
  row.dataset.st = st;
  row.querySelector('.rec-status').textContent = st === 'own' ? 'Oma ääni' : (st === 'none' ? 'Ei ääntä' : 'Valmis ääni');
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
    $$('.rec-row').forEach((row) => setRowStatus(row, own.has(row.dataset.id)));
  });
}

/* Enable/disable row + test buttons for the current recording state. */
function updateRowButtons() {
  const can = recSupported();
  const note = $('[data-rec-note]');
  if (note) note.hidden = can;
  $$('.rec-row').forEach((row) => {
    const busy = !!rec;
    const mine = !!(rec && rec.row === row);
    row.querySelector('[data-act="rec"]').disabled = !can || busy;
    row.querySelector('[data-act="play"]').disabled = busy || row.dataset.st === 'none';
    row.querySelector('[data-act="del"]').disabled = busy;
    row.classList.toggle('is-dim', busy && !mine);
  });
  $$('[data-test]').forEach((b) => { b.disabled = !!rec; });
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
/* "MP3: OK" -> ["MP3", "OK"] style value; strings without a short "label: " prefix stay whole. */
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

/* ---------- reset ---------- */
function showResetConfirm(on, focusBack) {
  $('#setResetConfirm').hidden = !on;
  $('[data-act="reset"]').hidden = on;
  if (on) focusEl($('[data-act="resetno"]'));
  else if (focusBack) focusEl($('[data-act="reset"]'));
}

/* ---------- events ---------- */
function onClick(e) {
  const t = e.target;
  const btn = t.closest ? t.closest('button') : null;
  if (!btn || !root.contains(btn) || btn.disabled) return;
  const row = rowOf(btn);
  const act = btn.dataset.act;
  if (btn.dataset.every) {
    opts.state.every = Number(btn.dataset.every) === 2 ? 2 : 1;
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
  else if (act === 'delno' && row) {
    row.querySelector('.rec-confirm').hidden = true;
    focusEl(row.querySelector('[data-act="del"]'));
  } else if (act === 'reset') {
    $('[data-reset-msg]').textContent = '';
    showResetConfirm(true);
  } else if (act === 'resetno') showResetConfirm(false, true);
  else if (act === 'resetyes') {
    call(opts.onReset);
    showResetConfirm(false, true);
    $('[data-reset-msg]').textContent = 'Tähdet ja edistyminen nollattiin.';
  }
}

function focusables() {
  return Array.from(sheet.querySelectorAll('button, input, summary, [href], [tabindex]:not([tabindex="-1"])'))
    .filter((el) => !el.disabled && el.getClientRects().length > 0);
}

function onKey(e) {
  if (!open || (e.key !== 'Escape' && e.key !== 'Tab')) return;
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
      opts.state[el.dataset.key] = !!el.checked;
      changed(el.dataset.key);
    } else if (el.id === 'setName') {
      el.value = opts.state.name || '';            /* show the trimmed name once editing ends */
    }
  }, sig);
  const input = $('#setName');
  input.addEventListener('input', () => {
    const v = normName(input.value);
    if (v === opts.state.name) return;
    opts.state.name = v;                           /* live save; the field itself keeps what is typed */
    changed('name');
  }, sig);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } }, sig);
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
  if (!o || !o.root || !o.state) return;
  if (ac) { if (open) closeSettings(); ac.abort(); }
  opts = o;
  root = o.root;
  root.classList.add('set-root');
  root.innerHTML = markup(o.credits);
  sheet = root.querySelector('.set-sheet');
  body = root.querySelector('.set-body');
  ac = new AbortController();
  lastDiag = '';
  bind();
  sync();
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
  sync();
  showResetConfirm(false);
  $('[data-reset-msg]').textContent = '';
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
  focusEl(sheet);
}

export function closeSettings() {
  if (!root || !open) return;
  open = false;
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
  if (back && back !== document.body && back.isConnected) focusEl(back);
}

export function isSettingsOpen() { return open; }
