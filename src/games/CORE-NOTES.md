# Minigame core v3 – what a game gets (for games-girl and games-boy)

> **STYLE CHANGED (owner, see CONTRACTS brief 1): no more pop art.** PREMIUM soft "clay / 3D-lite": airy light
> scenes, one hero object, soft gradients + inner highlight + soft coloured shadows, Fredoka type.
> **NO thick black outlines, NO halftone, NO comic bursts.** The core is already restyled: clean rounded title pill,
> soft star/heart markers, soft card arena, soft hint hand, FX without outlines, and `S.comic(text, at, big)` now
> renders a clean rounded praise pill ("Hienoa!") – keep calling it, just use sentence-case words
> (`WORDS` = Hienoa! Upeaa! Super! Huippua! Jee! Mahtavaa!). `S.ink` = '#24324F' (text colour, not for outlines).
> Girl palette: coral #FF7A9A, rose #FFB3C7, lavender #B9A4FF, peach #FFC9A8, mint #8EE3C8, gold #FFD36E, cream #FFF8F1.

Files: `src/games/core.js` (session S), `gestures.js`, `hint.js`, `index.js`, `src/styles/games.css`, `src/fx.js`.
Test page: `tools/games-test.html?theme=girl` (dev server, e.g. port 5205: `npx vite --host 127.0.0.1 --port 5205`,
open `/tools/games-test.html`). `tools/games-test.cjs` plays every game automatically.

## Module shape
`src/games/<theme>/index.js`: `export default [g0, g1, g2, g3, g4, g5]` (prompt order game-<theme>-0..5).
Each game: `export default { id: 'brush', goal: 6, start(S) { ... } }`
- `goal` (optional) = number of goal markers in the header (girl: hearts, boy: stars). `S.point()` lights the next one;
  reaching `goal` finishes the game. No goal → call `S.finish()` yourself.
- The title (speech bubble) and `say(...)` come from index.js/prompts – the game does not set them.
- A missing or throwing game falls back to a built-in "pop 10 hearts/stars" game (so the app never breaks).
- Import your CSS from your index.js (`import '../../styles/games-girl.css'`). Scope rules to
  `.mg[data-game="girl-3"]` or your own class prefix (e.g. `.gg-`), never bare tags.

## Rules (owner tested on a phone: v2 taps felt late)
- Visible change in the SAME frame as pointerdown: change a class / `translate` / `scale` / call `S.bump(el)`
  inside the gesture callback, and play an SFX there (`S.snd('pop')`). No `transition` on the property that shows
  the first response (transitions are fine for later scripted moves). No timers before feedback, no queues.
- No artificial pacing: length 10–20 s must come from content (e.g. 6 strokes + 4 treats + finale).
- Never fail, idle hint, targets >= 64 px, 360–1024 px + landscape 740x360, reduced motion (`S.rm`).

