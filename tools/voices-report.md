# Äänet – raportti

Kaikki äänet ovat oikeaa puhetta. Rivit ja niiden alut ovat oikeasta resitaatiosta tai oikean ihmisen äänestä; konepuhetta on vain suomeksi.

| Mitä | Lähde | Työkalu |
|---|---|---|
| Suurien rivit ja sana kerrallaan -palat (kaikki tasot) | Mishary Rashid Alafasy, murattal, luvuittaiset MP3:t + sana-ajat: **Quran.com QDC** (`api.qurancdn.com`, `download.quranicaudio.com`) | `tools/build-cuts.py` |
| Shahadan rivit ja palat | **Oikean ihmisen ääni**: YouTube "How to recite the Shahada of Islam [HD]", SC Brotherhood & News Reports (omistajan lataama, omistaja vastaa käytöstä) | `tools/build-cuts.py` + `tools/cut-src/shahada.json` |
| Suomenkieliset kehotteet ja merkitykset | Microsoft Edge -neuraalipuhe `fi-FI-NooraNeural` (`edge-tts`) | `tools/make_voices.py` |

Lähdemerkinnät (`data.js` credits, Asetukset → Lähteet ja lisenssit): "Resitaatio: Mishary Rashid Alafasy (murattal), Quran.com / quranicaudio.com; sana-ajat Quran.com (QDC).", "Shahada: oikean ihmisen ääni, SC Brotherhood & News Reports (YouTube: How to recite the Shahada of Islam).", "Sana kerrallaan -paloittelu: Mishary Alafasyn resitaatio, sana-ajat Quran.com (QDC)."

## Resitaatio paloiteltuna (`tools/build-cuts.py`)

Omistaja: "resitoinnin flow joka on vaan pilkottu". Jokaisesta suuran rivistä on rivitiedosto (`public/audio/SSSAAA.mp3`, nimet ennallaan) ja jokaisen sanarajan kohdalta **alkupala** `public/audio/cut/SSS_AAA_wW.mp3` = jae alusta sanan W loppuun (40 kpl). Al-Ikhlasin ja Al-Kawtharin Bismillah = 1:1. Sovellus soittaa osittain sanotun rivin YHTENÄ alkupalana (`prefixClips()` `src/content/chunks.js`:ssä), valmiit rivit rivitiedostoina 250 ms välein.

- **Lähde:** QDC (Mishary = reciter 7) luvut 1, 108, 112: MP3 + `verse_timings[].segments` = [sanan nro, alku ms, loppu ms] (rikkinäiset rivit kuten `[1]` hylätään). Tallessa `tools/recitation-src/` (ei mukana sovelluksessa).
- **Sama esitys kuin v2:n jaetiedostot?** Kyllä: jokaisen rivin 0,5 s ikkunoiden korrelaatio v2:n EveryAyah-tiedostoon (`tools/recitation-src/everyayah/`) on 0.986–0.997 vakioviiveellä. Luvun tiedosto on kuitenkin parempi (44,1 kHz / 128 kbps vs. 22 kHz / 64 kbps), joten **sekä rivi että sen alkupalat leikataan luvun tiedostosta**: sama otto, sama vahvistus, alkupala on täsmälleen rivin alku. Rivien kesto muuttui alle 0,1 s.
- **Leikkaus:** jokainen leikkauskohta (jakeen alku/loppu, sanan W+1 alku) siirretään hiljaisimpaan kohtaan (10 ms RMS) ±80 ms:n sisällä; 20 ms pehmeä alkuhäivytys, 60 ms loppuhäivytys (kosini), ei naksahduksia: ensimmäinen ja viimeinen 1 ms ≤ −62 dBFS kaikissa tiedostoissa.
- **QDC-aikojen korjaus:** 11/14 jakeessa QDC:n sana-ajat alkavat 65 ms ennen jakeen aikaleimaa. Jos ne alkavat aikaisemmin, koko jakeen sana-ajat siirretään ylimäärän verran myöhemmäksi: 108:2 +400 ms, 108:3 +50 ms, 1:6 +10 ms. Ilman korjausta 108:2:n palat olivat "فلس" ja "فصلي لرب" (sanan keskeltä); korjattuina "فصل" ja "فصل لربك", ja kohdat osuvat energiakäyrän ja Whisperin sana-aikojen kohtiin.
- **Äänekkyys:** rivi normalisoidaan −18.4 LUFS:iin (sama tavoite kuin kaikessa muussa; v2:n rivit vaihtelivat −16.3…−22.0 LUFS), alkupaloille **sama vahvistus kuin rivilleen**, joten pala kuulostaa täsmälleen samalta kuin rivin alku (palojen oma LUFS −22.5…−14.0; alle 0,4 s paloilla mittari ei anna arvoa). True peak ≤ −4.3 dBTP. MP3 stereo 44,1 kHz 96 kbps.
- **Tarkistus (Whisper `large-v3-turbo`, kaikki 16 riviä + 46 palaa):** rivit tunnistuvat oikein (0.96–1.0). Palat: 40/46 täsmälleen odotetut sanat järjestyksessä. Loput: Whisper "täydentää" tuttuja fraaseja (1:1 w2/w3 → koko Bismillah, vaikka pala on 1.5 / 2.6 s 6.1 s:sta; 112:3 w3 "لم يلد ولم يلد"; Shahada 1 w3 "…لا إله"), lyhyet palat (1:7 w1 0.70 s "سليلوال"; 112:3 w1 0.39 s "لن" = lam). Näissä kohta tarkistettiin erikseen: Whisperin sana-ajat koko rivistä ±0,15 s ja Shahadassa erilliset palat ("لا" | "إِلَهَا").
- **Ajo:** `python3 tools/build-cuts.py` (lataa puuttuvat, leikkaa muuttuneet, tarkistaa), `--check`, `--force`, `--asr [--only …]`, `--prune`. Deterministinen: toinen ajo ei muuta tavuakaan.

