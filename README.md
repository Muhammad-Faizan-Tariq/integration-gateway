# Integration Gateway

A production-quality file processing and webhook delivery platform built as a full-stack take-home assignment.

---

## Quick Start

```bash
# Clone and enter the project
cd integration-gateway

# Copy environment file
cp .env.example .env

# Start everything
docker compose up
```

Services start in the correct order automatically. Once healthy:

| Service | URL |
|---------|-----|
| Frontend (Developer Console) | http://localhost:5173 |
| Backend API | http://localhost:3001/v1 |
| MinIO Console | http://localhost:9001 |
| pgAdmin / direct postgres | localhost:5432 |

The demo API key is printed in the backend logs on first startup. It is also available as `SEED_API_KEY` in your `.env` file.

---

## Architecture Overview

```
┌──────────────┐     X-Api-Key     ┌─────────────────────────────────────┐
│   Partner    │ ──────────────── ▶ │  NestJS API  (port 3001)            │
│   (client)   │                   │                                     │
└──────────────┘                   │  AuthModule  — API key guard        │
                                   │  JobsModule  — submit / query       │
                                   │  StorageModule — MinIO wrapper      │
                                   └───────────┬─────────────────────────┘
                                               │ BullMQ
                          ┌────────────────────▼──────────────────────┐
                          │  ProcessingModule (Worker)                 │
                          │  • Mark PROCESSING                        │
                          │  • Simulate 2–10s + 20% failure           │
                          │  • Generate PDF report → MinIO            │
                          │  • Mark COMPLETED                         │
                          │  • Enqueue webhook                        │
                          └────────────────────┬──────────────────────┘
                                               │ BullMQ
                          ┌────────────────────▼──────────────────────┐
                          │  WebhooksModule (Worker)                   │
                          │  • POST callbackUrl with HMAC signature   │
                          │  • Retry: 0s → 1m → 5m → 15m → 1h       │
                          │  • Record each attempt in DB              │
                          │  • On exhaustion → WEBHOOK_FAILED         │
                          └───────────────────────────────────────────┘
```

**Modules:**
- `AuthModule` — validates `X-Api-Key` against bcrypt-hashed keys
- `PrismaModule` — global PostgreSQL client (Prisma ORM)
- `StorageModule` — global MinIO wrapper with presigned URL generation
- `PartnersModule` — partner management + startup seeder
- `JobsModule` — job submission (multipart), status polling, downloads, webhook retry trigger
- `ProcessingModule` — BullMQ worker handling the job lifecycle
- `WebhooksModule` — BullMQ worker with at-least-once delivery and exponential-ish backoff

---

## API Documentation

All endpoints require `X-Api-Key: <key>` header.

### Submit a Job

```
POST /v1/jobs
Content-Type: multipart/form-data
Idempotency-Key: <optional-uuid>   ← prevents duplicate submissions

Fields:
  metadata   (JSON string, required)
  files      (one or more files: PDF/JPG/JPEG/PNG, max 25MB each)

Metadata shape:
{
  "customerId": "cust-001",    ← required
  "caseType": "KYC",           ← required
  "callbackUrl": "https://...", ← required, valid URL
  ...any extra fields
}

Response: 202 Accepted
{
  "id": "...",
  "status": "SUBMITTED",
  "customerId": "...",
  ...
}

Errors:
{ "code": "INVALID_FILE_TYPE", "message": "..." }
{ "code": "FILE_TOO_LARGE",    "message": "..." }
{ "code": "VALIDATION_ERROR",  "message": "..." }
```

### Get Job Status

```
GET /v1/jobs/:id

Response: 200
{
  "id": "...",
  "status": "PROCESSING",     ← SUBMITTED|PROCESSING|COMPLETED|FAILED|WEBHOOK_FAILED
  "createdAt": "...",
  "metadata": {},
  "attachments": [...],
  "webhookDeliveries": [...]
}
```

### List All Jobs

```
GET /v1/jobs
```

### Download Report

