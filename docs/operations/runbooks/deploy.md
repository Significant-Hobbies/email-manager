# Runbook: Deploy to Cloudflare Workers

Production deploys are **manual**. `main` should stay releasable and green, but
pushing to `main` is not an auto-deploy trigger.

## Prerequisites

- `main` is green (CI passes: `pnpm lint && pnpm test:unit && pnpm build`).
- No uncommitted changes on `main`.
- Cloudflare API token and account ID available (for Actions deploy) or
  `wrangler` authenticated locally.

## Option 1: CLI deploy

```bash
git checkout main
git pull
pnpm deploy    # pnpm build && wrangler deploy
```

### Post-deploy smoke check

```bash
curl --fail --silent --show-error --location --max-time 30 \
  https://email-manager.sarthakagrawal927.workers.dev >/dev/null && echo "OK"
curl --fail --silent --show-error --location --max-time 30 \
  https://mail.significanthobbies.com/api/health | jq .auth.googleConfigured
# Should be: true
```

## Option 2: GitHub Actions (workflow_dispatch)

1. Go to the repo's **Actions** tab.
2. Select the **Deploy to Cloudflare Workers** workflow.
3. Click **Run workflow** on `main`.
4. The workflow builds, deploys via `wrangler deploy`, and runs a post-deploy
   smoke check automatically.

Required repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## What to check after deploy

- [ ] `https://mail.significanthobbies.com/` loads the Astro landing.
- [ ] `https://mail.significanthobbies.com/api/health` returns `googleConfigured: true`.
- [ ] `https://mail.significanthobbies.com/app` loads the SPA shell.
- [ ] Sign-in flow works (Google OAuth callback resolves).
- [ ] No CSP errors in browser console (especially HuggingFace CDN for ONNX
      model — see [`../../knowledge/learnings/lessons.md`](../../knowledge/learnings/lessons.md) lesson 2).

## Rollback

Cloudflare Workers supports instant rollback via the dashboard or:

```bash
wrangler deployments list    # see recent deployments
wrangler deployments rollback
```

## D1 migrations

If a migration is needed (rare — auth schema is stable):

```bash
wrangler d1 migrations apply email-manager-auth          # production
wrangler d1 migrations apply email-manager-auth --local  # local dev
```

See [`../deployment.md`](../deployment.md) for full D1 config.
