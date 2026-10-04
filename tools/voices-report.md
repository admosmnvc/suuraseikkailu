# Opettajaäänet ja sana-äänitteet – raportti

Kolme äänilähdettä, kaikki oikeaa puhetta (ei paloja resitaatiosta):

| Mitä | Lähde | Työkalu |
|---|---|---|
| Suurien rivit (Vaikea) | Mishary Rashid Alafasy, jakeittaiset MP3:t | (valmiit, `public/audio/SSSAAA.mp3`) |
| Suurien sanat (Helppo, Keskitaso) | **Quran.com word-by-word -äänitteet**, `https://audio.qurancdn.com/wbw/SSS_AAA_WWW.mp3` – ihmisen lukemat yksittäiset sanat | `tools/build-words.py` |
| Suomenkieliset kehotteet, Shahadan rivit ja Shahadan palat | Microsoft Edge -neuraalipuhe (`edge-tts`) | `tools/make_voices.py` |

Lähdemerkintä (Asetukset → Lähteet ja lisenssit, `data.js` credits): "Sana kerrallaan -äänitteet (Helppo ja Keskitaso): Quran.com, audio.qurancdn.com (word-by-word)."

## Opettajaäänet (`tools/make_voices.py`)

- **Suomi:** `fi-FI-NooraNeural`, nopeus `+3%`, sävelkorkeus `+15Hz` – kirkas, lämmin ja kannustava (valittu vertailemalla viittä asetusta kolmella lauseella).
- **Arabia (Shahada):** `ar-SA-ZariyahNeural`, nopeus `-25%`, sävelkorkeus `+8Hz` – selkeä ja hidas, jotta 4-vuotias ehtii toistaa. Teksti = `data.js`:n `tts`-kenttä täysin vokaalimerkein.
- **Shahadan palat (v3, Helppo/Keskitaso):** 14 tiedostoa `public/audio/shahada-c-<rivi>-<taso>-<n>.mp3` samoilla Zariyah-asetuksilla. Teksti = vastaavat sanat `tts`-kentästä (`src/content/chunks.js`, `teacherChunkClips()`):
  - rivi 1 helppo: أَشْهَدُ · أَنْ لا · إِلَهَ · إِلَّا اللَّه (Ash-hadu · an laa · ilaaha · illallaah); keskitaso: أَشْهَدُ أَنْ لا · إِلَهَ إِلَّا اللَّه
  - rivi 2 helppo: وَأَشْهَدُ · أَنَّ · مُحَمَّدًا · عَبْدُهُ · وَرَسُولُه; keskitaso: وَأَشْهَدُ أَنَّ · مُحَمَّدًا عَبْدُهُ · وَرَسُولُه
- **Uudet suomenkieliset kehotteet (v3):** cover, who, ask-theme, pick-level, level-easy/medium/hard, rocket-part, rocket-launch, game-boy-0..5, game-girl-0..5 (`ask-name` on vain tekstiä). Poistetut v2-pelikehotteet game-0..7 poistettiin (`--prune`). Kehotteita chunk-turn, chunk-good, line-now ja surah-now ei tehty (poistettu `prompts.js`:stä ennen generointia).
- **Ääntämiskorjaukset vain puheeseen** (`SAY_AS`; näkyvät tekstit eivät muutu): Al-Fatihan → Alfaatihan, Al-Ikhlasin → Alihlaasin, Al-Kawtharin → Alkautharin, Kawtharin → Kautharin, Upeaa → Upeeaa, Herraasi → Herraa-si, kaikkea → kaikke-a. Syy: "Al-…" luettiin kirjaimina; Noora nieli vokaalin sanoista "Upeaa", "Herraasi" ja "kaikkea". Uudet kehotteet eivät tarvinneet korjauksia (tarkistettu puheentunnistuksella).
- **Jälkikäsittely (ffmpeg):** hiljaisuus pois alusta ja lopusta (−50 dB RMS, 10 ms pehmeä häivytys), 60 ms tyhjää molempiin päihin, mono, kaksivaiheinen loudnorm (lineaarinen), MP3 mono 44,1 kHz 64 kbps.
- **Äänekkyys:** tavoite -18.4 LUFS = Mishary-tiedostojen (14 kpl) mediaani; mono mitataan dual-monona, koska selain soittaa sen molemmista kaiuttimista kuten resitaation. True peak ≤ -1.5 dBTP.

## Sana-äänitteet (`tools/build-words.py`)

