# Changelog

Všechny významné změny v aplikaci zapisujte sem. Nové záznamy patří nahoru.

Formát:

```text
## YYYY-MM-DD

### Oblast
- Co se změnilo a proč.
- Které části aplikace se to týká.
```

## 2026-09-01

### Schvalování práce pro více vedoucích
- Každá pracovní činnost má nově hlavního vedoucího zaměstnance a volitelného vedoucího činnosti, pokud zaměstnanec pracoval pro někoho jiného.
- Hlavní vedoucí zůstává finálním schvalovatelem; u práce pro jiného vedoucího lze finální schválení provést až po potvrzení konkrétní činnosti.
- Běžný výkaz pro vlastního vedoucího zůstává jednokrokový, takže dosavadní pracovní postup se zaměstnancům ani vedoucím nekomplikuje.
- Formulář výkazu má skrytou volbu `Práce pro jiného vedoucího` s vyhledáním podle jména nebo střediska.
- Schvalovací přehled i detail ukazují, kdo má potvrdit činnost, kdo provede finální schválení a která část už je hotová.
- Přístup k novým výkazům se řídí konkrétním přiřazením vedoucích; původní výkazy jsou při migraci bezpečně přiřazené dosavadnímu hlavnímu vedoucímu.
- Přibyly testy přístupu napříč středisky, pořadí obou schválení a zachování jednokrokového schválení pro běžné výkazy.
- README nově popisuje stejný dvoustupňový schvalovací model jako aplikace, aby další úpravy nevycházely ze starého pravidla podle cílového střediska.

## 2026-08-30

### Bezpečnostní opravy výkazů
- Schvalování už nepřijímá libovolný stav z klienta a dovolí měnit jen výkazy ve stavu `Ke schválení`.
- Backend serializuje ukládání výkazů stejného uživatele pro stejný den, aby souběžné odeslání neobešlo kontrolu překryvu času.
- Backend odmítá uložit pozemky u výkazů mimo středisko `Rostlinná výroba`.
- Schvalovací detail při uložení návštěvy doktora zachová čas od-do.
- Pracovníci přes API přípojných zařízení nedostávají interní označení, schvalovatelé a admini ano.
- Frontend přešel na `react-router-dom` 7.18.3, aby produkční audit závislostí nehlásil známé zranitelnosti routeru.

## 2026-08-28

### Přípojná zařízení a technika
- Formulář výkazu nově řadí naposledy použité stroje, typy práce a přípojná zařízení nahoru v běžném seznamu i ve výsledcích hledání.
- Admin číselníky mají novou samostatnou záložku `Přípojná zařízení` s úpravou interního označení, názvu a SPZ.
- Automatický sync základního seznamu přípojných zařízení při startu doplňuje jen chybějící položky, aby pozdější admin úpravy nepřepsal deploy.
- Stroje a technika jsou ve výkazu dostupné pro všechna střediska bez filtrování podle zvoleného střediska.
- Přípojná zařízení mají nový číselník z přiloženého Excelu; starý pevný frontend seznam byl nahrazen 94 položkami.
- Pracovník při zadávání výkazu vidí u přípojného zařízení jen název a případně SPZ, schvalovatel v detailu vidí i interní označení.
- Výběr přípojného zařízení ve výkazu má hledání podle názvu, SPZ i interního označení, ale interní označení se pracovníkovi nezobrazuje.
- Přihlašovací pole je výslovně textové přihlašovací jméno, aby prohlížeč nevyžadoval e-mailový zavináč.
- Opravena návaznost databázové migrace přípojných zařízení na skutečné Alembic revision id.

### Roští kompatibilita
- Přidán závazný dokument `docs/ROSTI_COMPATIBILITY.md` s pravidly pro Docker Stack, databázi, zálohy, proměnné prostředí a budoucí změny infrastruktury.
- Produkční Node, Python a PostgreSQL image jsou pinované digestem, aby se samovolně neměnily při buildu nebo deployi.
- Přidána kontrola `scripts/check-rosti-compat.mjs`, která před nasazením hlídá kompatibilitu s Roští a ochranu citlivých přihlašovacích souborů.
- README a pravidla pro další úpravy nově vyžadují kontrolu Roští kompatibility před deployem a chrání `backups` při nahrávání stacku.

