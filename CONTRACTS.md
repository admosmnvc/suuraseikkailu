# Suuraseikkailu v3 – build contracts (read fully before touching code)

v2 is live and working (light ice palace, one child). v3 = owner's new brief below. Several agents work **in parallel**
on disjoint files. v2 product brief (still valid where not changed): `KORJAUSPYYNTO.md`.

## Owner's v3 brief (binding, summarised from the owner's own words)
1. **Two themes – STYLE CHANGED (owner: "pop art" was the wrong word; the pop-art cover felt stuffy/cluttered).
   Target: PREMIUM, uplifting, modern kids' app** (quality level of top kids' apps: think Sago Mini / Pok Pok /
   Khan Academy Kids – as inspiration only, never copy). Rules:
   - Clean, airy compositions; ONE clear hero/focal point per screen; generous whitespace; few elements, each polished.
   - Soft "clay / 3D-lite" look: chunky rounded shapes, gentle gradients, soft inner highlight, soft coloured shadows.
     NO thick black outlines, NO halftone/Ben-Day dots, NO comic bursts/speech-burst clutter, NO busy patterns.
   - Harmonious bright palettes on light creamy/sky backgrounds. Girl: coral pink #FF7A9A, rose #FFB3C7, lavender
     #B9A4FF, peach #FFC9A8, mint #8EE3C8, gold #FFD36E, cream #FFF8F1. Boy: sky blue #5AB4FF, deep blue #2F6BFF,
     sunny yellow #FFD54A, tangerine #FF9A3C, teal #2EC4B6, red #FF5A5F, cream #F5FAFF. Ink (text) #24324F.
   - Rounded friendly type: Fredoka (display) + Nunito (body); NO Bangers. Praise words as clean big rounded text with a
     soft glow/confetti, e.g. "Hienoa!", "Upeaa!" (not comic bursts).
   - Motion: springy, smooth, delightful micro-interactions; tasteful confetti; reduced motion respected.
   - Animals (pony, puppy, kitten, bunny) cute and simple with soft shading; vehicles friendly; still NO humans.
   - The Arabic card stays calm and dignified (white card, soft shadow, no decoration on/behind the text).
2. **Cover**: first screen = split cover, half girl theme / half boy theme (both visible), big button
   **"Aloita Suuraseikkailu"**. Tap → enter the child's name + pick **Tyttö / Poika** → that choice = the theme the child
   plays in. **Several children**: profiles; intuitive "+ Lisää lapsi"; next launches show the children's cards to pick.
3. **Levels for every section** (incl. Shahada): **HELPPO** = one word at a time, **KESKITASO** = two words at a time,
   **VAIKEA** = whole line (v2 behaviour). Owner's Shahada example: HELPPO "Ash-hadu · an laa · ilaaha · illallaah",
   KESKITASO "Ash-hadu an laa · ilaaha illallaah", VAIKEA the whole line. Level is chosen **both** in the child's profile
   (default) **and** at the start of each surah (three big buttons; last pick remembered per surah).
4. **Minigames for ages 4–7, far more dynamic**, theme-specific: boys = cars/speed ("vaihda auton renkaat"),
   girls = princess mood, horses, animals ("harjaa hevosen tukka"). **Clear visual instructions** (animated hand showing
   the gesture). **Instantly responsive**: feedback in the same frame as the touch – v2 queued/paced taps (S.paced,
   10.5 s floor) and the owner felt the lag: REMOVE all artificial pacing; length comes from the task itself.
5. Progress picture: girls keep the castle whose windows light up; boys get a **rocket** that is built part by part
   (one part per completed line) and launches when a surah is finished.
6. Characters: **animals may have faces** (horse, puppy, kitten, bunny, etc.). **No humans** anywhere (no princess
   figure, no people, no human faces): princess mood = crowns, tiaras, dresses on hangers, castles, jewels.
7. Word audio for surahs (HELPPO/KESKITASO): **real human word-by-word recordings** (quran.com word audio,
   `https://audio.qurancdn.com/wbw/SSS_AAA_WWW.mp3`), never snippets cut from the Mishary recitation.
   Shahada (not Quran): teacher voice ar-SA-ZariyahNeural per chunk. Finnish prompts: teacher voice fi-FI-NooraNeural.

