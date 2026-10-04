# Suuraseikkailu – korjaus- ja uudistuspyyntö

Tämä on työohje Claude Codelle (tai koodarille). Lue ensin tämä tiedosto, `README.md` ja projektin tiedostot. Tee lyhyt suunnitelma ja toteuta sitten vaiheittain järjestyksessä 1 → 3.

## Mikä sovellus on

Suuraseikkailu on suomenkielinen oppimispeli 4-vuotiaalle sunnimuslimiperheen lapselle. Lapsi opettelee ulkoa Shahadan ja kolme suuraa: Al-Fatihan, Al-Ikhlasin ja Al-Kawtharin.

Kulku (säilytä tämä):

1. Lapsi valitsee osion.
2. Sovellus soittaa rivin Mishary Alafasyn resitaationa ja näyttää arabiankielisen tekstin, suomalaisittain kirjoitetun ääntämisavun ja suomennoksen.
3. Lapsi sanoo rivin ääneen ja painaa isoa **Sanoin!**-nappia.
4. Tulee noin 15 sekunnin minipeli, sitten palkinto ja **Jatka**.
5. Ketjutus: vaihe 1 = rivi 1, vaihe 2 = rivit 1–2, vaihe 3 = rivit 1–3 ja niin edelleen, kunnes koko suura sanotaan. Lopuksi iso juhla ja tarra.
6. Jokainen suura alkaa Bismillahilla. Al-Fatihassa Bismillah on jae 1. Al-Ikhlasissa ja Al-Kawtharissa se on erillinen ensimmäinen rivi ilman jaenumeroa.

**Nykytila:** versio 1 on tehty yhdeksi HTML-sivuksi claude.ai-artefaktiksi. Ulkoasu on tumma iltataivas. Puhelimella äänet eivät toimi.

## Ehdottomat rajat

- **Arabiankielinen teksti** tiedostossa `data.js` on otettu sanatarkasti Tanzil-projektin Uthmani-tekstistä. Älä muokkaa, korjaa, normalisoi tai kirjoita sitä uudelleen. Näytä se fontilla, joka tukee Koraanin merkkejä (Amiri Quran).
- **Shahadan muoto:** *Ash-hadu an laa ilaaha illallaah, wa ash-hadu anna Muhammadan ‘abduhuu wa rasuuluh.*
- **Ei musiikkia.** Vain lyhyet ääniefektit (poksahdus, kilahdus, kimallus), resitaatio ja puhe. Ei taustamusiikkia eikä melodisia jinglejä.
- **Ei hahmoja:** ei kasvoja, ihmisiä, eläimiä tai olentoja, ei myöskään prinsessahahmoa. Prinsessatunnelma tehdään esineillä: kruunut, tiarat, jääpalatsi, lumihiutaleet, kristallit, jalokivet, kuplat ja kimallus.
- **Ei Disneyn materiaalia.** "Frozen" tarkoittaa tässä vain väritunnelmaa. Älä käytä Frozen- tai Disney-nimiä, -hahmoja, -logoja, -fontteja, -kuvia tai -kappaleita. Kaikki kuvitus on omaa.
- **Käyttöliittymä suomeksi**, lyhyesti ja lämpimästi. Vanhempi lukee tekstit, lapsi kuuntelee ja napauttaa.
- **Säilytä nykyiset ominaisuudet:** vanhempien asetukset pitkällä painalluksella, lapsen nimi kehuissa, hidas resitaatio, minipeli joka vaiheen tai joka toisen vaiheen jälkeen, tähdet, tarrat ja edistymisen tallennus laitteelle.

## 1. Korjaa äänet (tärkein)

### Oire

Puhelimella resitaatio, ääniefektit ja puhe eivät kuulu tai kuuluvat vain osittain.

### Todennäköiset syyt

- **Artefaktin hiekkalaatikko.** claude.ai-artefakti pyörii lukitussa kehyksessä. Sen tiukka sisältöturvakäytäntö voi estää `<audio>`-toiston, ja Clauden sovelluksen sisäinen selain voi estää puhesynteesin.
- **iOS:n säännöt.** Ääni käynnistyy vain käyttäjän napautuksesta. Web Audio vaikenee, kun äänetön-kytkin on päällä, ellei `navigator.audioSession.type = 'playback'` ole asetettu (iOS 17+).
- **Puhesynteesi (`speechSynthesis`) on epäluotettava.** Laitteesta voi puuttua suomen tai arabian ääni, iOS vaatii ensimmäisen puheen napautuksen sisällä, ja Androidilla äänet latautuvat viiveellä.