- **Lähde:** Quran.com word-by-word, yksi tiedosto per sana, ihmisen lukema. Sanalista tulee sovelluksesta (`node tools/list-clips.mjs --words` = `src/content/words.js`): sana *n* rivillä = `SSS_AAA_<n>.mp3`, missä SSS/AAA tulee rivin jaetiedostosta. Al-Ikhlasin ja Al-Kawtharin Bismillah (rivi 0) käyttää Al-Fatihan 1:1 -sanoja → 54 eri tiedostoa (Al-Fatiha 29, Al-Ikhlas 15, Al-Kawthar 10).
- **Lataus:** `curl` (Pythonin urllib saa välityspalvelimelta 403), alkuperäiset talteen `tools/wbw-src/` (3,4 MB, 320 kbps stereo; ladataan uudelleen jos puuttuu). Alkuperäisten SHA-256 ja URL tallennetaan `tools/words.json`:iin.
- **Käsittely:** sama ketju kuin opettajaäänissä (`make_voices.master`), mutta reunat leikataan vain siitä, missä jokainen näyte on alle −50 dBFS (huippuarvo, ei RMS: hiljaista sanan loppua ei koskaan leikata), reunoihin n. 40 ms hiljaisuutta, lineaarinen loudnorm -18.4 LUFS, true peak ≤ -2 dBTP, MP3 mono 44,1 kHz 64 kbps → `public/audio/wbw/`. Sanan sisältä ei leikata mitään; alkuperäisissä oli 0,03–0,5 s tyhjää alussa (Al-Fatiha) ja n. 30 ms lopussa.
- **Ajo:** `python3 tools/build-words.py` (lataa puuttuvat, käsittelee muuttuneet, tarkistaa kaiken), `--check` (vain tarkistus), `--force`, `--asr` (takaisinlitterointi), `--prune`. Skripti on deterministinen ja idempotentti: toinen ajo ei muuta yhtään tavua (tarkistettu md5:llä).

### Tarkistukset (kaikki läpi)

- **Sanamäärä:** jokaiselle 14 jakeelle quran.comissa on täsmälleen yhtä monta sanatiedostoa kuin Tanzil-rivillä on sanoja – sana N+1 palauttaa 404 (`words.json` → `verses`).
- **Tiedostot kelpaavat:** ffprobe lukee kaikki; kesto 0,2–4 s (alkuperäiset 0.63–2.92 s). Ainoa poikkeus, dokumentoitu: 1:7 sana 9 ٱلضَّآلِّينَ 6.45 s → 6.01 s (madd laazim, venytys 6 tavua – kolmen suuran pisin sana).
- **Mitään ei leikattu sanasta:** valmis tiedosto on aina vähintään yhtä pitkä kuin alkuperäisen puheosuus (silencedetect −50 dB, riippumaton leikkaussuotimesta).
- **Kesto järkevä:** puhetta sekunteina per arabialainen kirjain on jokaisella sanalla mediaanin 1/3–3× sisällä (väärä tiedosto väärässä kohdassa näkyisi tässä).
- **Äänekkyys:** -18.5…-18.3 LUFS, true peak -12.4…-5.6 dBTP, kaikki "linear".
- **Selain:** kaikki 54 sanaa, 14 Shahadan palaa ja 56 suomenkielistä kehotetta dekoodautuvat Chromiumissa (Web Audio), ei virheitä.
- **Sanojen järjestys (takaisinlitterointi):** kaikki 54 käsiteltyä tiedostoa litteroitiin Whisperillä (`large-v3-turbo`, arabia). Jokainen tunnistus on oikea sana oikeassa kohdassa (konsonanttirunkojen samankaltaisuus 0.75–1.0; ainoa 0.5: 112:1 هُوَ → "أو", pehmeä h). Tunnistus vahvisti myös translitteroinnin säännön: jakeen keskellä sana luetaan täydellä päätteellä (بسمي = bismi, ربي = rabbi, مالكي = maaliki, نعبدو = na‘budu, فصلي = fasalli, لهو = lahuu), jakeen viimeinen sana taukomuodossa (نستعين = nasta‘iin, الرحيم = ar-rahiim, الدين = ad-diin, Ahad).

### Translitterointi (`src/content/words.js`)

