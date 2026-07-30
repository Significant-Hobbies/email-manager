# Kinetic

A read-only Gmail workspace with in-browser semantic search, subscription
management, sender analytics, and exportable Gmail filter recipes.

## Privacy

Messages and embeddings live in the browser's IndexedDB. The Worker proxies
live Gmail API calls and stores authentication records, but it does not retain
a server-side inbox copy. Kinetic requests `gmail.readonly`; it cannot compose,
reply, archive, or delete.

## Public product surfaces

- [Product home](https://mail.significanthobbies.com/)
- [Frequently asked questions](https://mail.significanthobbies.com/faq)
- [Changelog](https://mail.significanthobbies.com/changelog)
- [Source](https://github.com/Significant-Hobbies/email-manager)

## Agent entrypoints

- https://mail.significanthobbies.com/llms.txt
- https://mail.significanthobbies.com/api/ai
- https://mail.significanthobbies.com/index.md

Authenticated app routes and mailbox content are intentionally excluded.
