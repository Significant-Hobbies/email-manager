# Development Workflows

## Local setup

```bash
pnpm install
cp .env.example .dev.vars   # wrangler reads secrets from .dev.vars locally
pnpm dev
```

`pnpm dev` runs **two processes** concurrently:

- **Vite** at http://localhost:5173 — SPA routes (`/app`, `/about`, `/privacy`);
  proxies `/api/*` to wrangler.
- **Wrangler** at http://localhost:8787 — Hono API + static assets after
  `pnpm build`.

For a full production-like stack (Astro landing at `/` + API), build first then
use wrangler alone:

```bash
pnpm build
pnpm dev:api
```

Open http://localhost:8787.

### Required secrets (`.dev.vars` / `wrangler secret put`)

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

### Optional client build var (`.env` or `.env.local` for Vite)

- `VITE_POSTHOG_KEY`

### OAuth callback URLs

Must be registered in Google Cloud Console (see
[`../operations/runbooks/oauth-setup.md`](../operations/runbooks/oauth-setup.md)):

- `http://localhost:8787/api/auth/callback/google`
- `https://mail.significanthobbies.com/api/auth/callback/google`

## Build

```bash
pnpm build
```

Build pipeline:
1. `vite build` → `dist/spa-index.html` (SPA shell) + assets.
2. `pnpm build:landing` (Astro → `landing-astro/dist/`).
3. `scripts/overlay-landing.mjs` → `dist/index.html` (Astro landing overlaid).

The Worker serves `dist/index.html` for `GET /` and `dist/spa-index.html` for
SPA routes. `dist/` is the `ASSETS` binding directory in `wrangler.toml`.

## Typecheck

```bash
pnpm typecheck
```

Runs `tsc --noEmit` against `tsconfig.app.json` and `tsconfig.worker.json`.

## Lint

```bash
pnpm lint       # biome check .
pnpm format     # biome format --write .
```

## Deploy

Production deploys are **manual**. `main` stays releasable and green; it is not
an auto-deploy trigger.

```bash
pnpm deploy    # build + wrangler deploy
```

Or via GitHub Actions `workflow_dispatch` on the `deploy.yml` workflow. See
[`../operations/deployment.md`](../operations/deployment.md) for full details.

## Verification before changing behavior

Run the smallest relevant check:

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
pnpm digest:verify
pnpm check:docs
```

## D1 bindings note

D1 bindings resolve only under `wrangler dev` / deployed worker. Use `pnpm dev`
or `pnpm dev:api` for `/api/*` routes. Vite-only mode (`pnpm dev:spa`) will not
have working D1 bindings — it proxies `/api/*` to wrangler.
