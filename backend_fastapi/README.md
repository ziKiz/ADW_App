# ADW FastAPI backend

Živý backend pro ADW. Používá PostgreSQL, Alembic migrace, JWT přihlášení a auditní stopu.

## Lokální start

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

Demo účty mají heslo:

```text
demo
```

API běží na:

```text
http://localhost:8000/api
```

OpenAPI dokumentace:

```text
http://localhost:8000/docs
```

## Režimy frontendu

Live režim:

```bash
VITE_APP_MODE=live VITE_API_BASE=http://localhost:8000/api npm run dev
```

Statické demo pro GitHub Pages může dál používat `VITE_APP_MODE=static-demo`.
