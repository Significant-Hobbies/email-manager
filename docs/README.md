# email-manager Knowledge System

This `docs/` tree is the **canonical, local-first knowledge system** for the
email-manager repository. Markdown committed here is the source of truth for
product knowledge, architecture, decisions, development workflows, operations,
and durable learnings. Code and executable configuration remain authoritative
for implementation details and schedules.

The committed Markdown here is the source of truth. Code and executable
configuration remain authoritative for implementation details and schedules.

## Layout

| Path | Purpose |
| --- | --- |
| [`index.md`](index.md) | Public landing page. |
| [`current/`](current/) | Current-state pointers: STATUS.md and PROJECT_STATUS.md. |
| [`product/`](product/) | Product knowledge: what email-manager is, scope, users, recommendation context. |
| [`architecture/`](architecture/) | System architecture, data flow, and `decisions.md` (ADR log). |
| [`architecture/decisions.md`](architecture/decisions.md) | Architecture Decision Records (ADR-001 through ADR-009). |
| [`development/`](development/) | Development workflows, testing strategy, quality gates. |
| [`operations/`](operations/) | Deployment, env vars, OAuth setup, scheduled jobs, runbooks. |
| [`operations/jobs/`](operations/jobs/) | Catalog of scheduled jobs (CI, weekly quality, deploy). |
| [`operations/runbooks/`](operations/runbooks/) | Step-by-step runbooks: local dev, OAuth setup, digest verify, deploy. |
| [`knowledge/`](knowledge/) | Durable learnings and failed approaches worth remembering. |
| [`knowledge/learnings/`](knowledge/learnings/) | Project-specific gotchas and patterns (Transformers.js, IndexedDB, Workers, OAuth). |
| [`knowledge/failed-approaches/`](knowledge/failed-approaches/) | Removed/shelved approaches and why they did not ship. |
| [`retros/`](retros/) | Phase-level retrospectives (CF Workers migration, performance pass). |
| [`plans/`](plans/) | Product briefs and plans (email memories/digest). |
| [`archive/`](archive/) | Shipped PRDs and superseded docs (historical, not active). |

## Root-level docs

| File | Role |
| --- | --- |
| [`agents.md`](../agents.md) | Concise agent bootloader — purpose, commands, constraints, doc navigation. |
| [`STATUS.md`](../STATUS.md) | Short current-state view: objective, active work, blockers, next steps. |
| [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) | Detailed timeline + shipped features. Kept at root for fleet contract checks. |
| [`README.md`](../README.md) | Public repo overview, quick start, privacy model. |
| [`AUDIT.md`](../AUDIT.md) | Security and quality audit log. |
| [`CLAUDE.md`](../CLAUDE.md) | Pointer file (`@agents.md`) for Claude Code. |

## Maintenance rules

1. **One home per fact.** Do not duplicate a concept in two files. Link from
   secondary surfaces to the canonical home.
2. **Markdown is the source of truth.** Keep canonical content in this tree.
3. **Record why, not what.** Code shows what. Document non-obvious constraints,
   operational procedures, important decisions, and reusable failed approaches.
4. **Mark unresolved questions explicitly** (e.g., "TBD", "Open question:").
5. **Prefer preservation over deletion** — superseded plans live under
   [`archive/`](archive/); removed/shelved approaches live under
   [`knowledge/failed-approaches/`](knowledge/failed-approaches/).
6. **Validate before pushing**: `pnpm check:docs` checks broken links, empty
   docs, and required files. It runs in CI.
7. **Keep pages focused** (150–300 lines). Split catch-all docs into per-topic
   pages and link between them.

## Adding documentation

- New design decision → add to [`architecture/decisions.md`](architecture/decisions.md)
  as a new ADR section (ADR-NNN format).
- New runbook → [`operations/runbooks/<name>.md`](operations/runbooks/).
- New scheduled job → add a row to [`operations/jobs/README.md`](operations/jobs/README.md).
- New learning → [`knowledge/learnings/<topic>.md`](knowledge/learnings/).
- New failed approach → [`knowledge/failed-approaches/<date>-<topic>.md`](knowledge/failed-approaches/).
- New retro → [`retros/<date>-<topic>.md`](retros/).
- New product brief/plan → [`plans/<date>-<topic>.md`](plans/).
