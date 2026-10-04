# Suuraseikkailu

Suomenkielinen oppimispeli 4-vuotiaalle. Lapsi opettelee ulkoa Shahadan ja kolme suuraa: Al-Fatihan,
Al-Ikhlasin ja Al-Kawtharin.

Näin se toimii: sovellus soittaa rivin (suurat Mishary Alafasyn resitaationa, Shahada opettajan äänellä).
Ruudulla näkyvät arabiankielinen teksti, suomalaisittain kirjoitettu ääntämisapu ja suomennos. Lapsi sanoo
rivin ääneen ja painaa isoa **Sanoin!**-kuplaa. Sitten tulee lyhyt minipeli ja palkinto. Rivejä ketjutetaan
(1, sitten 1–2, sitten 1–3 …), kunnes koko suura sanotaan. Lopuksi on juhla ja tarra.

- Tavallinen staattinen verkkosivusto (Vite ja tavallinen JavaScript). Ei palvelinta, ei tiliä, ei mainoksia.
- PWA: sovelluksen voi lisätä kotivalikkoon, ja ensimmäisen avauksen jälkeen se toimii ilman nettiä.
- Edistyminen, asetukset ja omat äänitykset tallentuvat vain tälle laitteelle.
- Vanhempien asetukset aukeavat, kun **Vanhemmille**-nappia pitää painettuna.

## Vaatimukset

- **Node.js 20 tai uudempi** (npm tulee mukana). Tämä riittää sovelluksen rakentamiseen.
- Julkaisuun tarvitaan **HTTPS-osoite**. Service worker (offline-tila) toimii vain HTTPS:n kautta tai
  omalla koneella osoitteessa `127.0.0.1`/`localhost`.
- Vain jos haluat tehdä äänet uudelleen: Python 3, ffmpeg ja `edge-tts` (katso alempaa).

## Rakentaminen

```sh
npm ci
npm run build
```

Valmis sivusto syntyy kansioon `dist/` (noin 2,5 Mt: sivu, fontit, kuvakkeet ja kaikki MP3-tiedostot).
Build kirjoittaa samalla tiedoston `dist/sw.js`, jossa on luettelo kaikista `dist`-kansion tiedostoista.

Kehitystila muutosten tekemiseen: `npm run dev` ja selaimella http://127.0.0.1:5173/. Kehitystilassa
service worker ei ole käytössä.

## Esikatselu omalla koneella

```sh
npx vite preview --host 127.0.0.1
```

Avaa http://127.0.0.1:4173/. Tämä on valmis tuotantoversio service workerin kanssa, joten offline-tilaa
voi kokeilla: Chromen kehittäjätyökalut → *Application* → *Service workers* → *Offline*, ja sivun päivitys.

Tabletilla tai puhelimella kokeiluun tarvitaan HTTPS-osoite, eli julkaise sivusto (alla). Lähiverkon
`http://192.168…`-osoitteessa sovellus kyllä aukeaa, mutta ei toimi ilman nettiä.

## Julkaisu

Julkaistaan koko `dist/`-kansion sisältö. Mikä tahansa staattinen palvelu käy, ja sovellus toimii myös
alikansiossa (esim. `https://esimerkki.fi/lapset/suuraseikkailu/`), koska kaikki osoitteet ovat suhteellisia.
Avaa alikansion osoite kauttaviiva lopussa.

### Netlify Drop (helpoin)

1. Avaa https://app.netlify.com/drop ja kirjaudu tai luo ilmainen tili, jotta sivusto säilyy.
2. Vedä `dist`-kansio selaimen sivulle.
3. Saat osoitteen, esimerkiksi `https://jokin-nimi.netlify.app`. Nimen voi vaihtaa sivuston asetuksista.

Päivitys: avaa sivusto Netlifyssä → *Deploys* → vedä uusi `dist`-kansio pudotusalueelle.

### Cloudflare Pages

- **Ilman Gitiä:** Cloudflaren hallintapaneeli → *Workers & Pages* → *Create* → *Pages* → *Upload assets* →
  anna projektille nimi → vedä `dist`-kansio → *Deploy site*. Osoite on `https://<nimi>.pages.dev`.
  Komentoriviltä sama onnistuu näin: `npx wrangler pages deploy dist --project-name suuraseikkailu`.
- **Gitin kautta:** *Connect to Git*. Build command `npm run build`, build output directory `dist`. Lisää
  tarvittaessa ympäristömuuttuja `NODE_VERSION` = `20`.

### GitHub Pages

Vie lähdekoodi GitHub-repositorioon ja lisää tiedosto `.github/workflows/pages.yml`:

```yaml
name: Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run check:arabic
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Valitse sitten repositorion *Settings* → *Pages* → *Build and deployment* → *Source*: **GitHub Actions**.
Osoite on `https://<käyttäjä>.github.io/<repositorio>/`.

### Zip tai oma palvelin

