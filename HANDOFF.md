# Suuraseikkailu – handoff for the next session

Live: https://admosmnvc.github.io/suuraseikkailu/ (GitHub Pages from branch `gh-pages` = contents of `dist/`).
Source: branch `main` of github.com/admosmnvc/suuraseikkailu. Owner communicates in Finnish; keep replies short.

## State (v3)
- Animated intro (grey world → colour; mosque, pony, crown up top; camel, palms, car with crescent flag, rocket below;
  SUURA / S E I K K A I L U logo → candy "Aloita Suuraseikkailu" button, font Sniglet). Tap skips.
- Child profiles (girl/boy theme), levels HELPPO / KESKITASO / VAIKEA with cumulative chaining ("aina alusta"),
  6 minigames per theme, mosque progress (girls) / rocket (boys), premium soft style. See CONTRACTS.md (decisions log).
- Audio: Mishary lines + word-boundary prefix cuts (`public/audio/cut/`, `tools/build-cuts.py`, QDC timings);
  Shahada = real human recording supplied by the owner (wording "…anna Muhammadan rasuulullaah", owner's decision);
  Finnish prompts = ElevenLabs Aurora (`tools/make_voices.py`, see below).

## Finnish voice: ElevenLabs Aurora (done, v3.5)
- All 83 Finnish clips = ElevenLabs voice "Aurora" (`YSabzCJMvEHDduIDMdwV`), model `eleven_v3` (owner's pick: livelier),
  audio tags `[excited]` / `[cheerful]` (none for the meaning lines). The intro title "Suuraseikkailu!" is the owner's
  own melody turned into Aurora's voice (ElevenLabs speech-to-speech), a fixed take in `tools/voice-src/` (SOURCE_TAKES
  in make_voices.py: re-mastered, never re-synthesized; the owner's own recording is not in git).
  Settings + per-clip seeds in `tools/voices.json`. The owner has a Starter plan (free plan cannot use library voices
  or voice design via the API); the API key goes in the environment variable `ELEVENLABS_API_KEY` (never in chat/files).
- `tools/make_voices.py --provider elevenlabs --yes` checks every new take with faster-whisper large-v3 (`QA_MIN`,
  `QA_TAKES`, a statement heard as a question counts against it) and keeps the best take; `--no-qa` skips it.
  Onomatopoeia (fx-*) scores low by nature. Unit tests: `python3 -m unittest tools/make_voices_test.py`.
- Children's names: `python3 tools/make_name.py "Nimi" --provider elevenlabs --yes` (writes OUTSIDE the project,
  ../suuraseikkailu-nimet/); send the file to the owner, who imports it on the device: Vanhemmille -> Lapset ->
  Nimi omalla äänellä -> Tuo tiedosto. Never commit names.
- Release: `npm run build && node tools/check-arabic.mjs && node tools/e2e.cjs dist` (~9 min, all PASS), then commit to
  `main` and copy `dist/` (+ `.nojekyll`) to `gh-pages`.

## Android app (APK, Capacitor 8)
- `capacitor.config.json` (appId `fi.suuraseikkailu.app`: never change it, nor the server scheme/hostname, or saved
  profiles/recordings are lost) + `android/`. The web build is bundled in the APK; no service worker in the app
  (`src/pwa.js` nativeApp()); WebView plays sound without a tap (Capacitor), so the intro never waits for "Kosketa!".
  Back button = the app's Escape (closes the open sheet/picker); `allowBackup=false` (data stays on the device).
- Build: `npm ci && npm run build && npx cap sync android`, then in `android/`: `./gradlew assembleRelease`
  (needs JDK 21 + Android SDK platform 36 / build-tools 36: set `ANDROID_HOME` or `android/local.properties`).
  Output `android/app/build/outputs/apk/release/app-release.apk`; publish it as `Suuraseikkailu.apk` on gh-pages
  (download https://admosmnvc.github.io/suuraseikkailu/Suuraseikkailu.apk) and send it to the owner.
- Signing: the owner keeps the release keystore (`suuraseikkailu-release.jks` + password). An update MUST be signed
  with it (else Android refuses the update and only uninstall + reinstall works, losing the children's data). Ask the
  owner to upload it, write `android/keystore.properties` (storeFile, storePassword, keyAlias=suuraseikkailu,
  keyPassword; ignored by git), and never commit either file. The release build fails without it.
- Every release: bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
- Icons/splash: `node tools/make-android-assets.cjs` (from ART.appIcon()).

## Open owner questions / notes
- The minigame hint is a cartoon hand (no face). A reviewer noted it is a human body part; owner has not objected.
- Shahada recording licence: owner took responsibility (YouTube source).
- Intro sound before any tap: only an installed Android app (a real WebAPK; check chrome://webapks) is allowed it by
  Chrome. iOS, a browser tab, a "Create shortcut" icon and links opened from WhatsApp etc. need a tap: there the intro
  waits on its grey first frame with a pulsing "Kosketa!" (#introWake); that tap plays the whole intro with sound
  (src/ui/intro.js 'wait' state). The owner uses Android.
- Tests: `tools/e2e.cjs` (full app), `tools/audio-test.cjs`, `tools/games-test.cjs` (needs `npx vite --port 5204` dev
  server, or its own vite config), `tools/games-girl-test.cjs`, `tools/pwa-test.cjs dist`, `tools/settings-v3-test.cjs`.
- Build needs Node 20+; `npm ci`. Playwright is not a project dependency (tests use a global install).
- Not in git (see .gitignore): Mishary/QDC originals (re-download with tools/build-cuts.py), quran.com word audio, and the owner's Shahada source mp3 (ask the owner to re-send it only if the Shahada cuts must be rebuilt; the cut files in public/audio are committed).
