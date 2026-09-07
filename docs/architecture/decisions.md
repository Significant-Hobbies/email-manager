# Architecture Decision Records — email-manager

One-page ADR log. Each entry: decision, alternatives considered, rationale, and tradeoffs.
For product-phase context see [`../retros/`](../retros/). For PRD-level detail see [`../plans/`](../plans/).

---

## ADR-001 — In-browser ONNX inference via Transformers.js (not server-side)

**Date:** 2026-04-02 (first commit of `src/lib/embeddings.ts`)
**Status:** Accepted

**Decision:** Run `@huggingface/transformers` (ONNX runtime, WASM backend) in the browser via a `"use client"` component. No server-side ML.

**Alternatives:**
- Server-side inference (CF Workers AI, dedicated ML API)
- Hybrid: embed on first fetch, cache in D1

**Rationale:**
- Privacy-by-design: email text never leaves the browser. Aligns with the core "no server-side email storage" promise.
- Zero inference cost (no tokens/API calls per user).
- CF Workers has a 1 MB gzip bundle limit and no native module support — `onnxruntime-node` and native `.node` binaries cannot run in a Worker at all.

**Tradeoffs:**
- First embedding run downloads the ONNX model (~23 MB for `Xenova/all-MiniLM-L6-v2`) from HuggingFace CDN.
- WASM SIMD is not available on all mobile devices; single-threaded execution on older clients.
- Model must be stubbed out on the server side (webpack alias `@huggingface/transformers: false` + `serverExternalPackages`), requiring a custom OpenNext patch.

**Key files:** `src/lib/embeddings.ts`. (Historically required `next.config.ts` webpack aliases + `patches/opennext-cloudflare-externals.js` to keep ONNX out of the OpenNext server bundle — no longer needed after the 2026-06-20 Vite SPA migration; Vite handles client-only imports natively.)

---

## ADR-002 — Model selection: `Xenova/all-MiniLM-L6-v2` at `fp32`

**Date:** 2026-04-02
**Status:** Accepted

**Decision:** Use `Xenova/all-MiniLM-L6-v2` for feature-extraction via `pipeline("feature-extraction", ..., { dtype: "fp32" })`. Normalize output to enable cosine similarity via dot product.

**Alternatives:**
- Larger models (e.g. `Xenova/all-mpnet-base-v2`): better recall, ~4× larger download.
- Quantized (`int8`, `q4`): smaller and faster, quality penalty unknown.

**Rationale:**
- MiniLM-L6 is the canonical small-but-capable semantic search model; widely used in Transformers.js examples.
- `fp32` chosen for reliability (quantized WASM paths had reported accuracy regressions at the time).
- TBD: capture exact rationale for fp32 over int8 beyond initial prototyping choice.

**Tradeoffs:**
- 384-dim output stored per email in IndexedDB. At 10k emails ≈ 15 MB of float32 vectors in browser storage.

**Key files:** `src/lib/embeddings.ts`

---

## ADR-003 — IndexedDB as primary email store (not server DB)

**Date:** 2026-02-24 (initial commit)
**Status:** Accepted

**Decision:** Email metadata, bodies, and embeddings are cached exclusively in browser IndexedDB (`idb` wrapper, `email-search` DB v2 — `emails` store plus a `meta` store for the sync cursor). The server (CF Workers + D1) stores only auth tables.

**Alternatives:**
- Store emails in D1: would require server-side Gmail fetch, indexing, and data-at-rest compliance.
- No local cache: fetch from Gmail API on every page load, hitting rate limits quickly.

**Rationale:**
- Single strongest privacy guarantee: if the server is breached, no mailbox data leaks.
- Avoids GDPR/CCPA storage obligations for email content.
- Gmail API rate limits (429) make uncached fetching impractical for analytics over large inboxes.
- LocalStorage is too small for email bodies; IndexedDB handles tens of thousands of records.

**Tradeoffs:**
- Data does not survive clearing browser storage. No multi-device access.
- No server-side search; all querying happens on the client over fetched data.
- Embeddings are reproducible but re-generating them on a new device takes CPU time.

**Key files:** `src/lib/db.ts`, `README.md` (Privacy Model section)

---

## ADR-004 — Cloudflare Workers + D1 for the auth/metadata tier

**Date:** 2026-04-25 (CF Workers migration)
**Status:** Accepted

**Decision:** Deploy on Cloudflare Workers. Use CF D1 (`email-manager-auth`) for better-auth session/account tables only. (Originally via `@opennextjs/cloudflare` (OpenNext); migrated to Vite SPA + Hono Worker on 2026-06-20 — see [`../knowledge/failed-approaches/2026-06-20-opennext-build-pipeline.md`](../knowledge/failed-approaches/2026-06-20-opennext-build-pipeline.md).)

