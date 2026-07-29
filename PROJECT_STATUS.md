# email-manager — PROJECT STATUS
Last updated: 2026-07-25

## Why / What

**Email Manager** is a Gmail inbox workspace with local-first semantic search. Product thesis: read-only Gmail cockpit where mailbox contents and embeddings never leave the browser — server stores only auth sessions.

**Users:** Gmail users wanting semantic search, sender analytics, unsubscribe workflows, and weekly digest reflection without server-side mailbox storage.

**Constraints:** Stable maintenance mode after De-OpenNext migration (2026-06-20). Gmail OAuth scope is read-only. Unsubscribe requires explicit user click. Automation safety: no silent mailbox mutations.

**IN scope:** Vite SPA + Hono worker, Astro landing, IndexedDB cache, client-side embeddings, digest/filter studio, and sender insights.

**OUT of scope:** Server-side digest cron/delivery, LLM-written digest prose, automatic Today Little Log sync, saved filter presets, commercial "personal reporter" positioning.

## Dependencies

### External

- **Google OAuth (better-auth):** read-only Gmail scopes (`openid`, `email`, `profile`, `gmail.readonly`); offline access with consent prompt.
- **Gmail REST API:** fetched on demand via worker with 429 exponential backoff (1s/2s/4s).
- **Hugging Face Transformers/ONNX:** client-side embeddings in IndexedDB (`@huggingface/transformers`).
- **PostHog:** client analytics (`VITE_POSTHOG_KEY`).
- **Cloudflare:** Workers (Hono), D1 (`email-manager-auth`).
- **Secrets (names only):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

### Internal (fleet)

- **Today Little Log:** manual digest export via `digestToTodayLittleLogExport()` clipboard copy only — no automatic sync.

### Stack & commands

**Stack:** Vite SPA + Hono worker on Cloudflare Workers; Astro landing at `/`; better-auth + Google OAuth on D1 (Drizzle); client-side `@huggingface/transformers` embeddings in IndexedDB; PostHog; React Router v7.

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install deps |
| `cp .env.example .dev.vars` | Local wrangler secrets |
| `pnpm dev` | Vite :5173 + wrangler :8787 |
| `pnpm dev:api` | Wrangler only (after build) |
| `pnpm dev:spa` | Vite only |
| `pnpm build` | Vite build + Astro overlay → `dist/` |
| `pnpm typecheck` | TS check (app + worker) |
| `pnpm lint` | Biome (`biome check .`) |
| `pnpm test:e2e` | Playwright (desktop + mobile) |
| `pnpm digest:verify` | Golden-file digest fixture check |
| `pnpm deploy` | Build + `wrangler deploy` |

**OAuth callbacks (must register in Google Cloud Console):**
- `http://localhost:8787/api/auth/callback/google`
- `https://mail.sassmaker.com/api/auth/callback/google`

## Timeline

- **2026-07-29:** Added the first-party `/changelog` surface to the Astro public site. The page records verified product history, keeps planned work in GitHub Issues, and links to the canonical `sass-maker/email-manager` source repository.
- **2026-07-25:** Removed the redundant general weekly quality workflow. Typechecking now runs in the required push/PR CI job alongside lint, unit tests, build, and docs validation; Playwright remains a release-relevant local check. The privacy-safe Foundry evidence snapshot remains the only recurring GitHub Action.
- **2026-07-20:** Completed the earlier triage de-scope: removed the unreachable queue/session implementation and stale action state, retained `#today` and `#triage` as compatibility aliases to Inbox, and aligned product, architecture, and landing documentation. Historical triage PRDs remain archived.
- **2026-07-19:** Added privacy-safe Foundry evidence automation: durable sync failure recording (`InboxSyncMeta.lastError` with sanitized stage/class/timestamp, cleared on success), `classifySyncError()` helper, sync lifecycle unit tests (`src/lib/__tests__/inbox-sync.test.ts`), `pnpm foundry:evidence` script (`scripts/foundry-evidence.mjs`) that generates `foundry-evidence.json` with build/sync/auth invariants (no email content or tokens), and `foundry-evidence.yml` CI workflow that uploads the artifact on push + weekly. See `docs/operations/foundry-evidence.md`.
- **2026-07-13:** Allowed Cloudflare Web Analytics in the production CSP so the canonical `mail.sassmaker.com` surface loads without blocked-script errors.

