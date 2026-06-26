# Changelog

Všechny významné změny v aplikaci zapisujte sem. Nové záznamy patří nahoru.

Formát:

```text
## YYYY-MM-DD

### Oblast
- Co se změnilo a proč.
- Které části aplikace se to týká.
```

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
- Admin a Ing. Martina Novotná mohou přepnout řádek v organizaci do editačního módu.
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
