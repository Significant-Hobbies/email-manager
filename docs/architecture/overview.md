# Architecture Overview

## Tech stack

| Concern | Technology |
| --- | --- |
| Framework | Vite + React 19 SPA (`react-router-dom` v7) + Hono Worker |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS custom properties for light/dark) |
| Server DB | Cloudflare D1 `email-manager-auth` (Drizzle ORM) — auth tables only |
| Client DB | IndexedDB (`idb` v8) — `email-search` v2, stores `emails` + `meta` |
| Auth | better-auth (Google OAuth, `gmail.readonly`, offline access) |
| ML | `@huggingface/transformers` v4 (ONNX runtime, WASM, in-browser) |
| Analytics | PostHog (`posthog-js`), web-vitals RUM |
| Landing | Astro (static, overlaid into `dist/index.html`) |
| Deploy | Cloudflare Workers (`email-manager`) |
| Testing | Vitest (unit), Playwright (e2e) |
| Package manager | pnpm |

## Repo structure

```
src/
  worker.ts               # Hono Worker entry — /api/* routing, asset serving
  main.tsx                # SPA entry point
  router.tsx              # React Router routes
  RootLayout.tsx          # Root layout
  pages/                  # Route page components (HomeClient, About, Privacy, etc.)
  components/
    Providers.tsx         # SessionProvider wrapper
    Sidebar.tsx           # Nav
    EmailList.tsx         # Email list with search + infinite scroll
    EmailDetail.tsx       # Email viewer (sandboxed HTML iframe) + unsubscribe
    Subscriptions.tsx     # Deduplicated unsubscribeable senders
    Analytics.tsx         # Sender frequency analysis (bar charts)
    SemanticSearch.tsx    # In-browser vector search UI
    InsightsView.tsx      # Digest and filter-recipe workspace
    WeeklyDigestView.tsx  # Weekly digest view
    GmailFilterBuilder.tsx # Filter recipe studio
  lib/
    auth.ts               # better-auth config + Google OAuth
    auth-client.ts        # Client-side auth
    get-access-token.ts   # Google token refresh via auth.api.getAccessToken
    gmail.ts              # Gmail REST API client (429 exponential backoff)
    db.ts                 # IndexedDB schema + helpers
    embeddings.ts         # HuggingFace Transformers ONNX (in-browser)
    semantic-search.ts    # Cosine similarity search over stored embeddings
    digest.ts             # Weekly digest builder (pure)
    filter-builder.ts     # Gmail filter XML recipe builder
    security-headers.ts   # Security headers for /api/* responses
  db/
    schema.ts             # Drizzle schema (D1 auth tables)
landing-astro/            # Astro landing page (overlaid into deploy via build)
migrations/               # D1 SQL migrations
vite.config.ts            # Vite SPA build config
wrangler.toml             # Worker config: main=src/worker.ts
```

## Data flow

### Read flow (Gmail → browser)

```
User action → SPA → /api/emails → Hono Worker → Gmail REST API
  → 429 backoff (1s/2s/4s) → response → SPA → IndexedDB cache
```

- Gmail fetched on demand via worker with 429 exponential backoff.
- Cached in IndexedDB `email-search` v2 (`emails` store, `by-date` index).
- `StoredEmail` = `Email` + `embedding: number[] | null`.

### Embedding flow (in-browser)

```
StoredEmail (no embedding) → embeddings.ts → ONNX WASM pipeline
  → 384-dim float32 vector → normalized → stored back in IndexedDB
```

- Model: `Xenova/all-MiniLM-L6-v2` at `fp32` (~23 MB download from HuggingFace CDN).
- Single-threaded WASM (no `SharedArrayBuffer` — COOP/COEP headers not set).
- `getEmailsWithoutEmbedding` finds unembedded emails; full table scan (see
  [`../knowledge/learnings/lessons.md`](../knowledge/learnings/lessons.md) lesson 6).

### Semantic search flow

```
User query → embeddings.ts → query vector → semantic-search.ts
  → cosine similarity (dot product, normalized) over all stored embeddings
  → ranked results → SemanticSearch.tsx UI
```

### Auth flow

```
User → /api/auth/sign-in/social (POST) → better-auth → Google OAuth
  → callback /api/auth/callback/google → session in D1
  → refresh token stored (accessType: "offline")
  → auth.api.getAccessToken refreshes expired tokens transparently
```

### Unsubscribe flow

```
User click → POST /api/emails/:id/unsubscribe → RFC 8058 one-click POST
  → HTTPS-only List-Unsubscribe-Post → success or fallback URL
```

## IndexedDB schema (`src/lib/db.ts`)

- Database: `email-search` v2.
- Store `emails`: keyed by `id`, index `by-date`.
- Store `meta` (added in v2): holds the `inbox-sync` cursor (`nextPageToken`,
  `exhausted`, `lastSyncedAt`) so paged sync can resume where it left off.
- Record: `StoredEmail` = `Email` + `embedding: number[] | null`.
- Helpers: `storeEmails`, `getAllEmails`, `getEmailsWithoutEmbedding`,
  `getEmailCount`, `getIndexedCount`, `getInboxSyncMeta`, and `setInboxSyncMeta`.

## D1 schema (`migrations/0001_better_auth.sql`)

- Tables: `user`, `session`, `account`, `verification` (standard better-auth).
- Binding: `DB` → `email-manager-auth`.

## Worker API routes (`src/worker.ts`)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check (auth config status). |
| GET | `/api/auth/client-config` | Google client ID for SPA (no-store). |
| GET\|POST | `/api/auth/*` | better-auth handler (Google OAuth). |
| GET | `/api/emails` | List with `q`, `label`, `pageToken`, `maxResults` ≤500, `metadataOnly`. |
| GET | `/api/emails/:id` | Single email or thread. |
| POST | `/api/emails/:id/unsubscribe` | RFC 8058 one-click POST; HTTPS-only. |

## SPA routes (`src/router.tsx`)

- `/` → `LandingRedirect` (302 → `/app` if signed-in, else Astro landing).
- `/app` → `HomeClient` (Gmail cockpit; hash-based sub-views).
- `/about`, `/privacy` — static pages.
- `*` → `NotFoundPage`.

## Hash views inside `/app`

- `#today`, `#triage`, `#starred`, and `#trash` — compatibility aliases to `#inbox`.
- `#inbox`, `#sent` — mailbox lists + detail.
- `#search` — SemanticSearch (sync/index embeddings + query).
- `#subscriptions` — deduplicated unsubscribe candidates.
- `#insights` — weekly digest and Gmail filter recipe studio.
- `#digest`, `#filters` — compatibility aliases to `#insights`.
- `#analytics` — sender analytics by bucket.

## Build pipeline

```
vite build → dist/spa-index.html (SPA shell)
  → pnpm build:landing (Astro → landing-astro/dist/)
  → scripts/overlay-landing.mjs → dist/index.html (Astro landing)
  → wrangler deploy (dist/ as ASSETS binding)
```

The Astro landing is overlaid into `dist/index.html` — it is not a separate
Pages project. The Worker serves `dist/index.html` for `GET /` and
`dist/spa-index.html` for SPA routes.

## Wrangler config (`wrangler.toml`)

- `main = "src/worker.ts"`, `assets = { directory = "dist", binding = "ASSETS" }`.
- `compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]`.
- `[placement] mode = "smart"` — reduces D1 round-trip latency.
- `[observability] enabled = true, head_sampling_rate = 0.1`.
- `[[d1_databases]]` binding `DB` → `email-manager-auth`.
- Custom domain: `mail.significanthobbies.com`.
