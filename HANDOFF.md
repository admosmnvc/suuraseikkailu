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
  Finnish prompts = Edge TTS Noora (`tools/make_voices.py`).

## Next task: natural Finnish voice with ElevenLabs (owner chose this)
1. The owner adds the API key as environment variable `ELEVENLABS_API_KEY` (never ask for it in chat).
2. Make 3–4 short samples of natural, warm, cheerful Finnish voices (multilingual model) of e.g.
   "Nyt sinun vuorosi! Sano perässä." and "Mahtavaa! Osaat koko Al-Fatihan!" → send to the owner to pick one.
3. Add an ElevenLabs provider to `tools/make_voices.py` (keep the trim / loudness −18.4 LUFS / validation pipeline),
   regenerate every Finnish clip in `public/audio/fi/` (list: `node tools/list-clips.mjs`), keep the SAY_AS fixes only
   if still needed, update credits in `src/content/data.js` + README + `tools/voices-report.md`.
4. `npm run build && node tools/check-arabic.mjs && node tools/e2e.cjs dist` (~9 min, must be all PASS), then publish:
   commit to `main`; copy `dist/` (+ `.nojekyll`) to branch `gh-pages` and push. The service worker now uses
   network-first navigation + safe auto-reload, so phones show updates on the next open.

## Open owner questions / notes
- The minigame hint is a cartoon hand (no face). A reviewer noted it is a human body part; owner has not objected.
- Shahada recording licence: owner took responsibility (YouTube source).
- Tests: `tools/e2e.cjs` (full app), `tools/audio-test.cjs`, `tools/games-test.cjs` (needs `npx vite --port 5204` dev
  server, or its own vite config), `tools/games-girl-test.cjs`, `tools/pwa-test.cjs dist`, `tools/settings-v3-test.cjs`.
- Build needs Node 20+; `npm ci`. Playwright is not a project dependency (tests use a global install).
- Not in git (see .gitignore): Mishary/QDC originals (re-download with tools/build-cuts.py), quran.com word audio, and the owner's Shahada source mp3 (ask the owner to re-send it only if the Shahada cuts must be rebuilt; the cut files in public/audio are committed).
