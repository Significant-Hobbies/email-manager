// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Pure static output — the overlay copies cacheable /_astro assets.
// Lightning CSS replaces the default PostCSS pipeline as both
// transformer and minifier (fleet web-stack standard).
export default defineConfig({
  site: 'https://mail.significanthobbies.com',
  output: 'static',
  // Preserve HTML-aware word spacing when Astro 7 renders inline elements.
  compressHTML: true,
  trailingSlash: 'never',
  // Preserve the existing flat HTML routes.
  build: {
    format: 'file',
  },
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
    css: { transformer: 'lightningcss' },
    build: { cssMinify: 'lightningcss' },
  },
});
