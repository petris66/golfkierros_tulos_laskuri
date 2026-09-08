# GPS Green Workflow

Tämä ohje kuvaa, miten uusi kenttä lisätään Golf Voice Scorecard AI:n GPS Green Front / Center / Back -järjestelmään.

## 1. Lisää kenttä GPS Builderin valikkoon

Tiedosto:

`data/source/gps-builder-courses.json`

Lisää kentän `courseId` ja nimi, jotta kenttä näkyy GPS Builderissa.

Esimerkki:

```json
{
  "id": "stlaurence-kalkki-petteri",
  "name": "St. Laurence Golf – Kalkki-Petteri"
}
```

Huom: käytä samaa `courseId`:tä kaikissa projektin GPS-tiedostoissa.

## 2. Varmista kentän perustiedot / Course Library

Jos kenttä on kokonaan uusi, varmista että sen varsinainen kenttädata on mukana Course Libraryssa.

Siellä ovat mm.:

- reiät
- parit
- HCP:t
- tiit
- väyläpituudet

Jos kenttä on jo sovelluksessa ja lisäät vain GPS Green -datan, tätä ei yleensä tarvitse muuttaa.

## 3. Tee Green Front / Center / Back GPS Builderilla

Builder:

`tools/gps-builder.html`

Nykyinen toimiva Builder-versio:

`GPS Builder v0.8.3`

Builder v0.8.3 osaa:

- ladata valitun kentän tallennetun GPS Library -datan
- säilyttää kartan zoomin manuaalisen green-mappauksen aikana
- käyttää tallennettua Front / Center / Back -dataa uudelleen

Normaalisti Builderin HTML-koodia ei tarvitse muuttaa uuden kentän takia.

## 4. Tallenna varsinainen GPS-tiedosto

Tiedosto:

`data/gps/FI/<courseId>.json`

Esimerkki:

`data/gps/FI/stlaurence-kalkki-petteri.json`

Tiedostossa tulee olla 18 reiän Green Front / Center / Back -koordinaatit.

Tarkista ennen jatkoa:

- oikea `courseId`
- kaikki 18 reikää mukana
- Front / Center / Back ovat oikeilla rei'illä
- mahdollinen OSM-lähdetieto on järkevä

## 5. Lisää kenttä GPS-manifestiin

Tiedosto:

`data/gps/manifest.json`

Lisää uusi entry, joka osoittaa kentän GPS JSON -tiedostoon.

Esimerkki:

```json
{
  "courseId": "stlaurence-kalkki-petteri",
  "course": "St. Laurence Golf – Kalkki-Petteri",
  "country": "FI",
  "file": "FI/stlaurence-kalkki-petteri.json",
  "status": "pending",
  "holes": 18
}
```

Tämä vaihe on pakollinen, jotta tuloskorttisovellus löytää GPS-datan.

Jos manifest-entry puuttuu, sovellus voi näyttää esimerkiksi:

`GPS-kenttädata — Ei GPS dataa`

vaikka itse GPS JSON olisi oikein.

## 6. Testaa ennen committia

Suositeltu testijärjestys:

1. Avaa `tools/gps-builder.html` Live Serverillä.
2. Valitse uusi kenttä.
3. Tarkista, että Course Library latautuu oikein.
4. Tarkista, että GPS Library latautuu oikein, jos JSON on jo tallennettu.
5. Tarkista visuaalisesti greenien reikänumerot.
6. Zoomaa tiukasti yhteen greeniin ja tee yksi mapping-muutos / Aseta-testi.
7. Varmista, että zoomi pysyy paikallaan.
8. Avaa varsinainen tuloskorttisovellus.
9. Valitse kenttä ja käynnistä GPS.
10. Varmista, että Green Front / Center / Back -data löytyy.
11. Testaa tarvittaessa myös iPhonella / PWA:ssa.

## 7. Commit ja tag

Kun kaikki testit ovat läpäisseet:

- commitoi vain tarkoituksella muuttuneet tiedostot
- push GitHubiin
- testaa tarvittaessa Vercelin tuotantoversio
- tee tag vasta toimivan tuotantotestin jälkeen

## Pika-checklist uuden kentän GPS-griineihin

Yleensä muutettavat tiedostot ovat:

- `data/source/gps-builder-courses.json`
- `data/gps/FI/<courseId>.json`
- `data/gps/manifest.json`

Tarvittaessa lisäksi:

- kentän Course Library / perustietotiedosto, jos kenttä on kokonaan uusi

Normaalisti EI tarvitse muuttaa:

- `tools/gps-builder.html`
- `app.js`
- `index.html`
- `style.css`

ellei kyseessä ole uusi ominaisuus tai bugikorjaus.

## Toimiva referenssi

Hyvä referenssi uuden kentän lisäämiseen on St. Laurence Golf:

- `stlaurence-kalkki-petteri`
- `stlaurence-pyha-lauri`

Niiden avulla voi tarkistaa oikean GPS JSON- ja manifest-rakenteen.
