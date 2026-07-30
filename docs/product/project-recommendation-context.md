# Project Recommendation Context

Generated: 2026-06-06T21:14:19.545Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `email-manager`
- Registry description: Unified email management and automation tool.
- Product grouping: `public-ready`
- Source path: `email-manager`

## Product Context

Unified email management and automation tool.

Email Manager is a Gmail inbox workspace with local-first semantic search. It signs in with Google, reads Gmail through the Gmail API, stores email metadata and embeddings in the browser, and supports triage, search, analytics, and unsubscribe workflows without persisting mailbox contents on the server.

Email Manager Gmail inbox workspace with local-first semantic search. The app signs in with Google, reads Gmail through the Gmail API, stores email metadata and embeddings in the browser, and lets the user search, inspect, analyze, and unsubscribe without persisting mailbox contents on the server. Live app: <https://mail.significanthobbies.com What It Does - Browse Gmail views for inbox, starred, sent, trash, subscriptions, and analytics. - Search normal email metadata and run semantic search over locally generated embeddings. - Generate embeddings in-browser with Hugging Face Transformers / ONNX. - Keep email data and embeddings in IndexedDB instead of a server database. - P

## Feature Map

- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.
- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **Search and discovery**: Search, ranking, recommendations, feeds, semantic retrieval, and discovery UX. Keywords: search, discovery, recommend, ranking, semantic, feed, index, retrieval.
- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **Auth and identity**: Auth, OAuth, sessions, users, permissions, and account flows. Keywords: auth, oauth, identity, session, user, permission, login, nextauth.
- **Database and storage**: SQL, document storage, migrations, cache, queues, vectors, and persistence. Keywords: database, db, sql, sqlite, postgres, turso, libsql, drizzle.
- **Content and media**: Content production, video, reels, documents, markdown, and publishing workflows. Keywords: content, media, video, reel, markdown, document, publish, editor.

## Runtime Surfaces and Entrypoints

- `src/app/about/page.tsx`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/emails/[id]/route.ts`
- `src/app/api/emails/route.ts`
- `src/app/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/privacy/page.tsx`
- `worker.mjs`

## Current Stack

- Languages: `Astro`, `TypeScript`
- Frameworks/tools: `Astro`, `Cloudflare Workers`, `Drizzle`, `Next.js`, `OpenNext Cloudflare`, `Playwright`, `React`, `Tailwind CSS`
- Config files:
- `landing-astro/astro.config.mjs`
- `landing-astro/wrangler.toml`
- `next.config.ts`
- `playwright.config.ts`
- `wrangler.toml`

## OSS Already In Use

Direct dependencies:
- `@astrojs/sitemap`
- `@huggingface/transformers`
- `@libsql/client`
- `@saas-maker/feedback`
- `@saas-maker/sdk`
- `@saas-maker/testimonials`
- `astro`
- `better-auth`
- `drizzle-orm`
- `idb`
- `next`
- `posthog-js`
- `react`
- `react-dom`

Development dependencies:
- `@eslint/eslintrc`
- `@eslint/js`
- `@opennextjs/cloudflare`
- `@playwright/test`
- `@tailwindcss/postcss`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `beasties`
- `eslint`
- `eslint-config-next`
- `lightningcss`
- `tailwindcss`
- `typescript`
- `wrangler`

Package scripts:
- `astro`
- `build`
- `cf:build`
- `deploy`
- `dev`
- `digest:verify`
- `lint`
- `patch:opennext`
- `preview`
- `start`
- `test`
- `test:e2e`
- `test:e2e:mobile`
- `typecheck`

## Testing and Quality Signals

- `playwright.config.ts`
- `tests/example.spec.ts`

## Recommendation Guidance

Good matches:
- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen search and discovery without replacing already-installed libraries.
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen auth and identity without replacing already-installed libraries.
- Repos that strengthen database and storage without replacing already-installed libraries.
- Repos that strengthen content and media without replacing already-installed libraries.
- Tools with concrete support for email, gmail, src, digest, api, cloudflare, embeddings, indexeddb.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.

Avoid recommending:
- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:
- `PROJECT_STATUS.md`
- `README.md`
- `agents.md`

Package manifests:
- `landing-astro/package.json`
- `package.json`

Inventory notes:
- Files scanned: 114
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **high**

Why:
- PROJECT_STATUS.md present
- README.md present
- 9 entrypoint/runtime files identified
- package dependencies inventoried
- 2 test/quality files identified

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
