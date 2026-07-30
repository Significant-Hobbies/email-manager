// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pure static output — no SSR adapter. The landing is hand-written
// HTML/CSS with no client islands. CSS inlines into the HTML
// (`build.inlineStylesheets: 'always'`) so the LCP path is one
// round-trip: HTML → paint. No external fonts — system stack only,
// matching the existing email-manager layout (no next/font in
// src/app/layout.tsx).
//
// Lightning CSS replaces the default PostCSS pipeline as both
// transformer and minifier (fleet web-stack standard).
export default defineConfig({
  site: 'https://mail.significanthobbies.com',
  output: 'static',
  trailingSlash: 'never',
  // Emit `index.html` (the only page) directly at dist root.
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  integrations: [sitemap()],
  vite: {
    css: { transformer: 'lightningcss' },
    build: { cssMinify: 'lightningcss' },
  },
});
