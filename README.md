# AID Healthcare CRM

Production-oriented hospital CRM platform with a Django/DRF/Channels backend and a Next.js App Router frontend. The product direction is documented in [docs/production-roadmap.md](docs/production-roadmap.md), with Phase 1 foundation details in [docs/phase-01-foundation.md](docs/phase-01-foundation.md).

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
uvicorn healthcare_platform.asgi:application --reload --host 0.0.0.0 --port 8000
```

PostgreSQL is supported through `DATABASE_URL`. SQLite remains available only for local development.

### Production Backend Deployment

For server deployment with WebSocket support, use the production Docker Compose stack:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.backend.yml up -d --build
```

The stack runs PostgreSQL, Redis, the ASGI backend, and an Nginx reverse proxy configured for `/ws/` WebSocket upgrades. See [docs/backend-deployment.md](docs/backend-deployment.md) for domain, HTTPS, frontend env, and operations details.

### OpenAI AI Assistant

Add your key to `.env` at the repository root:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
```

The backend loads `.env` automatically. If no key is present, `/api/ai-assistant-sessions/<id>/messages/` falls back to the local protocol checker instead of failing.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000/doctor`, `http://localhost:3000/admin`, or `http://localhost:3000/feedback/maternity-204`.

## Realtime Endpoints

- Regional doctors: `ws://localhost:8000/ws/notifications/regional_doctor/<region_code>/`
- Head physicians: `ws://localhost:8000/ws/notifications/head_physicians/`

## Foundation API Endpoints

- `/api/organizations/`
- `/api/hospitals/`
- `/api/departments/`
- `/api/rooms/`
- `/api/staff-profiles/`
- `/api/access-grants/`
- `/api/audit-events/`

## Clinical API Endpoints

- `/api/patients/`
- `/api/patients/<id>/sync-biomarkers/`
- `/api/medical-records/`
- `/api/medical-records/<id>/discharge/`
- `/api/ai-assistant-sessions/`
- `/api/ai-assistant-sessions/<id>/messages/`
- `/api/ai-error-logs/`
- `/api/ai-error-logs/rca-summary/`
- `/api/feedback/request-phone-verification/`
- `/api/feedback/verify-phone/`
- `/api/feedback/`
- `/api/feedback/summary/`
- `/api/feedback/public-room-score/?room_qr_id=<qr_id>`
# aid
# aid
