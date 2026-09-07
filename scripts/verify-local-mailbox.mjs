import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

// Isolated browser, real IndexedDB and application modules. No OAuth, Gmail,
// telemetry, model download, env file, or persisted personal browser profile.
async function exerciseMailbox(page) {
  return page.evaluate(async () => {
    const db = await import('../src/lib/db.ts');
    const { ensureInboxEmails, refreshInboxHead } = await import('../src/lib/inbox-sync.ts');
    const { indexEmailsForSearch } = await import('../src/lib/email-index.ts');
    const { semanticSearch } = await import('../src/lib/semantic-search.ts');
    const { buildWeeklyDigest } = await import('../src/lib/digest.ts');
    await ensureInboxEmails({ accountId: 'fixture-a', target: 2 });
    await indexEmailsForSearch({ accountId: 'fixture-a' });
    const a = await db.getInboxEmailsSorted('fixture-a');
    const bInitially = await db.getAllEmails('fixture-b');
    await db.storeEmail(
      {
        ...a[0],
        subject: 'Synthetic B lease renewal',
        body: 'Synthetic B body',
        embedding: [0, 1],
      },
      'fixture-b'
    );
    await db.setInboxSyncMeta(
      { exhausted: false, nextPageToken: 'b-cursor', lastSyncedAt: null },
      'fixture-b'
    );
    // Complete a real A refresh after B's cache has become available.
    const originalFetch = window.fetch;
    let release;
    window.fetch = async () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const delayedRefresh = refreshInboxHead({ accountId: 'fixture-a' });
    while (!release) await new Promise((resolve) => setTimeout(resolve, 0));
    const bDuringRefresh = await db.getAllEmails('fixture-b');
    release(
      new Response(JSON.stringify({ emails: [{ ...a[0], snippet: 'Delayed A result' }] }), {
        status: 200,
      })
    );
    await delayedRefresh;
    window.fetch = originalFetch;
    let unscopedRejected = false;
    try {
      await db.getAllEmails('');
    } catch {
      unscopedRejected = true;
    }
    const digest = buildWeeklyDigest(await db.getInboxEmailsSorted('fixture-a'));
    return {
      a: await db.getAllEmails('fixture-a'),
      b: await db.getAllEmails('fixture-b'),
      aMeta: await db.getInboxSyncMeta('fixture-a'),
      bMeta: await db.getInboxSyncMeta('fixture-b'),
      bInitially,
      bDuringRefresh,
      unscopedRejected,
      digestBuilt: typeof digest === 'object',
      aSearch: (await semanticSearch('flight', 'fixture-a')).map((x) => x.email.subject),
      bSearch: (await semanticSearch('lease', 'fixture-b')).map((x) => x.email.subject),
      databases: (await indexedDB.databases()).map((x) => x.name),
    };
  });
}

test('isolated synthetic mailbox workflow', async () => {
  const server = await createServer({
    configFile: false,
    envDir: false,
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 0 },
    resolve: { alias: { '@': path.resolve('src') } },
    plugins: [
      {
        name: 'synthetic-mailbox-only',
        enforce: 'pre',
        load(id) {
          if (id.endsWith('/src/lib/embeddings.ts'))
            return `
        export const prepareEmailText = email => email.subject;
        export const embed = async text => text.includes('flight') ? [1, 0] : [0, 1];
      `;
        },
        configureServer(vite) {
          vite.middlewares.use('/fixture', (_req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><title>Synthetic mailbox qualification</title>');
          });
        },
      },
    ],
  });
  let browser;
  try {
    await server.listen();
    const origin = server.resolvedUrls.local[0];
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(origin).origin) return route.abort();
      if (url.pathname === '/api/emails') {
        assert.equal(route.request().method(), 'GET');
        const account = route.request().headers()['x-mailbox-account-id'];
        assert.equal(account, 'fixture-a');
        return route.fulfill({
          json: {
            emails: [
              {
                id: 'shared-id',
                threadId: 'thread-a',
                from: 'Synthetic A <a@example.invalid>',
                subject: 'flight confirmation',
                snippet: 'Synthetic flight receipt',
                body: 'Synthetic A body',
                date: '2026-09-06T00:00:00Z',
                labels: ['INBOX'],
              },
            ],
          },
        });
      }
      return route.continue();
    });
    await page.goto(`${origin}fixture`);
    const result = await exerciseMailbox(page);
    assert.equal(result.a.length, 1);
    assert.equal(result.bInitially.length, 0);
    assert.equal(result.b.length, 1);
    assert.equal(result.bDuringRefresh[0].body, 'Synthetic B body');
    assert.equal(result.a[0].body, 'Synthetic A body');
    assert.equal(result.b[0].body, 'Synthetic B body');
    assert.equal(result.a[0].snippet, 'Delayed A result');
    assert.equal(result.bMeta.nextPageToken, 'b-cursor');
    assert.equal(result.aMeta.exhausted, true);
    assert.deepEqual(result.aSearch, ['flight confirmation']);
    assert.deepEqual(result.bSearch, ['Synthetic B lease renewal']);
    assert.equal(result.unscopedRejected, true);
    assert.equal(result.digestBuilt, true);
    assert.equal(result.databases.includes('email-search'), false);
    console.log(
      'PASS: synthetic sync -> real account-scoped IndexedDB -> fixture embeddings -> search/digest; two accounts, colliding IDs, distinct cursors, delayed write and unscoped rejection. No live mail or model quality qualification.'
    );
  } finally {
    await browser?.close();
    await server.close();
  }
});
