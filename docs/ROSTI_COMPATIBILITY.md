# Roští Compatibility Guardrail

Tento dokument je závazné pravidlo pro změny ADW, které mohou ovlivnit běh na Roští.cz.

Ověřeno podle veřejné dokumentace Roští.cz dne 2026-08-28:

- Docker Stack podporuje `docker-compose.yml`, perzistentní volumes, automatický reverse proxy a Let's Encrypt.
- Roští doporučuje nasazení přes `rosticli stack push` nebo vlastní CI/CD nad Docker Stackem.
- Python hosting běží v kontejnerech a podporuje Python 3.x, pip, PostgreSQL, Redis, MariaDB, SSH/SFTP, Git, cron/supervisor a denní zálohy.

Použité zdroje:

- <https://rosti.cz/stacky-webhosting-kontejneru>
- <https://rosti.cz/>
- <https://web.rostiapp.cz/python-hosting/>

## Schválený Produkční Stack

- Hosting: Roští Docker Stack.
- Veřejná služba: `app`, port `80:80`.
- Databáze: interní PostgreSQL `db`, data v `./pgsql-data`.
- Frontend build: Node.js 20 Alpine.
- Runtime: Python 3.11 slim, FastAPI/Uvicorn, Nginx.
- Databáze: PostgreSQL 16 Alpine.
- Migrace: Alembic při startu kontejneru.
- Konfigurace: pouze přes proměnné prostředí v `.env` / administraci Roští.

## Tvrdá Pravidla

- Nepoužívat nepinované base image pro produkční Docker build.
- Nepoužívat `latest` u produkčních image.
- Nemazat `./pgsql-data` při běžném deployi.
- Nemazat `backups` při běžném deployi.
- Každá změna schématu nebo dat před ostrým nasazením musí mít zálohu databáze.
- Secret hodnoty patří do `.env` nebo administrace Roští, nikdy do Gitu.
- Nová služba, worker, cron, Redis, e-mail, úložiště nebo fronta vyžaduje aktualizaci tohoto dokumentu i `docker-compose.rosti.yml`.
- Veřejný vstup aplikace zůstává přes Nginx na portu 80.
- Produkční build musí používat stejný `Dockerfile`, který se testuje lokálně nebo při deployi.
- Soubor s přihlašovacími údaji nesmí být commitnutý.

## Checklist Před Novou Funkcí

Před změnou, která sahá do infrastruktury nebo runtime, odpověz:

- Přidává se nový runtime, služba nebo systémový balíček?
- Vyžaduje změna trvalé úložiště? Pokud ano, je ve volume?
- Vyžaduje změna background proces, cron nebo worker?
- Mění změna nároky na RAM, CPU nebo disk?
- Vyžaduje změna externí e-mail, SMS, souborové úložiště nebo API?
- Zůstává vše spustitelné v Roští Docker Stacku?

Pokud odpověď není jasná, změnu nejdřív ověř proti dokumentaci Roští.cz.

## Povinné Kontroly Před Deployem

```bash
node scripts/check-rosti-compat.mjs
node scripts/check-changelog.mjs
cd frontend && npm run build
cd backend_fastapi && PYTHONPATH=. .venv/bin/python -m unittest discover -s tests
cd backend_fastapi && PYTHONPATH=. .venv/bin/python -m compileall app alembic
git diff --check
```

Volitelně po změně závislostí:

```bash
cd frontend && npm audit --omit=dev
```

Známá výjimka k 2026-08-28: frontend má dvě moderate advisories v React Routeru, které vyžadují plánovaný upgrade na major verzi.

## Upgrade Policy

- Digesty produkčních image revidovat měsíčně nebo při bezpečnostním nálezu.
- Upgrade image dělat samostatným commitem.
- Po změně image vždy provést build, testy, deploy a live health check.
- Major upgrade PostgreSQL nedělat automaticky. Vyžaduje plán migrace a ověřenou obnovu ze zálohy.

## Disaster Recovery

- Produkční databáze běží v `./pgsql-data`.
- Zálohy držet mimo běžně mazatelný obsah stacku, aktuálně v `backups`.
- Před rizikovým deployem vytvořit zálohu databáze.
- Obnovu ze zálohy otestovat alespoň jednou za čtvrtletí.
