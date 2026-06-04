# Backend Deployment

This backend should run as an ASGI service so Django Channels can keep WebSocket connections open. The production compose file starts PostgreSQL, Redis, the Django backend through Uvicorn, and an Nginx reverse proxy with WebSocket upgrade headers.

## 1. Prepare The Server

Install Docker and the Docker Compose plugin on your server, then clone the repository.

```bash
git clone <your-repo-url> aid
cd aid
cp .env.production.example .env.production
```

Edit `.env.production` before starting the stack:

```bash
DJANGO_SECRET_KEY=<long-random-secret>
DJANGO_ALLOWED_HOSTS=api.your-domain.com,<server-ip>
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgres://aid:<strong-password>@db:5432/aid_healthcare
CORS_ALLOWED_ORIGINS=https://app.your-domain.com
CSRF_TRUSTED_ORIGINS=https://app.your-domain.com,https://api.your-domain.com
OPENAI_API_KEY=<your-openai-key>
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api
NEXT_PUBLIC_WS_BASE_URL=wss://api.your-domain.com
```

Use `DJANGO_SESSION_COOKIE_SAMESITE=None`, `DJANGO_CSRF_COOKIE_SAMESITE=None`, and `DJANGO_COOKIE_SECURE=true` when the frontend and backend are on different HTTPS domains.

Also update `server_name` in `deploy/nginx/aid-backend.conf` from `api.example.com` to your API domain.

## 2. Start The Backend

```bash
docker compose --env-file .env.production -f docker-compose.backend.yml up -d --build
```

The backend container runs migrations and `collectstatic` on startup. Create an admin user after the first deploy:

```bash
docker compose --env-file .env.production -f docker-compose.backend.yml exec backend python manage.py createsuperuser
```

Useful checks:

```bash
docker compose --env-file .env.production -f docker-compose.backend.yml ps
docker compose --env-file .env.production -f docker-compose.backend.yml logs -f backend
curl https://api.your-domain.com/health/
```

Use `http://.../health/` only while testing before TLS is enabled.

## 3. Enable HTTPS

The included Nginx config listens on port `80`. For production, put TLS in front of it with your server provider, Cloudflare, Caddy, Traefik, or a Certbot-managed Nginx SSL block.

WebSockets need the same domain, just with `wss`:

```bash
wss://api.your-domain.com/ws/notifications/head_physicians/
wss://api.your-domain.com/ws/notifications/regional_doctor/<region_code>/
```

If TLS terminates before this Nginx container, make sure the proxy still forwards:

```text
Upgrade: $http_upgrade
Connection: upgrade
X-Forwarded-Proto: https
```

## 4. Frontend Environment

Set the frontend deployment environment to the backend domain:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api
NEXT_PUBLIC_WS_BASE_URL=wss://api.your-domain.com
```

After changing frontend env vars, rebuild/redeploy the frontend.

## 5. Operational Notes

Redis is required in production because in-memory Channels cannot share WebSocket events between workers or containers.

Keep `.env.production` private. Do not commit real OpenAI keys, database passwords, or Django secrets.

For a zero-downtime style update:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.backend.yml up -d --build
docker compose --env-file .env.production -f docker-compose.backend.yml logs -f backend
```
