# Email Manager

Gmail inbox workspace with local-first semantic search. The app signs in with
Google, reads Gmail through the Gmail API, stores email metadata and embeddings
in the browser, and lets the user search, inspect, analyze, and unsubscribe
without persisting mailbox contents on the server.

Live app: <https://mail.significanthobbies.com>

## What It Does

- Browse Gmail views for inbox, starred, sent, trash, subscriptions, and analytics.
- Search normal email metadata and run semantic search over locally generated embeddings.
- Generate embeddings in-browser with Hugging Face Transformers / ONNX.
- Keep email data and embeddings in IndexedDB instead of a server database.
- Proxy Gmail reads through API routes with retry handling for rate limits.
- Surface sender analytics and deduplicated unsubscribe candidates.
- Unsubscribe through RFC 8058 one-click POST where available, with fallback links.

## Privacy Model

The server does not store email bodies, email lists, or generated embeddings.
Cloudflare D1 stores only better-auth tables for login/session state. Gmail data
is fetched on demand and cached locally in IndexedDB inside the browser.

## Deployment & External Services

| Concern | Service |
|---------|---------|
| Hosting | Cloudflare Workers (`email-manager`, email-manager.sarthakagrawal927.workers.dev) — Vite SPA + Hono worker |
| Database | Cloudflare D1 (`email-manager-auth`) for auth, via Drizzle ORM; email data + embeddings stored client-side in IndexedDB |
| Auth | better-auth + Google OAuth |
| Analytics | PostHog (`posthog-js`) |
| AI | `@huggingface/transformers` — runs client-side in the browser for semantic search |
| CI/CD | GitHub Actions — `ci.yml` (lint/typecheck/test/build) on push/PR to `main`; `deploy.yml` deploys to Cloudflare Workers on manual `workflow_dispatch` only (production deploys are manual) |

## Local Development

```bash
pnpm install
cp .env.example .dev.vars   # wrangler reads secrets from .dev.vars locally
pnpm dev
```

`pnpm dev` runs **two processes**:

- **Vite** at <http://localhost:5173> — SPA routes (`/app`, `/about`, `/privacy`); proxies `/api/*` to wrangler
- **Wrangler** at <http://localhost:8787> — Hono API + static assets after `pnpm build`

For a full production-like stack (Astro landing at `/` + API), build first then use wrangler alone:

```bash
pnpm build
pnpm dev:api
```

Open <http://localhost:8787>.

Required secrets (`.dev.vars` / `wrangler secret put`):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Optional client build var (`.env` or `.env.local` for Vite):

- `VITE_POSTHOG_KEY`

Google OAuth must allow the local and production callback URLs:

- `http://localhost:8787/api/auth/callback/google`
- `https://mail.significanthobbies.com/api/auth/callback/google`

## Scripts

- `pnpm dev` — Vite SPA + `wrangler dev` (API)
- `pnpm dev:api` — `wrangler dev` only
- `pnpm dev:spa` — Vite only
- `pnpm build` — Vite build + Astro landing overlay → `dist/`
- `pnpm typecheck` — TypeScript check (app + worker)
- `pnpm lint` — Biome (`biome check .`)
- `pnpm test` — Vitest unit suite
- `pnpm test:e2e` — Playwright e2e suite
- `pnpm check:docs` — documentation validation (`scripts/check-docs.mjs`)
- `pnpm deploy` — build and deploy to Cloudflare Workers

## Architecture

```text
src/worker.ts            Hono worker — /api/*, SPA shell routing, Astro landing at /
src/pages/HomeClient.tsx Gmail cockpit (/app)
landing-astro/           Static marketing landing (overlaid to dist/index.html)
src/components/          mailbox, search, analytics, unsubscribe UI
src/lib/auth.ts          better-auth + Google token refresh
src/lib/gmail.ts         Gmail REST client with 429 backoff
src/lib/db.ts            IndexedDB schema and helpers
src/lib/embeddings.ts    browser-side embedding model loading
dist/spa-index.html      Vite SPA shell served for /app, /about, /privacy
```

Key constraints:

- Gmail OAuth scope is read-only.
- Email content and embeddings stay client-side.
- Hugging Face Transformers must remain browser-safe; avoid adding Node-only ML dependencies.
- D1 bindings resolve only under `wrangler dev` / deployed worker — use `pnpm dev` or `pnpm dev:api` for `/api/*`.

## Verification

Before changing behavior, run the smallest relevant check:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

## Automation Safety

This app is **read-only by design**. It does not send, reply, archive, delete, or
modify any emails. The only non-read action available is unsubscribe, which always
requires an explicit user click and opens the sender's unsubscribe flow — nothing
happens automatically.

If automation features are added in the future (e.g. scheduled triage, AI-suggested
labels), the policy is:

- No action is taken on any email without an explicit user confirmation step.
- Bulk or destructive actions show a summary and require a deliberate "Review &
  confirm" gesture before executing.
- Automated suggestions are surfaced as drafts or previews, never applied silently.

Users can rely on the app not taking any action on their mailbox unless they
initiate it themselves.

## Current Status

Stable maintenance app. Migrated off OpenNext to Vite SPA + Hono worker (2026-06-20).
The remaining production setup footgun is Google OAuth: the deployed callback URL
must be present in the Google Cloud Console OAuth app, otherwise sign-in fails with
`redirect_uri_mismatch`.

See `agents.md` for implementation conventions and deeper architecture notes.
See `docs/README.md` for the full knowledge-system layout (product, architecture,
decisions, development, operations, learnings).

<!-- ACTIVE-AI-TASK-LOG:START -->
## Active AI Task Log

This section is maintained by the SaaS Maker Active-AI product/design loop so future agents do not reopen duplicate UI tasks.

- Business lane: P2 Watch / maintenance
- Rule: do not create another broad "improve the UI" task unless the acceptance criteria differ materially from the tasks listed here.
- Source of truth for task status: SaaS Maker task board. README entries are durable context only.

- 2026-05-26: Added "Automation Safety" section (task 74061467) — P2 trust maintenance. Documents read-only guarantee and review-before-send policy for any future automation features.
- 2026-06-20: De-OpenNext migration — Vite SPA + Hono worker per fleet PRD §6.2.
<!-- ACTIVE-AI-TASK-LOG:END -->