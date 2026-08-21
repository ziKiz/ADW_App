# ADW Aplikace

Toto je prototyp webové aplikace pro digitalizaci pracovních výkazů.

## Struktura

- `backend_fastapi/` - FastAPI + PostgreSQL backend
- `frontend/` - React + Vite frontend
- `docker/` - Nginx a start skripty pro Docker Stack
- `CHANGELOG.md` - historie změn aplikace
- `AGENTS.md` - pravidla pro další úpravy projektu

## Požadavky

- Node.js 20+ (nebo kompatibilní)
- PostgreSQL

## Backend

Živá demo/provozní verze používá `backend_fastapi/` s PostgreSQL, Alembic migracemi, JWT přihlášením a auditní stopou.

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

### Import dat z podkladů

Živý backend se plní přímo přes FastAPI seed:

```bash
cd backend_fastapi
source .venv/bin/activate
python -m app.seed
```

Seed načítá demo data z `frontend/public/demo-data/` a kontakty z dokumentů ve složce `Documents/`.

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
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/dist' \
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

Poznámka: GitHub Pages hostuje pouze statický frontend. Plný provoz vyžaduje FastAPI backend a PostgreSQL databázi.

## Lokální demo databáze

Statické demo pro GitHub Pages používá JSON soubory ve `frontend/public/demo-data/` a změny v prohlížeči drží v `localStorage`. Živý lokální běh používá PostgreSQL přes `docker compose up -d db`, migrace Alembic a `python -m app.seed`.

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

Aktuální backend už používá JWT přihlášení, Alembic migrace, auditní stopu a serverovou kontrolu oprávnění u výkazů. Před ostrým provozem zůstává doplnit produkční integraci Helios a finální správu uživatelských hesel.

## Poznámky

- `frontend` používá `localStorage` pro uchování přihlášeného uživatele.
- `backend_fastapi` ukládá hesla přes bcrypt a v live režimu vyžaduje vlastní silný `JWT_SECRET`.
