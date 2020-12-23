- Potrebno urediti, da se pri preverjanju prostega porta, preveri, če uporabnik slučajno že ima port!
- Ko uporabnik pošlje datoteko, se preveri, če je to prva datoteka (nekje na strani se nevidno shrani naključna vrednost, port je izpisan) in še enkrat se preveri, če je dodeljeni PORT še prost. Če ni, se ga obvesti z odgovorom.
- ALTERNATIVA: Ko uporabnik pošlje datoteko, se preveri, ali port in naključna vrednost predstavljata ime mape na serverju! 
    - Če mapa obstaja je OK
    - Če mapa ne obstaja, obstaja pa mapa s tem PORT-om, je port zaseden
    - v funkcijo za preverjanje prostega porta se doda port in naključna vrednost, da se s to funkcijo preveri, ali obstaja ta mapa. Da se uporabniku ne dodeli dveh portov. - To se sicer lahko prepreči tudi v LearnNodejs, kjer se v primeru, da ima uporabnik na strani izpisan, kater port je njegov, zahteva ne pošlje!

- FUnkcija za preverjanje porta na sandbox-u ustvari mapo, da se rezervira PORT.




- mogoče bi pri uporabniku hranili, kdaj je rezerviral PORT, da se ve, ali še obstaja...ker se po 1h izbriše (to še ni nujna zadeva).
- Ko uporabnik, pošlje datoteko, mora mapa ŽE OBSTAJATI, drugače nima rezeriranega PORT-a in mora ponovno rezervirati PORT!!!!!!!!! 

- CAPTION imajo vse datoteke za isti exercise ISTI :heavy_check_mark:
- LABEL pa je sestavljen {ID}-CAPTION :heavy_check_mark:


CREATE DATABASE jobe;

 CREATE TABLE `keys` (
       `id` INT(11) NOT NULL AUTO_INCREMENT,
       `user_id` INT(11) NOT NULL,
       `key` VARCHAR(40) NOT NULL,
       `level` INT(2) NOT NULL,
       `ignore_limits` TINYINT(1) NOT NULL DEFAULT '0',
       `is_private_key` TINYINT(1)  NOT NULL DEFAULT '0',
       `ip_addresses` TEXT NULL DEFAULT NULL,
       `date_created` INT(11) NOT NULL,
       PRIMARY KEY (`id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO jobe.keys (`user_id`, `key`, `level`, `date_created`) values (123456, "dcc9a835-9750-4725-af5b-2c839908f71", 1, 1234567);

GRANT ALL PRIVILEGES ON jobe.* TO 'jobe'@'localhost' IDENTIFIED BY 'jobePass10!';
CREATE USER 'jobe'@'localhost';