Nykyinen toteutus `index.html`:ssä: resitaatio soi yhdellä uudelleenkäytettävällä `HTMLAudioElement`illa (funktiot `playFile`, `playLine`, `playChain`, `runChain`), puhe `speechSynthesis`illä (`speak`, `speakFi`). Ääniefektit tulevat `games.js`:n `SFX`-oliosta (syntetisoitu Web Audiolla).

### Vaatimukset

1. **Irrota sovellus artefaktista.** Tee tavallinen staattinen web-sovellus (esim. Vite ja tavallinen JavaScript, ei raskasta frameworkia), joka julkaistaan HTTPS-osoitteeseen (Netlify, Vercel, Cloudflare Pages tai GitHub Pages). Ei riippuvuutta claude.ai:sta.
2. **PWA.** Manifest, kuvake ja service worker, joka tallentaa sivun ja kaikki MP3:t välimuistiin. Peli toimii lapsen tabletilla myös ilman nettiä, ja sen voi lisätä kotivalikkoon.
3. **Aloitusportti.** Ensimmäinen ruutu on iso kimaltava **Aloita**-kupla. Sen napautus avaa äänen lukituksen kaikille kanaville: `AudioContext.resume()`, resitaatiosoitin ja puhe. Näytä portti uudelleen, jos sovellus palaa taustalta ja ääni on lukittunut.
4. **Resitaatio.** Yksi selkeä audioputki ja yksi ääni kerrallaan (jono). Suositus: `HTMLAudioElement`, koska se soi iOS:ssa myös äänetön-kytkin päällä. Varalla Web Audio (`fetch` → `decodeAudioData`), jos `play()` hylätään. Hidas tila: `playbackRate = 0.8` ja `preservesPitch = true`.
5. **Shahadalle oikea ihmisääni.** Shahadaan ei ole resitoijan tallennetta. Lisää vanhempien asetuksiin **Nauhoita oma ääni** (`MediaRecorder` → IndexedDB) kummallekin Shahadan riville. Jos tiedostot `audio/shahada-1.mp3` ja `audio/shahada-2.mp3` ovat olemassa, käytä niitä. Laitteen puheääni on vasta viimeinen vara.
6. **Suomenkieliset kehotteet** ("Nyt sinun vuorosi!", kehut, pelien nimet): älä luota pelkkään puhesynteesiin. Tue valmiita äänitiedostoja (`audio/fi/*.mp3`) ja omaa nauhoitusta samalla tavalla kuin Shahadassa. Puhesynteesi on varalla. Näytä kehote aina myös tekstinä ja animaationa.
7. **Ääniefektit** ovat hiljaisempia kuin resitaatio eivätkä koskaan soi resitaation päällä.
8. **Testaa äänet -paneeli** vanhempien asetuksiin: napit resitaatiolle, efektille, suomen puheelle ja arabian puheelle sekä näkyvä tila, esim. "MP3: OK", "AudioContext: running", "Virhe: NotAllowedError" tai "Suomen puheääni: ei löytynyt".

### Hyväksyntä

Testaa oikeilla laitteilla, ei vain työpöytäselaimella:

- iPhone Safari, äänetön-kytkin päällä ja pois
- iPad Safari, myös kotivalikkoon lisättynä
- Android Chrome
- työpöydän Chrome

Jokaisella laitteella:

- ensimmäinen napautus avaa äänen
- Al-Fatihan ketju 1–7 soi oikeassa järjestyksessä ilman päällekkäisyyttä
- **Kuuntele** aloittaa alusta ja **Sanoin!** katkaisee toiston
- minipelien efektit kuuluvat
- ääni toimii, kun sovellus palaa taustalta

## 2. Uusi ulkoasu: vaalea, kupliva jääprinsessa

### Tunnelma

Vaalea, kirkas ja todella kupliva, kuin talvinen satulinna: huurteinen sininen, lila ja hopea, kimallusta ja kuplia kaikkialla. Lapsen pitää haluta koskea kaikkeen. Arabiankielinen teksti pysyy silti selkeänä ja arvokkaana: se näytetään rauhallisella, vaalealla kortilla, eikä sen päälle tule koristeita.

### Väripaletti (oma, ehdotus)

| Rooli | Väri |
|---|---|
| Tausta, lumi | `#F6FBFF` |
| Huurre, pinnat | `#E4F3FF` |
| Jää | `#BFE6FF` |
| Jäätikkö, korostus | `#7FD3F2` |
| Safiiri, napit | `#2F6FE0` |
| Tumma teksti | `#23306B` |
| Lila | `#C8B6FF` |
| Orkidea, korostus | `#B45FE0` |
| Ruusu, pieni korostus | `#FF9FD6` |
| Hopea, reunat | `#DCE7F3` |