- **2026-07-04** — Keyboard-driven batch triage promoted to the primary `#today` interface: `j`/`k` + arrows navigate, `Shift+arrows` extend multi-select, `d`/`f`/`s` act on all selected (or focused) messages, `?` toggles a shortcut help overlay, `Esc` clears selection. Per-row kbd hints on the focused message; `ShortcutHelpOverlay` component shared by both the queue and the focused session. `isTypingTarget` extracted to `triage-session.ts` (duck-typed, Node-safe) so shortcuts never fire inside text inputs.
- **2026-07-03** — Keyboard triage session mode on `#today`: works through next 25 unread-but-unsorted messages one at a time with single-key actions (`d`/`f`/`s`, `j`/`k`, `Esc`); closes planned "triage keyboard shortcuts" item.
- **2026-07-02** — Added `app.onError()` global error handler to Hono worker (catches unhandled errors → 500 JSON + console.error logging).
- **2026-06-20** — De-OpenNext migration: Next.js+OpenNext → Vite SPA + Hono worker on Cloudflare Workers; Astro landing overlaid to `dist/index.html`; D1 only server DB (Turso residue removed).
- **2026-06-20** — Shipped PRD batch (2026-06-12): weekly digest, triage action queue, Gmail filter recipe studio.
- **2026-06-12** — PRD batch defined: weekly digest, triage queues, filter recipe studio.
- **Ongoing** — CI (lint + typecheck + unit tests + build + docs validation) runs on push/PR to `main`; deploys are manual (`pnpm deploy`, or `deploy.yml` via workflow_dispatch). The only scheduled workflow is the privacy-safe Foundry evidence snapshot.

## Products

- **Worker (SPA + API):** https://mail.sassmaker.com — worker `email-manager`; D1 `email-manager-auth` (`e770dfa2-1032-4a12-b0fb-52e77f5319e8`).
- **Landing:** `/` Astro static marketing overlaid to `dist/index.html` (not separate Pages project).
- **App shell:** `/app` SPA with hash-based sub-views; signed-in users 302 from `/` → `/app`.
- **Local dev:** Vite :5173 + wrangler :8787.

## Features (shipped)

### SPA routes (`src/router.tsx`)

- `/` → `RootLayout` with `Providers` + `ErrorBoundary`.
- `/app` → `HomeClient` (Gmail cockpit; hash-based sub-views).
- `/about`, `/privacy` — static pages.
- `*` → `NotFoundPage`.

### Hash views inside `/app` (`HomeClient.tsx`)

- `#today`, `#triage`, `#starred`, `#trash` — compatibility aliases to `#inbox`.
- `#inbox`, `#sent` — mailbox lists + detail.
- `#search` — SemanticSearch (sync/index embeddings + query).
- `#subscriptions` — deduplicated unsubscribe candidates.
- `#insights` — WeeklyDigestView + GmailFilterBuilder recipe studio.
- `#digest`, `#filters` — compatibility aliases to `#insights`.
- `#analytics` — sender analytics by bucket.
- Unauthenticated `/app` renders inline Google sign-in UI.

### Worker API (`src/worker.ts`)

- `GET|POST /api/auth/*` — better-auth handler (Google OAuth).
- `GET /api/emails` — list with `q`, `label`, `pageToken`, `maxResults` ≤500, `metadataOnly`.
- `GET /api/emails/:id` — single email.
- `POST /api/emails/:id/unsubscribe` — RFC 8058 one-click POST; HTTPS-only; fallback URL on failure.
- Security headers on all `/api/*` responses.

### Architecture