**Alternatives:**
- Vercel (default Next.js target): easier deploys, no OpenNext needed.
- CF Pages (tried briefly, 2026-04-25): Pages does not support arbitrary Workers runtime; reverted to Workers within the same day.

**Rationale:**
- CF Workers global edge network; latency-sensitive OAuth redirects and Gmail proxy calls.
- D1 is co-located with the Worker, minimizing auth round-trip on session lookup.
- Smart Placement (`[placement] mode = "smart"`) further reduces D1 latency.
- CF free tier covers this app's scale.

**Tradeoffs:**
- OpenNext adds significant build complexity (see ADR-007).
- Worker bundle size limit (1 MB compressed) forces careful exclusion of native modules.
- D1 row/storage limits are generous for auth-only use; would constrain server-side email storage if ever attempted.

**Key files:** `wrangler.toml`, `src/worker.ts` (Hono Worker entry; replaced `worker.mjs` + `open-next.config.ts` on 2026-06-20)

---

## ADR-005 — better-auth with Google OAuth (not NextAuth)

**Date:** 2026-04-25 (migration commit)
**Status:** Accepted

**Decision:** Use `better-auth` with the `drizzleAdapter` pointing at D1. Replaced NextAuth.js.

**Alternatives:**
- NextAuth.js v4 (original): bypassed OIDC discovery step broke on CF Workers edge runtime.
- NextAuth.js v5 (Auth.js): TBD: rationale for not upgrading instead of migrating.
- Roll own session management: excessive complexity.

**Rationale:**
- NextAuth's OIDC discovery (`/.well-known/openid-configuration`) fetch failed on CF Workers at initial setup; a fix was attempted (`bypass OIDC discovery`) but fragile.
- `better-auth` provides a Drizzle adapter that integrates cleanly with D1; has first-class offline-access/refresh-token support needed for Gmail.
- `accessType: "offline"` + `prompt: "consent"` ensures a refresh token is issued, enabling `auth.api.getAccessToken` to transparently renew expired tokens.

**Tradeoffs:**
- `better-auth` is younger than NextAuth; smaller community.
- Auth env is a dual-lookup pattern (`env[key] ?? process.env[key]`) to support both CF Workers bindings and local Next.js dev.

**Key files:** `src/lib/auth.ts`, `src/lib/get-access-token.ts`, `src/db/schema.ts`, `migrations/0001_better_auth.sql`

---

## ADR-006 — Drizzle ORM for D1 schema management

**Date:** 2026-04-25
**Status:** Accepted

**Decision:** Use `drizzle-orm` with `drizzle-orm/d1` driver. Schema defined in `src/db/schema.ts`; migrations in `migrations/`.

**Alternatives:**
- Raw D1 SQL: simpler, no dependency, but no type safety.
- Prisma: no D1 adapter at the time; requires prisma-client which cannot bundle in Workers.

**Rationale:**
- better-auth's `drizzleAdapter` requires Drizzle; it was already a forced dependency.
- Typed schema catches column/type drift at build time.

**Tradeoffs:**
- D1 schema is auth-only (4 tables). Drizzle overhead is minimal for this surface.
- `@libsql/client` listed as a dependency despite not being used for D1 access; likely a transitive requirement from better-auth or residual from an earlier libSQL migration path. TBD: verify if removable.

**Key files:** `src/db/schema.ts`, `migrations/0001_better_auth.sql`, `src/lib/auth.ts`

---

## ADR-007 — OpenNext + custom worker entry + Beasties build pipeline

**Date:** 2026-04-25 through 2026-06-04 (iterative)
**Status:** Superseded (2026-06-20 De-OpenNext migration — see [`../knowledge/failed-approaches/2026-06-20-opennext-build-pipeline.md`](../knowledge/failed-approaches/2026-06-20-opennext-build-pipeline.md)). Kept for historical context.

**Decision:** Use `@opennextjs/cloudflare` to adapt the Next.js build for Workers. Wrap the generated worker in a custom `worker.mjs` that handles edge caching for `/`. Run Beasties (critical-CSS inlining) post-build, before the OpenNext `--skipNextBuild` pass.

**Alternatives:**
- Use OpenNext directly without a custom worker entry: no edge cache for `/`, higher TTFB.
- Use CF Pages Functions: tried and reverted (2026-04-25); Pages runtime constraints don't support the required Worker APIs.

