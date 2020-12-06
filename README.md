- Potrebno urediti, da se pri preverjanju prostega porta, preveri, če uporabnik slučajno že ima port!
- Ko uporabnik pošlje datoteko, se preveri, če je to prva datoteka (nekje na strani se nevidno shrani naključna vrednost, port je izpisan) in še enkrat se preveri, če je dodeljeni PORT še prost. Če ni, se ga obvesti z odgovorom.
- ALTERNATIVA: Ko uporabnik pošlje datoteko, se preveri, ali port in naključna vrednost predstavljata ime mape na serverju! 
    - Če mapa obstaja je OK
    - Če mapa ne obstaja, obstaja pa mapa s tem PORT-om, je port zaseden
    - v funkcijo za preverjanje prostega porta se doda port in naključna vrednost, da se s to funkcijo preveri, ali obstaja ta mapa. Da se uporabniku ne dodeli dveh portov. - To se sicer lahko prepreči tudi v LearnNodejs, kjer se v primeru, da ima uporabnik na strani izpisan, kater port je njegov, zahteva ne pošlje!

- FUnkcija za preverjanje porta na sandbox-u ustvari mapo, da se rezervira PORT.




- mogoče bi pri uporabniku hranili, kdaj je rezerviral PORT, da se ve, ali še obstaja...ker se po 1h izbriše (to še ni nujna zadeva).
- Ko uporabnik, pošlje datoteko, mora mapa ŽE OBSTAJATI, drugače nima rezeriranega PORT-a in mora ponovno rezervirati PORT!!!!!!!!! 
