# Engineering Decisions

Key architectural choices made during the build of Integration Gateway, with the reasoning behind each one.

---

## 1. NestJS over Express directly

**Decision:** Use NestJS as the backend framework rather than bare Express.

**Reasoning:**
NestJS enforces a module-based structure (controllers → services → providers) that maps cleanly to the domain model here: `AuthModule`, `JobsModule`, `ProcessingModule`, `WebhooksModule`. Each module owns its own dependencies and is independently testable. For a system with this many cross-cutting concerns (auth guard, exception filter, validation pipe, BullMQ workers) the decorator-driven DI makes wiring straightforward and reduces boilerplate.

The tradeoff is startup weight — NestJS is heavier than bare Express — but for a long-running server process this is irrelevant. It becomes relevant only for serverless cold starts, which is one reason BullMQ workers are kept in the same process instead of moved to Lambda/Cloud Functions.

---

## 2. API key design: `keyPrefix` + bcrypt hash

**Decision:** Store API keys as bcrypt hashes (cost 10). Index the first 8 characters after `sk_` as `keyPrefix` for fast lookup.

**Reasoning:**
Storing plaintext API keys is a critical security failure — a DB read is enough to impersonate any partner. A naive "hash everything with bcrypt" approach works but bcrypt is intentionally slow (cost 10 ≈ 100ms per compare); running it on every request against a full table scan is unacceptable.

The `keyPrefix` pattern solves this: on every request we extract `rawKey.slice(3, 11)`, do an O(1) unique index lookup to find the candidate row, then run a single bcrypt compare. The prefix is short enough to be low entropy (not useful alone) but long enough to guarantee uniqueness across partners in practice. This is the same pattern used by GitHub and Stripe for their API keys.

---

## 3. BullMQ for async job processing

**Decision:** Use BullMQ (Redis-backed) for the processing queue and webhook delivery queue rather than processing synchronously or using a simple in-memory queue.

**Reasoning:**
Job processing involves file operations and simulated external API calls — it cannot run in the HTTP request/response cycle without blocking. An in-memory queue (e.g. `EventEmitter`) loses all pending jobs on restart and cannot survive crashes. BullMQ gives durable queuing, automatic retries with configurable backoff, job priority, concurrency limits, and a full audit trail — all without running a separate message broker binary (Redis is already required for session/cache infrastructure in most NestJS deployments).

The two-queue design (`processing` and `webhook`) keeps concerns separated: a spike in webhook failures doesn't block new job processing.

---

## 4. Custom exponential backoff for webhooks

**Decision:** Implement a custom BullMQ backoff schedule for webhook retries: immediate → +60s → +5 min → +15 min → +1 hr (5 attempts total).

**Reasoning:**
BullMQ's built-in exponential backoff doubles the delay each time starting from 1 second, which reaches 16 seconds by attempt 5. That's too aggressive for webhook delivery — partner services often have planned maintenance windows measured in minutes or hours, not seconds. The custom schedule front-loads quick retries (catches transient errors) then backs off to hour-scale (survives longer outages) before exhausting attempts and marking the job `WEBHOOK_FAILED`. The terminal state is intentional: silent infinite retries would make debugging impossible.

---

## 5. HMAC-SHA256 webhook signatures

**Decision:** Sign every webhook POST body with `HMAC-SHA256` using a per-partner `webhookSecret`, sent as `X-Signature: sha256=<hex>`.

**Reasoning:**
Without a signature, any party that discovers a partner's `callbackUrl` can forge webhook deliveries. HMAC-SHA256 lets the partner verify that the payload originated from Integration Gateway and was not tampered in transit — without needing a PKI infrastructure. The `timingSafeEqual` comparison on the partner's side prevents timing-oracle attacks that could allow brute-forcing the secret byte-by-byte.

The `sha256=` prefix follows the GitHub Webhooks convention, which most partner developers will already be familiar with.

---

## 6. Idempotency keys scoped per partner

**Decision:** Store `IdempotencyKey` records with a `(partnerId, key)` composite unique constraint. The same key sent by two different partners creates two separate jobs.

**Reasoning:**
If idempotency keys were global, a malicious or buggy partner could accidentally (or deliberately) collide with another partner's keys and receive their job results. Per-partner scoping is the correct security boundary — it matches how Stripe, Adyen, and other payment APIs handle it.

The implementation uses a database transaction (`$transaction`) to atomically check for an existing key and create the job + key record together, preventing race conditions on concurrent retries.

---

## 7. Presigned URLs for report downloads

**Decision:** The `GET /v1/jobs/:id/download` endpoint returns a 15-minute presigned MinIO/S3 URL rather than streaming the file through the application server.