### Ostrý provoz a schvalování
- Přidán kontrolní účet `tomas.zika` s administrátorským přístupem a možností přepnout se do pracovního profilu.
- Do speciálních typů výkazů pod `Ostatní` přibylo `Darování krve` jako celodenní absence.
- Jana Bulíčková / Jana Bobulová má omezený režim pouze pro čtení schválených výkazů napříč všemi středisky.
- Výběr pozemků při vytváření výkazu se zobrazuje jen pro středisko `Rostlinná výroba`.
- Schvalování zobrazuje výkazy seskupené podle zaměstnance a pracovního dne, aby šel celý den zkontrolovat v jednom přehledu.

## 2026-08-26

### Ostré přihlášení a nový číselník prací
- Přihlášení v live režimu používá přihlašovací jméno a heslo bez demo účtů na obrazovce.
- Produkční seed umí načíst uživatele, střediska, vedoucí a hesla ze souboru `Přihlašovací údaje.xlsx`.
- Token přihlášení má delší platnost, aby uživatel zůstal přihlášený až do vlastního odhlášení.
- Číselník typů práce je aktualizovaný podle nového ostrého seznamu a ve formuláři jde živě filtrovat.
- Viditelné popisky uživatelských úrovní byly odstraněné z přihlášení, hlavičky i organizace.

### Mobilní formulář a technika
- Formulář výkazu má v části `Technika` živé hledání podle názvu, SPZ i typu stroje.
- Výběr techniky nově nabízí první volbu `Bez techniky`, aby šel uložit výkaz bez stroje.
- Výsledky hledání pozemků ukazují místo DPB výměru v hektarech.
- Mobilní hlavička zkracuje dlouhé jméno uživatele bez zvětšení výšky hlavičky.
- Mobilní spodní navigace se při psaní do vyhledávání schová, aby nepřekrývala výsledky a klávesnici.

### Výkazy, absence a archiv
- Výběr pozemků ve formuláři i schvalovacím detailu má živé výsledky hledání přímo pod polem, takže není nutné otevírat rozbalovací seznam.
- Speciální volby `Dovolená`, `Školení` a nový typ `Doktor` jsou schované pod rozklikávacím přepínačem `Ostatní`.
- Typ `Doktor` podporuje 4 hodiny s automatickým koncem podle začátku nebo 8 hodin jako celý den `07:00-15:00`.
- Frontend i backend brání uložení překrývajících se výkazů stejného uživatele ve stejném čase.
- Admin navigace má novou stránku `Archiv`, která zobrazuje auditní historii včetně obsahu a období platnosti záznamu.
- Mobilní navigace schvalovatele nechává jen `Ke schválení`; výkaz z přehledu vedoucího jde otevřít přímo do detailu schválení.

### Schvalování a dashboard
- Schvalovatel může v detailu výkazu před schválením doplnit, vyhledat nebo odebrat více pozemků a uložit správný součet hektarů.
- Ve schvalovacím detailu i filtrech zmizely pomocné texty `Česky:` pod datumy a časy.
- Martina Novotná má přepínač mezi admin profilem a pracovním schvalovacím profilem pro své středisko.
- Mobilní hlavička nabízí po klepnutí na jméno uživatele možnost odhlášení.
- Dashboard ukazuje tankování PHM podle strojů jako jednoduchý seznam názvu stroje a litrů.
- Formulář výkazu i backend hlídají, že konec práce musí být po začátku; při změně začátku se konec automaticky posune.

### Mobilní výkazy
- Mobilní hlavička aplikace je kompaktnější podle nového návrhu: logo, název společnosti, jméno uživatele se stavovou tečkou a datum platnosti databáze zabírají méně výšky.
- Mobilní formulář výkazu má u typu práce menší tlačítka `Dovolená` a `Školení` vedle sebe, aby běžná volba práce zůstala vizuálně hlavní.
- Mobilní stránka nového výkazu má kompaktní tlačítko zpět vedle názvu stránky.

### Výkazy
- Formulář pracovního výkazu už nezobrazuje pomocné texty `Česky:` pod datumy a časy, aby vyplňování nebylo zahlcené opakovanými informacemi.
- Výběr pozemku má hledání podle názvu, kódu a dalších údajů pole, aby uživatel nemusel procházet dlouhou roletku ručně.
- Před uložením a odesláním výkazu, dovolené nebo školení se zobrazí potvrzení s rekapitulací vybraného termínu.

## 2026-08-21

