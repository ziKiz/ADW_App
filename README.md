# ADW Aplikace

Toto je prototyp webové aplikace pro digitalizaci pracovních výkazů.

## Struktura

- `backend/` - Express + TypeScript API
- `frontend/` - React + Vite frontend
- `CHANGELOG.md` - historie změn aplikace
- `AGENTS.md` - pravidla pro další úpravy projektu

## Požadavky

- Node.js 20+ (nebo kompatibilní)
- PostgreSQL

## Backend

### Nový FastAPI backend

Nový hlavní směr pro živou demo/provozní verzi je `backend_fastapi/` s PostgreSQL, Alembic migracemi, JWT přihlášením a auditní stopou.

Lokální první spuštění:

```bash
docker compose up -d db
cd backend_fastapi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Frontend proti FastAPI:

```bash
cd frontend
VITE_APP_MODE=live VITE_API_BASE=http://localhost:8000/api npm run dev
```

Demo heslo seednutých účtů je `demo`.

### Původní Express backend

Původní Express backend zůstává dočasně v `backend/` jako reference a fallback během migrace.

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

Stroje se berou z `Documents/seznam a rozřazení strojů.xlsx` a pole z těchto souborů:

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

## Roští Docker Stack

Pilotní online verze běží na Roští Docker Stacku:

```text
https://adw-app-641.rostiapp.cz
```

Stack používá jednu veřejnou službu `app` na portu 80 a interní PostgreSQL službu `db`.

- `Dockerfile` sestaví React frontend, nainstaluje FastAPI backend a spustí Nginx jako veřejný web server.
- `docker/nginx.conf` servíruje frontend a proxyuje `/api/` na FastAPI.
- `docker/start.sh` spustí Alembic migrace, volitelně demo seed a potom Uvicorn + Nginx.
- `docker-compose.rosti.yml` definuje `app` a `db` pro Roští Stack.
- `.env.production.example` ukazuje potřebné produkční proměnné.

Lokální `.env` se necommituje. Pro pilot obsahuje PostgreSQL heslo, JWT secret, CORS origin a `ADW_SEED_DEMO=true`.

Nasazení bez lokálního Dockeru:

```bash
COPYFILE_DISABLE=1 tar --no-xattrs \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./backend/node_modules' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/dist' \
  --exclude='./backend/dist' \
  --exclude='./backend/local-data' \
  --exclude='./backend_fastapi/.venv' \
  --exclude='./Documents' \
  --exclude='./screenshots' \
  --exclude='./ADW_mobile_demo.html' \
  --exclude='./.DS_Store' \
  --exclude='./._*' \
  -czf - . | ssh -i "$HOME/Library/Application Support/rosti/ssh/id_ed25519" -p 29762 root@ssh.rosti.cz \
  "bash -lc 'cd /srv/stack && find . -mindepth 1 -maxdepth 1 ! -name pgsql-data -exec rm -rf {} + && tar -xzf - && find . -name \"._*\" -delete && docker build -t localhost/app:latest . && docker compose -f docker-compose.rosti.yml --env-file .env up -d --remove-orphans'"
```

Pozor: `rm -rf pgsql-data` používat jen při resetu pilotní databáze. V ostrém provozu by to smazalo data.

## GitHub Pages

Frontend je připravený pro GitHub Pages na adrese:

```text
https://zikiz.github.io/ADW_App/
```

Deploy zajišťuje GitHub Actions workflow `.github/workflows/deploy-pages.yml`.

V GitHub repozitáři je potřeba jednorázově nastavit:

1. `Settings` → `Pages`
2. `Build and deployment`
3. `Source` = `GitHub Actions`

Po každém `git push` do větve `main` se frontend automaticky sestaví a publikuje.

Poznámka: GitHub Pages hostuje pouze statický frontend. Backend API na Expressu tam nepoběží. Pro plný provoz bude později potřeba samostatný server pro backend a databázi.

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

Import načítá pozemky z `Documents/Seznam poli.xlsx` a stroje z `Documents/seznam a rozřazení strojů.xlsx`.

## Changelog

Každá významná změna aplikace musí být zapsaná v `CHANGELOG.md`. Pravidla pro další nástroje a AI asistenty jsou v `AGENTS.md`.

Kontrola před dokončením práce:

```bash
node scripts/check-changelog.mjs
```

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
