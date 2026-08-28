# Pokyny Pro Úpravy Projektu

## Changelog je povinný

Každá změna aplikace musí aktualizovat `CHANGELOG.md`.

Platí pro:

- úpravy frontendu,
- úpravy backendu,
- změny datových modelů,
- změny demo dat,
- změny importů,
- změny chování uživatelských rolí,
- nové obrazovky nebo formuláře,
- opravy chyb, které mění chování aplikace.

Neplatí jen pro čistě technické změny bez dopadu na aplikaci, například oprava překlepu v komentáři.

## Jak zapisovat

- Nový záznam dej nahoru pod nejbližší datum.
- Použij český popis.
- Piš podle oblasti aplikace, například `Výkazy`, `Dashboard`, `Backend`, `Demo data`.
- Popiš co se změnilo a proč, stručně.

## Kontrola

Před dokončením změny spusť:

```bash
node scripts/check-changelog.mjs
```

Pokud skript hlásí chybějící changelog, doplň `CHANGELOG.md`.

## Roští kompatibilita

Před změnou Dockeru, deploye, databáze, runtime verzí, nových služeb nebo produkčních závislostí přečti `docs/ROSTI_COMPATIBILITY.md`.

Před deployem na Roští spusť:

```bash
node scripts/check-rosti-compat.mjs
```

Produkční image musí být pinované digestem, `latest` je zakázané mimo lokálně sestavený `localhost/app:latest`. Běžný deploy nesmí mazat `pgsql-data` ani `backups`.