## Session S
```
S.theme 'girl'|'boy'   S.index   S.arena (div, position:relative; you draw into it)   S.W / S.H arena px
S.rm  reduced motion   S.t  seconds since start   S.colors  theme palette (6 hex)   S.ink '#24324F'
S.active()  false once finished/aborted          S.done / S.dead

S.el(tag, cls, html?, parent?)  create + append (parent default arena; null = don't append) -> element
S.add(el, parent?)              append
S.later(fn, ms) -> id  / S.clear(id)     timers that die with the session
S.on(el, type, fn, opt)                   listener removed at cleanup
S.own(offFn)                              any extra cleanup function
S.vp(x, y) arena px -> viewport px        S.local(clientX, clientY) -> arena px     S.dist(a, b)

S.tap(el, fn(p))                          pointerdown = tap (keyboard Enter/Space too)
S.drag(el, { onStart(p), onMove(p), onEnd(p) -> true keeps it there, else it glides home; follow: true })
S.rub(el, { onStart(p), onRub(dist, x, y, p), onEnd(p) })        dist px since last move, client x/y
S.hold(el, { onStart(p), onHold(ms, dt, p), onRelease(ms, p) })  onHold every frame while pressed
   p = { x, y (client px), dx, dy (from pointerdown), cx, cy (element centre now, client px), el, e }
   While active the element has .is-down (+ .is-dragging / .is-rubbing / .is-holding).
   Drag moves the element with the CSS `translate` property (composes with your transform/left/top).
   To snap: set your own position, S.clearDrag(el), return true from onEnd.
   All gestures use pointer capture and are disabled automatically once the game is done.

S.point(n=1)     light goal marker(s); reaching S.goal -> finish     S.setGoal(n)  change marker count
S.finish()       finish now (celebration: S.onComplete(), success SFX, confetti, a compact praise pill near the TOP of
                 the arena so the finished scene stays visible, then onDone)
S.endWait = ms   celebration length before onDone (default 1500, 600..4000)
S.autoFinish = false   reaching the goal does NOT finish (play your outro, then call S.finish())
S.progress()     "the child did something" -> resets the idle-hint timer (pointerdown/S.point do this too)

S.hint({ type: 'tap'|'drag'|'rub'|'hold', at, to?, r?, size? })
   animated soft hand; at/to = arena px {x,y} or an Element (its centre); fingertip on `at`;
   rub: r = scrub amplitude px. Hides on the next touch anywhere in the arena.
S.idleHint(fn, ms=2500)   after ms without touch/progress call fn (usually fn = () => S.hint({...current target}));
                          re-arms after every touch. S.idleHint(null) stops it.  S.hideHint()

S.bump(el, k=1)           instant squash-pop (Web Animations on `scale`; reduced motion: brightness flash)
S.burst(at, colors?, n?)  soft particle burst at arena px      S.sparkle(at)
S.comic(text?, at?, big?) clean praise pill ("Hienoa!"... random when text omitted) at arena px; alias S.praise
S.snd(name, arg)          SFX: pop ding(i) chime(i) plop whoosh boom sparkle success tap (never throws)
S.say(id) -> played?      short voice exclamation, id from FX_IDS in prompts.js: fx-vroom 'Vrruum!', fx-namnam,
                          fx-shine, fx-splash, fx-ready, fx-wow, fx-yay, fx-beep, fx-pretty, fx-yum, fx-go, fx-boing.
                          Goes to the say() the app passed to play() (it plays engine.prompt(id)). Rate-limited by the
                          core: max 1 per 2.5 s, never in the first 1.5 s (title prompt); a limited call is dropped
                          silently (returns false). Use 2–3 per game at real moments; keep the instant SFX as well.

Hooks you may set:
S.update = (dt, t) => {}     every animation frame (dt seconds)
S.resize = (oldW, oldH) => {} arena size changed (S.W/S.H already new) – re-layout
S.fillRest = () => ms        safety time-out at 16.5 s: show the rest quickly, return ms (<= 1100) before finish
S.onComplete = () => {}      your finale (runs at finish)
S.destroy = () => {}         extra cleanup
```
Empty taps (nothing used the event) get a small sparkle + tap SFX from the core automatically. A game that handles
pointerdown itself marks the event `e.__mgUsed = true` (gestures do this) and the core adds nothing. Stable API (both
game agents rely on it): S.hint, S.idleHint, S.bump, S.fillRest, S.onComplete, S.endWait, S.autoFinish, S.rm, e.__mgUsed.
The core calls FX.clear() when a game starts (no leftover confetti over the scene).
Safety: the core auto-finishes at 16.5 s (+ fillRest + endWait ≈ 18.5–19.5 s; keep endWait <= 1800). Page hidden → time limit pauses.

## CSS (games.css)
Overlay `.mg[data-theme="girl|boy"][data-game="girl-0"]`, arena `.mg-arena` = soft rounded card (radius 28, soft shadow).
Variables: `--mg-ink` (#24324F text), `--mg-c1..c6` (girl: coral, lavender, gold, mint, rose, peach), `--mg-panel` (arena bg),
`--mg-accent`, `--mg-soft` (soft coloured shadow rgba), `--mg-shadow` (card shadow), `--mg-font` (Fredoka).
Buttons inside the arena are reset (`all: unset; position: absolute`) – style them yourself.
Utilities: `.mg-pop-in` (entrance), `.mg-press` (scale .9 while .is-down), `.mg-lift` (bigger + soft shadow while dragged),
`.mg-hit` (+16 px invisible hit margin), `.mg-wiggle`, `.mg-glow` (soft pulsing glow for targets). `.mg-halftone` is now a no-op.
Override the arena background per game: `.mg[data-game="girl-2"] .mg-arena { background: linear-gradient(...) }`.

## FX (src/fx.js)
Viewport px. `FX.burst/sparkle/confetti/firework/rocket/show/clear` as before, re-paletted per theme (soft particles
with white highlights, no outlines; girl confetti includes hearts). `FX.setTheme(t|null)` (core sets it during a game), `FX.palette()`.
