// biome-ignore-all lint/suspicious/noMisplacedAssertion: Standalone verification command uses Node assertions outside a test runner.
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { SECURITY_HEADERS } from '../src/lib/security-headers.ts';

// Explicit network check: downloads the real model into a disposable browser.
// No app configuration, owner profile, mailbox, credentials or telemetry is loaded.
const server = await createServer({
  configFile: false,
  envDir: false,
  root: process.cwd(),
  resolve: { alias: { '@': path.resolve('src') } },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'browser-model-fixture',
      configureServer(vite) {
        vite.middlewares.use('/model-fixture', (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.setHeader(
            'Content-Security-Policy',
            SECURITY_HEADERS['Content-Security-Policy']
          );
          response.end('<!doctype html><title>Browser model check</title>');
        });
      },
    },
  ],
});
let browser;
let timer;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const local = url.origin === new URL(origin).origin && !url.pathname.startsWith('/api/');
    const model = [
      'huggingface.co',
      'cdn-lfs.huggingface.co',
      'us.aws.cdn.hf.co',
      'cdn.jsdelivr.net',
    ].includes(url.hostname);
    return local || model ? route.continue() : route.abort();
  });
  await page.goto(`${origin}model-fixture`);
  const result = await Promise.race([
    page.evaluate(async () => {
      const violations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push({
          directive: event.effectiveDirective,
          uri: event.blockedURI.split('?')[0],
        });
      });
      const { embed } = await import('../src/lib/embeddings.ts');
      const start = performance.now();
      const vector = await embed('Synthetic flight confirmation and boarding pass.');
      return {
        milliseconds: performance.now() - start,
        dimensions: vector.length,
        finite: vector.every(Number.isFinite),
        norm: Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)),
        violations,
      };
    }),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Browser model check exceeded 180 seconds')),
        180_000
      );
    }),
  ]);
  assert.equal(result.dimensions, 384);
  assert.equal(result.finite, true);
  assert.ok(Math.abs(result.norm - 1) < 0.001);
  assert.deepEqual(result.violations, []);
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        scope:
          'Real browser model loading with application CSP; synthetic text only, no mailbox or ranking qualification',
        ...result,
      },
      null,
      2
    )
  );
} finally {
  clearTimeout(timer);
  await browser?.close();
  await server.close();
}
