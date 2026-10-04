# Suuraseikkailu v2 – testiraportti

Päiväys: 4.10.2026 · Versio: 2.0.0

## Yhteenveto

- **Automaattiset testit selaimessa:** kaikki menevät läpi (Chromium, puhelin- ja tablettikoot, vaaka- ja pystyasento).
- **Oikeilla laitteilla ei ole testattu.** Rakentajalla ei ollut pääsyä iPhoneen, iPadiin eikä Android-laitteeseen.
  Alla on lista, jonka voi käydä läpi omalla laitteella noin 10 minuutissa.
- **Äänet:** kukaan ihminen ei ole vielä kuunnellut kaikkia opettajaääniä. Kuuntele ainakin Shahada ja kehut.
  Jokaisen äänen voi korvata omalla äänityksellä (Vanhemmille → Omat äänitykset).

## Laitteittain

| Laite | Tila | Mitä on varmistettu |
|---|---|---|
| Työpöydän Chrome | ✅ Testattu automaattisesti (Chromium) | Koko kulku, äänijono, offline, asetukset, äänitys valemikrofonilla |
| Android Chrome | ⚠️ Vain emuloitu (puhelinkoot, kosketus) | Asettelu 360–430 px, kosketusalueet, ei vaakavieritystä. Oikea äänentoisto tarkistamatta. |
| iPhone Safari, äänetön-kytkin pois | ❓ Ei testattu | Koodi noudattaa iOS:n sääntöjä (ääni avataan Aloita-napautuksessa, yksi jaettu audio-elementti) |
| iPhone Safari, äänetön-kytkin päällä | ❓ Ei testattu | Resitaatio ja puhe soivat audio-elementillä, joka ei noudata äänetön-kytkintä. Efektit: iOS 17+ `audioSession = playback`; iOS 16 ja vanhempi: efektit voivat olla mykkiä. |
| iPad Safari + kotivalikko | ❓ Ei testattu | Manifest, kuvakkeet, service worker ja offline toimivat Chromiumissa |

## Hyväksyntäkohdat (KORJAUSPYYNTO.md)

| Kohta | Chromium | Oikea laite |
|---|---|---|
| Ensimmäinen napautus avaa äänen (Aloita-kupla) | ✅ | tarkista |
| Al-Fatihan ketju 1–7 soi järjestyksessä ilman päällekkäisyyttä | ✅ 001001 → 001007 → "Nyt sinun vuorosi", tauot 258–388 ms, ei päällekkäisyyttä | tarkista |
| Kuuntele aloittaa alusta, Sanoin! katkaisee toiston | ✅ pause 0 ms napautuksesta | tarkista |
| Minipelien efektit kuuluvat | ✅ (efektit eivät soi resitaation päällä) | tarkista korvalla |
| Ääni toimii, kun sovellus palaa taustalta | ✅ simuloitu: lukittunut ääni → "Jatketaan!"-kupla → jatkuu | tarkista |
| Koko kulku kaikissa osioissa | ✅ kaikki 4 osiota, 18 vaihetta, 8 minipeliä, palkinnot, loppujuhla, tarrat | – |
| Vaihepallot, kertaus, Uudestaan, nollaus vahvistuksella | ✅ | – |
| Ei vaakavieritystä 360–1024 px, safe area | ✅ 33 näkymää / koko + 844×390 vaaka; safe area emuloitu | tarkista iPhonella |
| Edistyminen säilyy uudelleenkäynnistyksessä | ✅ | – |
| Konsolissa ei virheitä | ✅ 0 virhettä, 0 varoitusta | – |
| Toimii ilman nettiä | ✅ kaikki 82 tiedostoa välimuistissa, offline-uudelleenlataus toimii | tarkista kotivalikosta |

## Automaattiset testisarjat

| Sarja | Komento | Tulos |
|---|---|---|
| Koko kulku (4 näyttökokoa + vaaka, ääni, asetukset, offline, tausta) | `npm run build && node tools/e2e.cjs` | ✅ 211/211 |
| Ääniputki (jono, varatoisto, hidas tila, lukitus, äänitys) | `node tools/audio-test.cjs` | ✅ 92/92 |
| Minipelit (8 peliä, 5 näyttökokoa, kesto 10–20 s, nopea hakkaaminen) | `node tools/games-test.cjs` | ✅ 196/196 (ALL OK) |
| PWA (välimuisti, offline, Range 206, alikansio, päivitys) | `node tools/pwa-test.cjs <dist>` | ✅ 68/68 |
| Arabiankielinen teksti muuttamaton | `npm run check:arabic` | ✅ 18 riviä identtiset Tanzil-tekstin kanssa |

## Tarkistuslista omalle laitteelle (noin 10 min)

1. Julkaise `julkaistava-sivu`-kansio (esim. Netlify Drop) ja avaa HTTPS-osoite puhelimella.
2. Napauta **Aloita** → kuuluuko "Hei! Mitä opitaan tänään?"
3. Avaa **Al-Fatiha**, mene vaiheeseen 7 (tai käy vaiheet läpi) → soivatko rivit 1–7 järjestyksessä?
4. Paina **Kuuntele** kesken → alkaako alusta? Paina **Sanoin!** kesken → loppuuko ääni heti?
5. Pelaa minipeli → kuuluvatko poksahdukset ja kilahdukset?
6. Laita iPhonen äänetön-kytkin päälle → soiko resitaatio yhä? Kuuluvatko efektit?
7. Vaihda toiseen sovellukseen ja palaa → jatkuuko ääni (tarvittaessa napautus "Jatketaan!")?
8. Lisää kotivalikkoon (iPhone/iPad: Jaa → Lisää Koti-valikkoon), avaa sieltä, laita lentokonetila päälle → toimiiko?
9. **Vanhemmille** (pidä nappia painettuna) → **Testaa äänet**: neljä nappia ja tila (esim. "MP3: OK", "AudioContext: running").

Jos jokin kohta ei toimi, kirjoita ylös laite, iOS/Android-versio ja Testaa äänet -paneelin tilarivit.

## Tunnetut rajoitukset

- iOS 16 ja vanhempi, äänetön-kytkin päällä: ääniefektit voivat olla hiljaa (resitaatio ja puhe soivat).
- Jos audio-elementti ei soi lainkaan, käytetään Web Audio -varatoistoa: silloin hidas tila ei hidasta.
- Hidas tila koskee Misharyn resitaatiota. Shahadan opettajaääni on valmiiksi hidas, joten sitä ei hidasteta lisää.
- Opettajaäänet on tehty Microsoft Edge -puhesynteesillä. Perhekäyttöön tämä riittää. Jos sovellusta jaetaan laajasti,
  tarkista palvelun käyttöehdot tai korvaa äänet omilla äänityksillä.
- Offline-tila vaatii HTTPS-osoitteen (ei toimi `http://`-lähiverkko-osoitteessa).
