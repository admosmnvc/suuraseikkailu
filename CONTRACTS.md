# Suuraseikkailu v2 – build contracts (read fully before touching code)

Product brief: `KORJAUSPYYNTO.md` (Finnish). This file adds the module split, ownership and APIs so
several agents can work **in parallel without editing each other's files**.

Owner's extra decision (binding):
- Teacher voice: Shahada (2 lines) and **all Finnish prompts/praise/meanings/game titles** are
  pre-generated MP3s spoken by a **cheerful, upbeat teacher voice** (Finnish: `fi-FI-NooraNeural`,
  Arabic: `ar-SA-ZariyahNeural`). They are NEVER snippets cut from the recitation.
  Surah lines stay Mishary Alafasy recitation (`public/audio/0*.mp3`, `1*.mp3`).
- Delivery: a zip of the static site (no hosting by us). Must work from any sub-path (Vite `base: './'`).

## Hard rules (from KORJAUSPYYNTO.md – never break)
- `src/content/data.js` field `ar` is Tanzil text: never edit/normalise. `node tools/check-arabic.mjs` must pass.
  Show Arabic in `var(--f-arabic)` (Amiri Quran), calm light card, no decorations on top of it.
- No music: only short SFX (pop, clink, sparkle), recitation and speech. No background music, no melodic jingles
  (no recognisable scale runs / arpeggio fanfares).
- No characters: no faces, people, animals, creatures, no princess figure. Princess mood = objects only
  (crowns, tiaras, ice palace, snowflakes, crystals, gems, bubbles, sparkle). Palace may have domes and crescents.
- No Disney/Frozen names, logos, fonts, images or songs. All art is our own inline SVG/CSS.
- UI text in Finnish, short and warm. Parent reads, child listens and taps.
- Keep features: parent settings via long-press, child's name in praise, slow recitation, minigame every step or
  every 2nd step, stars, stickers, progress saved on device (`localStorage` key `suuraseikkailu-v1`, v1-compatible shape).
- Hit targets >= 64 px, nothing punishes a wrong tap, respect `prefers-reduced-motion`, no horizontal scroll at
  360–1024 px, iPhone safe areas (`env(safe-area-inset-*)`), no console errors.

## Stack / layout
Vite 8 + plain JavaScript ES modules (no framework). `npm run build` -> `dist/`.
```
index.html                 [ui]       body markup + <script type=module src=./src/main.js>; head is FOUNDATION (pwa may edit head only)
src/main.js                [ui]       entry: imports fonts+styles, boot, gate, flow, wiring
src/state.js               [ui]       load/save state (v1-compatible), defaults
src/ui/background.js       [ui]       frost background: rising bubbles, snowflakes, sparkles, palace silhouette
src/ui/*.js (others)       [ui]       optional split of home/learn/overlays/caption – ui agent's choice
src/styles/tokens.css      [ui]       FOUNDATION palette tokens (others may read; ui may add, never rename)
src/styles/app.css         [ui]       all app styles except settings + games
src/ui/settings.js         [settings] settings sheet (renders into #settings), recordings UI, sound-test panel
src/styles/settings.css    [settings]
src/audio/context.js       [audio]    shared AudioContext (create/resume/state, buses)
src/audio/engine.js        [audio]    voice channel: queue, recitation, prompts, fallbacks, lock detection, diagnostics
src/audio/recorder.js      [audio]    MediaRecorder -> IndexedDB
src/audio/tts.js           [audio]    speechSynthesis last-resort fallback
src/audio/sfx.js           [audio]    synthesized SFX (quieter than voice, never over recitation)
src/fx.js                  [games]    full-screen particle canvas (FX)
src/games/**               [games]    8 minigames + framework
src/styles/games.css       [games]
src/art.js                 [art]      all SVG art (icons, crown, palace, stickers, app icon…)
src/pwa.js                 [pwa]      SW registration/update
vite.config.js             [pwa]      build config + SW precache generation plugin
public/manifest.webmanifest, public/icons/*   [pwa]
public/audio/fi/*.mp3, public/audio/shahada-*.mp3, tools/make_voices.py   [voices]
public/audio/0*.mp3,1*.mp3 FOUNDATION (Mishary, do not touch)
src/content/data.js, src/content/prompts.js   FOUNDATION (frozen; ask integration if a change is needed)
src/util.js                FOUNDATION helpers (clamp, rand, now, shuffle, reducedMotion, hexToRgb, mix, shade, TAU)
tools/check-arabic.mjs, tools/list-clips.mjs  FOUNDATION
v1-reference/              read-only: the v1 code (index.html, games.js, art.js, games.css, data.js)
README.md                  [pwa]      Finnish: how to build, run, deploy (Netlify Drop / GitHub Pages / Cloudflare Pages)
```
**Only edit files you own.** If you need something from another module that the contract does not give you,
code defensively (feature-check) and report it in your final summary under `needs`.