## Shahada: oikean ihmisen ääni

- **Teksti (omistajan päätös):** rivi 2 = وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ ("wa ash-hadu anna Muhammadan rasuulullaah", "Ja todistan, että Muhammad on Allahin lähettiläs."). `tools/arabic-original.json` päivitettiin vain tältä riviltä; Koraanin rivit ovat tavu tavulta ennallaan (`node tools/check-arabic.mjs`).
- **Äänite:** 278 s, Shahada 7 kertaa hitaina opetuspaloina (2–4 s hiljaisuus välissä). Kaikki 7 toistoa ovat samaa ottoa (palojen korrelaatio 0.98–0.996); käytetään toistoa 1 (2.8–44.7 s, "wa" mukana). Palat: Ash-hadu | an | laa ilaaha | illallaah | wa ash-hadu | anna | Muhammadan | rasuulullaah. "laa ilaaha" jaetaan إِلَٰهَ:n kurkkuäänteen kohdalta (13.08 s; erikseen tunnistettuna "لا" | "إِلَهَا").
- **Käsittely:** palat rajataan puheeseen (−50 dBFS + 10 ms), 20 ms / 40 ms häivytykset, liitetään 220 ms:n tauoin (alkuperäisessä 2–4 s), mono 44,1 kHz 64 kbps, rivi −18.4 LUFS ja paloille sama vahvistus. Tiedostot: `public/audio/shahada-1.mp3` (12.1 s), `shahada-2.mp3` (14.3 s) ja yksikköjen loppuihin `public/audio/cut/shahada-1_w1/_w3/_w4.mp3`, `shahada-2_w1/_w2/_w3.mp3`.
- **Tarkistus (Whisper):** rivit "أشهد أن لا إله إلا الله" ja "وأشهد أن محمداً رسول الله" (1.0); palat أشهد · أشهد أن لا (+ fraasin täydennys إله) · أشهد أن لا إله · وأشهاد · وأشهد أن · وأشهد أن محمداً.
- Zariyah-konepuheen Shahada-tiedostot (`shahada-c-*`, vanhat `shahada-1/2`) poistettiin. Moottorin `preSlowed`-sääntö on nyt aina epätosi: hidas tila hidastaa myös Shahadan (0,8), kuten resitaation.

## Suomenkieliset opettajaäänet (`tools/make_voices.py`)

