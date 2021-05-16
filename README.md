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
* Uporabnik lahko server požene samo na njegovem portu, kar se doseže z uporabo .env (PORT se poda pri zagonu kode na JOBE) - preverja se, ali koda vsebuje '.listen(process.env.PORT', drugače javi napako!
* Ogled strani direktno pri uporabniku v oknu pod datotekami


**CODE CHUNKS:**
* Naloge tipa `js` bodo morale imeti definiran `id` in `caption`. :heavy_check_mark:
* Če naloga tipa `js` ne bo imela definiranega `serverIP`, potem je lahko `caption` samo "app.js". :heavy_check_mark:
* Option `type` sprejme samo "js". :heavy_check_mark:
* Naloge, ki ne bodo tipa `js`, ne bodo smele imeti definiranega nobenega izmed novih OPTIONS (id, serverIP). :heavy_check_mark:
* Potrebno preveriti, da se caption ne podvaja pri type = "js" za isti "id".  **TODO**

* Kjer je v JS kodi 1 \, se doda še 1, da zadeva deluje v V8! Drugače nastane problem, ker R drugače obravnava escape znake kot JS.
* Dodane ustrezne datoteke za preverjanje pravilnosti kode v različnih jezikih (JS, CSS, HMTL) v ACE editorju. Poleg tega prilagojen tudi mode za ace editor, glede na ime datoteke oz. končnico imena datoteke.
* Dodani TAB-i za datoteke in prav tako za output, error in preview page za JS naloge.
* Preprečitev proženja custom autocompletitiona in diagnostics, kadar je mode različen od R.
* V Shiny server se pošlje koda, ki jo vpiše uporabnik. Če gre za JS nalogo in je server IP podan, potem se ta koda le shrani in se ne izvede s pomočjo V8 paketa. V primeru pa, da je naloga JS in server IP ni podan, pa se koda shrani in izvede na serverju z V8 paketom.
* Zaganjanje preprostega Express serverja mogoče le z uporabo PROCESS.ENV.PORT, ki se nato v JOBE serverju poda kot okoljska spremenljivka ob ukazu za zagon naloge.
* Dodaj možnost izbire med nekaj temami za ACE editor 

* Problem pri ESCAPE znakih pri izvajanju kode pri odjemalcu s paketom V8! --> ODPRAVLJENO!

* **Na Linux obvezna uporaba RAppArmor!**
* Paket je navarneje uporabljati na Linux, saj na drugih sistemih (Windows, Mac) ne moremo omejiti časa izvajanja za JS kodo, ampak lahko to storimo samo za R
* Tudi Linux sedaj uporablja `inline_evaluator`, ker sem odkril napake pri izvajanju `forked_evaluatorja`
* Za varnost potrebno na serverju, kjer je shiny (linux), vključiti RAppArmor --> https://rstudio.github.io/learnr/publishing.html#Exercise_Execution
* https://github.com/jeroen/RAppArmor#readme
* RAppArmor deluje le na Linux, lahko se omeji dostop do datotek, memory, disk
* eval.secure je bolje uporabiti kot pa setTimeout() in vse druge funkcije posebej. Pri setTimeout() se nekatere funkcije iz forttrama lahko vseeno izvajajo v nedogled
* Lahko bi uporabili funkcijo eval(), vendar ne vemo, ali je varno in ali lahko preprečimo infinite loop.
* Izvajanje direktno pri klientu ni smiselno, ker:
  * stran zmrzne pri klicu eval ali pa new Function
  * ni varno za odjemalca, saj si lahko ponesreči izbriše datoteke npr.

* Pri JS nalogah, se lahko parameter `exercise.completion` nastavi na FALSE, `exercise.diagnostics` pa je lahko FALSE le takrat, ko sta oba FALSE.


* Na Ubuntu je bilo treba namestiti knjižnjice:
  *   sudo apt-get install libv8-dev
  *   sudo apt-get install libssh2-1-dev libgit2-dev
* AppArmor:
  * https://github.com/jeroen/RAppArmor#readme

* Kako prenesti RAppArmor profile?
  * cd /home/ubuntu/R/x86_64-pc-linux-gnu-library/3.6/RAppArmor
  * sudo cp -Rf profiles/debian/* /etc/apparmor.d/
  * #Load the profiles into the kernel \n
    sudo service apparmor restart

* Ko želi uporabnik pognati server, se najprej preveri, ali je njegov port v uporabi. 
* Če je v uporabi, se za uporabnika, ki ga uporablja ustavi vse procese in požene nato.
* Tako preprečimo, da bi nek uporabnik preprečil drugemu uporabniku normalno uporabo dodeljenega porta.
* sudo lsof -n -i :{3000 | awk '{print $3}' | tail -n1

* Na JOBE serverju se logirajo zahteve in v primeru, da je zahteva prevelika, se jo zavrne in se ne logira vsebine

**JOBE:**
mysql -u root -p fuzbal00
CREATE DATABASE jobe;

CREATE USER 'jobe'@'localhost'IDENTIFIED BY 'jobePass10!';
GRANT ALL PRIVILEGES ON jobe.* TO 'jobe'@'localhost';


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

CREATE TABLE `logs` (
       `id` INT(11) NOT NULL AUTO_INCREMENT,
       `uri` VARCHAR(255) NOT NULL,
       `method` VARCHAR(6) NOT NULL,
       `params` MEDIUMTEXT DEFAULT NULL,
       `api_key` VARCHAR(40) NOT NULL,
       `ip_address` VARCHAR(45) NOT NULL,
       `time` INT(11) NOT NULL,
       `rtime` FLOAT DEFAULT NULL,
       `authorized` VARCHAR(1) NOT NULL,
       `response_code` smallint(3) DEFAULT '0',
       PRIMARY KEY (`id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8;


* Potrebno urediti, da se datoteke izbrišejo, če se zasede preveč prostora (uporabnikov ni potrebno izbrisati, ker se pri pošiljanju datoteke ponovno ustvari direktorij, če se le ta izbriše).
* Pri pošiljanju datotek, se preveri, ali direktorij že obstaja. Če ne obstaja, se ustvari direktorij.
* Na JOBE serverju nastavljena omejitev max izvajanja kode (če uporabnik slučajno želi kodo izvajati predolgo, se le to na JOBE serverju zazna in prepreči)
  
* **Potrebno odstraniti še nekaj kode v JOBE - LanguageTask.php**
***

* sudo apt install ufw
* sudo ufw default reject outgoing
* sudo sudo ufw allow in 22/tcp
* sudo ufw allow in 80
* sudo ufw enable

* https://github.com/zircote/swagger-php
* Mogoče bo potrebno zircote inštalirati preko dodatnega ukaza v Dockerfile (sicer je v composer.json, ampak ne vem, ali se to avtomatsko inštalira)
* Odstrani node_modules!

- POGLEJ, ZAKAJ VRNE HTML OB NAPAKI, ČE NI DATOTEKE GOR???

https://snyk.io/blog/10-docker-image-security-best-practices/

SWAGGER dostop s porta različnega od 80!!

sudo apt install composer
composer require zircote/swagger-php

 set NODE_PATH=your\directory\to\node_modules;%NODE_PATH%

 https://mastering-shiny.org/action-dynamic.html


 **SHINY - event-driven vs data-driven**
 /home/ubuntu/Desktop/lib/*.js r