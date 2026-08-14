#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ORIGIN = 'https://mail.significanthobbies.com';
const pages = [
  { file: 'index.html', url: `${ORIGIN}/` },
  { file: 'faq.html', url: `${ORIGIN}/faq` },
  { file: 'changelog.html', url: `${ORIGIN}/changelog` },
];

for (const page of pages) {
  const html = await readFile(resolve('dist', page.file), 'utf8');
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  const openGraphUrl = html.match(
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
  )?.[1];
  assert.equal(canonical, page.url, `${page.file}: canonical`);
  assert.equal(openGraphUrl, page.url, `${page.file}: og:url`);
}

const sitemap = await readFile(resolve('public', 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(
  sitemapUrls,
  pages.map((page) => page.url),
  'sitemap URLs'
);

console.log(`Verified ${pages.length} public sitemap URLs and self-referencing canonicals.`);
