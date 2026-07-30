---
title: "Email Manager Docs"
description: "Gmail inbox workspace with local-first semantic search — private email tooling, client-side ML, no server-side mailbox storage."
---

# Email Manager

Gmail inbox workspace with local-first semantic search. The app signs in with
Google, reads Gmail through the Gmail API, stores email metadata and embeddings
in the browser, and lets you search, inspect, analyze, and unsubscribe without
persisting mailbox contents on the server.

## What it does

- Browse Gmail views for inbox, sent mail, subscriptions, insights, and analytics.
- Search normal email metadata and run semantic search over locally generated embeddings.
- Generate embeddings in-browser with Hugging Face Transformers / ONNX.
- Keep email data and embeddings in IndexedDB instead of a server database.
- Proxy Gmail reads through API routes with retry handling for rate limits.
- Surface sender analytics and deduplicated unsubscribe candidates.
- Unsubscribe through RFC 8058 one-click POST where available, with fallback links.
- Weekly digest: quiet relationships, threads to revisit, weekly themes — all local.
- Inbox insights and filter recipes, generated locally.

## Privacy model

The server does not store email bodies, email lists, or generated embeddings.
Cloudflare D1 stores only better-auth tables for login/session state. Gmail data
is fetched on demand and cached locally in IndexedDB inside the browser.

## Documentation

- [Product overview](product/overview) — what it is, who uses it, scope boundaries.
- [How it works](architecture/how-it-works) — end-to-end walkthrough: fetch → embed → IndexedDB → search.
- [Architecture](architecture/overview) — system shape, data flow, tech stack.
- [Architecture decisions](architecture/decisions) — ADR-001 through ADR-009.
- [Development](development/workflows) — local dev, build, test, deploy workflows.
- [Operations](operations/deployment) — deployment, env vars, OAuth setup, runbooks.
- [Learnings](knowledge/learnings/lessons) — durable gotchas (Transformers.js, IndexedDB, Workers, OAuth).
- [External references](knowledge/learnings/external-references) — authoritative sources for key concepts.

## Live app

[mail.significanthobbies.com](https://mail.significanthobbies.com) — Cloudflare Worker (`email-manager`).
