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
2. The owner CHOSE the voice: ElevenLabs Voice Library "Aurora" – Young Finnish friendly and professional voice,
   voice_id `YSabzCJMvEHDduIDMdwV` (https://elevenlabs.io/voices/YSabzCJMvEHDduIDMdwV). Make 2–3 short samples with it
   (e.g. "Nyt sinun vuorosi! Sano perässä." / "Mahtavaa! Osaat koko Al-Fatihan!") with a cheerful, warm, slower delivery
   for 4–7-year-olds (try stability/style settings), send them to the owner for a quick OK, then generate all clips.
   The full Finnish script with ids is in PUHEKASIKIRJOITUS.md.
3. The ElevenLabs provider is ALREADY implemented in `tools/make_voices.py` (unit tests:
   `python3 -m unittest tools/make_voices_test.py -v`). Run, in order:
   `python3 tools/make_voices.py --provider elevenlabs --samples --yes` (3 samples → ../qa/voice-samples/, send to owner)
   `python3 tools/make_voices.py --provider elevenlabs` (estimate only: 83 clips ≈ 2 027 credits)
   `python3 tools/make_voices.py --provider elevenlabs --yes` (all Finnish clips; credits line updated automatically).
   Free plan (10 000 credits) is enough; ElevenLabs free tier = non-commercial + attribution (credit line covers it).
   Currently all 83 Finnish clips are Edge Noora placeholders (27 new ones: intro-title, intro-go, nice-name, …, fx-*).
4. Children's names: ask the owner for the names, then
   `python3 tools/make_name.py "Nimi" --provider elevenlabs --yes` (writes OUTSIDE the project, ../suuraseikkailu-nimet/),
   send the files to the owner via chat; the owner imports them in the app: Vanhemmille → Lapset → Nimi omalla äänellä →
   Tuo tiedosto (stored only on the device). Never commit names.
5. `npm run build && node tools/check-arabic.mjs && node tools/e2e.cjs dist` (~9 min, must be all PASS), then publish:
   commit to `main`; copy `dist/` (+ `.nojekyll`) to branch `gh-pages` and push. The service worker now uses
   network-first navigation + safe auto-reload, so phones show updates on the next open.

## Open owner questions / notes
- The minigame hint is a cartoon hand (no face). A reviewer noted it is a human body part; owner has not objected.
- Shahada recording licence: owner took responsibility (YouTube source).
- Intro sound before any tap: only an installed Android app (a real WebAPK; check chrome://webapks) is allowed it by
  Chrome. iOS, a browser tab, a "Create shortcut" icon and links opened from WhatsApp etc. need a tap: the first tap on
  the cover turns sound on (title at once, "intro-go" 3 s later). The owner uses Android.
- Tests: `tools/e2e.cjs` (full app), `tools/audio-test.cjs`, `tools/games-test.cjs` (needs `npx vite --port 5204` dev
  server, or its own vite config), `tools/games-girl-test.cjs`, `tools/pwa-test.cjs dist`, `tools/settings-v3-test.cjs`.
- Build needs Node 20+; `npm ci`. Playwright is not a project dependency (tests use a global install).
- Not in git (see .gitignore): Mishary/QDC originals (re-download with tools/build-cuts.py), quran.com word audio, and the owner's Shahada source mp3 (ask the owner to re-send it only if the Shahada cuts must be rebuilt; the cut files in public/audio are committed).
