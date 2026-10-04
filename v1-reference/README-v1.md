# Suuraseikkailu – projektitiedostot (versio 1)

Lasten oppimispeli: Shahada, Al-Fatiha, Al-Ikhlas ja Al-Kawthar rivi kerrallaan, oikealla resitaatiolla ja minipeleillä. Seuraavan kierroksen tehtävä on tiedostossa `KORJAUSPYYNTO.md`.

Uusi versio saa vapaasti korvata tämän rakenteen, esimerkiksi Vite-projektilla. Sisältö (`data.js`) ja äänet (`audio/`) siirretään sellaisenaan.

## Tiedostot

| Tiedosto | Sisältö |
|---|---|
| `KORJAUSPYYNTO.md` | Seuraavan kierroksen tehtävä: äänten korjaus ja uusi ulkoasu |
| `index.html` | Sovelluksen runko: tyylit, näkymät, kulku, resitaatio, puhe ja asetukset. Sisältää paikkamerkit moduuleille. |
| `data.js` | Sisältö: osiot, arabiankielinen teksti (Tanzil, älä muokkaa), ääntämisapu, suomennokset ja äänitiedostojen polut. Asettaa `window.SUURA_DATA`. |
| `art.js` | SVG-kuvitus: ikonit, kuviotausta, siluetti, tarrat, jaemerkit ja palkintotähti. Asettaa `window.ART`. |
| `games.js`, `games.css` | Kuusi minipeliä, syntetisoidut ääniefektit ja partikkeliefektit. Asettaa `window.MiniGames`, `window.SFX` ja `window.FX`. |
| `audio/` | 14 MP3-tiedostoa: Al-Fatiha `001001`–`001007`, Al-Kawthar `108001`–`108003`, Al-Ikhlas `112001`–`112004`. Bismillah käyttää tiedostoa `001001`. |
| `build.py` | Kokoaa moduulit tiedostoon `dist/index.html` ja kopioi äänet kansioon `dist/audio/`. |
| `dist/` | Versio 1 koottuna, sellaisena kuin se julkaistiin artefaktina. |
| `art-test.html`, `games-test.html` | Erilliset testisivut kuvitukselle ja minipeleille. |

## Ajaminen paikallisesti

```bash
python3 build.py
cd dist
python3 -m http.server 8000
```

Avaa sitten `http://localhost:8000`. Puhelimella testaamiseen ja mikrofonin tai service workerin käyttöön tarvitaan HTTPS-osoite, joten julkaise testiversio esimerkiksi Netlifyyn tai Verceliin.

## Moduulien rajapinnat

```js
window.SUURA_DATA = {
  sections: [{ id, name, ar, sub, acc, color, quran,
               lines: [{ ar, tr, fi, audio, n, tts? }] }],
  credits
}
// n = jaenumero (0 = ei jaemerkkiä), audio = null Shahadassa, tts = arabia puheäänelle

window.ART.icon(name, className)   // 'home','play','star','speech','gear','close','check','replay','back','sound'
window.ART.patternURL() / skyline() / emblem() / medal(id, earned) / ayah(n) / rewardStar() / arabicDigits(n) / starPath(...)

window.SFX.unlock() / setEnabled(bool) / pop() / ding(i) / chime(i) / plop() / whoosh() / boom() / sparkle() / success() / tap()
window.FX.burst(x, y, colors, n) / sparkle(x, y) / confetti(n) / firework(x, y, hue) / rocket(x0, y0, x1, y1, onArrive) / show(ms) / clear()
window.MiniGames.play({ index, onDone, say })  // palauttaa { abort() }
```

## Tallennus

`localStorage`-avain `suuraseikkailu-v1`:

```js
{ progress: { shahada, fatiha, ikhlas, kawthar }, done: {}, stars, name,
  speech, slow, translit, sfx, every, game }
```
