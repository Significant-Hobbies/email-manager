# Astro 6 Compatibility Review — landing-astro

Scoped compatibility review for upgrading `landing-astro` from Astro ^5.18.2
(installed 5.18.2) to a supported Astro 6 release, plus an advisory check on
the accepted `image-size` exceptions in `scripts/check-code-health.mjs`.

Tracking issue: [Significant-Hobbies/email-manager#32](https://github.com/Significant-Hobbies/email-manager/issues/32).

## 1. landing-astro project shape

The landing is a **pure static site** — three hand-written pages, one layout,
one global stylesheet, and the `@astrojs/sitemap` integration. No SSR adapter,
no content collections, no client islands, no image optimization pipeline.

| File | Role |
| --- | --- |
| `landing-astro/astro.config.mjs` | ESM config; `output: 'static'`, `build.format: 'file'`, lightningcss transformer/minifier, sitemap integration |
| `landing-astro/src/pages/index.astro` | Home page (static HTML, no frontmatter logic beyond title/description) |
| `landing-astro/src/pages/changelog.astro` | Changelog page (inline data array, scoped `<style>`) |
| `landing-astro/src/pages/faq.astro` | FAQ page (inline data array, scoped `<style>`, JSON-LD `<script>`) |
| `landing-astro/src/layouts/Layout.astro` | Shared `<head>` (meta, OG, JSON-LD via `is:inline`), `<slot />`, project-strip script |
| `landing-astro/src/styles/landing.css` | Global CSS (oklch tokens, no Tailwind/PostCSS) |
| `landing-astro/package.json` | `astro: ^5.18.2`, `@astrojs/sitemap: ^3.7.3`, `lightningcss: ^1.32.0` |

## 2. Astro 6 breaking changes — relevance matrix

| Breaking change | Relevant? | Evidence |
| --- | --- | --- |
| **Node 22+ required** (dropped 18 & 20) | No — already satisfied | Repo runs Node v24.19.0; `apps/docs-blume` already requires `>=22.12.0`. `landing-astro` has no `engines` field but is built under the same Node. |
| **Vite 7.0 upgrade** | Low risk | Config uses `vite.css.transformer: 'lightningcss'` and `vite.build.cssMinify: 'lightningcss'` — standard Vite CSS options preserved in Vite 7. No custom Vite plugins or pinned Vite version. |
| **Zod 4 upgrade** (content schemas) | No | No content collections, no `defineCollection`/`getCollection`, no `src/content/` directory. `@astrojs/sitemap@3.7.3` already declares `zod: ^4.3.6` so the transitive Zod 4 bump is absorbed. |
| **Removed: `Astro.glob()`** | No | Not used anywhere in `landing-astro/src/`. |
| **Removed: `emitESMImage()`** | No | Not used; no `astro:assets` image pipeline. |
| **Removed: legacy `<Content />` component** | No | Not used; no Markdown/MDX content. |
| **Removed: legacy content collections** | No | No `src/content/` directory, no `legacy.collections` flag. |
| **Integration API: `entryPoints` removed from `astro:build:ssr`** | No | No custom integrations. Only `@astrojs/sitemap` is registered, and it does not expose a peer dependency on `astro` (verified: `peerDependencies` is empty in 3.7.3). |
| **Cloudflare adapter: `Astro.locals.runtime`** | No | `output: 'static'` — no SSR adapter at all. The landing is overlaid onto `.open-next/assets/index.html` and served by the Worker's ASSETS binding, not by an Astro Cloudflare adapter. |
| **i18n: `redirectToDefaultLocale` default changed** | No | No `i18n` config block in `astro.config.mjs`. |
| **Removed: CommonJS config files** | No | Config is `astro.config.mjs` (ESM). |
| **Changed: `<script>` and `<style>` rendered in definition order** | Minor risk | Layout uses two `is:inline` scripts (JSON-LD in `<head>`, project-strip in `<body>`). `faq.astro` has a JSON-LD `<script>` **without** `is:inline`. Verify this still emits inline after the Vite 7 bundler change. |
| **`build.format: 'file'` still supported?** | Yes — confirmed | `build.format` is not listed in the Astro 6 upgrade guide breaking changes. The `'file'` option (emit `index.html` at dist root) remains valid. |

## 3. What changes are needed to upgrade

The upgrade is a **version bump + install + build verification** — no source
code changes are expected.

1. In `landing-astro/package.json`, change `"astro": "^5.18.2"` to `"astro": "^6.4.6"` (or the latest 6.x patch).
2. Run `pnpm install` inside `landing-astro/`.
3. Run `pnpm --filter landing-astro build` and confirm `dist/index.html`, `dist/faq/index.html` (or `faq.html`), and `dist/changelog/index.html` (or `changelog.html`) are emitted at the expected paths.
4. Run `pnpm --filter landing-astro preview` and smoke-test all three pages (meta tags, JSON-LD, scoped styles, sitemap generation).

`@astrojs/sitemap@3.7.3` requires no change — it has no `astro` peer dependency
and already uses Zod 4. `lightningcss` is a devDependency unaffected by the
Astro major bump.

## 4. Risks and unknowns

- **Vite 7 + lightningcss**: The `vite.css.transformer` and `vite.build.cssMinify` options are standard Vite config, but Vite 7 is a major bump. If the lightningcss transformer API shifted, the build would fail loudly (not silently). Low risk, easy to catch.
- **`faq.astro` JSON-LD without `is:inline`**: The `<script type="application/ld+json" set:html={...} />` in `faq.astro` does not use `is:inline`. Astro has historically left non-JS `type` scripts alone, but the Vite 7 bundler refactor in Astro 6 is the kind of change that could alter edge-case script handling. If the JSON-LD disappears or gets bundled, add `is:inline` to match `Layout.astro`.
- **Astro 6 is already one major behind**: The latest Astro on npm is **7.2.4**, not 6.x. Astro 7 has its own breaking changes (and its own set of advisories). Issue #32 scopes this review to Astro 6, but the team should decide whether to land on 6.x (minimal change, clears the two accepted high-severity Astro advisories) or jump to 7.x (clears all currently-open Astro advisories including moderate ones). See §6 below.
- **Sitemap output path**: With `build.format: 'file'`, each page emits `page.html` rather than `page/index.html`. Confirm the sitemap integration's URL generation still matches the `trailingSlash: 'never'` config after the upgrade.

## 5. Recommendation

**Safe to upgrade to Astro 6.4.6.** The project is a minimal static site that
touches none of the removed APIs. Scope is a single dependency bump in
`landing-astro/package.json` plus a build smoke test. No source changes are
expected, though the `faq.astro` JSON-LD script should be verified (and
`is:inline` added if needed).

## 6. image-size advisory check

Issue #32 says: "Remove the image-size exceptions when Blume publishes a fixed
dependency chain." The four accepted advisories in
`scripts/check-code-health.mjs` are:

| Advisory | Module | Severity | Category |
| --- | --- | --- | --- |
| `GHSA-2pvr-wf23-7pc7` | astro | high | Astro (cleared by Astro 6.4.6+) |
| `GHSA-8hv8-536x-4wqp` | astro | high | Astro (cleared by Astro 6.3.3+) |
| `GHSA-5p2g-fcmc-qvqq` | image-size | high | image-size (Blume docs tool) |
| `GHSA-w3rx-r6r6-pgpr` | image-size | high | image-size (Blume docs tool) |

### image-size findings

- **No fix has been published.** Both image-size advisories report
  `vulnerable_versions: <=2.0.2` and `patched_versions: <0.0.0` (i.e. no
  patched version exists). The npm registry confirms `2.0.2` is the latest
  published version — the same version that is vulnerable.
- **Blume still pulls image-size.** The dependency chain is
  `apps/docs-blume > blume@1.4.3 > image-size@2.0.2`. Blume 1.4.3 declares
  `"image-size": "^2.0.2"` as a direct dependency. There is no override or
  patch available downstream.
- **The advisories are DoS-only** (infinite loops in ICNS, JXL, and HEIF
  parsers). The docs tool processes local markdown images, not untrusted
  user-uploaded files, so the practical exploitability is low — but the
  advisories remain technically open.

### Can the image-size exceptions be removed now?

**No.** image-size has not published a fixed version, and Blume 1.4.3 still
depends on the vulnerable `2.0.2`. The two `image-size` entries must remain in
the accepted-advisories set in `scripts/check-code-health.mjs` until Blume
either drops the `image-size` dependency or upgrades to a patched release
(once one exists).

### Can the Astro exceptions be removed now?

**Yes, after upgrading landing-astro to Astro 6.4.6+.** Both Astro advisories
are patched in 6.x:
- `GHSA-8hv8-536x-4wqp` (reflected XSS via unescaped slot name) → patched in `>=6.3.3`
- `GHSA-2pvr-wf23-7pc7` (host header SSRF in prerendered error page fetch) → patched in `>=6.4.6`

Upgrading to 6.4.6 clears both. At that point, remove those two IDs from the
`accepted` set in `scripts/check-code-health.mjs`, leaving only the two
image-size entries.

> **Note:** Upgrading to Astro 6 does not clear the moderate-severity Astro
> advisories (`GHSA-j687-52p2-xcff`, `GHSA-jrpj-wcv7-9fh9`,
> `GHSA-f48w-9m4c-m7f5`, `GHSA-4g3v-8h47-v7g6`) — those require Astro 7.x.
> They are not in the accepted set because `check-code-health.mjs` only gates
> on `critical` and `high` severity. A future jump to Astro 7.1.0+ would clear
> all open Astro advisories.

## 7. Summary

| Item | Status |
| --- | --- |
| landing-astro → Astro 6 upgrade | Safe; scope is a version bump + build check |
| `@astrojs/sitemap` compatibility | Already compatible (no astro peer dep, Zod 4) |
| Astro exceptions (`GHSA-2pvr…`, `GHSA-8hv8…`) | Removable after upgrade to 6.4.6+ |
| image-size exceptions (`GHSA-5p2g…`, `GHSA-w3rx…`) | **Not removable** — no fix published, Blume still depends on 2.0.2 |