### QA a použitelnost
- Formuláře výkazů a detailů schvalování zobrazují vedle nativních polí také český náhled datumů a časů.
- Mobilní spodní navigace je kompaktnější a obsah má větší spodní odsazení, aby se ovládání nepřekrývalo s obsahem.
- Dashboard už běžným rolím nespouští načítání auditního feedu, které končilo očekávanou chybou oprávnění v konzoli; audit feed má zároveň stabilní klíče bez React varování.

### Backend a bezpečnost
- Odstraněn starý Express backend `backend/`; aplikace má jeden živý backend ve `backend_fastapi/`.
- README a Nginx konfigurace byly vyčištěny na čistý FastAPI + PostgreSQL workflow bez starých Express importů a lokálních JSON backend dat.

## 2026-08-19

### Výkazy
- Po úspěšném vytvoření pracovního výkazu, dovolené nebo školení se zobrazí potvrzovací okno.
- Pole tankování PHM už při zapnutí nezobrazuje pevnou nulu, kterou uživatel nemůže smazat; prázdné pole se ukládá jako 0 litrů.
- V přehledu pracovníka se u dovolené a školení nezobrazuje výkon v hektarech.
- Pracovník může otevřít pouze čtecí náhled vlastního výkazu z první stránky bez možnosti úprav.

### Schvalování
- Obrazovka schvalování má přímo nahoře přepínač `Ke schválení` / `Schválené`, takže schválené výkazy jsou dostupné ze stejného pracovního místa.

### Přehled ředitelství
- Výběr střediska je převedený na rozbalovací seznam a přibyl filtr období `7 dní`, `30 dní` a `Vše`.

### Dashboard
- Přidávání informací na informační panel a servisů strojů má viditelné stavové hlášky pro ukládání, úspěch i chybu.
- Opraveno pořadí API routerů, kvůli kterému se `notices` a `service-tasks` chybně zpracovávaly jako obecný číselník a ukládání končilo chybou.
- Panely tankování podle strojů a poslední aktivity mají čitelnější řádky a stabilnější vlastní scrollování.

## 2026-08-18

### Výkazy
- Formulář dovolené a školení nově zobrazuje jasné stavové hlášení při kontrole, ukládání, úspěchu i chybě; hláška je vidět nahoře u formuláře i u tlačítka pro uložení.

### Kontakty
- Mobilní kontakty mají přepínač `Pracovní` / `Vedení společnosti` pevně ve dvou tlačítkách bez bočního posouvání a výběr oddělení je přes rozbalovací seznam.

## 2026-08-17

### Výkazy
- U typu práce `Ostatní` už není povinný pozemek, technika ani přípojné zařízení; uživatel je může samostatně zapnout checkboxem a potom se zobrazí původní výběry.
- Pro typ práce `Ostatní` je ve výběru techniky dostupná výchozí volba `Bez techniky` a výkaz se může uložit bez stroje, pozemku i přípojného zařízení.
- Při uložení výkazu aplikace upozorní na datum v minulosti nebo budoucnosti a vyžádá potvrzení s počtem dní rozdílu.
- Předvyplnění z posledního výkazu nově pracuje i s posledním pracovním výkazem bez techniky, takže typ `Ostatní` bez stroje nepřeruší historii uživatele.
- Živý backend při ukládání výkazů převádí datumy a časy do databázových typů, aby se výkaz korektně uložil i na PostgreSQL přes Roští.
- Doplněna databázová migrace, která po importovaných demo ID dorovná sekvence tabulek a nové výkazy už nedostanou duplicitní interní ID.

### Kontakty
- Kontakty byly aktualizovány podle souboru `Documents/telefonní seznam RS Lesonice 2.2.2026.xlsx`, doplněny do jednotného `contacts.json`, rozděleny na `Vedení společnosti` a `Pracovní` a dále do skupin ekonomické oddělení, správa majetku, rostlinná výroba, živočišná výroba, mechanizace, stavební skupina, BPS, mlékárna, vrátnice a jídelna.
- Do kontaktů byla doplněna interní telefonní klapka a import kontroluje, aby se stejné kontakty neduplikovaly.

### Roští nasazení
- Přidána Docker konfigurace pro Roští Stack: společný produkční image s React frontendem, Nginx proxy, FastAPI backendem a PostgreSQL 16 přes `docker-compose.rosti.yml`.
- Frontend build nově umí nastavit base path přes `VITE_BASE_PATH`, aby stejný projekt fungoval na GitHub Pages i na Roští doméně.
- Opraven FastAPI seed pro Docker: správná cesta k demo datům, datumy a časy se předávají jako Python `date`/`time`, interní `.local` emaily projdou přihlášením a duplicitní kódy pozemků/strojů neblokují pilotní PostgreSQL seed.

