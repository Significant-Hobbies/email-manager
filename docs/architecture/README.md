# Architecture

How email-manager is structured and how its parts interact.

## System shape

- **Client** (browser) → Vite SPA (`/app`) + Astro landing (`/`).
- **Worker** (`src/worker.ts`, Hono on Cloudflare Workers) → `/api/*` routing,
  better-auth handler, Gmail proxy, static asset serving.
- **D1** `email-manager-auth` (Drizzle ORM) — auth tables only (`user`,
  `session`, `account`, `verification`).
- **IndexedDB** `email-search-account:<encoded user ID>` v2 (client-side, `idb` wrapper) — email metadata,
  bodies, and embeddings. Store `emails` keyed by `id`, index `by-date`; store
  `meta` (added in v2) holds the `inbox-sync` cursor for resumable paged sync.
- **HuggingFace Transformers** (ONNX runtime, WASM backend) — in-browser
  embeddings via `Xenova/all-MiniLM-L6-v2` at `fp32`.
- **PostHog** — client analytics (`posthog-js`).

## Request flow

1. `GET /` → Astro landing (`dist/index.html`); signed-in users 302 → `/app`.
2. `GET /app`, `/about`, `/privacy` → SPA shell (`dist/spa-index.html`).
3. `GET|POST /api/auth/*` → better-auth handler (Google OAuth).
4. `GET /api/emails` → Gmail proxy with 429 exponential backoff (1s/2s/4s),
   batched in groups of 25; `metadataOnly` option for unsubscribe lookups.
5. `GET /api/emails/:id` → single email or thread.
6. `POST /api/emails/:id/unsubscribe` → RFC 8058 one-click POST (HTTPS-only);
   fallback URL on failure.
7. All `/api/*` responses get security headers via middleware.

## Files

- [`how-it-works.md`](how-it-works.md) — learning-tier, code-grounded
  walkthrough of a single email end-to-end: sign-in, Gmail proxy fetch,
  IndexedDB cache, in-browser ONNX embedding, semantic search, triage, and
  unsubscribe. Start here to understand the system before the reference tables.
- [`overview.md`](overview.md) — system shape, data flow, tech stack, key
  components, and the local-first privacy architecture.
- [`decisions.md`](decisions.md) — Architecture Decision Records (ADR-001
  through ADR-009): in-browser ONNX, model selection, IndexedDB as primary
  store, CF Workers + D1, better-auth, Drizzle, OpenNext pipeline (historical),
  Gmail proxy, sync strategy.

## Key architectural constraints

- **No server-side email storage.** All email data and embeddings live in
  IndexedDB. D1 holds only better-auth tables.
- **Client-side ML only.** Embeddings generated in-browser; no server inference.
- **Read-only Gmail scope.** `gmail.readonly` only — no compose/reply/archive/delete.
- **Pull-on-demand sync.** No background sync, no cron, no Gmail Pub/Sub push.
  Emails fetched on user action; IndexedDB cache makes repeat loads fast.
- **Token refresh via better-auth.** `auth.api.getAccessToken` transparently
  renews expired Google OAuth tokens using the stored refresh token
  (`accessType: "offline"`).
