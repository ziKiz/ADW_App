# ADW Aplikace

Toto je prototyp webové aplikace pro digitalizaci pracovních výkazů.

## Struktura

- `backend/` - Express + TypeScript API
- `frontend/` - React + Vite frontend

## Požadavky

- Node.js 20+ (nebo kompatibilní)
- PostgreSQL

## Backend

1. Vytvořte databázi `adw` nebo nastavte proměnné v `backend/.env`.
2. Spusťte SQL skript `backend/src/models/schema.sql` pro vytvoření tabulek a seed dat.
3. Nainstalujte závislosti:
   ```bash
   cd backend
   npm install
   ```
4. Spusťte server:
   ```bash
   npm run dev
   ```

### Import dat z podkladů

Traktory se berou z `Documents/seznam stroju.JPG` a pole z těchto souborů:

- `Documents/tisk_zem_parcel (13).xls`
- `Documents/tisk_zem_parcel (14).xls`
- `Documents/tisk_zem_parcel (15).xls`

Po spuštění PostgreSQL databáze nahrajete data příkazem:

```bash
cd backend
npm run import:documents
```

Když databáze neběží, backend pro rozbalovací seznamy použije stejná data přímo ze souborů jako dočasnou zálohu.

## Frontend

1. Nainstalujte závislosti:
   ```bash
   cd frontend
   npm install
   ```
2. Spusťte vývojový server:
   ```bash
   npm run dev
   ```

## Lokální demo databáze

Když PostgreSQL neběží, backend používá lokální JSON data v `backend/local-data/`. Tato data zůstávají uložená i po vypnutí editoru nebo vývojového serveru.

Prototyp má připravenou fiktivní databázi pro duben a květen 2026:

```bash
cd backend
npm run generate:demo
```

Příkaz vytvoří chybějící lokální soubory `users.json`, `fields.json`, `tractors.json`, `work-types.json` a přegeneruje `reports.json`. Výkazy lze dál upravovat přímo v aplikaci; změny se zapisují zpět do `backend/local-data/reports.json`.

Číselníky v aplikaci teď slouží hlavně pro pozemky a stroje. Podporují založení nových záznamů i úpravu existujících. Každý lokální záznam obsahuje `created_at`, `created_by`, `updated_at`, `updated_by` a `last_change`. Detailní historie změn se ukládá do `backend/local-data/audit-log.json`.

Číselníky lze znovu načíst z podkladů ve složce `Documents/`:

```bash
cd backend
npm run import:local-dictionaries
```

Import načítá pozemky z `Documents/Seznam poli.xlsx` a traktory z `Documents/Seznam stroju.JPG`.

## Přihlášení

Lokální prototyp používá demo přihlášení přes `localStorage`. Výchozí demo uživatel:

- Ing. Martina Novotná, administrátor systému

## Organizační model

Referenční struktura je převzatá z `Documents/ADW Databazovy model.xlsx` a vloženého textového zadání. Aplikace rozlišuje:

- `departments` - střediska a nákladová střediska
- `employees` - lidé v organizaci
- `roles`, `permissions`, `role_permissions`, `user_roles` - základ RBAC
- `reports`, `work_report_lines`, `approvals`, `helios_checks`, `notifications`, `audit_log` - výkazy, schvalování, kontrola Helios a historie

Zásadní pravidlo: finální schválení výkazu musí provést vedoucí střediska, na jehož nákladové středisko byla práce vykázána. Práce pro jiné středisko proto musí projít i cílovým střediskem.

Aktuální offline krok je příprava struktury a dat. Před nasazením na server bude potřeba doplnit skutečné přihlášení, migrace databáze, validace oprávnění na backendu a exportní vazbu na Helios.

## Poznámky

- `frontend` používá `localStorage` pro uchování přihlášeného uživatele.
- `backend` zatím ukládá heslo v databázi jako prostý text pouze pro prototyp.