- **Nyt (väliaikainen):** `fi-FI-NooraNeural` (Edge), nopeus `+3%`, sävelkorkeus `+15Hz`. 83 tiedostoa (kehotteet + merkitykset); `ask-name` on vain tekstiä. v3.2:n 27 uutta kehotetta (intro-title, intro-go, nice-name, welcome-new, welcome-back, greet-*, bye, praise-6..10, game-done, fx-*) ovat **paikkamerkkejä** Nooran äänellä, kunnes ElevenLabs-ääni vaihdetaan.
- **Vaihto ElevenLabsiin (omistajan valitsema ääni "Aurora", `YSabzCJMvEHDduIDMdwV`):** valmis, ajetaan seuraavassa istunnossa:
  1. `export ELEVENLABS_API_KEY=…` (avainta ei koskaan tulosteta eikä tallenneta)
  2. `python3 tools/make_voices.py --provider elevenlabs --samples --yes` → 3 näytettä `../qa/voice-samples/` (public/ ei muutu); asetuksia voi kokeilla: `--stability --similarity --style --speed --seed --model`
  3. `python3 tools/make_voices.py --provider elevenlabs` näyttää merkkimäärän ja krediittiarvion (nyt 83 tiedostoa, 2027 merkkiä ≈ 2027 krediittiä, `eleven_multilingual_v2`), mitään ei lähetetä
  4. `python3 tools/make_voices.py --provider elevenlabs --yes` tekee kaikki suomenkieliset tiedostot; sama jälkikäsittely ja tarkistus kuin nyt (mp3_44100_128 → reunat, −18.4 LUFS, mono 64 kbps). Onnistuneen ajon jälkeen `data.js`:n lähdemerkintä vaihtuu: "Suomenkieliset kehotteet: ElevenLabs, ääni Aurora."
  - Oletusasetukset (iloinen): stability 0.35, similarity_boost 0.8, style 0.45, speaker boost, speed 1.0, seed 7. Jokainen asetus on osa tiedoston avainta: muuttumattomat tiedostot ohitetaan, muutetut tehdään uudelleen. Ilman `--provider`-valintaa käytetään edellisen ajon palvelua, joten pelkkä ajo ei vaihda ääntä vahingossa.
  - Testit ilman avainta ja verkkoa: `python3 -m unittest tools/make_voices_test.py -v` (12 testiä: pyynnön rakenne, uudelleenyritys 429/503, avain ei koskaan näy, arvio ilman `--yes` ei lähetä mitään, ohitus, lähdemerkintä, näytteet, nimet).
- **Lapsen nimi:** `python3 tools/make_name.py "Nimi" [--say "ääntämisasu"] [--out tiedosto.mp3] [--provider elevenlabs --yes]` tekee nimen samalla äänellä ja käsittelyllä projektikansion ULKOPUOLELLE (oletus `../suuraseikkailu-nimet/<nimi>.mp3`; kansion sisälle kirjoittaminen estetään). Nimiä ei koskaan lisätä projektiin.
- **Ääntämiskorjaukset vain puheeseen:** koko teksti (`SAY_ID`): intro-title → "Suuuuraseikkailuu!" (venytetty, innostunut), bye → "Nähdään, taas!" (Noora puuroutti: "nahdantos"). Sanat (`SAY_AS`, Noora): Al-Fatihan → Alfaatihan, Al-Ikhlasin → Alihlaasin, Al-Kawtharin → Alkautharin, Kawtharin → Kautharin, Upeaa → Upeeaa, Herraasi → Herraa-si, kaikkea → kaikke-a, lähettiläs → lähetti-läs. ElevenLabsille vain arabialaiset nimet (Nooran vokaalikorjaukset eivät koske sitä).
- **Jälkikäsittely:** hiljaisuus pois reunoilta (−50 dB RMS, 10 ms häivytys), 60 ms tyhjää, mono, kaksivaiheinen lineaarinen loudnorm, MP3 mono 44,1 kHz 64 kbps.
- **Äänekkyys:** tavoite −18.4 LUFS = v2:n alkuperäisten Mishary-jaetiedostojen (14 kpl, `tools/recitation-src/everyayah/`) mediaani. True peak ≤ −1.5 dBTP.
- **Tarkistus:** kaikki 83 läpi (kesto, äänekkyys −18.5…−18.3, true peak); kaikki litteroitu Whisperillä. Erot: gem "javokiven" (l pehmeä), finale-* / mean-kawthar-1 täsmäävät puhemuotoon, rocket-launch "3, 2, 1", game-girl-1 "Ruokieläimet", intro-title "Suu-uuraseikkailu" (tarkoituksella venytetty), fx-vroom "Vroom", fx-wow "Wow", fx-yay "Yippee", fx-splash "Plats", fx-yum "Herkulista" (tunnistimen kirjoitusasuja), **fx-shine "Kiitoa" ja fx-beep "Tiit-tiit"** (Noora: l / p heikko; myös "Kiil-toa" ja "Piip, piip" kokeiltu – paikkamerkit, korvautuvat ElevenLabsilla).
- Ajo: `python3 tools/make_voices.py` (`--check`, `--force`, `--only`, `--asr`, `--prune`, `--provider`, `--samples`, `--yes`).