## Working rules for agents
- Project root: the directory containing this file. Run commands there.
- Never run a bare `npm run build` / `vite build` into `dist/` (shared). Build into your own dir:
  `npx vite build --outDir ../build-<agent> --emptyOutDir`. Dev server: `npx vite --host 127.0.0.1 --port <your port>`
  (ports: ui 5101, settings 5102, audio 5103, games 5104, art 5105, pwa 5106, voices 5107, integration 5110).
- Other agents edit their files at the same time. A build error in a file you do not own: wait a minute and retry;
  do not "fix" it. Keep your own files syntactically valid as often as possible (write whole files, not half-edits).
- Browser testing: Playwright is at `/opt/node-tools/node_modules/playwright` (CommonJS `require`), Chromium is
  pre-installed (do not run `playwright install`). See `../smoke.cjs` for a tiny static server + page example.
- No new npm dependencies without need (allowed already: vite, @fontsource/fredoka, @fontsource/nunito,
  @fontsource/amiri-quran). Everything must work offline after first load.

## Data
`DATA = (await import('./content/data.js')).default` → `{ sections: [{ id, name, ar, sub, acc, color, quran, lines: [{ ar, tr, fi, audio, n, rec?, tts? }] }], credits: string[] }`
- Section ids: `shahada` (2 lines), `fatiha` (7), `ikhlas` (5), `kawthar` (4). Each surah starts with Bismillah
  (Fatiha: verse 1 `n=1`; Ikhlas/Kawthar: separate first line `n=0`, no verse marker).
- Shahada lines: `audio: 'audio/shahada-1.mp3'|'-2'`, `rec: 'shahada-1'|'shahada-2'`, `tts` = Arabic for device speech.
- Paths are relative (`audio/...`) – resolve against `document.baseURI`, never with a leading `/`.

## Prompts (src/content/prompts.js)
`PROMPTS` (id → Finnish text), `PRAISE_IDS`, `GAME_COUNT = 8`, `gameId(i)`, `finaleId(secId)`, `meaningId(secId, i)`,
`promptText(id)`, `RECORDABLE` (clips a parent can record: shahada-1/2, name, turn-*, praise-*, gem, finale-*),
`allVoiceClips()`. File convention: Finnish clip `<id>` → `audio/fi/<id>.mp3`. `'name'` = recording only.

## Audio API (owner: audio) – `import * as engine from './audio/engine.js'`
Clip = `{ kind: 'recitation'|'voice', id?: string|null, src?: string|null, text?: string, lang: 'ar'|'fi' }`.
Source order per clip: parent recording (by `id`, IndexedDB) → MP3 `src` → device speech (`text`, `lang`) →
silent wait (~4 s for an Arabic line so the parent can read it; ~0 for Finnish).
```js
engine.unlock()                 // SYNC, call inside the gate tap handler: AudioContext resume + navigator.audioSession.type='playback'
                                //   + bless the single shared <audio> element + warm speechSynthesis. Never throws.
engine.isLocked() -> boolean    // true before first unlock, and when audio got locked again (background return, interruption)
engine.onLockChange(cb)         // cb(locked:boolean). UI shows the gate bubble again when locked === true.
engine.preload(srcs[])          // warm cache (fetch -> blob URLs); call when a section opens
engine.line(sec, i) -> Clip     // clip for a data line (recitation; Shahada = voice files with rec ids)
engine.prompt(id) -> Clip       // Finnish clip (PROMPTS id, meaning id, or 'name')
engine.meaning(sec, i) -> Clip  // = prompt(meaningId(sec.id, i))
engine.playSequence(clips, { gapMs?, onItem?(i) }) -> Promise<boolean>
                                // stops current playback first; one clip at a time, in order, never overlapping;
                                // true = all finished, false = interrupted by stop()/another play
engine.play(clip) -> Promise<boolean>
engine.stop()                   // immediate silence of voice channel + queue + speech
engine.isBusy() -> boolean; engine.busyKind() -> 'recitation'|'voice'|null
engine.setSlow(bool)            // recitation playbackRate 0.8, preservesPitch true
engine.setSpeechEnabled(bool)   // false = Finnish prompts silent (resolve immediately); recitation unaffected
engine.refreshRecordings()      // call after recordings change (settings)
engine.diagnostics() -> { mp3, context, lastError, fiVoice, arVoice, recordings: string[] }   // strings for the test panel
engine.test(kind: 'recitation'|'sfx'|'fi'|'ar') -> Promise<{ ok: boolean, detail: string }>   // detail e.g. "MP3: OK",
                                // "AudioContext: running", "Virhe: NotAllowedError", "Suomen puheääni: ei löytynyt"
```
`import * as recorder from './audio/recorder.js'`:
`isSupported()`, `has(id)`, `list()`, `get(id) -> Blob|null`, `remove(id)`, `start()` (asks mic, max 15 s auto-stop),
`stopAndSave(id) -> Blob`, `cancel()`, `isRecording()`, `onChange(cb)`.
`import { SFX } from './audio/sfx.js'`: `unlock()`, `setEnabled(bool)`, `pop()`, `ding(i)`, `chime(i)`, `plop()`, `whoosh()`,
`boom()`, `sparkle()`, `success()`, `tap()` (same names as v1; quieter than voice; skipped while recitation plays).

