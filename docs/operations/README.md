# Operations

How email-manager is deployed, configured, and operated. For executable
scripts, see [`../../scripts/`](../../scripts/) — these docs are the
human-readable companion.

## Files

- [`deployment.md`](deployment.md) — deploy model, Cloudflare Worker config,
  env vars, D1 binding, custom domain.
- [`foundry-evidence.md`](foundry-evidence.md) — privacy-safe build/sync/auth
  evidence for the Foundry.
- [`jobs/`](jobs/) — catalog of CI, Foundry evidence, and deploy workflows.
- [`runbooks/`](runbooks/) — step-by-step runbooks (local dev, OAuth setup,
  digest verify, deploy).

## Key operational commands

| Command | Purpose |
| --- | --- |
| `pnpm deploy` | Build + `wrangler deploy` to Cloudflare Workers |
| `pnpm build` | Vite build + Astro landing overlay → `dist/` |
| `pnpm typecheck` | TS check (app + worker) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | E2E tests (Playwright) |
| `pnpm digest:verify` | Golden-file digest fixture check |
| `pnpm check:docs` | Validate docs/ (broken links, empty docs, required files) |
| `pnpm foundry:evidence` | Generate privacy-safe `foundry-evidence.json` |

## External services

| Concern | Service |
| --- | --- |
| Hosting | Cloudflare Workers (`email-manager`) |
| Database | Cloudflare D1 (`email-manager-auth`) — auth tables only |
| Auth | better-auth + Google OAuth |
| Analytics | PostHog (`posthog-js`) |
| AI | `@huggingface/transformers` — client-side in browser |
| CI/CD | GitHub Actions — lint + build + unit test on push; deploy manual |

## Secrets (names only — never commit values)

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Local: `.dev.vars` (gitignored). Production: `wrangler secret put` or
`wrangler.toml` `[vars]` for non-secret config.

See [`deployment.md`](deployment.md) for full details.
