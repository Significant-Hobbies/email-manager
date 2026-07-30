# Deployment

## Deploy target

Cloudflare Worker `email-manager` serving `mail.significanthobbies.com`.

- Worker entry: `src/worker.ts` (Hono).
- Assets: `dist/` directory via `ASSETS` binding.
- D1 binding: `DB` → `email-manager-auth` (`e770dfa2-1032-4a12-b0fb-52e77f5319e8`).
- Custom domain: `mail.significanthobbies.com` (configured in `wrangler.toml`).
- Smart Placement: `[placement] mode = "smart"` — reduces D1 round-trip latency.
- Observability: enabled, 10% head sampling.
- CPU limit: 30000ms.

## Deploy process

Production deploys are **manual**. `main` stays releasable and green; it is not
an auto-deploy trigger.

### Option 1: CLI

```bash
pnpm deploy    # pnpm build && wrangler deploy
```

### Option 2: GitHub Actions (workflow_dispatch)

The `deploy.yml` workflow can be triggered manually from the Actions tab. It
builds and runs `wrangler deploy` with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets. A post-deploy smoke check curls the production
worker URL.

## Wrangler config (`wrangler.toml`)

```toml
name = "email-manager"
main = "src/worker.ts"
compatibility_date = "2025-09-23"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

assets = { directory = "dist", binding = "ASSETS", not_found_handling = "none" }

routes = [
  { pattern = "mail.significanthobbies.com", custom_domain = true },
  { pattern = "mail.sassmaker.com", custom_domain = true }
]

[placement]
mode = "smart"

[observability]
enabled = true
head_sampling_rate = 0.1

[limits]
cpu_ms = 30000

[[d1_databases]]
binding = "DB"
database_name = "email-manager-auth"
database_id = "e770dfa2-1032-4a12-b0fb-52e77f5319e8"
migrations_dir = "migrations"

[vars]
NODE_ENV = "production"
BETTER_AUTH_URL = "https://mail.significanthobbies.com"
```

### SPA vs landing asset serving

`wrangler.toml` uses `not_found_handling = "none"` (not SPA fallback) because
`index.html` is the Astro landing — SPA fallback would serve the landing page
for `/app` navigations. The Worker handles SPA route serving explicitly from
`dist/spa-index.html`.

## Environment variables

### Secrets (set via `wrangler secret put` or `.dev.vars` locally)

| Secret | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `BETTER_AUTH_SECRET` | better-auth session signing secret |

### Non-secret vars (`wrangler.toml` `[vars]`)

| Var | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `BETTER_AUTH_URL` | `https://mail.significanthobbies.com` |

### Client build var (Vite, `.env` or `.env.local`)

| Var | Purpose |
| --- | --- |
| `VITE_POSTHOG_KEY` | PostHog project key (inlined at build time) |

## D1 migrations

Migrations live in `migrations/`. Current: `0001_better_auth.sql` (creates
`user`, `session`, `account`, `verification` tables).

Apply via `wrangler d1 migrations apply email-manager-auth` (production) or
`wrangler d1 migrations apply email-manager-auth --local` (local dev).

## OAuth callback URLs

Must be registered in Google Cloud Console (see
[`runbooks/oauth-setup.md`](runbooks/oauth-setup.md)):

- `http://localhost:8787/api/auth/callback/google`
- `https://mail.significanthobbies.com/api/auth/callback/google`

`redirect_uri_mismatch` errors mean the callback URL is not registered. This is
the most common setup footgun for new environments.

## Post-deploy smoke check

```bash
curl --fail --silent --show-error --location --max-time 30 \
  https://email-manager.sarthakagrawal927.workers.dev >/dev/null
```

The `deploy.yml` workflow runs this automatically after deploy. For manual
deploys, run it yourself.

## CSP and security headers

All `/api/*` responses get security headers via middleware
(`src/lib/security-headers.ts`). The landing page CSP allows Cloudflare Web
Analytics and HuggingFace CDN shards for the ONNX model download (see
[`../knowledge/learnings/lessons.md`](../knowledge/learnings/lessons.md) lesson 2).