## 2026-07-07

### Backend a databáze
- Přidán nový základ živého FastAPI backendu s PostgreSQL, Alembic migracemi, JWT přihlášením, Docker PostgreSQL konfigurací a auditními triggery pro dohledatelnost změn.
- Doplněna Python závislost `greenlet`, kterou SQLAlchemy potřebuje pro async databázové operace ve FastAPI backendu.

### Dashboard
- Admin může archivovat informace z informačního panelu a tato akce se propisuje do auditu i poslední aktivity.

### Výkazy
- Nový výkaz umí převzít poslední použitou činnost, techniku a přípojné zařízení z posledního pracovního výkazu přihlášeného uživatele.

### Služby
- Zpřehledněno desktopové i mobilní zobrazení služeb dílny a BPS, aby se jména nepřekrývala s tlačítky pro volání a přehled byl pohodlnější na telefonu.

## 2026-07-06

### Dashboard
- Upraven přehled podle rolí: pracovníkům se nezobrazuje panel `Kdo dnes chybí`, schvalovatelé mají sloučený počet výkazů ke schválení a adminovi s ředitelem zmizel dočasný souhrn PHM za 1 až 30 dní.
- Zjednodušeno mobilní zobrazení posledních výkazů a výkazů ke schválení, aby karty na telefonu nezabíraly zbytečně velkou část obrazovky.

### Výkazy
- Schvalovatelům, adminům a ředitelům byla odebrána navigace na zadání nového výkazu, protože výkazy zadávají pracovníci.
- Formulář výkazu má odstraněné duplicitní vnitřní popisky u střediska, typu práce a techniky.
- Do dovolené byla přidána půldenní volba s kontrolou, že ve stejný den existuje také pracovní činnost.

### Schvalování
- Detail výkazu na mobilu má upravené pořadí polí a ponechává jen hlavní akci pro schválení.
- Samotnou půldenní dovolenou bez pracovní činnosti ve stejný den nelze schválit.
- Zvětšen zavírací křížek v detailu výkazu pro pohodlnější ovládání na telefonu.

### Služby
- Aktualizován demo rozpis služeb podle souboru `Documents/rozpis_sluzeb_do_konce_roku_2026_Dílna.xlsx`, aby aplikace zobrazovala správné služby dílny od července do konce roku 2026.
- Opraven výpočet dne služby bez posunu časovým pásmem, odstraněna legenda směn a doplněno tlačítko pro zavolání službě podle telefonního seznamu.
- Stránka služeb nově spojuje služby dílny a BPS podle souboru `Documents/2026.II.pdf`, aby uživatel v jednom dni viděl obě pohotovosti včetně volání.

### Kontakty
- Sloučeny kategorie `Služby` a `Nejčastější čísla` do první kategorie `Pracovní`, aby důležité pracovní kontakty byly dostupné hned.
- Kontakty byly naplněny podle souboru `Documents/telefonní seznam RS Lesonice 2.2.2026.xlsx` a převedeny do kompaktního seznamu s filtrem oddělení a tlačítkem pro volání.
- Mobilní kontakty dostaly vyhledávání podle jména, funkce, oddělení i čísla a lepší dotykové ovládání pro rychlé volání.

### Servisy strojů
- Servisní panel zobrazuje jen stroj a popis servisu, bez data dostupnosti.
- Admin může servisní informaci archivovat, aby nezmizela bez dohledatelné historie.

### Přehled ředitelství
- Hektary za období se zobrazují jen u rostlinné výroby, protože u ostatních středisek nejsou rozhodující metrikou.

### Exporty
- Do exportů přidán výběr konkrétního střediska a CSV export podle něj filtruje výkazy.

## 2026-06-28

### Mobilní zobrazení
- Zjednodušen mobilní přehled traktoristy a zaměstnance: odstraněna karta dovolené a chybějící/vrácené výkazy jsou sloučené do jednoho informačního panelu.
- Zmenšen mobilní horní panel s uživatelem, odhlášením, verzí a platností databáze, aby nezabíral zbytečně vysokou část obrazovky.
- Upraveny kontakty na mobilu pro všechny uživatele, aby se kategorie a ikony nepřekrývaly na malých displejích.

### Výkazy
- Rychlé volby `Dovolená` a `Školení` lze druhým klepnutím zrušit a vrátit formulář zpět na běžnou práci.