**Rationale:**
- `caches.default` in a custom worker entry avoids needing CF Cache Rules (zone-level configuration) for edge caching.
- Beasties inlines above-the-fold CSS, improving LCP. Must run before `--skipNextBuild` so OpenNext serves the modified HTML (via `staticAssetsIncrementalCache`).
- `overlay-astro-landing.mjs` replaces the OpenNext-rendered `/` with a pre-built Astro static page for ~30ms TTFB vs ~250ms from the Next.js SSR path.

**Tradeoffs:**
- Complex multi-step build: patch → next build → Beasties → OpenNext `--skipNextBuild` → populateCache → Astro build → overlay. Any step failure is opaque.
- The `patches/opennext-cloudflare-externals.js` script patches OpenNext's internal `bundle-server.js` and must be re-checked on OpenNext upgrades.
- The `scripts/cf-build.mjs` workaround (copy full Next.js dist into `.next/node_modules/.pnpm` store) is required because pnpm sparse installs drop files that OpenNext's esbuild needs.

**Key files:** `worker.mjs` (removed), `open-next.config.ts` (removed), `scripts/cf-build.mjs` (removed), `scripts/inline-critical-css.mjs` (removed), `scripts/overlay-astro-landing.mjs` (removed), `patches/opennext-cloudflare-externals.js` (removed). All removed in the 2026-06-20 De-OpenNext migration to Vite SPA + Hono worker.

---

## ADR-008 — Gmail proxy through API routes (not direct client fetch)

**Date:** 2026-02-24
**Status:** Accepted

**Decision:** All Gmail API calls go through Worker API routes (`/api/emails`, `/api/emails/:id`) that hold the access token server-side. The browser never receives the OAuth access token. (Originally Next.js API routes; migrated to Hono Worker routes on 2026-06-20.)

**Alternatives:**
- Client-side Gmail fetch with token passed to the browser: simpler, but leaks the token to JS.

**Rationale:**
- Access token and refresh token stay in D1 / server memory only.
- Rate-limit retry logic (exponential backoff on 429) lives in `src/lib/gmail.ts` on the server, reducing complexity on the client.

**Tradeoffs:**
- Every Gmail fetch adds one server round-trip (client → CF Worker → Gmail API → client). On cold start this adds latency.

**Key files:** `src/lib/gmail.ts`, `src/worker.ts` (Hono routes for `/api/emails`, `/api/emails/:id`)

---

## ADR-009 — Sync strategy: pull-on-demand, no background sync

**Date:** 2026-02-24
**Status:** Accepted

**Decision:** Emails are fetched from Gmail on user action (page load, scroll, explicit search). There is no background sync, no cron, and no push from Gmail (no Pub/Sub watch).

**Alternatives:**
- Gmail Pub/Sub push notifications: real-time inbox updates; requires server-side state and a writable webhook endpoint.
- Periodic background sync (Service Worker): more complex, requires `gmail.readonly` to remain valid in background.

**Rationale:**
- Keeps the app stateless on the server — no sync state to manage.
- Gmail Pub/Sub requires a topic subscription and `gmail.modify` or topic management scopes outside the read-only model.
- IndexedDB cache means repeat page loads are fast without re-fetching.

**Tradeoffs:**
- Inbox is only as fresh as the last manual load. New mail is not surfaced in real time.
- Large inboxes require multiple explicit "load more" actions before analytics/digest have enough data.


## ADR-010: Explicit account ownership for browser mail caches (2026-09-07)

The previous global `email-search` cache could expose another signed-in user's
messages, embeddings and pagination cursor on the same browser. Each storage
operation now requires the authenticated user ID; the database is
`email-search-account:<encoded user ID>` with the existing v2 schema. Sync,
indexing, search and digest capture that identity explicitly. An account-keyed
provider resets visible mailbox and selected-message state; hover body caches
also include account identity. Mailbox requests identify their expected account,
and token lookup rejects a mismatching session before contacting Gmail.

The legacy unscoped database is neither opened nor deleted. Its ownership is
unknown, so it must not be automatically migrated into the current account.
Users will resync a fresh scoped cache after this source is deployed. This is
application account isolation, not encryption or protection from someone who
controls the browser profile and its developer tools.

`pnpm verify:local-mailbox` uses a fresh Chrome context, actual IndexedDB and
application sync/index/search/digest modules. Gmail responses and embeddings are
explicit fixtures; external traffic and mutations are blocked. It verifies
same-ID account separation, cursors, delayed refresh completion, body reads and
unscoped rejection. Live OAuth, provider data and model ranking quality remain
separate qualification gates. Implementation tracking: [#53](https://github.com/Significant-Hobbies/email-manager/issues/53).
