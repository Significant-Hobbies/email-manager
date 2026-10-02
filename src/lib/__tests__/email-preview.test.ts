import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emailPreviewText, needsPreviewHydration } from '../email-preview';
import { getEmail } from '../gmail';

let browser: Browser;
let page: Page;
const resourceRequests: string[] = [];
const moduleCode = ts.transpileModule(
  readFileSync(new URL('../email-preview.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}`;

beforeAll(async () => {
  if (process.env.PREVIEW_BROWSER_TESTS !== '1') return;
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PREVIEW_BROWSER_CHANNEL || undefined,
  });
  page = await browser.newPage();
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) resourceRequests.push(request.url());
  });
  await page.route('**/*', (route) => route.abort());
});
afterAll(async () => {
  await browser?.close();
});

async function htmlPreview(text: string) {
  // A string keeps Vite from rewriting the browser's native dynamic import.
  return page.evaluate(
    `(async () => {
      const { emailPreviewText: preview } = await import(${JSON.stringify(moduleUrl)});
      return preview({ snippet: 'raw', previewContent: {
        mimeType: 'text/html', text: ${JSON.stringify(text)}
      } });
    })()`
  );
}

describe('verified text previews', () => {
  describe.skipIf(process.env.PREVIEW_BROWSER_TESTS !== '1')('browser HTML extraction', () => {
    it.each([
      ['<p>you&#39;re &amp; me &copy; &#x1F600;</p>', "you're & me © 😀"],
      ['<p>&amp;#39; &lt;script&gt;literal&lt;/script&gt;</p>', '&#39; <script>literal</script>'],
      ['<p>one</p><div>two<br>three</div>', 'one two three'],
      [
        '<p>safe<script>window.executed = true</script><style>hidden</style><img src="https://example.invalid/x" onerror="window.executed=true"> text</p>',
        'safe text',
      ],
      ['<p>malformed &unknown; &#xZZ; &#39 <b>tail', "malformed &unknown; &#xZZ; ' tail"],
      [
        '<link rel=stylesheet href="https://example.invalid/style"><iframe src="https://example.invalid/frame"></iframe><video poster="https://example.invalid/poster"><source src="https://example.invalid/media"></video><object data="https://example.invalid/object"></object><p>safe</p>',
        'safe',
      ],
    ])('extracts inert HTML %s', async (html, expected) => {
      expect(await htmlPreview(html)).toBe(expected);
      expect(await page.evaluate(() => 'executed' in window)).toBe(false);
      await page.waitForTimeout(50);
      expect(resourceRequests).toEqual([]);
    });
  });

  it('preserves literal entities and tag-like content in plain MIME text', () => {
    const text = 'literal &#39; &amp; <script>alert(1)</script>';
    expect(
      emailPreviewText({ snippet: 'encoded', previewContent: { mimeType: 'text/plain', text } })
    ).toBe(text);
  });

  it('does not infer legacy MIME semantics from a cached body', () => {
    const legacy = { snippet: 'you&#39;re', body: '<p>you&#39;re</p>' };
    expect(emailPreviewText(legacy)).toBe(legacy.snippet);
    expect(needsPreviewHydration(legacy)).toBe(true);
    expect(needsPreviewHydration({ ...legacy, previewContent: null })).toBe(false);
    expect(needsPreviewHydration({ snippet: 'safe plain text' })).toBe(false);
  });

  it('carries raw snippet and HTML MIME provenance from a full fetch', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      Response.json({
        id: 'fixture',
        snippet: 'you&#39;re',
        payload: {
          mimeType: 'text/html',
          body: { data: btoa('<p>you&#39;re</p>') },
        },
      });
    try {
      const email = await getEmail('synthetic-token', 'fixture');
      expect(email.snippet).toBe('you&#39;re');
      expect(email.previewContent?.mimeType).toBe('text/html');
      expect(email.previewContent?.text).toBe('<p>you&#39;re</p>');
      const metadata = await getEmail('synthetic-token', 'fixture', { metadataOnly: true });
      expect(metadata.previewContent).toBeUndefined();
      expect(needsPreviewHydration(metadata)).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