Suomalaisittain luettava, `data.js`:n tyyli: pitkät vokaalit kahdella kirjaimella (aa, ii, uu), ‘ = ain, ’ = hamza, sh/kh/gh/dh/th, artikkeli väliviivalla (al-, ar-, as-, ad-). Jokainen sana kirjoitetaan niin kuin se kuuluu omassa äänitteessään: hamzat al-wasl saa vokaalinsa (ٱللَّهِ yksin = Allaahi, ٱهْدِنَا = Ihdinaa), jakeen sisällä täysi pääte, jakeen lopussa taukomuoto. Isolla alkukirjaimella rivin ensimmäinen sana (kuten `data.js`) ja Allaah. Palan teksti = sanojen tekstit välilyönnillä; Shahadassa omistajan yksiköt (Ash-hadu · an laa · ilaaha · illallaah).

Keskitason parit: sanat pareittain vasemmalta oikealle (viimeinen voi jäädä yksin). Poikkeus, deterministinen (`LEADS` `chunks.js`:ssä): pieni partikkeli, joka johtaa seuraavaan sanaan (وَلَا), ei jää parin jälkimmäiseksi: 1:7 … | ‘alayhim | wa laa ad-daalliin.

## Puheentunnistus: opettajaäänet

Kaikki 72 opettajaäänitiedostoa on litteroitu takaisin paikallisella Whisper-mallilla (`faster-whisper`, `large-v3-turbo`, CPU; uudet 35 tässä ajossa: `make_voices.py --asr --only …`). Suomi: 48/56 täsmää näytettävään tekstiin ja 4 puhemuotoon (`SAY_AS`) (isot kirjaimet ja välimerkit ohitettu; huutomerkit kuuluvat tunnistimelle usein pisteinä). Arabia: 11/16 täsmää kirjain kirjaimelta (vokaalimerkit ohitettu). Erot:

| Tiedosto | Odotettu | Tunnistettu | Arvio |
|---|---|---|---|
| gem | Sait jalokiven kruunuun! | Sait javokiven kruunuun. | (v2) rajatapaus, l on pehmeä; raakaversio tunnistui "jalokiven". |
| finale-fatiha / -ikhlas / -kawthar, mean-kawthar-1 | Al-Fatihan … | alfaatihan … | täsmää puhemuotoon (`SAY_AS`) |
| mean-shahada-1 | … Muhammad … | … Muhammed … | (v2) tunnistimen kirjoitusasu |
| rocket-launch | Kolme, kaksi, yksi... Raketti lähtee! | 3, 2, 1. Raketti lähtee. | täsmää (numerot numeroina) |
| game-girl-1 | Ruoki eläimet! | Ruokieläimet | täsmää (tunnistin yhdisti sanat) |
| shahada-c-1-easy-2 | أَنْ لا | أنا لأ | lyhyt pala (0,9 s); keskitason pala أشهد أن لا tunnistuu oikein |
| shahada-c-1-easy-3 | إِلَهَ | إلعا | toisella ajolla "إلاها / Ilaha" = ilaaha, oikein |
| shahada-c-1-medium-2 | إِلَهَ إِلَّا اللَّه | إِلَهَا إِلَّا اللَّهِ | oikein (tunnistin lisäsi vokaalit) |
| shahada-c-2-easy-2 | أَنَّ | ن | tunnistin ei saa 0,5 s sanasta otetta; taajuusanalyysi: a (160 ms) – nn (150 ms) – a, eli "anna" kuuluu kokonaan; keskitason pala وأشهد أن tunnistuu oikein |
| shahada-c-2-easy-4 | عَبْدُهُ | عبدو | ‘abduh(u), loppu-h pehmeä; keskitason pala محمدا عبده tunnistuu oikein |

Lyhyiden arabian palojen vaihtoehtoja kokeiltiin (piste perään, nopeus -10 %, `لَا`/`إِلَٰهَ`-kirjoitusasu): tunnistus ei parantunut, joten palat tehtiin samalla tekstillä ja asetuksilla kuin Shahadan rivit.

## Oma ääni

Vanhempi voi korvata asetuksissa (pitkä painallus → **Omat äänitykset**) Shahadan rivit, vuorokehotteet, kehut, palkintolauseet ja juhlalauseet omalla nauhoituksellaan; oma nauhoitus soi aina ennen näitä tiedostoja. Asetuksia voi muuttaa skriptin alusta (`VOICES`, `SAY_AS`) ja ajaa uudelleen: `python3 tools/make_voices.py` (tarkistus ilman verkkoa: `--check`, kaikki uudestaan: `--force`, litterointi: `--asr`, käyttämättömät pois: `--prune`).