### Schvalování
- Z detailu výkazu odstraněna procentuální nápověda u výměry pozemku, protože u ochranných pásů a souvisejících pozemků působila zavádějícím dojmem.
- Z detailu schvalování se už nezobrazuje generická poznámka `Práce proběhla bez závad.`, pokud ji výkaz obsahuje jen jako výchozí text.

## 2026-06-27

### Demo data
- Obnovena původní reálná data, jména, pole, stroje, výkazy a lokální podklady podle stavu před anonymizací, aby aplikace znovu používala správnou databázi.

### Navigace
- Levý navigační panel na desktopu je pevně ukotvený mimo obsah stránky, aby při scrollování neujížděl a odkazy zůstaly dostupné.

### Dashboard
- Opraven pád úvodního přehledu u výkazů typu dovolená nebo školení bez vyplněného času, aby se stránka nenačetla jako bílá obrazovka.

### Bezpečnost publikace
- Z repozitáře vyřazeny lokální podklady ve složce `Documents`, aby se nepublikovaly na GitHub Pages.
- Veřejná demo data ve `frontend/public/demo-data` byla anonymizována.
- Demo uživatelé, kontakty a organizační seed používají fiktivní jména a e-maily.
- Do `.gitignore` přidána pravidla pro lokální dokumenty, `.env.*` a statický mobilní export.
- Odstraněn starý statický `ADW_mobile_demo.html` z git indexu, protože obsahoval vložená demo data.
- Opraven kontrolní skript changelogu pro správné rozpoznání upraveného `CHANGELOG.md`.

## 2026-06-26

### Navigace a metadata
- Přesunuta verze aplikace a datum platnosti databáze ze začátku menu dolů do rohu postranního panelu.
- Datum platnosti se zobrazuje s celým rokem ve formátu den.měsíc.rok.
- Traktorista a běžný zaměstnanec vidí v navigaci kromě přehledu a výkazu také `Služby` a `Kontakty`.
- Přímý vstup na admin stránky je pro traktoristu a běžného zaměstnance přesměrován zpět na přehled.
- Sjednoceno zobrazení dat v aplikaci na formát `dd.mm.rrrr`.

### Přehled a informace
- Přidán informační panel na úvodní stránku pro sdílení zpráv všem uživatelům.
- Admin a ředitel mohou přidávat nové zprávy do informačního panelu.
- Přidán panel servisů strojů s popisem úkonu a datem dostupnosti.
- Admin a vedoucí střediska mohou přidávat servisní úkoly.
- Z přehledu traktoristy odstraněna prázdná informace `Bez vrácených výkazů`.
- Panel `Kdo dnes chybí` je univerzální pro všechny uživatele a ukazuje dovolené nebo školení v aktuální den.
- Panel `Lidé s možnými úpravami` byl odstraněn.
- Panel `Poslední aktivita` vidí pouze admin a ředitel.
- Admin a ředitel vidí souhrn tankování PHM za 1, 2, 3, 7, 10 a 30 dní.

### Přehled ředitelství
- Přidána samostatná stránka `Přehled ředitelství` pro admina a ředitele.
- Přehled má přepínače středisek a ukazuje nejpoužívanější práce, hektary, práci lidí, nejpoužívanější stroj a PHM za 10/30 dní.

### Výkazy
- Přidán režim výkazu `Dovolená` a `Školení`.
- U dovolené a školení se vyplňuje jen období od-do a poznámka; pole, technika, PHM a přípojná zařízení se nezadávají.
- Formulář výkazu předvyplňuje středisko podle přihlášeného uživatele.
- Formulář výkazu si pamatuje poslední použité středisko, typ práce, techniku a přípojné zařízení.
- Tlačítka `Dovolená` a `Školení` přepínají i hodnotu typu práce.
- U dovolené a školení přidána kontrola rozsahu dat, upozornění na nestandardně dlouhé období a upozornění při překročení dostupné dovolené.

### Přihlášení
- Do demo přihlášení přidán pohled agronoma.

### Organizace
- Admin a Demo Admin mohou přepnout řádek v organizaci do editačního módu.
- Přidána možnost upravit jméno, středisko, pozici, roli a rozsah uživatele.

### Audit
- DB úpravy uživatelů, výkazů, schvalování, pozemků, strojů a typů práce zapisují detailní záznam do `audit_log`.
- Demo režim zapisuje lokální audit do `localStorage` pro nové výkazy a úpravy organizace.
- Schvalování výkazů má serverovou kontrolu oprávněných rolí.
- Backend admin akce používají společný helper pro čtení identity a kontrolu role.

