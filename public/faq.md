# Kinetic FAQ

Kinetic is a local-first, read-only Gmail workspace with semantic search,
subscription management, sender analytics, and exportable Gmail filter recipes.

## Does Kinetic store my email on its servers?

No. Messages, cached bodies, and embeddings live in the browser's IndexedDB.
The Worker proxies live Gmail API calls and stores only the authentication
records required for the read-only connection.

## Can Kinetic modify or send email?

Kinetic requests `gmail.readonly`. It cannot compose, reply, archive, or delete.
Unsubscribe is the sole non-read action and always requires an explicit user
click. It either sends an RFC 8058 request to the sender's endpoint or opens
the sender's unsubscribe URL.

## How does semantic search work?

A Hugging Face Transformers ONNX model generates embeddings in the browser.
Kinetic stores those vectors locally and ranks messages by cosine similarity,
so a query can describe meaning instead of repeating exact keywords.

## How does subscription management work?

The Subscriptions view finds messages with unsubscribe headers and deduplicates
them by sender. This produces one actionable entry per subscription rather than
one entry per message.

## What does sender analytics show?

Analytics ranks senders and lists by message volume. The same local signal can
suggest Gmail filter recipes, which the user may export as XML and import into
Gmail.

## What is stored in the cloud?

Cloudflare D1 contains Better Auth records only. Kinetic does not keep a
server-side inbox copy or server-side embedding index.

## Public resources

- [Open Kinetic](https://mail.significanthobbies.com/)
- [Read the changelog](https://mail.significanthobbies.com/changelog)
- [View the source](https://github.com/Significant-Hobbies/email-manager)

Authenticated app routes and mailbox content are intentionally absent from the
public agent catalog.