**Reasoning:**
Streaming large PDF files through the API server ties up Node.js event-loop resources proportional to file size and concurrent downloads. Presigned URLs offload the transfer directly to the object store, which is purpose-built for large binary transfers. The 15-minute TTL is long enough for a browser redirect but short enough that a leaked URL becomes useless quickly.

The public endpoint rewrite in `StorageService.rewriteHostname()` is specific to the Docker development environment, where MinIO is reachable internally at `minio:9000` but externally at `localhost:9000`. In production (Cloudflare R2 / AWS S3) this rewrite is a no-op.

---

## 8. Prisma ORM pinned to v6

**Decision:** Use Prisma v6, not v7.

**Reasoning:**
Prisma v7 (released early 2025) introduced breaking changes to the `PrismaClient` API and removed several `$` utility methods used throughout the codebase. v6 is the current LTS-stable release with full NestJS 11 support and no migration burden. Upgrading to v7 is a future task after reviewing the migration guide.

---

## 9. Frontend: manual shadcn/ui components, no CLI

**Decision:** Write shadcn/ui-style components by hand rather than using the `shadcn-ui` CLI.

**Reasoning:**
The shadcn/ui CLI generates components pre-configured for PostCSS-based Tailwind (v3). This project uses Tailwind v4 with the Vite plugin (`@tailwindcss/vite`), which is incompatible with the PostCSS plugin the CLI assumes. Attempting to use the CLI output directly caused `[postcss] It looks like you're trying to use tailwindcss directly as a PostCSS plugin` errors.

Writing components manually meant we could use Radix UI primitives (`@radix-ui/react-slot`, `react-separator`, `react-scroll-area`, `react-tabs`, `react-tooltip`) with CVA (`class-variance-authority`) variant systems, achieving identical DX to shadcn/ui without any PostCSS dependency.

---

## 11. BullMQ Redis TLS — parse `rediss://` scheme explicitly

**Decision:** Extract TLS settings from the `REDIS_URL` scheme in `BullModule.forRootAsync`, passing `tls: {}` and `password` explicitly to ioredis rather than passing just `host` and `port`.

**Reasoning:**
The original code used `new URL(redisUrl)` to extract only `hostname` and `port`, silently discarding the `rediss://` scheme. BullMQ passes these directly to ioredis, which opened a plaintext connection even when the URL indicated TLS. Upstash (and other managed Redis providers) require TLS — plaintext connections are rejected immediately (`ECONNRESET`) or time out (`ETIMEDOUT`).

The fix checks `url.protocol === 'rediss:'` and conditionally adds `tls: {}` to the ioredis connection options. This makes the `REDIS_URL` env var the single source of truth for both host/port and TLS configuration — no extra env vars needed.

---

## 12. Backblaze B2 over Cloudflare R2 for production storage

**Decision:** Use Backblaze B2 as the production object storage provider instead of Cloudflare R2.

**Reasoning:**
Both are S3-compatible and work with the existing MinIO client without code changes — only environment variables differ. Backblaze B2 was chosen for the production deployment because the account setup and API key creation flow is simpler (App Keys page is straightforward) and the free tier is generous (10 GB storage, no egress fees). Cloudflare R2 requires navigating Workers & Pages → R2, finding the account ID in a non-obvious location, and the API token scoping UI is more complex.

The `MINIO_USE_SSL=true` env var (added to `StorageService`) enables TLS for either provider without code changes.

---

## 13. Railway over Vercel for NestJS backend

**Decision:** Deploy the NestJS backend on Railway rather than Vercel.

**Reasoning:**
Vercel's serverless functions have two hard constraints that break this application:
1. **Request body limit of 4.5 MB** — the API accepts file uploads up to 25 MB per file.
2. **No persistent processes** — BullMQ workers need to run continuously, listening to the Redis queue. Vercel kills function instances after 10–60 seconds; there is no way to run a long-lived worker.

Railway deploys from the existing `server/Dockerfile`, supports long-running processes, has no body size restrictions, and has a free tier sufficient for a demo deployment. The existing Dockerfile required zero changes.

---

## 10. Class-based dark mode via `document.documentElement.classList`

**Decision:** Implement dark mode by toggling a `.dark` class on `<html>` and using Tailwind's `dark:` variant, persisted to `localStorage`.

**Reasoning:**
Tailwind v4 uses `@variant dark (&:is(.dark *))` (class-based) rather than the default `prefers-color-scheme` media query, giving the user explicit control independent of their OS setting. Persisting to `localStorage` ensures the preference survives page reloads. The `useDarkMode` hook initialises from `localStorage` first, falling back to `prefers-color-scheme` on first visit — no flash of wrong theme.
