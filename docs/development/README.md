# Development

Development workflows, testing strategy, and quality gates for email-manager.

## Files

- [`workflows.md`](workflows.md) — local dev, build, test, deploy workflows;
  environment setup; secrets.
- [`testing.md`](testing.md) — testing strategy: unit (Vitest), e2e (Playwright),
  digest fixture verification; what is and is not covered by CI.
- [`astro-6-compatibility-review.md`](astro-6-compatibility-review.md) — scoped
  review of upgrading landing-astro to Astro 6 and the image-size advisory
  exceptions (issue #32).

## Quick reference

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite SPA (:5173) + wrangler dev (:8787) concurrently |
| `pnpm dev:api` | wrangler dev only (Worker, port 8787) |
| `pnpm dev:spa` | Vite only (port 5173, proxies /api → 8787) |
| `pnpm build` | Vite build + Astro landing overlay → `dist/` |
| `pnpm typecheck` | TS check (app + worker) |
| `pnpm lint` | biome check . |
| `pnpm test` | vitest run (unit) |
| `pnpm test:e2e` | playwright test (e2e) |
| `pnpm digest:verify` | golden-file digest fixture check |
| `pnpm check:docs` | validate docs/ (broken links, empty docs, required files) |

See [`workflows.md`](workflows.md) for full setup and workflow details.
