#!/bin/sh
set -eu

cd /app/backend_fastapi

alembic upgrade head

if [ "${ADW_SEED_DEMO:-false}" = "true" ]; then
  python -m app.seed
fi

uvicorn app.main:app --host 127.0.0.1 --port 8000 &

exec nginx -g "daemon off;"