## Tiedostot: opettajaäänet

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
| `public/audio/fi/game-girl-5.mp3` | Sytytä linnan valot! | 1.38 | -18.4 |
| `public/audio/fi/test-fi.mp3` | Hei! Tämä on suomen puheääni. | 2.95 | -18.4 |
| `public/audio/shahada-c-1-easy-1.mp3` | أَشْهَدُ | 0.89 | -18.3 |
| `public/audio/shahada-c-1-easy-2.mp3` | أَنْ لا | 0.86 | -18.4 |
| `public/audio/shahada-c-1-easy-3.mp3` | إِلَهَ | 0.76 | -18.4 |
| `public/audio/shahada-c-1-easy-4.mp3` | إِلَّا اللَّه | 0.94 | -18.4 |
| `public/audio/shahada-c-1-medium-1.mp3` | أَشْهَدُ أَنْ لا | 1.36 | -18.4 |
| `public/audio/shahada-c-1-medium-2.mp3` | إِلَهَ إِلَّا اللَّه | 1.57 | -18.4 |
| `public/audio/shahada-c-2-easy-1.mp3` | وَأَشْهَدُ | 1.04 | -18.3 |
| `public/audio/shahada-c-2-easy-2.mp3` | أَنَّ | 0.68 | -18.4 |
| `public/audio/shahada-c-2-easy-3.mp3` | مُحَمَّدًا | 1.28 | -18.4 |
| `public/audio/shahada-c-2-easy-4.mp3` | عَبْدُهُ | 0.81 | -18.4 |
| `public/audio/shahada-c-2-easy-5.mp3` | وَرَسُولُه | 1.20 | -18.4 |
| `public/audio/shahada-c-2-medium-1.mp3` | وَأَشْهَدُ أَنَّ | 1.49 | -18.4 |
| `public/audio/shahada-c-2-medium-2.mp3` | مُحَمَّدًا عَبْدُهُ | 1.62 | -18.4 |
| `public/audio/shahada-c-2-medium-3.mp3` | وَرَسُولُه | 1.20 | -18.4 |
| `public/audio/fi/mean-shahada-0.mp3` | Todistan, että ei ole muuta jumalaa kuin Allah. | 3.00 | -18.4 |
| `public/audio/shahada-1.mp3` | أَشْهَدُ أَنْ لا إِلَهَ إِلَّا اللَّه | 2.48 | -18.4 |
| `public/audio/fi/mean-shahada-1.mp3` | Ja todistan, että Muhammad on Allahin palvelija ja lähettiläs. | 3.81 | -18.4 |
| `public/audio/shahada-2.mp3` | وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُه | 3.63 | -18.4 |
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

## Tiedostot: sana-äänitteet

Kesto: alkuperäinen → käsitelty. Tunnistus = Whisperin arabiankielinen litterointi käsitellystä tiedostosta (samankaltaisuus 0–1). Alkuperäinen URL = `https://audio.qurancdn.com/wbw/<tiedosto>`.