## Hard rules (unchanged from v2 – never break)
- `src/content/data.js` field `ar` is Tanzil text: never edit. `node tools/check-arabic.mjs` must pass. Word chunks are
  exact space-separated substrings of `ar` (joining a line's words with ' ' must give `ar` exactly).
- No music (only short SFX, recitation, speech). No Disney/Frozen or other brands, logos, songs. Own art only.
- UI in Finnish, short and warm. Ages 4–7, the parent reads.
- Keep v2 features: Aloita/gate audio unlock + "Jatketaan!" relock gate, single audio queue, slow recitation,
  minigame every step / every 2nd step, stars, stickers, recordings, Testaa äänet, offline PWA, long-press parent
  settings, credits, safe areas, >= 64 px targets, no horizontal scroll 360–1024 px, reduced motion, no console errors.

## Ownership (edit ONLY your files; others work at the same time)
```
FOUNDATION (frozen; ask the orchestrator for changes)
  src/content/data.js, src/content/prompts.js, src/profiles.js, CONTRACTS.md, src/util.js
content agent   src/content/words.js, src/content/chunks.js, public/audio/wbw/**, public/audio/shahada-c-*.mp3,
                public/audio/fi/** (regenerate for new prompts), tools/make_voices.py, tools/build-words.*,
                tools/check-arabic.mjs (extend: word chunks join back to ar), tools/voices*.{json,md}, tools/list-clips.mjs
art agent       src/art.js (may split into src/art/*.js re-exported by src/art.js), tools/art-*
games-core+boy  src/games/core.js, src/games/hint.js, src/games/gestures.js, src/games/index.js, src/games/boy/**,
                src/fx.js, src/styles/games.css, tools/games-test.* (remove v2 game files you replace)
games-girl      src/games/girl/**, src/styles/games-girl.css (imported by src/games/girl/index.js)
ui agent        index.html (body + <head> theme-color), src/main.js, src/ui/* (except settings.js), src/styles/tokens.css,
                src/styles/app.css, src/state.js (delete; use profiles.js), tools/e2e.cjs (update)
settings agent  src/ui/settings.js, src/styles/settings.css
unchanged       src/audio/* (engine API below), src/pwa.js, vite.config.js, tools/pwa-*, public/icons (regenerated at the end)
```
Working rules: build only into your own outDir (`npx vite build --outDir ../build-<role> --emptyOutDir`), own dev port
(ui 5201, settings 5202, content 5203, games-boy 5204, games-girl 5205, art 5206). A build error in someone else's file:
wait and retry, never fix it. Write whole files you own; never sed/Write files you don't own. Playwright:
`/opt/node-tools/node_modules/playwright` (CommonJS), Chromium pre-installed. Look at your screenshots with Read.
Fonts available via npm (@fontsource): fredoka, nunito, amiri-quran already installed; you MAY add `@fontsource/bangers`
(comic display font, ui/art/games use it only for bursts/titles; it is caps-only) – the ui agent installs it.

## Data: words and chunks (owner: content) – `import { chunks, words } from './content/chunks.js'`
```js
words(secId, lineIndex) -> [{ ar, tr, src }]      // Tanzil words of the line (ar exact), Finnish-friendly transliteration
                                                  // per word (as the word is said on its own), src = word audio (Quran)
chunks(secId, lineIndex, level) -> [{ ar, tr, clips }]
  // level 'hard' -> []  (the line itself is the unit)
  // 'easy'   -> one chunk per word (Shahada: the owner's units: أَشْهَدُ | أَنْ لَا | إِلَٰهَ | إِلَّا اللَّهُ, line 2 similar)
  // 'medium' -> two easy-chunks per chunk (last may be single)
  // ar = exact substring of the line's ar (words joined by ' '), tr = transliteration shown under it,
  // clips = engine clips to play in order with gap 0: Quran: one {kind:'recitation', id:null, src:'audio/wbw/SSS_AAA_WWW.mp3',
  //   text:'', lang:'ar'} per word; Shahada: one teacher clip {kind:'recitation', id:null, src:'audio/shahada-c-<line>-<level>-<i>.mp3',
  //   text:<tts with diacritics>, lang:'ar'} per chunk.
```
Bismillah of Ikhlas/Kawthar (line 0) uses the Fatiha 1:1 word audio.

## Flow per level (owner: ui) – FINAL (owner decision: "koko ajan pitää sanoa alusta")
The v2 cumulative chaining is THE method on every level; the level only sets the size of the UNIT added per step:
HELPPO unit = one easy chunk (word; Shahada: the owner's units), KESKITASO unit = one medium chunk (two words),
VAIKEA unit = one line. Units run continuously through the whole section (across line boundaries).
- Step k = units 1..k FROM THE VERY START of the section → "Sanoin!" → minigame (every / every-2nd step, as v2)
  → reward (+1 star) → "Jatka" → step k+1. The last step (= the whole section) → finale (no minigame), +3/+1 stars as v2.
  Turn prompts as v2: step 1 'turn-1', later 'turn-all' ("Sano kaikki alusta asti").
- Audio of step k: every line fully inside units 1..k plays as the normal LINE clip (engine.line: Mishary / Shahada
  teacher line, gapMs 250 between lines); the current, partially covered line plays its covered chunks' clips (gap 0 inside
  a chunk, ~150 ms between chunks). When step k completes a line exactly, that line plays as the line clip.
- Screen: cards for all lines touched so far (v2 style); in the current partial line the covered words are shown normally,
  the newest unit highlighted ("UUSI"), the not-yet-covered words of that line hidden or very dimmed; transliteration
  shows only the covered part. No decoration on Arabic.
- Progress: child.progress[secId] = completed LINES (a line is complete when a completed step covers its last unit) →
  castle windows / rocket parts / crown slots (one per line, 18 total). The reward overlay after every step shows +1 star
  and a comic burst; when the step completed a line, the gem flies into the crown (girl) / the part into the rocket (boy)
  and the window/part lights. child.steps[secId][level] = completed steps at HELPPO/KESKITASO (VAIKEA uses progress, as v2).
  Changing the level mid-section resumes at the first unit of the first incomplete line (derived from progress).
- Step bubbles: one per step can be many (Al-Fatiha HELPPO = 29): show a compact scrollable row or a progress bar with
  the current number "Vaihe 5/29"; reopening a section resumes at the next step; done sections open in review = last step.
- Example Shahada HELPPO (9 units: Ash-hadu | an laa | ilaaha | illallaah | wa ash-hadu | anna | Muhammadan |
  ‘abduhuu | wa rasuuluh): step 1 "Ash-hadu" → game; step 2 "Ash-hadu an laa" → game; … step 4 = line 1 (window 1)
  → game; step 5 = line 1 + "wa ash-hadu" → game; … step 9 = whole Shahada → finale. 8 games (every=1).
  Al-Fatiha HELPPO: 29 steps, 28 games (14 with every-2nd). VAIKEA = exactly v2.
- Removed prompts: chunk-turn, chunk-good, line-now, surah-now (no separate chunk practice, no extra final step).

## Profiles / state (FOUNDATION: src/profiles.js – read it)
`loadStore(sectionIds)`, `saveStore(store)`, `activeChild(store)`, `addChild(store, name, theme, ids)`,
`updateChild(store, id, {name, theme, level})`, `removeChild(store, id)`, `setActive(store, id)`,
`levelFor(child, secId)`, `resetChild(child, ids)`, `NAME_MAX`, `MAX_CHILDREN`.
Store: `{ version: 3, children: [{ id, name, theme, level, levelBySection, progress, steps, done, stars, game }], activeId,
settings: { speech, slow, translit, sfx, every } }`. Settings are shared by all children (device-level).
The theme is applied as `<html data-theme="girl|boy">` (ui). Mutate the one store object; call saveStore after changes.

## Prompts (FOUNDATION: src/content/prompts.js)
New ids: cover, who, ask-name (text only, no audio), ask-theme, pick-level, level-easy/medium/hard, rocket-part, rocket-launch, game-boy-0..5, game-girl-0..5. `THEMES`, `LEVELS`, `LEVEL_NAMES`
(HELPPO/KESKITASO/VAIKEA), `GAME_COUNT = 6` per theme, `gameId(theme, i)`, `levelId(level)`. Old game-0..7 ids are gone.
Girl reward prompt 'gem' (gem into the crown), boy reward prompt 'rocket-part'. Finale prompts are shared;
boys additionally hear 'rocket-launch' when a surah is finished.

## Audio API (unchanged, see src/audio/engine.js)
`engine.unlock()` (sync in a click), `isLocked`, `onLockChange`, `preload(srcs)`, `line(sec,i)`, `prompt(id)`,
`meaning(sec,i)`, `playSequence(clips, {gapMs, onItem})`, `play(clip)`, `stop()`, `isBusy()`, `busyKind()`, `setSlow`,
`setSpeechEnabled`, `refreshRecordings`, `diagnostics`, `test(kind)`. Word/chunk clips are kind 'recitation'
(always play, SFX ducked). `SFX` (src/audio/sfx.js): unlock, setEnabled, pop, ding(i), chime(i), plop, whoosh, boom,
sparkle, success, tap, test. SFX play instantly (Web Audio) – use them on pointerdown for instant feedback.

## Art API v3 (owner: art) – `import ART from './art.js'`
All return SVG strings (aria-hidden), PREMIUM soft style (see brief 1: no outlines/halftone), viewBox only (scale to container).
```
ART.icon(name, cls)                     home play star speech gear close check replay back sound mic stop trash plus user
                                        edit crown gem rocket car lock (24x24, currentColor stroke, bold)
ART.cover()                             full split cover: left girl (castle, horse with a face, crown, hearts, sparkles),
                                        right boy (race car, rocket, checkered flag, speed lines); diagonal comic split;
                                        preserveAspectRatio xMidYMid slice; no text in the SVG
ART.avatar(theme, cls)                  profile badge (girl: crown/horse head; boy: race car/rocket) – no humans
ART.progress(theme, { total, done, cls }) girl: castle with `total` windows, `done` lit (.pw[data-i], .on);
                                        boy: rocket with `total` parts assembled bottom-up (.rp[data-i], .on), flame when total===done
ART.reward(theme, { slots, filled, cls }) girl: crown with gem sockets; boy: mini rocket with part slots;
                                        both use `.slot[data-i]` and `.on` (ui adds .on to animate the newest)
ART.sticker(theme, id, earned)          ids: shahada fatiha ikhlas kawthar bonus; girl: tiara, horse, castle, bunny, crown…;
                                        boy: race car, rocket, trophy, helmet, flag…; not earned = grey halftone ghost
ART.burst(color, cls)                   comic explosion/burst shape (text is HTML on top), ART.bubble(cls) speech bubble
ART.background(theme)                   wide pop-art backdrop for the bottom/back of screens (girl: castle hills, hearts,
                                        stars; boy: city/track/space, speed lines) – xMidYMax slice
ART.levelIcon(level, cls)               1/2/3 filled stars style badges for easy/medium/hard
ART.ayah(n), ART.arabicDigits(n)        verse marker (keep calm, it sits next to Arabic)
ART.appIcon()                           512x512 split icon (pink/purple half with crown, blue/red half with rocket), no text
```
## Games API v3 (owner: games-core+boy; girl games plug in) – `import MiniGames from './games/index.js'`
```js
MiniGames.count(theme) === 6; MiniGames.titles(theme) -> 6 PROMPTS texts
MiniGames.play({ theme, index, onDone, say }) -> { abort() }   // index modulo 6; say(gameId(theme, idx)) once at start
```
Each game module: `export default { id, title, start(S) }` in src/games/<theme>/<name>.js; src/games/<theme>/index.js
exports an array of 6 in prompt order. Core session `S` (core.js) keeps the v2 basics (arena, S.later, S.on, S.add,
S.point/goal markers, S.active, finish → onDone, hidden-page pause, abort cleanup) and adds (games-core implements,
both game agents use):
```js
S.hint({ type: 'tap'|'drag'|'rub'|'hold', at: {x,y}, to?: {x,y} })   // animated hand demo; auto-hides on first touch
S.idleHint(fn, ms=2500)                                              // re-show a hint after ms without progress
gestures.drag(el, { onStart, onMove, onEnd })                        // pointer capture, instant follow (no easing lag)
gestures.rub(el, { onRub(dist, x, y) })                              // brushing/scrubbing amount
gestures.hold(el, { onHold(ms), onRelease })                         // press-and-hold progress
```
Rules for every game: visible response in the SAME frame as pointerdown (transform/class change + SFX), no queued taps,
no debounce on success; finish 10–20 s through content (e.g. 4 nuts + swap tire + 4 nuts), never fail, idle hand hint,
targets >= 64 px, reduced-motion fallback, 360–1024 px + landscape phone, Finnish only, no humans (animals with faces ok).
Boy games (titles fixed): 0 Vaihda auton renkaat, 1 Pese auto puhtaaksi, 2 Tankkaa auto täyteen, 3 Vihreä valo kaasua,
4 Aja kilpaa ja kerää tähdet, 5 Pysäköi auto ruutuun. Girl games: 0 Harjaa hevosen harja, 1 Ruoki eläimet,
2 Kylvetä koiranpentu, 3 Koristele kakku, 4 Kasvata kukkaniitty, 5 Sytytä linnan valot.

## Settings API v3 (owner: settings) – `import * as settings from './ui/settings.js'`
```js
settings.initSettings({ root, store, save, onChange, onReset, onChildrenChange, credits })
  // store: the profiles store (settings edits store.settings.* and children via profiles.js helpers)
  // onChange(key) for speech/slow/translit/sfx/every; onReset(childId) after confirmed reset of ONE child;
  // onChildrenChange() after add/rename/theme/level/delete of children (ui re-renders, re-applies theme)
settings.openSettings(); settings.closeSettings(); settings.isSettingsOpen()
```
Settings sections v3: Lapset (list: name, theme Tyttö/Poika toggle, default level HELPPO/KESKITASO/VAIKEA, rename,
"Aloita alusta" per child with confirm, delete with confirm, "+ Lisää lapsi"), Ääni ja näyttö, Minipeli, Omat äänitykset,
Testaa äänet, Vinkit, Lähteet ja lisenssit (add: "Sana-äänitteet: Quran.com (audio.qurancdn.com)").

## Final summary each agent returns
files, api (deviations), tests (what ran + results), needs (for other owners), risks. Concise.
