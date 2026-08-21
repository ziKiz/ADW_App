FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
ARG VITE_APP_MODE=live
ARG VITE_API_BASE=/api
ARG VITE_BASE_PATH=/
ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx curl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/nginx /var/log/nginx

COPY backend_fastapi/requirements.txt /app/backend_fastapi/requirements.txt
RUN pip install --no-cache-dir -r /app/backend_fastapi/requirements.txt

COPY backend_fastapi /app/backend_fastapi
COPY frontend/public/demo-data /app/frontend/public/demo-data
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/start.sh /app/start.sh

RUN chmod +x /app/start.sh

WORKDIR /app/backend_fastapi
EXPOSE 80

CMD ["/app/start.sh"]
