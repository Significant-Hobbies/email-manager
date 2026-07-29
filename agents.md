# agents.md — email-manager

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose

Gmail inbox workspace with local-first semantic search. Fully client-side ML via HuggingFace ONNX; emails and embeddings stored in IndexedDB; server stores only auth sessions. Status: stable maintenance mode.

## Stack

- **Framework:** Vite + React 19 SPA (`react-router-dom`) + Hono Worker (`src/worker.ts`)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (CSS custom properties for light/dark theming)
- **DB:** Cloudflare D1 `email-manager-auth` (auth tables, Drizzle) + IndexedDB (client-side via `idb`) — emails and embeddings stored locally
- **Auth:** better-auth (Google OAuth, `gmail.readonly` scope, offline access + manual token refresh)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Deploy:** Cloudflare Workers (`email-manager`) — `pnpm build` (Vite + Astro landing overlay) + `wrangler deploy`
- **Package manager:** pnpm

## Key commands

```bash
pnpm dev          # Vite SPA (:5173) + wrangler dev (:8787) concurrently
pnpm dev:api      # wrangler dev only (Worker, port 8787)
pnpm dev:spa      # Vite only (port 5173, proxies /api → 8787)
pnpm build        # Vite build + Astro landing overlay → dist/
pnpm typecheck    # TS check (app + worker)
pnpm lint         # biome check .
pnpm test         # vitest run
pnpm test:e2e     # playwright test
pnpm digest:verify  # golden-file digest fixture check
pnpm check:docs   # validate docs/ (broken links, empty docs, required files)
pnpm docs:dev     # Blume docs dev server (presentation layer)
pnpm docs:build   # Blume docs build → apps/docs-blume/dist/
```

## Critical constraints

- **Read-only by design.** `gmail.readonly` scope only. No compose/reply/archive/delete. The only non-read action is unsubscribe, which always requires an explicit user click.
- **No server-side email storage.** All email data and embeddings live in IndexedDB. D1 holds only better-auth tables. Do not add server-side email storage without explicit approval.
- **Client-side ML only.** HuggingFace Transformers (ONNX runtime) generates embeddings in-browser. Do not add Node-only ML dependencies or server-side inference.
- **D1 bindings resolve only under `wrangler dev` / deployed worker.** Use `pnpm dev` or `pnpm dev:api` for `/api/*` routes.
- **OAuth callback URLs must match exactly** in Google Cloud Console. See [`docs/operations/runbooks/oauth-setup.md`](docs/operations/runbooks/oauth-setup.md).
- **Production deploys are manual.** `main` stays releasable and green; it is not an auto-deploy trigger.

## Documentation navigation

| Need | Where |
| --- | --- |
| Current/shipped product truth | [`PROJECT_STATUS.md`](PROJECT_STATUS.md) |
| Open work and blockers | GitHub Issues |
| Knowledge system layout + maintenance rules | [`docs/README.md`](docs/README.md) |
| Product overview, scope, users | [`docs/product/`](docs/product/) |
| System architecture + data flow | [`docs/architecture/`](docs/architecture/) |
| Architecture decision records (ADRs) | [`docs/architecture/decisions.md`](docs/architecture/decisions.md) |
| Development workflows + testing | [`docs/development/`](docs/development/) |
| Deployment, env vars, runbooks, scheduled jobs | [`docs/operations/`](docs/operations/) |
| Durable learnings + gotchas | [`docs/knowledge/learnings/`](docs/knowledge/learnings/) |
| Failed/shelved approaches | [`docs/knowledge/failed-approaches/`](docs/knowledge/failed-approaches/) |
| External reference sources | [`docs/knowledge/learnings/external-references.md`](docs/knowledge/learnings/external-references.md) |
| Retrospectives | [`docs/retros/`](docs/retros/) |
| Shipped PRD archive | [`docs/archive/`](docs/archive/) |
| Security audit log | [`AUDIT.md`](AUDIT.md) |

## Documentation maintenance rules

1. **Markdown is the source of truth.** Blume (`apps/docs-blume/`) is the presentation and search layer only. Never author content inside `apps/docs-blume/dist/`.
2. **One home per fact.** Do not duplicate a concept in two files. Link from secondary surfaces to the canonical home.
3. **Record why, not what.** Code shows what. Document non-obvious constraints, operational procedures, important decisions, and reusable failed approaches.
4. **Mark unresolved questions explicitly** (e.g., "TBD", "Open question:").
5. **Prefer preservation over deletion.** Superseded plans live under `docs/archive/`; removed/shelved approaches live under `docs/knowledge/failed-approaches/`.
6. **Validate before pushing:** `pnpm check:docs` checks broken links, empty docs, and required files. It runs in CI.
7. **Keep pages focused** (150–300 lines). Split catch-all docs into per-topic pages and link between them.
8. **When adding a new doc**, add it to the relevant `README.md` index in the same directory.

<!-- FLEET-GUIDANCE:START -->

## Fleet Guidance

### Adding Tasks
- Track Email Manager work in this repository's GitHub issues or OpenSpec changes.
- Keep cross-project infrastructure work in Fleet Workspace, not SaaS Maker.

### Using SaaS Maker
- Do not use the retired SaaS Maker task queue or API as a system of record.
- Fleet Workspace owns shared project metadata and infrastructure; Email
  Manager remains independently versioned and deployed.

### Free AI First
- Prefer free/local AI paths for routine development and analysis: the `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost, reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->