### Přehled zaměstnance
- Přidán zaměstnanecký přehled chybějících výkazů za poslední všední dny.
- Přidáno upozornění na výkazy vrácené k úpravě.
- Přidána karta zůstatku dovolené.

### Číselníky a technika
- Stroje se načítají ze souboru `Documents/seznam a rozřazení strojů.xlsx`.
- Technika ve výkazu se filtruje podle vybraného střediska.
- Osobní auta se ve výběru techniky řadí až na konec seznamu.
- Import pozemků nově hledá `Seznam poli.xlsx` i v archivu a zahrnuje nové exporty pozemků.
- Lokální a frontend demo data byla obnovena na 661 pozemků a 122 strojů.
- Backend validuje, že zvolený stroj patří do zvoleného střediska.

### Opravy po kontrole
- Schvalování už nespadne u výkazů typu `Dovolená` a `Školení`, které nemají čas, pole ani stroj.
- Detail schvalování u dovolené a školení zamyká pole, která se u absence nepoužívají.
- Horní souhrn nového výkazu zobrazuje datum ve formátu `dd.mm.rrrr`.
- Demo přihlášení ukazuje správné označení role pro agronoma a další role.
- Agronom a schvalovatel už nevidí administrátorské moduly `Organizace`, `Číselníky` a `Exporty`.

### Pravidla projektu
- Zaveden tento changelog.
- Přidána pravidla pro další úpravy v `AGENTS.md`.
- Přidán kontrolní skript `scripts/check-changelog.mjs`.

## 2026-06-10

### Výkazy
- Přidáno automatické navazování dalšího výkazu podle posledního konce práce.
- Formulář po uložení nabízí další časový úsek bez ručního přepisování začátku.

### Mobilní zobrazení
- Zúženy a zpřehledněny mobilní filtry data ve schvalování.
- Opraveny šířky polí ve formulářích na mobilu.

### GitHub Pages
- Upraven GitHub Actions workflow pro nasazení statického frontendu.

## 2026-06-09

### Mobilní aplikace
- Přidán mobilní app shell layout pro hlavní obrazovky.
- Upraveno zobrazení navigace a hlavních modulů pro telefon.

### Tankování PHM
- Přidán workflow tankování PHM ve výkazu.
- Doplněn lokální model tankování a demo data `fuel-entries.json`.
- Export a dashboard počítají tankování podle výkazů a strojů.

### Schvalování
- Vylepšen mobilní detail schvalování výkazu.
- Upraveny tabulky a detailní panely pro lepší čitelnost na telefonu.

## 2026-06-08

### Přihlášení
- Vylepšeno demo přihlášení a výběr uživatele.
- Přihlášení upraveno pro pohodlnější prototypové použití.

### Výkazy
- Upraven výběr střediska ve formuláři výkazu na standardní select.
- Vylepšeno mobilní zadávání výkazů, zejména ovládací prvky a rozložení polí.

### GitHub Pages
- Přidán deploy frontendu na GitHub Pages.
- Doplněna konfigurace Vite pro publikování statického frontendu.

### Demo data
- Přidána statická demo data pro GitHub Pages.
- Frontend umí používat demo JSON soubory, když backend není dostupný.

### Mobilní zobrazení
- Optimalizováno mobilní rozložení.
- Opraveno přetékání viewportu.
- Zpřehledněny ovládací prvky ve formulářích.

## 2026-06-04

### Základ aplikace
- Založen prototyp aplikace ADW pro digitalizaci pracovních výkazů.
- Přidán backend Express + TypeScript.
- Přidán frontend React + Vite.

### Datový model
- Přidán PostgreSQL schema návrh pro střediska, zaměstnance, uživatele, role, výkazy, schvalování, techniku, pozemky a audit.
- Přidány importy a lokální fallback data z podkladů ve složce `Documents`.

### Moduly aplikace
- Přidán formulář pracovního výkazu.
- Přidán dashboard.
- Přidáno schvalování výkazů.
- Přidány číselníky pozemků a strojů.
- Přidán export výkazů.
- Přidána správa uživatelů.

### Dokumenty a podklady
- Do projektu vloženy úvodní dokumenty, business case, databázový model a vzorové výkazy.
- Přidán samostatný mobilní HTML prototyp `ADW_mobile_demo.html`.
