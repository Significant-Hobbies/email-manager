# Lessons Learned — email-manager

Concrete, earned lessons from building this app. No general advice — only things that
actually burned time or required non-obvious fixes here.

For decision rationale see [`../../architecture/decisions.md`](../../architecture/decisions.md). For phase-level retrospectives see [`../../retros/`](../../retros/).

---

## Transformers.js / ONNX Runtime

### 1. You must hide the import specifier from server-side bundlers

`@huggingface/transformers` must be dynamically imported with `/* webpackIgnore: true */`
AND aliased to `false` in `webpack.resolve.alias` for server builds AND listed in
`serverExternalPackages`. All three are required — any one alone is not enough. The
OpenNext esbuild pass additionally needs the library marked as external via the patch in
`patches/opennext-cloudflare-externals.js`. Missing the esbuild step causes the Worker
bundle to include ONNX native stubs, which fail at deploy time.

```ts
// embeddings.ts — the triple escape hatch
const mod = "@huggingface/transformers";
const { pipeline } = await import(/* webpackIgnore: true */ /* @vite-ignore */ mod);
```

### 2. First inference is slow; model is downloaded from HuggingFace CDN

`Xenova/all-MiniLM-L6-v2` is ~23 MB (fp32 ONNX weights + tokenizer). The browser
downloads it from `cdn-lfs.huggingface.co` on first use. The CSP `connect-src` must
whitelist multiple HuggingFace CDN hosts (`cdn-lfs.huggingface.co`, `cdn-lfs-us-1.huggingface.co`,
`*.huggingface.co`) — the exact host varies by shard. A too-narrow CSP silently blocks
the model fetch with a network error that looks like an ONNX runtime crash.

### 3. Threading and SIMD

The WASM ONNX backend is single-threaded in this setup. `SharedArrayBuffer` (required
for multi-threaded WASM) needs `Cross-Origin-Opener-Policy: same-origin` +
`Cross-Origin-Embedder-Policy: require-corp` headers — not currently set, so threading
is disabled. For a small model over email-sized texts this is fine; for larger models
it would be the first thing to enable.

### 4. `fp32` vs quantized

`dtype: "fp32"` was chosen for reliability. Quantized variants (int8, q4) are smaller
and faster but had reported accuracy regressions in early Transformers.js v3 releases.
If model size becomes a concern, test `int8` first on a representative email set before
switching.

---

## IndexedDB

### 5. Schema migrations must gate on `oldVersion`

`src/lib/db.ts` opens `email-search` at `DB_VERSION = 2`. The `upgrade` callback
creates the `emails` store (with a `by-date` index) on first install, then adds
the `meta` store guarded by `oldVersion < 2` so existing v1 users get the new
store without clobbering their cached emails. Any future version (e.g. the
planned `digests` store from [`../../plans/2026-06-04-email-memories-digest.md`](../../plans/2026-06-04-email-memories-digest.md))
must bump `DB_VERSION` again and add another `oldVersion`-gated branch. Not
incrementing the version with a schema change silently ignores the change for
existing users; not gating on `oldVersion` re-runs migrations and can throw when
a store already exists.

### 6. `getEmailsWithoutEmbedding` does a full table scan

The current helper loads all emails into memory and filters in JavaScript. At a few
thousand emails this is fast. At 10k+ emails with 384-dim float vectors this will
become the bottleneck. A dedicated `embedded: 0|1` index would fix it, but requires
a version bump (see lesson 5).

### 7. Large attachment bodies in IndexedDB

Email bodies are stored as decoded UTF-8 strings including HTML. Emails with inline
base64 images (common in marketing HTML) can be 500 KB–2 MB per message. IndexedDB
has no per-record size limit, but the browser imposes a total quota (typically 60% of
available disk space). For typical inboxes this is fine; for power users syncing
thousands of marketing emails, consider stripping base64 `<img src="data:...">` before
storage. No guard currently exists.

---

## Cloudflare Workers

> **Note:** Lessons 9–16 below were written during the Next.js + OpenNext era
> (pre-2026-06-20). The app has since migrated to Vite SPA + Hono Worker
> (De-OpenNext migration). Lessons 9–13 about Workers runtime constraints
> (bundle limits, `global_fetch_strictly_public`, Smart Placement, `caches.default`,
> Pages vs Workers) remain relevant. Lessons 14–16 about the OpenNext/Beasties
> build pipeline are **historical** — the fragile multi-step build no longer
> exists. See
> [`../failed-approaches/2026-06-20-opennext-build-pipeline.md`](../failed-approaches/2026-06-20-opennext-build-pipeline.md).

### 9. 1 MB compressed bundle limit is the main constraint

CF Workers enforces a 1 MB gzip limit on the deployed bundle. `onnxruntime-node`,
`@huggingface/transformers`, and `sharp` must be excluded from the server bundle —
not just the runtime imports, but esbuild must mark them external. This requires
the `patches/opennext-cloudflare-externals.js` patch to OpenNext's `bundle-server.js`.
The patch must be re-validated on every `@opennextjs/cloudflare` upgrade.