## Art API (owner: art) – `import ART from './art.js'` (also `export const ART`)
All return SVG markup strings (`aria-hidden="true"`), scale to their container (width/height 100% or viewBox only).
```
ART.icon(name, cls)   names: home play star speech gear close check replay back sound mic stop trash crown gem snowflake sparkle
ART.ayah(n)           verse-end marker with Arabic digits (keep v1 look adapted to light theme)
ART.arabicDigits(n)   ART.starPath(cx, cy, R, r, points?, rotation?)
ART.crystal(cls)      8-pointed star as an ice crystal (star counter icon)
ART.snowflake(cls)    ART.bubble(cls)    ART.gem(color, cls)    ART.tiara(color, cls)
ART.crown({ slots, filled, colors?, cls? })   sockets are elements `.crown-slot[data-i]`, filled ones also `.on`
ART.palace({ windows, lit, cls? })            ice palace with domes + crescents; windows `.pw[data-i]`, lit ones `.on`
ART.palaceSilhouette()                         wide light silhouette for the background bottom (preserveAspectRatio xMidYMax slice)
ART.sticker(id, earned)   ids: shahada fatiha ikhlas kawthar palace(bonus: all four done). Not earned = frosted outline.
ART.appIcon()             512×512 square SVG (crown + crystal on frost) used by the pwa agent for PNG icons
```
## Games API (owner: games) – `import MiniGames from './games/index.js'`
`MiniGames.count === 8`, `MiniGames.titles` (= PROMPTS game-0..7 texts), `MiniGames.play({ index, onDone, say }) -> { abort() }`.
`say('game-<i>')` is called once at start with the prompt id (UI plays `engine.prompt(id)`). Index order:
0 balloons, 1 snowflake rain, 2 bubbles, 3 crystal lanterns, 4 fruit basket, 5 sparkle/aurora fireworks,
6 "Koristele kruunu" (NEW), 7 "Sytytä palatsin valot" (NEW). Length 10–20 s, no losing, big targets.
`import { FX } from './fx.js'`: `burst(x,y,colors,n)`, `sparkle(x,y)`, `confetti(n)`, `firework(x,y,hue)`, `rocket(...)`, `show(ms)`, `clear()`.

## Settings API (owner: settings) – `import * as settings from './ui/settings.js'`
```js
settings.initSettings({ root, state, save, onChange, onReset, credits })
  // root: the empty <div id="settings" class="overlay overlay-settings" hidden> in index.html (settings renders inside)
  // state: shared state object; settings mutates name, speech, slow, translit, sfx, every, then calls save() and onChange(key)
  // onReset(): called after the parent confirmed "Aloita alusta"; the app clears progress/done/stars/game
  // credits: DATA.credits (string[]) – shown as "Lähteet ja lisenssit"
settings.openSettings(); settings.closeSettings(); settings.isSettingsOpen()
```
Settings imports `engine` and `recorder` itself (recordings + "Testaa äänet" panel). The long-press parent button
lives on the home screen (ui) and calls `settings.openSettings()` after an 800 ms hold.

## State (owner: ui) – `localStorage['suuraseikkailu-v1']`
`{ progress: { shahada, fatiha, ikhlas, kawthar }, done: {}, stars, name, speech, slow, translit, sfx, every: 1|2, game }`
(v1 shape; `game` = next minigame index, used modulo 8).

## Final summary each agent returns
`files` (paths written), `api` (anything others must know / deviations from this contract), `tests` (what you ran
and the result), `needs` (things another owner must change), `risks`.
