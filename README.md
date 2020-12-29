- Funkcija za preverjanje porta na sandbox-u ustvari mapo, da se rezervira PORT.




- mogoče bi pri uporabniku hranili, kdaj je rezerviral PORT, da se ve, ali še obstaja...ker se po 1h izbriše (to še ni nujna zadeva).
- Ko uporabnik, pošlje datoteko, mora mapa ŽE OBSTAJATI, drugače nima rezeriranega PORT-a in mora ponovno rezervirati PORT!!!!!!!!! 

- CAPTION predstavlja IME DATOTEKE :heavy_check_mark:
- LABEL pa je poljuben in se ne uporablja nikjer :heavy_check_mark:

**SPREMEMBE:**
* Novi options v chunkih:
    * `exercise.type`: tip naloge (js, r), če ni navedeno se privzame kot da gre za "r"
    * `exercise.serverIP`: predstavlja IP JOBE serverja, če je prazen se predpostavlja izvajanje pri odjemalcu
    * `exercise.id`: predstavlja IME NALOGE
    * exercise.caption: predstavlja IME DATOTEKE
* Datoteke so razdeljene v zavihke, omogoča poljubno število datotek, vse datoteke, ki pripadajo ISTI NALOGI, morajo imeti isti `exercise.id`
* Omogoča dodajanje API KEY-a v input field. Ko se izpolni input, se API KEY shrani v local storage in napolni vse druge inpute. Ko se stran naloži, se preveri, ali v local storage obstaja API KEY in se ga vstavi v inpute.



**CODE CHUNKS:**
* Naloge tipa `js` bodo morale imeti definiran `id` in `caption`. :heavy_check_mark:
* Če naloga tipa `js` ne bo imela definiranega `serverIP`, potem je lahko `caption` samo "app.js". :heavy_check_mark:
* Option `type` sprejme samo "js". :heavy_check_mark:
* Naloge, ki ne bodo tipa `js`, ne bodo smele imeti definiranega nobenega izmed novih OPTIONS (id, serverIP). :heavy_check_mark:
* Potrebno preveriti, da se caption ne podvaja pri type = "js" za isti "id". 





**JOBE:**
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