## quran.com-sana-äänitteet (vain työkalukopio)

v3:n ensimmäinen versio käytti quran.comin erillisiä sana-äänitteitä (`audio.qurancdn.com/wbw/SSS_AAA_WWW.mp3`, 54 kpl). Omistaja halusi resitaation omaa virtaa, joten niitä **ei enää ole sovelluksessa** (`public/audio/wbw/` poistettu). Kopio: alkuperäiset `tools/wbw-src/`, käsitellyt `tools/wbw/`, raportti `tools/words.json` (`tools/build-words.py`).

## Oma ääni

Vanhempi voi korvata asetuksissa (pitkä painallus → **Omat äänitykset**) Shahadan rivit, kehotteet, kehut ja juhlalauseet omalla nauhoituksellaan; oma nauhoitus soi aina ennen tiedostoa.

## Tiedostot: resitaatio ja Shahada

| Tiedosto | Sanat | Kesto (s) | LUFS | Tunnistus |
|---|---|---|---|---|
| `public/audio/shahada-1.mp3` | koko rivi | 12.12 | -18.4 | أشهد أن لا إله إلا الله (1.0) |
| `public/audio/cut/shahada-1_w1.mp3` | أَشْهَدُ | 1.65 | -22.5 | أشهد (1.0) |
| `public/audio/cut/shahada-1_w3.mp3` | أَشْهَدُ أَنْ لَا | 5.67 | -19.0 | أشهد أن لا إله (0.84) |
| `public/audio/cut/shahada-1_w4.mp3` | أَشْهَدُ أَنْ لَا إِلَٰهَ | 7.26 | -18.8 | أشهد أن لا إله (1.0) |
| `public/audio/shahada-2.mp3` | koko rivi | 14.29 | -18.4 | وأشهد أن محمداً رسول الله (1.0) |
| `public/audio/cut/shahada-2_w1.mp3` | وَأَشْهَدُ | 2.01 | -19.5 | وأشهاد (0.91) |
| `public/audio/cut/shahada-2_w2.mp3` | وَأَشْهَدُ أَنَّ | 5.15 | -19.3 | وأشهد أن (1.0) |
| `public/audio/cut/shahada-2_w3.mp3` | وَأَشْهَدُ أَنَّ مُحَمَّدًا | 8.44 | -19.6 | وأشهد أن محمداً (1.0) |
| `public/audio/001001.mp3` | koko rivi | 6.11 | -18.5 | بسم الله الرحمن الرحيم (1.0) |
| `public/audio/cut/001_001_w1.mp3` | بِسْمِ | 0.63 | -16.6 | بسمي (0.86) |
| `public/audio/cut/001_001_w2.mp3` | بِسْمِ ٱللَّهِ | 1.51 | -16.2 | بسم الله الرحمن الرحيم (0.54) |
| `public/audio/cut/001_001_w3.mp3` | بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ | 2.61 | -17.3 | بسم الله الرحمن الرحيم (0.81) |
| `public/audio/001002.mp3` | koko rivi | 5.64 | -18.3 | الحمد لله رب العالمين (0.97) |
| `public/audio/cut/001_002_w1.mp3` | ٱلْحَمْدُ | 1.07 | -19.8 | الحمدل (0.91) |
| `public/audio/cut/001_002_w2.mp3` | ٱلْحَمْدُ لِلَّهِ | 1.91 | -17.5 | الحمد لله (1.0) |
| `public/audio/cut/001_002_w3.mp3` | ٱلْحَمْدُ لِلَّهِ رَبِّ | 2.51 | -17.5 | الحمد لله ربنا (0.91) |
| `public/audio/001003.mp3` | koko rivi | 4.65 | -18.4 | الرحمن الرحيم (1.0) |
| `public/audio/cut/001_003_w1.mp3` | ٱلرَّحْمَٰنِ | 1.23 | -17.9 | الرحمن (1.0) |
| `public/audio/001004.mp3` | koko rivi | 4.70 | -18.4 | مالك يوم الدين (0.96) |
| `public/audio/cut/001_004_w1.mp3` | مَٰلِكِ | 0.76 | -16.7 | مالك (0.86) |
| `public/audio/cut/001_004_w2.mp3` | مَٰلِكِ يَوْمِ | 1.49 | -17.6 | مالك يومي (0.86) |
| `public/audio/001005.mp3` | koko rivi | 6.74 | -18.4 | إياك نعبد وإياك نستعين (1.0) |
| `public/audio/cut/001_005_w1.mp3` | إِيَّاكَ | 1.04 | -17.4 | إياك (1.0) |
| `public/audio/cut/001_005_w2.mp3` | إِيَّاكَ نَعْبُدُ | 1.75 | -17.7 | إياك نعبد (1.0) |
| `public/audio/cut/001_005_w3.mp3` | إِيَّاكَ نَعْبُدُ وَإِيَّاكَ | 2.95 | -17.4 | إياك نعبد وإياك نعبد (0.87) |
| `public/audio/001006.mp3` | koko rivi | 5.64 | -18.4 | اهدنا الصراط المستقيم (0.97) |
| `public/audio/cut/001_006_w1.mp3` | ٱهْدِنَا | 0.81 | -21.4 | إهدنا (1.0) |
| `public/audio/cut/001_006_w2.mp3` | ٱهْدِنَا ٱلصِّرَٰطَ | 1.57 | -16.8 | اهدنا الصراط (0.95) |
| `public/audio/001007.mp3` | koko rivi | 13.24 | -18.4 | صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين (0.99) |
| `public/audio/cut/001_007_w1.mp3` | صِرَٰطَ | 0.70 | -15.3 | سليلوال (0.0) |
| `public/audio/cut/001_007_w2.mp3` | صِرَٰطَ ٱلَّذِينَ | 1.62 | -16.1 | صراط الذين (0.94) |
| `public/audio/cut/001_007_w3.mp3` | صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ | 2.61 | -16.9 | صراط الذين أنعمت (0.96) |
| `public/audio/cut/001_007_w4.mp3` | صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ | 3.68 | -17.0 | صراط الذين أنعمت عليهم (0.97) |
| `public/audio/cut/001_007_w5.mp3` | صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ | 4.13 | -17.2 | صراط الذين أنعمت عليهم غير (0.98) |
| `public/audio/cut/001_007_w6.mp3` | صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ | 5.30 | -17.6 | صراط الذين أنعمت عليهم غير المغضوب (0.98) |
| `public/audio/cut/001_007_w7.mp3` | صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ | 6.40 | -17.6 | صراط الذين أنعمت عليهم غير المغضوب عليهم (0.99) |
| `public/audio/cut/001_007_w8.mp3` | صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا | 6.74 | -17.6 | صراط الذين أنعمت عليهم غير المغضوب عليهم ولا (0.99) |
| `public/audio/112001.mp3` | koko rivi | 3.00 | -18.4 | قل هو الله أحد (1.0) |
| `public/audio/cut/112_001_w1.mp3` | قُلْ | 0.50 | -22.2 | قل (1.0) |
| `public/audio/cut/112_001_w2.mp3` | قُلْ هُوَ | 0.68 | -20.9 | قل هو (1.0) |
| `public/audio/cut/112_001_w3.mp3` | قُلْ هُوَ ٱللَّهُ | 1.72 | -17.3 | قل هو الله (1.0) |
| `public/audio/112002.mp3` | koko rivi | 2.59 | -18.4 | الله الصمد (1.0) |
| `public/audio/cut/112_002_w1.mp3` | ٱللَّهُ | 1.10 | -16.9 | الله (1.0) |
| `public/audio/112003.mp3` | koko rivi | 3.03 | -18.3 | لم يلد ولم يولد (1.0) |
| `public/audio/cut/112_003_w1.mp3` | لَمْ | 0.39 | – | لن (0.5) |
| `public/audio/cut/112_003_w2.mp3` | لَمْ يَلِدْ | 0.99 | -17.2 | لم يلد (1.0) |
| `public/audio/cut/112_003_w3.mp3` | لَمْ يَلِدْ وَلَمْ | 1.75 | -16.9 | لم يلد ولم يلد (0.84) |
| `public/audio/112004.mp3` | koko rivi | 4.86 | -18.4 | ولم يكن له كفوا أحد (1.0) |
| `public/audio/cut/112_004_w1.mp3` | وَلَمْ | 0.60 | -14.0 | والم (0.86) |
| `public/audio/cut/112_004_w2.mp3` | وَلَمْ يَكُن | 1.25 | -16.6 | ولم يكن (1.0) |
| `public/audio/cut/112_004_w3.mp3` | وَلَمْ يَكُن لَّهُۥ | 2.14 | -17.1 | ولم يكن له (1.0) |
| `public/audio/cut/112_004_w4.mp3` | وَلَمْ يَكُن لَّهُۥ كُفُوًا | 3.06 | -17.5 | ولم يكن له كفوا (1.0) |
| `public/audio/108001.mp3` | koko rivi | 6.74 | -18.4 | إنا أعطيناك الكوثر (0.97) |
| `public/audio/cut/108_001_w1.mp3` | إِنَّآ | 3.58 | -17.7 | إنا (1.0) |
| `public/audio/cut/108_001_w2.mp3` | إِنَّآ أَعْطَيْنَٰكَ | 5.07 | -17.8 | إنا أعطيناك (0.95) |
| `public/audio/108002.mp3` | koko rivi | 3.60 | -18.3 | فصل لربك وانحر (1.0) |
| `public/audio/cut/108_002_w1.mp3` | فَصَلِّ | 0.78 | -18.1 | فصل (1.0) |
| `public/audio/cut/108_002_w2.mp3` | فَصَلِّ لِرَبِّكَ | 2.09 | -17.2 | فصل لربك (1.0) |
| `public/audio/108003.mp3` | koko rivi | 5.25 | -18.4 | إن شانئك هو الأبتر (1.0) |
| `public/audio/cut/108_003_w1.mp3` | إِنَّ | 1.59 | -18.2 | إِنَّ (1.0) |
| `public/audio/cut/108_003_w2.mp3` | إِنَّ شَانِئَكَ | 2.90 | -17.2 | إن شانئك (1.0) |
| `public/audio/cut/108_003_w3.mp3` | إِنَّ شَانِئَكَ هُوَ | 3.16 | -17.3 | إن شانئك هو (1.0) |

