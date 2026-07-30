# Product Overview

## Thesis

Email Manager is a Gmail inbox workspace with local-first semantic search.
Product thesis: a read-only Gmail cockpit where mailbox contents and
embeddings never leave the browser — the server stores only auth sessions.

## Users

Gmail users wanting semantic search, sender analytics, unsubscribe workflows,
and weekly digest reflection without server-side mailbox storage.

## Scope

**IN scope:** Vite SPA + Hono worker, Astro landing, IndexedDB cache,
client-side embeddings, digest/filter studio, and sender insights.

**OUT of scope:** Server-side digest cron/delivery, LLM-written digest prose,
automatic Today Little Log sync, saved filter presets, commercial "personal
reporter" positioning.

Authoritative scope: [`../../PROJECT_STATUS.md`](../../PROJECT_STATUS.md)
"Why / What" section.

## Privacy model

The server does not store email bodies, email lists, or generated embeddings.
Cloudflare D1 stores only better-auth tables for login/session state. Gmail data
is fetched on demand and cached locally in IndexedDB inside the browser.

This means:
- If the server is breached, no mailbox data leaks.
- No GDPR/CCPA storage obligations for email content.
- No multi-device access — data does not survive clearing browser storage.
- No real-time inbox updates — inbox is only as fresh as the last manual load.

## Automation safety

The app is **read-only by design**. It does not send, reply, archive, delete, or
modify any emails. The only non-read action is unsubscribe, which always
requires an explicit user click and opens the sender's unsubscribe flow —
nothing happens automatically.

If automation features are added in the future (e.g. scheduled triage,
AI-suggested labels), the policy is:
- No action is taken on any email without an explicit user confirmation step.
- Bulk or destructive actions show a summary and require a deliberate
  "Review & confirm" gesture before executing.
- Automated suggestions are surfaced as drafts or previews, never applied silently.

## Features (shipped summary)

For the full inventory, see
[`../../PROJECT_STATUS.md`](../../PROJECT_STATUS.md) "Features (shipped)".

- **Mailbox views:** inbox, sent, subscriptions, insights, and analytics.
- **Semantic search:** in-browser vector search over locally generated ONNX embeddings.
- **Sender analytics:** bucketed frequency analysis with drill-down.
- **Unsubscribe:** RFC 8058 one-click POST + fallback links; deduped sender list.
- **Weekly digest:** quiet relationships, threads to revisit, weekly themes.
- **Gmail filter studio:** recipe suggestions with XML export.
- **PostHog RUM:** signup, returned, activated, email_opened, digest_generated, digest_exported.

## Products

- **Worker (SPA + API):** https://mail.significanthobbies.com — worker `email-manager`;
  D1 `email-manager-auth` (`e770dfa2-1032-4a12-b0fb-52e77f5319e8`).
- **Landing:** `/` Astro static marketing overlaid to `dist/index.html`.
- **App shell:** `/app` SPA with hash-based sub-views; signed-in users 302 from
  `/` → `/app`.
- **Local dev:** Vite :5173 + wrangler :8787.