Pura `dist`-kansion sisältö mihin tahansa HTTPS-palvelimen kansioon. Älä avaa `index.html`-tiedostoa
suoraan tiedostona (`file://…`), koska silloin moduulit ja service worker eivät toimi.

## Lisää kotivalikkoon

Avaa ensin julkaistu osoite netin kanssa.

- **iPhone ja iPad:** avaa osoite **Safarilla** → Jaa-painike (neliö ja nuoli ylös; iPadilla yläpalkissa) →
  **Lisää Koti-valikkoon** → *Lisää*. Avaa sovellus jatkossa kotivalikon kuvakkeesta. Silloin se aukeaa koko
  näytölle ilman osoiteriviä.
  Huom: kotivalikkoon lisätyllä sovelluksella on oma tallennustila. Safari-välilehdellä kertynyt edistyminen ei
  siirry sinne, joten lisää sovellus kotivalikkoon heti alussa ja käytä sitä.
- **Android (Chrome):** avaa osoite → ⋮-valikko → **Asenna sovellus** tai **Lisää aloitusnäytölle** → *Asenna*.
- **Tietokone (Chrome tai Edge):** osoiterivin oikeassa reunassa olevasta asennuskuvakkeesta.

Ensimmäinen napautus isoon **Aloita**-kuplaan avaa äänet. Jos sovellus palaa taustalta ja äänet ovat
lukittuneet, kupla näkyy uudelleen.

## Toiminta ilman nettiä

- Kun sovellus avataan ensimmäisen kerran netin kanssa, se tallentaa laitteelle kaikki tiedostonsa: sivun,
  fontit, kuvakkeet ja kaikki MP3-tiedostot (noin 2,5 Mt). Sen jälkeen kaikki toimii ilman nettiä, myös
  lentotilassa. Pidä sovellus ensimmäisellä kerralla hetken auki (hitaalla yhteydellä noin puoli minuuttia).
- Jos lataus katkeaa, laitteelle ei jää puolikasta versiota. Lataus yritetään uudelleen seuraavalla avauksella,
  ja siihen asti sovellus toimii tavallisesti netin kautta.
- **Päivitykset:** kun julkaiset uuden version, laite hakee sen taustalla seuraavalla avauksella, kun netti on
  päällä. Uusi versio tulee käyttöön, kun sovellus avataan seuraavan kerran. Peli ei siis koskaan lataudu
  uudelleen kesken lapsen leikin. Edistyminen ja omat äänitykset säilyvät päivityksissä.
- Edistyminen (`localStorage`) ja omat äänitykset (IndexedDB) ovat vain tällä laitteella. Selaimen
  *Tyhjennä sivuston tiedot* poistaa ne ja offline-kopion.
- Tekniikka: `dist/sw.js` tallentaa jokaisen buildin omaan välimuistiinsa
  (`suuraseikkailu:<osoite>:<versio>`). Versio lasketaan tiedostojen sisällöstä, ja vanhat versiot poistetaan.
  Äänitiedostojen osapyynnöt (Range, iPhone ja iPad) palvellaan välimuistista `206 Partial Content`
  -vastauksina.

## Äänten tekeminen uudelleen

Opettajan äänet ovat valmiita MP3-tiedostoja. Mukana ovat suomenkieliset kehotteet, kehut, pelien nimet,
merkitykset ja Shahada: `public/audio/fi/*.mp3` sekä `public/audio/shahada-1.mp3` ja `shahada-2.mp3`. Tekstit
tulevat tiedostosta `src/content/prompts.js`. Jos muutat tekstejä:

```sh
pip install edge-tts                                   # kerran; lisäksi tarvitaan ffmpeg ja Node.js
python3 tools/make_voices.py                           # tekee vain puuttuvat ja muuttuneet
python3 tools/make_voices.py --force                   # kaikki uudelleen
python3 tools/make_voices.py --only praise-1,shahada-2 # vain nämä
python3 tools/make_voices.py --check                   # pelkkä tarkistus, ei verkkoa
```

Skripti tarvitsee nettiyhteyden (Microsoft Edge -puhepalvelu). Se tasoittaa äänenvoimakkuuden resitaation
tasolle ja kirjoittaa raportin tiedostoon `tools/voices.json`. Aja lopuksi `npm run build` uudelleen.
Vanhempi voi myös nauhoittaa omat äänensä asetuksissa. Ne tallentuvat vain laitteelle.

Resitaatiotiedostoja (`public/audio/0*.mp3`, `public/audio/1*.mp3`) ei tehdä uudelleen eikä muokata.

## Arabiankielisen tekstin tarkistus

```sh
npm run check:arabic
```

Komento vertaa tiedoston `src/content/data.js` arabiankielisiä rivejä tallennettuun Tanzil-tekstiin
(`tools/arabic-original.json`) ja epäonnistuu, jos yksikin merkki on muuttunut. Aja se aina ennen julkaisua.