Osioiden värit: Shahada turkoosi `#33C3D6`, Al-Fatiha lila `#9A7BFF`, Al-Ikhlas ruusu `#FF8BC8`, Al-Kawthar safiiri `#4A86FF`. Tarkista kontrasti: leipätekstille vähintään 4.5:1, ja vaaleilla pinnoilla käytetään tummaa tekstiä.

### Elementit

- **Kuplanapit:** pyöreät ja kiiltävät, valoheijastus, pehmeä varjo ja hyytelömäinen painallus (litistyy ja pomppaa takaisin).
- **Tausta:** pehmeä huurregradientti, nousevia läpikuultavia kuplia, leijuvia lumihiutaleita ja kimalluksia. Alareunassa jääpalatsin siluetti; palatsissa voi olla kupoleita ja puolikuita, jolloin se sopii myös islamilaiseen teemaan.
- **Koristeet:** kruunut, tiarat, jalokivet ja kristallit. Nykyinen 8-sakarainen tähti toimii jääkiteenä.
- **Osiokortit:** isot kupla- tai jalokivikortit. Valmis osio saa tiaran tai kruunun.
- **Palkinnot:** jalokivi kruunuun jokaisesta vaiheesta ja tarra-albumi (tiarat, kristallit, palatsin osat). Edistyminen näkyy kuvana, esimerkiksi jääpalatsin ikkunat syttyvät vaihe kerrallaan.
- **Fontit:** pyöreä ja kupliva otsikkofontti (esim. Fredoka tai Baloo 2), luettava leipätekstifontti (Nunito tai Andika) ja arabialle Amiri Quran.
- **Liike:** kaikki reagoi kosketukseen pompulla, kimalluksella ja pienellä äänellä. Kunnioita `prefers-reduced-motion`-asetusta.

### Lapsen huomio

- Yksi iso ja selvä toiminto kerrallaan. **Sanoin!** on suurin ja kimaltavin kupla, ja se sykkii, kun on lapsen vuoro.
- Vähän tekstiä. Ohjeet tulevat äänenä ja animaationa.
- Napautusalueet vähintään 64 px, eikä mikään rankaise väärästä napautuksesta.

### Minipelit uuteen teemaan

Pelit ovat tiedostossa `games.js` (6 kpl). Uudet värit ja kuvitus:

- Ilmapallot → jääpastelliset, kimaltavat ilmapallot
- Tähtisade → lumihiutalesade
- Kuplat → säilyy sellaisenaan, sopii teemaan
- Lyhdyt → kristallilyhdyt tai jääpalatsin ikkunat
- Hedelmäkori → kimalteleva kori, hedelmät säilyvät (taateli, viinirypäle, granaattiomena, viikuna, oliivi)
- Ilotulitus → kimallus- ja revontuli-ilotulitus

Lisää kaksi uutta peliä: **Koristele kruunu** (napautetut jalokivet lentävät kruunuun) ja **Sytytä palatsin valot**. Kesto 10–20 sekuntia, isot osuma-alueet, ei häviämistä.

## 3. Muut korjaukset ja laadunvarmistus

- Käy koko kulku läpi kaikissa osioissa: koti → osio → jokainen vaihe → minipeli → palkinto → loppujuhla → tarra.
- Tarkista vaihepallot, kertaus valmiissa osiossa, **Uudestaan** ja nollaus vahvistuksineen.
- Ei vaakavieritystä 360–1024 px leveyksillä, ja iPhonen safe area -marginaalit toimivat.
- Edistyminen säilyy, kun sovellus suljetaan ja avataan uudelleen.
- Konsolissa ei ole virheitä.

## Lähteet ja lisenssit

Pidä nämä näkyvissä vanhempien asetuksissa:

- Koraanin teksti: Tanzil Quran Text (Uthmani), © Tanzil Project, CC BY 3.0, tanzil.net. Tekstiä saa käyttää vain muuttamattomana.
- Resitaatio: Mishary Rashid Alafasy, jakeittaiset MP3-tiedostot (64 kbps), haettu GitHub-repositoriosta Raf0707/q7h_alafasy (EveryAyah-nimeäminen).
- Fontit: Google Fonts (SIL Open Font License).

## Toimita takaisin

- julkaistu osoite ja lähdekoodi
- lyhyt testiraportti laitteittain: mikä toimii ja mikä ei