| Tiedosto | Jae:sana | Arabia | Translitterointi | Kesto (s) | LUFS | Tunnistus |
|---|---|---|---|---|---|---|
| `public/audio/wbw/001_001_001.mp3` | 1:1:1 | بِسْمِ | Bismi | 1.12 → 0.89 | -18.4 | بسمي (0.86) |
| `public/audio/wbw/001_001_002.mp3` | 1:1:2 | ٱللَّهِ | Allaahi | 1.36 → 1.04 | -18.4 | الله (1.0) |
| `public/audio/wbw/001_001_003.mp3` | 1:1:3 | ٱلرَّحْمَٰنِ | ar-rahmaani | 1.88 → 1.57 | -18.4 | الرحمن (1.0) |
| `public/audio/wbw/001_001_004.mp3` | 1:1:4 | ٱلرَّحِيمِ | ar-rahiim | 1.75 → 1.46 | -18.4 | الرحيم (1.0) |
| `public/audio/wbw/001_002_001.mp3` | 1:2:1 | ٱلْحَمْدُ | Al-hamdu | 1.33 → 1.04 | -18.4 | الحمد (1.0) |
| `public/audio/wbw/001_002_002.mp3` | 1:2:2 | لِلَّهِ | lillaahi | 1.72 → 1.33 | -18.4 | لله (1.0) |
| `public/audio/wbw/001_002_003.mp3` | 1:2:3 | رَبِّ | rabbi | 1.23 → 1.04 | -18.4 | ربي (0.8) |
| `public/audio/wbw/001_002_004.mp3` | 1:2:4 | ٱلْعَٰلَمِينَ | al-‘aalamiin | 2.38 → 2.01 | -18.4 | العالمين (0.93) |
| `public/audio/wbw/001_003_001.mp3` | 1:3:1 | ٱلرَّحْمَٰنِ | Ar-rahmaani | 1.80 → 1.54 | -18.4 | الرحمن (1.0) |
| `public/audio/wbw/001_003_002.mp3` | 1:3:2 | ٱلرَّحِيمِ | ar-rahiim | 2.38 → 1.93 | -18.4 | الرحيم (1.0) |
| `public/audio/wbw/001_004_001.mp3` | 1:4:1 | مَٰلِكِ | Maaliki | 1.80 → 1.36 | -18.4 | مالكي (0.75) |
| `public/audio/wbw/001_004_002.mp3` | 1:4:2 | يَوْمِ | yawmi | 1.75 → 1.31 | -18.5 | يومي (0.86) |
| `public/audio/wbw/001_004_003.mp3` | 1:4:3 | ٱلدِّينِ | ad-diin | 2.22 → 1.83 | -18.4 | الدين (1.0) |
| `public/audio/wbw/001_005_001.mp3` | 1:5:1 | إِيَّاكَ | Iyyaaka | 1.77 → 1.38 | -18.4 | إياك (1.0) |
| `public/audio/wbw/001_005_002.mp3` | 1:5:2 | نَعْبُدُ | na‘budu | 1.80 → 1.36 | -18.4 | نعبدو (0.89) |
| `public/audio/wbw/001_005_003.mp3` | 1:5:3 | وَإِيَّاكَ | wa iyyaaka | 2.35 → 1.80 | -18.4 | وإياك (1.0) |
| `public/audio/wbw/001_005_004.mp3` | 1:5:4 | نَسْتَعِينُ | nasta‘iin | 2.92 → 2.06 | -18.4 | نستعين (1.0) |
| `public/audio/wbw/001_006_001.mp3` | 1:6:1 | ٱهْدِنَا | Ihdinaa | 1.46 → 1.18 | -18.4 | اهدينا (0.91) |
| `public/audio/wbw/001_006_002.mp3` | 1:6:2 | ٱلصِّرَٰطَ | as-siraata | 1.88 → 1.59 | -18.4 | الصراط (0.91) |
| `public/audio/wbw/001_006_003.mp3` | 1:6:3 | ٱلْمُسْتَقِيمَ | al-mustaqiim | 2.69 → 2.40 | -18.4 | المستقيم (1.0) |
| `public/audio/wbw/001_007_001.mp3` | 1:7:1 | صِرَٰطَ | Siraata | 1.59 → 1.31 | -18.4 | صراط (0.86) |
| `public/audio/wbw/001_007_002.mp3` | 1:7:2 | ٱلَّذِينَ | alladhiina | 1.59 → 1.33 | -18.4 | الذين (1.0) |
| `public/audio/wbw/001_007_003.mp3` | 1:7:3 | أَنْعَمْتَ | an‘amta | 1.64 → 1.33 | -18.4 | أنعمت (1.0) |
| `public/audio/wbw/001_007_004.mp3` | 1:7:4 | عَلَيْهِمْ | ‘alayhim | 1.96 → 1.57 | -18.4 | عليهم (1.0) |
| `public/audio/wbw/001_007_005.mp3` | 1:7:5 | غَيْرِ | ghayri | 1.51 → 1.23 | -18.4 | أغيري (0.75) |
| `public/audio/wbw/001_007_006.mp3` | 1:7:6 | ٱلْمَغْضُوبِ | al-maghduubi | 2.14 → 1.83 | -18.4 | المغضوب (1.0) |
| `public/audio/wbw/001_007_007.mp3` | 1:7:7 | عَلَيْهِمْ | ‘alayhim | 1.93 → 1.72 | -18.4 | عليهم (1.0) |
| `public/audio/wbw/001_007_008.mp3` | 1:7:8 | وَلَا | wa laa | 1.23 → 0.97 | -18.4 | ولا (1.0) |
| `public/audio/wbw/001_007_009.mp3` | 1:7:9 | ٱلضَّآلِّينَ | ad-daalliin | 6.45 → 6.01 | -18.4 | الضالين (1.0) |
| `public/audio/wbw/112_001_001.mp3` | 112:1:1 | قُلْ | Qul | 0.73 → 0.78 | -18.4 | قل (1.0) |
| `public/audio/wbw/112_001_002.mp3` | 112:1:2 | هُوَ | huwa | 0.63 → 0.68 | -18.4 | أو (0.5) |
| `public/audio/wbw/112_001_003.mp3` | 112:1:3 | ٱللَّهُ | Allaahu | 1.25 → 1.33 | -18.4 | الله (1.0) |
| `public/audio/wbw/112_001_004.mp3` | 112:1:4 | أَحَدٌ | ahad | 0.94 → 0.99 | -18.4 | أحد (1.0) |
| `public/audio/wbw/112_002_001.mp3` | 112:2:1 | ٱللَّهُ | Allaahu | 1.33 → 1.38 | -18.4 | الله (1.0) |
| `public/audio/wbw/112_002_002.mp3` | 112:2:2 | ٱلصَّمَدُ | as-samad | 1.15 → 1.23 | -18.3 | الصمد (1.0) |
| `public/audio/wbw/112_003_001.mp3` | 112:3:1 | لَمْ | Lam | 0.78 → 0.86 | -18.3 | لم (1.0) |
| `public/audio/wbw/112_003_002.mp3` | 112:3:2 | يَلِدْ | yalid | 0.97 → 1.04 | -18.4 | ياليد (0.75) |
| `public/audio/wbw/112_003_003.mp3` | 112:3:3 | وَلَمْ | wa lam | 1.07 → 1.15 | -18.4 | ولم (1.0) |
| `public/audio/wbw/112_003_004.mp3` | 112:3:4 | يُولَدْ | yuulad | 1.07 → 1.15 | -18.4 | يولاد (0.89) |
| `public/audio/wbw/112_004_001.mp3` | 112:4:1 | وَلَمْ | Wa lam | 0.84 → 0.89 | -18.4 | ولم (1.0) |
| `public/audio/wbw/112_004_002.mp3` | 112:4:2 | يَكُن | yakun | 0.94 → 0.99 | -18.4 | يكون (0.86) |
| `public/audio/wbw/112_004_003.mp3` | 112:4:3 | لَّهُۥ | lahuu | 1.04 → 1.12 | -18.4 | لهو (0.8) |
| `public/audio/wbw/112_004_004.mp3` | 112:4:4 | كُفُوًا | kufuwan | 1.18 → 1.25 | -18.4 | كفوان (0.89) |
| `public/audio/wbw/112_004_005.mp3` | 112:4:5 | أَحَدٌۢ | ahad | 0.97 → 1.04 | -18.3 | أحد (1.0) |
| `public/audio/wbw/108_001_001.mp3` | 108:1:1 | إِنَّآ | Innaa | 1.54 → 1.59 | -18.4 | إِنَّا (1.0) |
| `public/audio/wbw/108_001_002.mp3` | 108:1:2 | أَعْطَيْنَٰكَ | a‘taynaaka | 1.65 → 1.70 | -18.4 | أعطيناك (0.92) |
| `public/audio/wbw/108_001_003.mp3` | 108:1:3 | ٱلْكَوْثَرَ | al-kawthar | 1.51 → 1.57 | -18.4 | الكوثر (1.0) |
| `public/audio/wbw/108_002_001.mp3` | 108:2:1 | فَصَلِّ | Fasalli | 1.23 → 1.28 | -18.3 | فصلي (0.86) |
| `public/audio/wbw/108_002_002.mp3` | 108:2:2 | لِرَبِّكَ | lirabbika | 1.18 → 1.25 | -18.4 | لربك (1.0) |
| `public/audio/wbw/108_002_003.mp3` | 108:2:3 | وَٱنْحَرْ | wanhar | 1.12 → 1.18 | -18.4 | وانحر (1.0) |
| `public/audio/wbw/108_003_001.mp3` | 108:3:1 | إِنَّ | Inna | 1.12 → 1.18 | -18.4 | إن (1.0) |
| `public/audio/wbw/108_003_002.mp3` | 108:3:2 | شَانِئَكَ | shaani’aka | 1.33 → 1.38 | -18.4 | جانئك (0.8) |
| `public/audio/wbw/108_003_003.mp3` | 108:3:3 | هُوَ | huwa | 0.76 → 0.84 | -18.5 | هو (1.0) |
| `public/audio/wbw/108_003_004.mp3` | 108:3:4 | ٱلْأَبْتَرُ | al-abtar | 1.44 → 1.49 | -18.5 | الأبتر (1.0) |