## Kuvakkeet ja testit

- `node tools/make-icons.cjs` piirtää sovelluskuvakkeen (`ART.appIcon()` tiedostosta `src/art.js`)
  PNG-kuviksi kansioon `public/icons/`. Valinnainen `--preview kuva.png` piirtää tarkistuskuvan maskeilla.
  Skripti tarvitsee Playwrightin ja Chromiumin.
- `npx vite build --outDir ../build-pwa --emptyOutDir` ja sitten `node tools/pwa-test.cjs ../build-pwa`
  testaa service workerin, offline-tilan, Range-vastaukset, manifestin ja kuvakkeet. Testi ajetaan sekä
  juuressa että alikansiossa.
- `node tools/pwa-serve.cjs dist --port 5106 [--base /alikansio/]` on pieni testipalvelin, joka tukee
  Range-pyyntöjä.
- `npm run build` ja sitten `node tools/e2e.cjs dist` käy koko sovelluksen läpi Chromiumissa (noin 9 min):
  kaikki osiot ja vaiheet, minipelit, palkinnot, loppujuhlat, asetukset, äänitys, äänijärjestys, offline,
  näyttökoot 360–1024 px. Kuvakaappaukset menevät kansioon `../qa/screens/`, ja lopuksi tulostuu
  PASS/FAIL-taulukko (paluuarvo 1, jos jokin epäonnistuu). `--only flow-390x844,audio` ajaa vain osan.
- Muut testit: `tools/audio-test.cjs`, `tools/games-test.cjs`, `tools/art-shots.cjs`.

## Projektin rakenne

```
index.html                  sivun runko
src/main.js                 käynnistys, aloitusportti ja kulku
src/profiles.js             lapset, edistyminen ja asetukset (localStorage 'suuraseikkailu-v3'; v1/v2-tallennus siirtyy)
src/ui/                     näkymät, huurretausta ja vanhempien asetukset (settings.js)
src/audio/                  ääniputki: engine.js (jono, resitaatio, kehotteet), context.js,
                            recorder.js (omat äänitykset), tts.js (laitteen puhe varalla), sfx.js (efektit)
src/games/                  8 minipeliä ja niiden yhteinen kehys
src/fx.js                   kimallus-, konfetti- ja ilotulitusefektit
src/art.js                  kaikki kuvitus SVG-muodossa, myös sovelluskuvake
src/content/data.js         osiot ja rivit (arabia = Tanzil, muuttamaton)
src/content/prompts.js      suomenkieliset kehotteet ja äänitiedostojen nimet
src/styles/                 CSS: tokens, app, games, settings
src/pwa.js                  service workerin rekisteröinti
public/audio/               resitaatio (001001.mp3 …), Shahada ja audio/fi/ (opettajan äänet)
public/icons/               sovelluskuvakkeet (PNG)
public/manifest.webmanifest PWA-manifesti
vite.config.js              build-asetukset ja dist/sw.js:n generointi
tools/                      apuskriptit: make_voices.py, check-arabic.mjs, list-clips.mjs, make-icons.cjs,
                            pwa-sw.cjs (service workerin koodi), pwa-serve.cjs, pwa-test.cjs …
v1-reference/               versio 1 vertailua varten (ei mukana buildissa)
```

## Lähteet ja lisenssit

- **Koraanin teksti:** Tanzil Quran Text (Uthmani), © Tanzil Project, CC BY 3.0, https://tanzil.net.
  Tekstiä saa käyttää vain muuttamattomana, ja se on mukana muuttamattomana (tarkistus: `npm run check:arabic`).
- **Resitaatio:** Mishary Rashid Alafasy, jakeittaiset MP3-tiedostot (64 kbps). Haettu GitHub-repositoriosta
  Raf0707/q7h_alafasy. Tiedostot on nimetty EveryAyah-tavalla `SSSJJJ.mp3`, esimerkiksi `001001.mp3` on
  suura 1, jae 1.
- **Fontit:** Fredoka, Nunito ja Amiri Quran, Google Fonts, SIL Open Font License 1.1. Ne tulevat
  @fontsource-npm-paketeista ja ovat buildin mukana, joten niitä ei haeta netistä.
- **Opettajan äänet:** Microsoft Edge -puhesynteesi (`edge-tts`). Suomi: fi-FI-NooraNeural, arabia:
  ar-SA-ZariyahNeural. Äänet on tehty skriptillä `tools/make_voices.py`. Jos sovellusta jaetaan laajasti,
  tarkista Microsoftin palvelun käyttöehdot.
- **Kuvitus ja ääniefektit:** tämän projektin omaa työtä (SVG-kuvat ja Web Audiolla syntetisoidut efektit).
  Mukana ei ole Disneyn eikä muiden tahojen materiaalia.

Lähteet näkyvät myös sovelluksessa: **Vanhemmille** → *Lähteet ja lisenssit*.
