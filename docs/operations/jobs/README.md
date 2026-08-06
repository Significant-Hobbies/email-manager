# Scheduled Jobs

Catalog of recurring automated jobs that touch email-manager. The executable
schedule is authoritative and lives in code: `.github/workflows/*.yml` (GitHub
Actions). This file is the human-readable index — update it when a job is
added, retired, or its cadence changes.

## GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Cadence | Purpose |
| --- | --- | --- | --- |
| `ci.yml` | `push`/`pull_request` to `main`/`master` | Every push/PR | `pnpm lint`, `pnpm test:unit`, `pnpm build`, `pnpm check:docs` |
| `deploy.yml` | `workflow_dispatch` (manual) | Manual only | Build + `wrangler deploy` + production smoke check |

## Notes

- **CI (`ci.yml`)** runs on every push and PR to `main`/`master`. It covers
  lint, typecheck, unit tests, build, and docs validation.
- **Deploy (`deploy.yml`)** is manual only (`workflow_dispatch`). Production
  deploys are never automatic. The workflow builds, deploys via
  `wrangler deploy`, and runs a post-deploy smoke check against the production
  worker URL.

## No local cron jobs

email-manager has no local Codex automations or scheduled GitHub Actions.