## Tiedostot: suomenkieliset

| Tiedosto | Teksti | Kesto (s) | LUFS |
|---|---|---|---|
| `public/audio/fi/welcome.mp3` | Hei! Mitä opitaan tänään? | 2.61 | -18.4 |
| `public/audio/fi/listen.mp3` | Kuuntele tarkkaan. | 1.33 | -18.5 |
| `public/audio/fi/turn-1.mp3` | Nyt sinun vuorosi! Sano perässä. | 3.08 | -18.5 |
| `public/audio/fi/turn-all.mp3` | Nyt sinun vuorosi! Sano kaikki alusta asti. | 3.84 | -18.5 |
| `public/audio/fi/praise-1.mp3` | Hienoa! | 0.73 | -18.4 |
| `public/audio/fi/praise-2.mp3` | Mahtavaa! | 0.86 | -18.4 |
| `public/audio/fi/praise-3.mp3` | Upeaa! | 0.78 | -18.3 |
| `public/audio/fi/praise-4.mp3` | Loistavaa! | 0.86 | -18.5 |
| `public/audio/fi/praise-5.mp3` | Hyvin sanottu! | 1.10 | -18.4 |
| `public/audio/fi/gem.mp3` | Sait jalokiven kruunuun! | 1.72 | -18.4 |
| `public/audio/fi/next.mp3` | Jatketaan! | 0.89 | -18.4 |
| `public/audio/fi/finale-shahada.mp3` | Mahtavaa! Osaat koko Shahadan! | 3.03 | -18.5 |
| `public/audio/fi/finale-fatiha.mp3` | Mahtavaa! Osaat koko Al-Fatihan! | 3.24 | -18.5 |
| `public/audio/fi/finale-ikhlas.mp3` | Mahtavaa! Osaat koko Al-Ikhlasin! | 3.29 | -18.4 |
| `public/audio/fi/finale-kawthar.mp3` | Mahtavaa! Osaat koko Al-Kawtharin! | 3.29 | -18.4 |
| `public/audio/fi/sticker.mp3` | Sait uuden tarran! | 1.41 | -18.4 |
| `public/audio/fi/cover.mp3` | Tervetuloa Suuraseikkailuun! | 1.96 | -18.4 |
| `public/audio/fi/who.mp3` | Kuka pelaa tänään? | 1.25 | -18.4 |
| `public/audio/fi/ask-theme.mp3` | Valitse: tyttö vai poika? | 1.78 | -18.4 |
| `public/audio/fi/pick-level.mp3` | Valitse taso! | 1.10 | -18.4 |
| `public/audio/fi/level-easy.mp3` | Helppo! Sana kerrallaan. | 2.61 | -18.4 |
| `public/audio/fi/level-medium.mp3` | Keskitaso! Kaksi sanaa kerrallaan. | 3.16 | -18.5 |
| `public/audio/fi/level-hard.mp3` | Vaikea! Koko rivi kerrallaan. | 2.90 | -18.4 |
| `public/audio/fi/rocket-part.mp3` | Raketti sai uuden osan! | 1.83 | -18.4 |
| `public/audio/fi/rocket-launch.mp3` | Kolme, kaksi, yksi... Raketti lähtee! | 3.81 | -18.3 |
| `public/audio/fi/game-boy-0.mp3` | Vaihda auton renkaat! | 1.67 | -18.4 |
| `public/audio/fi/game-boy-1.mp3` | Pese auto puhtaaksi! | 1.62 | -18.4 |
| `public/audio/fi/game-boy-2.mp3` | Tankkaa auto täyteen! | 1.62 | -18.4 |
| `public/audio/fi/game-boy-3.mp3` | Vihreä valo, kaasua! | 1.75 | -18.4 |
| `public/audio/fi/game-boy-4.mp3` | Aja kilpaa ja kerää tähdet! | 1.96 | -18.4 |
| `public/audio/fi/game-boy-5.mp3` | Pysäköi auto ruutuun! | 1.62 | -18.4 |
| `public/audio/fi/game-girl-0.mp3` | Harjaa hevosen harja! | 1.67 | -18.4 |
| `public/audio/fi/game-girl-1.mp3` | Ruoki eläimet! | 1.23 | -18.4 |
| `public/audio/fi/game-girl-2.mp3` | Kylvetä koiranpentu! | 1.33 | -18.4 |
| `public/audio/fi/game-girl-3.mp3` | Koristele kakku! | 1.25 | -18.4 |
| `public/audio/fi/game-girl-4.mp3` | Kasvata kukkaniitty! | 1.44 | -18.4 |
| `public/audio/fi/game-girl-5.mp3` | Sytytä moskeijan valot! | 1.65 | -18.4 |
| `public/audio/fi/intro-title.mp3` | Suuraseikkailu! | 1.46 | -18.4 |
| `public/audio/fi/intro-go.mp3` | No niin, aloitetaan! Tule jo! | 2.79 | -18.4 |
| `public/audio/fi/nice-name.mp3` | Oi, onpa kiva nimi! | 1.44 | -18.4 |
| `public/audio/fi/welcome-new.mp3` | Jee! Tervetuloa mukaan! | 2.56 | -18.4 |
| `public/audio/fi/welcome-back.mp3` | Hei taas! Kiva, että tulit! | 2.69 | -18.5 |
| `public/audio/fi/greet-morning.mp3` | Hyvää huomenta! | 1.18 | -18.4 |
| `public/audio/fi/greet-day.mp3` | Hyvää päivää! | 1.10 | -18.4 |
| `public/audio/fi/greet-evening.mp3` | Hyvää iltaa! | 1.10 | -18.4 |
| `public/audio/fi/bye.mp3` | Nähdään taas! | 1.25 | -18.4 |
| `public/audio/fi/praise-6.mp3` | Olet tosi taitava! | 1.28 | -18.4 |
| `public/audio/fi/praise-7.mp3` | Jee, hienosti! | 1.20 | -18.4 |
| `public/audio/fi/praise-8.mp3` | Vau, ihan mahtavaa! | 1.54 | -18.4 |
| `public/audio/fi/praise-9.mp3` | Upeasti sanottu! | 1.33 | -18.4 |
| `public/audio/fi/praise-10.mp3` | Sinä osaat! | 0.99 | -18.3 |
| `public/audio/fi/game-done.mp3` | Hienosti pelattu! | 1.25 | -18.4 |
| `public/audio/fi/fx-vroom.mp3` | Vrruum! | 0.65 | -18.4 |
| `public/audio/fi/fx-namnam.mp3` | Nam nam! | 0.78 | -18.4 |
| `public/audio/fi/fx-shine.mp3` | Kiiltoa! | 0.76 | -18.4 |
| `public/audio/fi/fx-splash.mp3` | Pläts! | 0.55 | -18.5 |
| `public/audio/fi/fx-ready.mp3` | Valmista! | 0.84 | -18.4 |
| `public/audio/fi/fx-wow.mp3` | Vau! | 0.55 | -18.4 |
| `public/audio/fi/fx-yay.mp3` | Jippii! | 0.73 | -18.4 |
| `public/audio/fi/fx-beep.mp3` | Piip piip! | 0.70 | -18.4 |
| `public/audio/fi/fx-pretty.mp3` | Kaunista! | 0.76 | -18.4 |
| `public/audio/fi/fx-yum.mp3` | Herkullista! | 0.94 | -18.4 |
| `public/audio/fi/fx-go.mp3` | Mennään! | 0.73 | -18.4 |
| `public/audio/fi/fx-boing.mp3` | Pomppis! | 0.73 | -18.4 |
| `public/audio/fi/test-fi.mp3` | Hei! Tämä on suomen puheääni. | 2.95 | -18.4 |
| `public/audio/fi/mean-shahada-0.mp3` | Todistan, että ei ole muuta jumalaa kuin Allah. | 3.00 | -18.4 |
| `public/audio/fi/mean-shahada-1.mp3` | Ja todistan, että Muhammad on Allahin lähettiläs. | 3.13 | -18.4 |
| `public/audio/fi/mean-fatiha-0.mp3` | Allahin, Armeliaan, Armahtavan nimeen. | 2.64 | -18.4 |
| `public/audio/fi/mean-fatiha-1.mp3` | Kaikki kiitos kuuluu Allahille, maailmojen Herralle. | 3.24 | -18.4 |
| `public/audio/fi/mean-fatiha-2.mp3` | Armeliaalle, Armahtavalle. | 1.83 | -18.4 |
| `public/audio/fi/mean-fatiha-3.mp3` | Tuomiopäivän Valtiaalle. | 1.59 | -18.4 |
| `public/audio/fi/mean-fatiha-4.mp3` | Vain Sinua me palvelemme, ja vain Sinulta pyydämme apua. | 3.32 | -18.4 |
| `public/audio/fi/mean-fatiha-5.mp3` | Ohjaa meidät suoralle tielle. | 1.91 | -18.4 |
| `public/audio/fi/mean-fatiha-6.mp3` | Niiden tielle, joita olet siunannut, ei niiden, jotka ovat saaneet vihasi, eikä niiden, jotka ovat eksyneet. | 6.61 | -18.3 |
| `public/audio/fi/mean-ikhlas-0.mp3` | Allahin, Armeliaan, Armahtavan nimeen. | 2.64 | -18.4 |
| `public/audio/fi/mean-ikhlas-1.mp3` | Sano: Hän on Allah, yksi ja ainoa. | 2.98 | -18.4 |
| `public/audio/fi/mean-ikhlas-2.mp3` | Allah, jota kaikki tarvitsevat ja joka ei tarvitse ketään. | 3.45 | -18.5 |
| `public/audio/fi/mean-ikhlas-3.mp3` | Hänellä ei ole lapsia, eikä Hän ole kenenkään lapsi. | 3.24 | -18.4 |
| `public/audio/fi/mean-ikhlas-4.mp3` | Eikä kukaan ole Hänen kaltaisensa. | 2.30 | -18.4 |
| `public/audio/fi/mean-kawthar-0.mp3` | Allahin, Armeliaan, Armahtavan nimeen. | 2.64 | -18.4 |
| `public/audio/fi/mean-kawthar-1.mp3` | Me olemme antaneet sinulle Kawtharin, runsaasti hyvää. | 3.40 | -18.5 |
| `public/audio/fi/mean-kawthar-2.mp3` | Rukoile siis Herraasi ja uhraa. | 2.43 | -18.4 |
| `public/audio/fi/mean-kawthar-3.mp3` | Se, joka sinua vihaa, jää itse vaille kaikkea hyvää. | 3.45 | -18.4 |
