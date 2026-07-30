# Email Manager Docs (Blume)

AI-ready docs powered by [Blume](https://github.com/haydenbleasel/blume).

Blume is the **presentation and search layer only**. The committed Markdown at
the repository root in [`docs/`](../../docs/) is the source of truth. Do not
author content inside this package — edit `docs/` and rebuild.

`blume.config.ts` points `content.root` at `../../docs`, so every page rendered
here is the canonical Markdown from the repo knowledge tree. See
[`docs/README.md`](../../docs/README.md) for the documentation layout and
maintenance rules.

## Setup

```bash
npm install
```

Node >= 22.12. Uses `shamefully-hoist=true` (see `.npmrc`) so Blume can resolve
nested Astro deps under pnpm.

## Commands

```bash
npm run build   # → dist/ (llms.txt, llms-full.txt, sitemap, per-page .md)
npm run dev     # local dev server
npm run preview # preview built site
npm run doctor  # diagnose Blume config issues
```

## Deployment

`dist/` is a static site. Deploy to Cloudflare Pages or any static host. The
intended domain is `docs.mail.sassmaker.com` (see `blume.config.ts`
`deployment.site`).

Cut-over checklist:
1. Create Cloudflare Pages project at this package root.
2. Build: `npm run build`; output `dist`.
3. Attach custom domain `docs.mail.sassmaker.com`.
4. Submit `sitemap.xml` in Search Console.
5. Spot-check: `/llms.txt`, `/index.md`, `/agent-readability.json`.

## What stays non-Blume

The product app (`mail.significanthobbies.com`) keeps its own Vite SPA + Hono Worker +
Astro landing overlay. Blume is for the **docs corpus** only, not the app shell
or marketing landing.