- `GET /` serves Astro landing; signed-in users 302 → `/app`.
- SPA shell at `/app`, `/about`, `/privacy` from `dist/spa-index.html`.
- Hono worker handles `/api/*`: better-auth, Gmail proxy reads, unsubscribe POST.
- Gmail fetched on demand via worker with 429 exponential backoff (1s/2s/4s); cached in IndexedDB `email-search` v2.
- Embeddings generated in-browser with Hugging Face Transformers/ONNX; semantic search client-side.
- D1 (`email-manager-auth`) stores only better-auth tables — no mailbox data.
- Build: Vite → `dist/spa-index.html`; Astro landing overlaid to `dist/index.html` via `scripts/overlay-landing.mjs`.

### IndexedDB schema (`src/lib/db.ts`)

- Database: `email-search` v2; store `emails` keyed by `id` (index `by-date`) + store `meta` (added in v2) holding the `inbox-sync` cursor.
- Record: `StoredEmail` = `Email` + `embedding: number[] | null`.
- Helpers: `storeEmails`, `getAllEmails`, `getEmailsWithoutEmbedding`, `getEmailCount`, `getIndexedCount`, `getInboxSyncMeta`, `setInboxSyncMeta`.

### D1 schema (`migrations/0001_better_auth.sql`)

- Tables: `user`, `session`, `account`, `verification` with standard better-auth columns.
- Binding: `DB` → `email-manager-auth`.

### Core inbox workspace

- Gmail read-only views across all hash routes above.
- Semantic search over locally generated embeddings; metadata search in lists.
- Gmail REST client (`src/lib/gmail.ts`) with 429 backoff.
- Sender analytics (bucketed sampling); deduped unsubscribe list.
- RFC 8058 one-click unsubscribe + fallback links; explicit user click required.
- PostHog events: signup, returned, activated, email_opened, digest_generated, digest_exported.

### UI components shipped

- `Sidebar` — nav for all views; mobile drawer.
- `WorkSurface` — split list/detail layout.
- `EmailList`, `EmailDetail` — mailbox rows, thread reader, and explicit unsubscribe.
- `SemanticSearch` — model load, index sync, semantic query.
- `Subscriptions`, `Analytics`, `WeeklyDigestView`, `GmailFilterBuilder`.
- `Providers`, `posthog-provider.tsx`, `ErrorBoundary`.

### Shipped PRD batch (2026-06-12, closed 2026-06-20)

**Weekly digest (`#digest`):**
- `WeeklyDigestView` renders `buildWeeklyDigest()` from IndexedDB.
- Sections: quiet relationships, threads to revisit, weekly themes.
- Open sender → inbox search `from:`; open thread → subject search.
- `digestToTodayLittleLogExport()` clipboard copy (manual only).
- Fixtures: `fixtures/digest-sample-emails.json`, `fixtures/weekly-digest-sample.json`; verify via `pnpm digest:verify`.

**Retired triage experiment:**
- The keyboard triage queue, focused session, and local action ledger shipped in July 2026 but were removed from navigation before maintenance mode.
- Their implementation was deleted on 2026-07-20; the historical PRD remains in `docs/archive/`.
- `#today` and `#triage` remain safe aliases to Inbox so old bookmarks do not break.

**Gmail filter recipe studio (`#filters`):**
- Categories: newsletter, receipt, notification, follow-up.
- Per-recipe: match rationale, `suggestedActionLines`, `archiveImpactLabel`.
- Side-by-side: selected recipes, Gmail XML (`buildGmailFilterXml`), `buildRecipeExplanation`.
- Sample sizes: 100 / 500 / 1k inbox messages; local deterministic suggestions.

### Marketing (Astro `landing-astro/`)

- Static `/` landing and `/changelog`: product introduction plus an owned, verified release history; CTA → `/app`.
- Built into `dist/index.html` — not separate Pages project.

### Tests

- Vitest unit (`pnpm test`): digest builder, filter builder, inbox sync, formatting, subscription senders, and sent-reply state (`src/lib/__tests__/`).
- Playwright: landing hero/features/CTA, no horizontal scroll, CTA touch target ≥44px (desktop + mobile).
- `pnpm digest:verify` golden-file check for digest builder.
- CI (`ci.yml`): lint + typecheck + unit tests + build + docs validation. Playwright is run locally before releases when relevant.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/sarthakagrawal927/email-manager/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