### 10. `global_fetch_strictly_public` changes outbound fetch semantics

`wrangler.toml` sets `compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]`.
The `global_fetch_strictly_public` flag prevents the Worker from fetching internal
Cloudflare addresses. Useful for security but worth noting: any future internal
CF service integration would need to be reconsidered.

### 11. Smart Placement reduces D1 round-trip latency

`[placement] mode = "smart"` was added after a psi-swarm Lighthouse audit flagged
4.6s LCP on mobile due to render delay. Smart Placement moves the Worker to the
region closest to D1, cutting auth/session lookup latency. This is a free Cloudflare
feature but requires the Worker to be re-deployed after enabling.

### 12. `caches.default` vs Cache Rules

Using `caches.default.put/match` in `worker.mjs` sidesteps the need for zone-level
Cache Rules to cache HTML. Cache Rules are a dashboard setting that operators may not
have access to on shared zones. The `caches.default` approach works on any Workers
plan but the cache is per-PoP (not globally shared like CDN-Cache-Control).

### 13. CF Pages → Workers migration was same-day

The deploy target bounced CF Workers → CF Pages → CF Workers on 2026-04-25 within a
single day. CF Pages does not support the Workers runtime APIs (`caches.default`,
`ctx.waitUntil`, Durable Object exports) that OpenNext and the custom worker entry
depend on. Do not attempt a Pages deploy again without confirming OpenNext Pages support.

---

## Build Pipeline

### 14. pnpm sparse install drops Next.js dist files OpenNext needs

In a pnpm workspace, `.next/node_modules/.pnpm` gets a sparse install that omits
server-internal Next.js files (`dist/server/node-environment.js`, etc.). OpenNext's
esbuild step resolves these relative to `.next/node_modules`, finds them missing, and
fails. `scripts/cf-build.mjs` works around this by copying the full Next.js dist from
the Fleet workspace pnpm store into `.next/node_modules/.pnpm` and patching `.nft.json`
trace manifests. This needs to be re-verified whenever Next.js is upgraded.

### 15. Beasties critical-CSS inlining must run before `--skipNextBuild`

`inline-critical-css.mjs` modifies the HTML files in `.next/`. OpenNext's
`--skipNextBuild` reads from `.next/` to populate `.open-next/assets/`. If Beasties
runs after `--skipNextBuild`, the modified HTML never reaches the asset bundle.
The `staticAssetsIncrementalCache` override in `open-next.config.ts` is what makes
OpenNext serve the pre-rendered HTML from assets rather than re-rendering from `page.js`
— without it the inlined CSS would be overwritten at runtime.

### 16. The OpenNext patch is a string-replacement on a minified file

`patches/opennext-cloudflare-externals.js` searches for an exact string in
`@opennextjs/cloudflare/cli/build/bundle-server.js`. If OpenNext reformats or renames
that string the patch will log `patch target not found` and exit 1, blocking `cf:build`.
Keep `@opennextjs/cloudflare` pinned and read its CHANGELOG before upgrading.

---

## OAuth / Auth

### 17. The original NextAuth OIDC fix was fragile; better-auth was a cleaner replacement

The first auth layer was NextAuth with a custom `bypass OIDC discovery` fix because
CF Workers' edge runtime timed out on the `.well-known/openid-configuration` fetch
during cold starts. Rather than patching NextAuth further, the migration to better-auth
(2026-04-25) solved this by avoiding OIDC discovery entirely in favor of direct
Google OAuth endpoints.

### 18. Raw `SELECT accessToken` never refreshed; `auth.api.getAccessToken` does

The original Gmail token lookup was a direct D1 query for `accessToken` from the
`account` table. Access tokens expire after 1 hour. `auth.api.getAccessToken` from
better-auth transparently refreshes the token when it is near expiry (via the stored
`refreshToken` from `accessType: "offline"`). The raw query path was silently failing
after the first hour, forcing users to re-sign-in. Fixed in `src/lib/get-access-token.ts`
on 2026-06-10.

### 19. Google OAuth callback URL must match exactly in GCP Console

`redirect_uri_mismatch` errors mean the callback URL in Google Cloud Console does not
match the deployed URL. Both `http://localhost:3000/api/auth/callback/google` and
`https://mail.significanthobbies.com/api/auth/callback/google` must be
registered. This is a manual step with no automation; it is the most common setup
footgun for new environments.

### 20. Double-gzip caused a garbled landing page

`worker.mjs` compresses the Astro landing HTML with `CompressionStream("gzip")`. The
Workers runtime's default `encodeBody: "automatic"` mode re-compressed the already-gzipped
stream. Fix: set `encodeBody: "manual"` so the runtime passes the bytes through
unchanged. Browsers received double-compressed bytes silently — the landing rendered as
binary garbage with no console error.