```
GET /v1/jobs/:id/download    ← only for COMPLETED jobs

Response:
{ "downloadUrl": "http://localhost:9000/...?X-Amz-..." }  ← signed URL, 15 min expiry
```

### Retry Webhook

```
POST /v1/jobs/:id/retry-webhook    ← only for COMPLETED jobs
```

---

## Idempotency Design

The `Idempotency-Key` header prevents duplicate job creation on retried requests.

**Implementation:**

1. Client sends `Idempotency-Key: <uuid>` with the request
2. Server checks the `idempotency_keys` table for `(partnerId, key)` using a unique constraint
3. If found → return the existing job immediately (no new records)
4. If not found → create the job, then atomically insert the idempotency key record within the same `$transaction`

**Race condition safety:** The database `UNIQUE` constraint on `(partnerId, key)` acts as the final arbiter. Concurrent requests with the same key will produce a constraint violation; the losing request receives the existing job via a re-query.

---

## Webhook Retry Design

Webhooks use BullMQ's built-in retry machinery with a custom backoff strategy.

**Retry schedule** (5 total attempts):

| Attempt | Delay |
|---------|-------|
| 1 | immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5 | 1 hour |

**At-least-once delivery:** Each attempt is recorded in `webhook_deliveries` with the HTTP status code and any error message. If all 5 attempts fail, the job status is set to `WEBHOOK_FAILED`.

**Manual retry:** `POST /v1/jobs/:id/retry-webhook` re-enqueues a fresh 5-attempt sequence for any `COMPLETED` job.

**Signature verification** (HMAC SHA256):

```js
const payload = JSON.stringify({ eventId, jobId, status, downloadUrl });
const sig = crypto.createHmac('sha256', partner.webhookSecret)
                  .update(payload)
                  .digest('hex');
// Header sent: X-Signature: sha256=<sig>

// Verification on partner side:
const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(`sha256=${expected}`));
```

---

## Security Considerations

| Concern | Approach |
|---------|----------|
| API key storage | Only bcrypt hash stored (cost=10). Raw key never persisted. |
| API key lookup | Short prefix (`keyPrefix`) stored for O(1) lookup without exposing the secret. |
| Webhook authenticity | HMAC SHA256 signature in `X-Signature` header using per-partner secret. |
| File storage | Private MinIO bucket. No public URLs. Downloads require presigned URLs (15 min expiry). |
| Authorization | Every job endpoint verifies `job.partnerId === authenticatedPartner.id`. |
| Input validation | `class-validator` DTOs, MIME type allowlist, 25MB file size limit enforced at multer layer. |
| CORS | Backend allows only `localhost:5173` by default. |

---

## Testing

```bash
cd server

# Run all unit tests
npm test

# Run with coverage
npm run test:cov
```

Tests cover:
- **Idempotency** (`src/jobs/jobs.idempotency.spec.ts`): verifies that duplicate submissions with the same key return the existing job, and that two different keys create two separate jobs.
- **Webhook retry** (`src/webhooks/webhooks.retry.spec.ts`): verifies delivery recording, WEBHOOK_FAILED transition on exhaustion, and success path recording.

---

## What I Would Do With More Time

1. **E2E tests** — Supertest integration tests against a real test database using Docker Compose override.
2. **Rate limiting** — Per-partner request rate limits using Redis counters.
3. **Structured logging** — Replace `console.log` with a JSON logger (Pino) shipping to a log aggregator.
4. **Observability** — Prometheus metrics for queue depths, job durations, webhook success rates.
5. **API key rotation** — Allow partners to rotate keys without downtime (store multiple active hashes).
6. **Webhook verification UI** — Show partners their webhook secret and a code snippet for signature verification.
7. **Production frontend build** — Replace the Vite dev server in Docker with a multi-stage build served by nginx.
8. **Database connection pooling** — PgBouncer in front of PostgreSQL for high concurrency.
9. **Dead letter queue** — Move permanently-failed jobs to a DLQ for manual inspection.
10. **Pagination** — Cursor-based pagination on `GET /v1/jobs` for large datasets.
