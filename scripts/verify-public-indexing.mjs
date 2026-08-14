#!/usr/bin/env node

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
  if (canonical !== page.url) {
    throw new Error(
      `${page.file}: expected canonical ${page.url}, found ${canonical || 'missing'}`
    );
  }
  if (openGraphUrl !== page.url) {
    throw new Error(
      `${page.file}: expected og:url ${page.url}, found ${openGraphUrl || 'missing'}`
    );
  }
}

const sitemap = await readFile(resolve('public', 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expectedSitemapUrls = pages.map((page) => page.url);
if (JSON.stringify(sitemapUrls) !== JSON.stringify(expectedSitemapUrls)) {
  throw new Error(
    `Expected sitemap URLs ${expectedSitemapUrls.join(', ')}, found ${sitemapUrls.join(', ')}`
  );
}

console.log(`Verified ${pages.length} public sitemap URLs and self-referencing canonicals.`);
