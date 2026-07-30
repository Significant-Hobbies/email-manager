# Kinetic changelog

Verified product, privacy, reliability, and operations changes. Planned work
stays in GitHub Issues.

## July 25, 2026 — A tighter release gate

Typechecking now runs with lint, unit tests, the production build, and
documentation validation on every push and pull request. Browser checks remain
part of release verification.

## July 20, 2026 — Inbox navigation simplified

The retired triage queue and session implementation were removed. Existing
`#today` and `#triage` bookmarks continue to open Inbox.

## July 19, 2026 — Privacy-safe sync evidence

Kinetic now records sanitized sync failure stage, class, and time without
storing message content or tokens. A repeatable evidence command verifies
build, authentication, and sync invariants.

## June 20, 2026 — A smaller Cloudflare runtime

The app moved from Next.js and OpenNext to a Vite SPA with a Hono Worker. The
static Astro landing serves the public first visit while the inbox remains a
client-side workspace.

- [Roadmap](https://github.com/Significant-Hobbies/email-manager/issues)
- [Source](https://github.com/Significant-Hobbies/email-manager)
