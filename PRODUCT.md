# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gmail users who want semantic search, sender insights, and unsubscribe tools without handing a third party a server-side copy of their mailbox.

## Product Purpose

Kinetic is a read-only Gmail workspace. It makes older messages easier to retrieve and recurring inbox patterns easier to understand while keeping message content and embeddings in the browser.

## Positioning

Mailbox contents and semantic-search embeddings remain in IndexedDB; the server stores authentication sessions and proxies live Gmail reads.

## Capabilities and Constraints

- Read-only Gmail scope; no compose, reply, archive, or delete.
- Client-side ONNX embeddings and local semantic search.
- Explicit user action is required for unsubscribe.
- Production deploys are manual.

## Evidence on Hand

Verified product history and shipped behavior live in `PROJECT_STATUS.md`; implementation and tests live under `src/` and `landing-astro/`.

## Product Principles

- Keep mailbox data local.
- Make privacy boundaries explicit.
- Prefer useful retrieval over inbox automation.
- Never imply a shipped capability that is not present.

