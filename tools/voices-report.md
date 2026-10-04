# Opettajaäänet – raportti

Tuotettu skriptillä `tools/make_voices.py` (Microsoft Edge -neuraalipuhe, `edge-tts`). Kaikki tiedostot ovat oikeaa puhetta, ei paloja resitaatiosta. Suurien rivit ovat edelleen Mishary Alafasyn resitaatiota.

## Asetukset

- **Suomi:** `fi-FI-NooraNeural`, nopeus `+3%`, sävelkorkeus `+15Hz` – kirkas, lämmin ja kannustava. Valittu vertailemalla viittä asetusta (0/+10/+15/+20 Hz, 0–5 %) kolmella lauseella: +15 Hz nostaa ääntä ja laajentaa sävelvaihtelua (pirteämpi), +3 % pitää pitkät suomennokset vielä rauhallisina lapselle.
- **Arabia (Shahada):** `ar-SA-ZariyahNeural`, nopeus `-25%`, sävelkorkeus `+8Hz` – selkeä ja hidas, jotta 4-vuotias ehtii toistaa (rivi 1 n. 4,7 tavua/s; normaalinopeus n. 6). Teksti = `data.js`:n `tts`-kenttä täysin vokaalimerkein.
- **Ääntämiskorjaukset vain puheeseen** (`SAY_AS`; näkyvät tekstit eivät muutu):
  - Al-Fatihan → Alfaatihan
  - Al-Ikhlasin → Alihlaasin
  - Al-Kawtharin → Alkautharin
  - Kawtharin → Kautharin
  - Upeaa → Upeeaa
  - Herraasi → Herraa-si
  - kaikkea → kaikke-a
  - Syy: "Al-…" luettiin kirjaimina ("aa, äl"); yhteen kirjoitettuna luetaan yhtenä sanana, pitkät vokaalit kuten arabiassa. Noora nieli vokaalin sanoista "Upeaa" ("upa"), "Herraasi" ("hööraasi") ja "kaikkea" ("kaikkia"); tavuviiva ei lisää taukoa.
- **Jälkikäsittely (ffmpeg):** hiljaisuus pois alusta ja lopusta (−50 dB, 10 ms pehmeä häivytys), 60 ms tyhjää molempiin päihin, mono, kaksivaiheinen loudnorm (lineaarinen), MP3 mono 44,1 kHz 64 kbps.
- **Äänekkyys:** tavoite -18.4 LUFS = Mishary-tiedostojen (14 kpl) mediaani; mono mitataan dual-monona, koska selain soittaa sen molemmista kaiuttimista kuten resitaation. True peak ≤ -1.5 dBTP.

## Tarkistukset

- 45/45 tiedostoa läpäisi: olemassa, kesto 0,4–12 s (nyt 0.73–6.61 s), ei hiljainen (max > −20 dB), äänekkyys -18.5…-18.3 LUFS (sallittu ±1,5 LU), true peak -8.5…-4.8 dBTP.
- Chromium (Playwright): kaikki 45 soivat `<audio>`-elementillä ja dekoodautuvat Web Audiolla, ei konsolivirheitä.
- Skripti on idempotentti: toinen ajo ei tee mitään eikä muuta `voices.json`:ia; epäonnistunut puhepyyntö uusitaan (1, 2, 4, 8 s).

## Puheentunnistus (ääntämisen tarkistus)

Kaikki 45 tiedostoa litteroitiin takaisin paikallisella Whisper-mallilla (`faster-whisper`, `large-v3-turbo`, CPU; mallin lataus Hugging Facesta onnistui, mitään ei estetty). 39/45 täsmää näytettävään tekstiin ja 4 lisää puhemuotoon (`SAY_AS`) (isot kirjaimet, välimerkit ja arabian vokaalimerkit ohitettu). Huutomerkit kuuluvat tunnistimelle usein pisteinä. Erot:

| Tiedosto | Odotettu | Tunnistettu | Arvio |
|---|---|---|---|
| gem | Sait jalokiven kruunuun! | Sait javokiven kruunuun. | Rajatapaus: raakaversio tunnistuu "jalokiven", pelkkä uudelleennäytteistys kääntää tunnistuksen. Ei virhe, l on pehmeä. |
| finale-fatiha | Mahtavaa! Osaat koko Al-Fatihan! | Mahtavaa! Osaat koko alfaatihan! | täsmää puhemuotoon Mahtavaa! Osaat koko Alfaatihan! |
| finale-ikhlas | Mahtavaa! Osaat koko Al-Ikhlasin! | Mahtavaa! Osaat koko alihlaasin! | täsmää puhemuotoon Mahtavaa! Osaat koko Alihlaasin! |
| finale-kawthar | Mahtavaa! Osaat koko Al-Kawtharin! | Mahtavaa! Osaat koko Alkautharin. | täsmää puhemuotoon Mahtavaa! Osaat koko Alkautharin! |
| mean-shahada-1 | Ja todistan, että Muhammad on Allahin palvelija ja lähettiläs. | Ja todistan, että Muhammed on Allahin palvelija ja lähettiläs. | "Muhammed" on tunnistimen kirjoitusasu; aiempi otos tunnistui "Muhammad". |
| mean-kawthar-1 | Me olemme antaneet sinulle Kawtharin, runsaasti hyvää. | Me olemme antaneet sinulle Kautharin runsaasti hyvää. | täsmää puhemuotoon Me olemme antaneet sinulle Kautharin, runsaasti hyvää. |

- shahada-1: tunnistettu `أشهد أن لا إله إلا الله` – täsmää
- shahada-2: tunnistettu `وأشهد أن محمدا عبده ورسوله` – täsmää

## Tiedostot

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
| `public/audio/fi/game-0.mp3` | Puhkaise ilmapallot! | 1.46 | -18.4 |
| `public/audio/fi/game-1.mp3` | Napauta lumihiutaleita! | 1.72 | -18.4 |
| `public/audio/fi/game-2.mp3` | Poksauta kuplat! | 1.25 | -18.4 |
| `public/audio/fi/game-3.mp3` | Sytytä kristallilyhdyt! | 1.51 | -18.3 |
| `public/audio/fi/game-4.mp3` | Kerää hedelmät koriin! | 1.59 | -18.4 |
| `public/audio/fi/game-5.mp3` | Napauta taivasta! | 1.41 | -18.4 |
| `public/audio/fi/game-6.mp3` | Koristele kruunu! | 1.20 | -18.4 |
| `public/audio/fi/game-7.mp3` | Sytytä palatsin valot! | 1.54 | -18.4 |
| `public/audio/fi/test-fi.mp3` | Hei! Tämä on suomen puheääni. | 2.95 | -18.4 |
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

## Oma ääni

Vanhempi voi korvata asetuksissa (pitkä painallus → **Omat äänitykset**) Shahadan rivit, vuorokehotteet, kehut, jalokivilauseen ja juhlalauseet omalla nauhoituksellaan; oma nauhoitus soi aina ennen näitä tiedostoja. Asetuksia voi myös muuttaa skriptin alusta (`VOICES`, `SAY_AS`) ja ajaa uudelleen: `python3 tools/make_voices.py` (tarkistus ilman verkkoa: `--check`, kaikki uudestaan: `--force`, litterointi: `--asr`).
