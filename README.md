# Golf Voice Scorecard AI

Projektirakenne:

- `index.html` – sivun rakenne
- `style.css` – ulkoasu
- `app.js` – toiminnallisuus
- `manifest.webmanifest` – web-sovelluksen asetukset
- `icons/` – kaikki kuvakkeet
- `images/` – tulevat kuvat
- `backup/` – omat varmuuskopiot

Lataa GitHub-repositorion juureen kaikki tämän paketin kansiot ja tiedostot.


## v3.3

- Pelaajien P1–P4 ovat nyt paikkamerkkejä eivätkä varsinaista tekstiä.
- Pelaajan nimen kirjoittaminen ei enää muodosta esimerkiksi `PeteP1`.
- Vanhoista selaintallennuksista ladatut P1–P4-oletusnimet käsitellään automaattisesti tyhjinä.


## v3.4

- Äänikanava alustetaan heti puhepainikkeen napautuksesta.
- Äänikuittaus käynnistyy vasta mikrofonin vapautumisen jälkeen.
- iOS/PWA-puhesynteesille lisättiin `resume()`-varmistus.
- Tallennettu reikä vieritetään heti näkyviin ja korostetaan hetkeksi.
- `style.css`- ja `app.js`-viittauksiin lisättiin välimuistin ohittava versio `v=3.4`.


## v3.4.1

- Pelitilanteen suomenkielinen ilmaisu korjattu:
  - `yhdellä lyönnillä`
  - `kahdella lyönnillä`
  - `kolmella lyönnillä` jne.
- Tasatilanteen takana olevien pelaajien erot ilmaistaan luonnollisemmin suomeksi.
- Välimuistiversio päivitetty arvoon `3.4.1`.


## v3.5.0

- Tallennettu reikä vieritetään näkyviin puhekirjauskortin alapuolelle.
- Etuysin jälkeen ilmoitetaan jokaisen pelaajan etuysin lyöntimäärä sekä näytöllä että puheella.
- Reiän 18 jälkeen ilmoitetaan kierroksen voittaja ja voittotulos.
- Tasatuloksessa ilmoitetaan kaikki voittajat.
- DNF-pelaajat huomioidaan loppuilmoituksessa.
- Viivat säilyvät oikein tallennetussa kierroshistoriassa.
- `style.css`- ja `app.js`-välimuistiversio päivitetty arvoon `3.5.0`.


## v3.5.1

- Poistettu automaattinen vieritys tallennetun reiän jälkeen.
- Poistettu automaattinen vieritys takaysille etuysin valmistuttua.
- Tallennettu reikä korostuu edelleen hetkeksi vihreällä.
- Poistettu puhekirjauksen esimerkkirivi.
- Välimuistiversio päivitetty arvoon `3.5.1`.


## v3.6.0 – mobiilin kierrosnäkymä

- Puhekirjauskortti pienenee automaattisesti ensimmäisen tallennetun reiän jälkeen.
- Kierroksen aloitusotsikko, pelaajamäärän valinta ja suuri seuraavan reiän kortti piilotetaan kierroksen ajaksi.
- Seuraavan reiän numero näkyy pienessä puhekirjauskortissa.
- Pelitilanteen valinta ja viivan merkitseminen ovat samalla rivillä.
- Tuloskortti käyttää puhelimessa pienempiä rivejä, soluja ja fontteja.
- Kierroksen aikana näytetään vain pelattava ysi: reiät 1–9 tai 10–18.
- Aloita uusi kierros palauttaa etuysin näkyviin ja vierittää sovelluksen takaisin alkuun.
- Välimuistiversio päivitetty arvoon `3.6.0`.


## v3.7.0 – pystymallinen tuloskortin jako

- Tallennettu kierros jaetaan nyt pystymallisena PNG-tuloskorttina.
- Jakokuvassa näkyvät kenttä, päivämäärä, pelimuoto ja mahdolliset huomautukset.
- Yläosassa on pelaajakohtainen etuysi-, takaysi- ja kokonaistulos.
- Varsinaisessa tuloskortissa näkyvät kaikki reiät 1–18 sekä etuysi, takaysi ja yhteensä.
- Voittaja ja voittomarginaali korostetaan.
- Tasatuloksessa ilmoitetaan tasatulos sekä huomautus, ettei tasoituksia ole huomioitu.
- iPhonessa kuva lähetetään suoraan järjestelmän jakovalikkoon.
- Jos kuvan jakamista ei tueta, PNG tallennetaan ladattavaksi.
- Välimuistiversio päivitetty arvoon `3.7.0`.


## v3.7.1 – selainriippumaton mobiiliskaalaus

- Tuloskortin leveys sidottu varmasti selainikkunan leveyteen.
- Korjattu Edge- ja Chrome-mobiilin vaakasuuntainen ylivuoto.
- Pelaajanimet skaalautuvat ja katkeavat hallitusti hyvin kapealla näytöllä.
- Numerokentät säilyvät selkeinä myös pienessä näkymässä.
- Lisätty Safari-, Edge- ja Chrome-yhteensopiva tekstin skaalaus.
- Huomioitu iPhonen safe area -reunukset.
- Jakokortin toiminnallisuuteen ei tehty muutoksia.
- Välimuistiversio päivitetty arvoon `3.7.2`.


## v3.7.2 – Field Test Edition

- Aloitusnäkymään lisätty tekijätieto `© 2026 Petri Suokas`.
- Jaettavaan PNG-tuloskorttiin lisätty allekirjoitus `Petri Suokas / AI Golf Apps`.
- Lisätty kevyt Tietoja sovelluksesta -osio ja yhtenäinen AI Golf Apps -tekijätunniste.
- Sovellusikonin sisältöä suurennettu ja vaalea ulkoreunus poistettu iOS-kotinäyttöä varten.
- PWA-manifestiin lisätty sovelluksen tunniste, laajuus, kieli ja pystysuunnan oletus.
- Ikonit käyttävät uusia 3.7.2-tiedostonimiä, jotta iOS ei näyttäisi välimuistissa olevaa vanhaa ikonia.

### iPhone-päivitys

Poista vanha kotinäytön kuvake ja lisää sovellus Safari-valikosta uudelleen, jotta uusi ikoni varmasti päivittyy. Tallennetut kierrokset säilyvät, kun sivuston selaintietoja ei poisteta.


## v3.7.3 – iPhone scaling bug fix

- Korjattu iOS Safarin automaattinen zoomaus, joka saattoi jäädä päälle, kun pelaajan nimeä muokattiin kierroksen aikana.
- Pelaajan nimi- ja tuloskentät käyttävät mobiilissa vähintään 16 px fonttikokoa, jolloin Safari ei muuta sivun mittakaavaa kentän fokusoinnin yhteydessä.
- Sovelluksen muu toiminnallisuus ja v3.7.2-kuvakkeet säilyvät ennallaan.


## v3.7.4 – Neutral shared scorecard

- Jaettavasta PNG-tuloskortista poistettiin voittaja- ja tasatulososio.
- Jaettava kuva sisältää nyt vain kierroksen tiedot ja varsinaisen tuloskortin.
- Sovelluksen kierroksen aikainen voittajan ilmoitus säilyy ennallaan.
- Jakokuvan korkeutta tiivistettiin poistuneen yhteenveto-osion verran.
