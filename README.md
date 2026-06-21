# Integration Gateway

A production-quality async file processing and webhook delivery platform — built as a full-stack take-home assignment.

**Stack:** NestJS · React 19 · PostgreSQL (Prisma) · Redis (BullMQ) · S3-compatible storage · Tailwind v4 · shadcn/ui

---

## Live Demo

| Service | URL |
|---|---|
| Frontend (Developer Console) | _Add your Vercel URL here_ |
| Backend API | _Add your Railway URL here_ |

Demo API key: set as `VITE_API_KEY` in your frontend environment.

---

## Local Development (Docker)

```bash
git clone https://github.com/your-username/integration-gateway
cd integration-gateway

# Start everything (Postgres + Redis + MinIO + backend + frontend)
docker compose up
```

Services start in the correct order automatically:

| Service | URL |
|---|---|
| Frontend (Developer Console) | http://localhost:5173 |
| Backend API | http://localhost:3001/v1 |
| Health check | http://localhost:3001/health |
| MinIO Console | http://localhost:9001 |

The demo API key is printed in the backend logs on first boot and is also pre-set in the frontend via `SEED_API_KEY`.

---

## Production Deployment

### Backend → Railway

1. Connect your GitHub repo to [Railway](https://railway.app)
2. Railway auto-detects `railway.json` and builds from `server/Dockerfile`
3. Set these environment variables in Railway:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → Connection string |
| `REDIS_URL` | Upstash dashboard → Connect tab → ioredis URL (`rediss://...`) |
| `MINIO_ENDPOINT` | Backblaze B2 → bucket endpoint e.g. `s3.us-west-004.backblazeb2.com` |
| `MINIO_PORT` | `443` |
| `MINIO_USE_SSL` | `true` |
| `MINIO_ACCESS_KEY` | Backblaze B2 → App Keys → keyID |
| `MINIO_SECRET_KEY` | Backblaze B2 → App Keys → applicationKey |
| `MINIO_BUCKET` | `integration-gateway` |
| `MINIO_PUBLIC_ENDPOINT` | Same as `MINIO_ENDPOINT` |
| `SEED_API_KEY` | Any string starting with `sk_` followed by 32+ hex chars |
| `CORS_ORIGINS` | Your Vercel frontend URL e.g. `https://your-app.vercel.app` |
| `PORT` | `3001` |

See `server/.env.example` for the full reference.

### Frontend → Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set root directory to `client`
3. Set these environment variables in Vercel:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.railway.app/v1` |
| `VITE_API_KEY` | Same value as `SEED_API_KEY` on Railway |

### External Services (all free tier)

| Service | Used for | Free tier |
|---|---|---|
| [Neon](https://neon.tech) | PostgreSQL | 0.5 GB, 1 project |
| [Upstash](https://upstash.io) | Redis (BullMQ queues) | 10K commands/day |
| [Backblaze B2](https://backblaze.com) | File + report storage | 10 GB, no egress fees |

---

## Architecture

```
┌──────────────────────────────────┐
│   React Frontend (Vercel)        │
│   Developer Console              │
│   Dashboard / Jobs / Playground  │
│   API Docs (/docs)               │
└─────────────┬────────────────────┘
              │ X-Api-Key header
              ▼
┌──────────────────────────────────────────────────────┐
│   NestJS API  (Railway)                              │
│                                                      │
│   ApiKeyGuard → keyPrefix O(1) lookup → bcrypt verify│
│   JobsController  POST/GET /v1/jobs                  │
│   HttpExceptionFilter  structured JSON errors        │
└──────────────┬───────────────────────────────────────┘
               │ BullMQ queue
    ┌──────────▼──────────┐       ┌──────────────────┐
    │  ProcessingWorker   │──────▶│  Backblaze B2    │
    │  Mark PROCESSING    │       │  uploads/ reports/│
    │  Generate PDF       │       └──────────────────┘
    │  Mark COMPLETED     │
    └──────────┬──────────┘
               │ BullMQ queue
    ┌──────────▼──────────┐       ┌──────────────────┐
    │  WebhooksWorker     │──────▶│  Partner Webhook │
    │  HMAC-SHA256 sign   │       │  callbackUrl     │
    │  POST callbackUrl   │       └──────────────────┘
    │  5 attempts backoff │
    └─────────────────────┘

Persistence:  Neon (PostgreSQL via Prisma)
Queues:       Upstash (Redis via BullMQ)
Storage:      Backblaze B2 (S3-compatible via MinIO client)
```

---

## API Reference

All endpoints require `X-Api-Key: <key>` header. Full interactive docs at `/docs` in the frontend.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (no auth required) |
| `POST` | `/v1/jobs` | Submit job (multipart/form-data) |
| `GET` | `/v1/jobs` | List all jobs for your partner account |
| `GET` | `/v1/jobs/:id` | Get single job with webhook delivery history |
| `GET` | `/v1/jobs/:id/download` | Get 15-min presigned download URL (COMPLETED only) |
| `POST` | `/v1/jobs/:id/retry-webhook` | Re-queue webhook delivery |

### Submit a Job

```bash
curl -X POST https://your-backend.railway.app/v1/jobs \
  -H "X-Api-Key: sk_demo_..." \
  -H "Idempotency-Key: $(uuidgen)" \
  -F 'metadata={"customerId":"cust-001","caseType":"KYC","callbackUrl":"https://httpbin.org/post"}' \
  -F "files=@document.pdf"
```

Response `202 Accepted`:
```json
{
  "id": "clxxxxxxxxxxxxx",
  "status": "SUBMITTED",
  "customerId": "cust-001",
  "caseType": "KYC"
}
```

---

## Key Design Decisions

### API Key Security
Keys are stored as **bcrypt hashes** (cost 10). The first 8 characters after `sk_` are indexed as `keyPrefix` for O(1) lookup — we find the candidate row first, then run one bcrypt compare. Plaintext keys are never persisted.

### Idempotency
The `Idempotency-Key` header is scoped per partner via a `(partnerId, key)` composite unique constraint. Duplicate submissions return the existing job without creating a new one. A database `$transaction` atomically creates the job and idempotency record to prevent race conditions.

### Webhook Reliability
BullMQ delivers webhooks with a custom backoff schedule: **immediate → +60s → +5m → +15m → +1hr** (5 attempts). Every attempt is signed with `HMAC-SHA256` and recorded in `webhook_deliveries`. After exhaustion the job moves to `WEBHOOK_FAILED`. Manual re-queue available via API.

### Presigned URLs
Reports are stored privately in Backblaze B2. Downloads use **15-minute presigned URLs** — the file transfer goes directly from B2 to the browser, not through the API server.

See [docs/engineering-decisions.md](docs/engineering-decisions.md) for all 11 decisions with full rationale.

---

## Testing

```bash
cd server

# Unit tests (no external services needed)
npm test

# E2E tests (no Docker needed — Prisma and Storage are mocked)
npm run test:e2e
```

| Suite | Tests | Covers |
|---|---|---|
| `api-key.guard.spec.ts` | 4 | Auth guard: missing key, invalid key, valid key attaches partner |
| `jobs.idempotency.spec.ts` | 5 | Idempotency: dedup, separate keys, file type/size validation |
| `webhooks.retry.spec.ts` | 5 | Webhook delivery recording, WEBHOOK_FAILED on exhaustion |
| `app.e2e-spec.ts` | 4 | HTTP: health check, 401 on missing/malformed key |

**19 tests, all passing.**

---

## Security

| Concern | Approach |
|---|---|
| API key storage | bcrypt hash (cost 10) — plaintext never persisted |
| API key lookup | `keyPrefix` index for O(1) lookup before bcrypt |
| Webhook authenticity | HMAC-SHA256 in `X-Signature: sha256=<hmac>` header |
| File storage | Private bucket — downloads via presigned URLs (15 min TTL) |
| Authorization | Every job endpoint checks `job.partnerId === partner.id` |
| Input validation | MIME allowlist, 25 MB size limit at Multer layer |
| CORS | Configurable via `CORS_ORIGINS` env var |

---

## Project Structure

```
integration-gateway/
├── client/               # React 19 + Vite + Tailwind v4
│   ├── src/
│   │   ├── api/          # Axios client + job API calls
│   │   ├── components/   # shadcn/ui-style components + layout
│   │   ├── hooks/        # TanStack Query hooks + useDarkMode
│   │   ├── pages/        # Dashboard, Jobs, JobDetail, Playground, ApiDocs
│   │   └── types/        # Shared TypeScript types
│   └── Dockerfile
├── server/               # NestJS
│   ├── src/
│   │   ├── auth/         # ApiKeyGuard + AuthService (bcrypt)
│   │   ├── jobs/         # JobsController + JobsService (idempotency)
│   │   ├── processing/   # BullMQ worker (job lifecycle)
│   │   ├── webhooks/     # BullMQ worker (HMAC delivery + retry)
│   │   ├── storage/      # MinIO/S3 client wrapper
│   │   ├── partners/     # Partner management + demo seeder
│   │   └── prisma/       # Prisma service
│   ├── prisma/           # Schema + migrations
│   ├── test/             # E2E tests
│   └── Dockerfile
├── docs/
│   ├── architecture.md   # Mermaid system + state machine + ER diagrams
│   └── engineering-decisions.md
├── docker-compose.yml
└── railway.json
```
