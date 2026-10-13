import { expect } from '@playwright/test';
import { test } from './local-test';

test('guest browses, searches and clears sample without OAuth, mailbox calls or storage', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const externalRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiRequests.push(url.pathname);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) externalRequests.push(url.hostname);
  });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Sample inbox · No OAuth' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Connect Gmail (read-only)', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: /Atlas Travel/ }).click();
  await expect(page.getByRole('article', { name: 'Sample message' })).toContainText(
    'fictional flight'
  );
  await page.getByRole('button', { name: 'Back to sample inbox' }).click();
  await page.getByLabel('Search sample messages').fill('garden');
  await expect(page.getByRole('status')).toHaveText('1 sample messages');
  await page.getByLabel('Search sample messages').fill('no-such-message');
  await expect(page.getByText('No sample messages match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('status')).toHaveText('4 sample messages');
  expect(apiRequests.every((path) => path === '/api/auth/get-session')).toBe(true);
  // Existing telemetry is blocked by the harness; no OAuth or model request is attempted.
  expect(
    externalRequests.every((host) =>
      ['us-assets.i.posthog.com', 'us.i.posthog.com', 'www.clarity.ms'].includes(host)
    )
  ).toBe(true);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('Gmail sign-in starts only on explicit consent and exposes retryable failures', async ({
  page,
}) => {
  const posts: { provider: string; callbackURL: string }[] = [];
  await page.route('**/api/auth/sign-in/social', async (route) => {
    posts.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      json: { message: 'Synthetic sign-in failure. Try again.' },
    });
  });
  await page.goto('/app');
  const connect = page.getByRole('button', { name: 'Connect Gmail (read-only)', exact: true });
  await expect(connect).toBeVisible();
  expect(posts).toEqual([]);
  await connect.click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic sign-in failure. Try again.');
  await expect(connect).toBeEnabled();
  expect(posts).toEqual([{ provider: 'google', callbackURL: '/app' }]);
  await connect.click();
  await expect.poll(() => posts.length).toBe(2);
  await expect(page.getByRole('heading', { name: 'Sample inbox · No OAuth' })).toBeVisible();
});

for (const width of [390, 768, 1440]) {
  test(`Kinetic guest and About render without overflow at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/app', '/about']) {
      await page.goto(path);
      await expect(page).toHaveTitle(/Kinetic.*semantic search/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      ).toBe(false);
      if (path === '/app')
        await expect(page.getByTestId('gmail-connect-card')).toHaveCSS('opacity', '1');
      await page.screenshot({
        path: testInfo.outputPath(`${path.slice(1)}-${width}.png`),
        fullPage: true,
      });
    }
    await expect(page.getByRole('heading', { name: 'About Kinetic' })).toBeVisible();
    await expect(page.getByText(/one-click filter you can install/i)).toHaveCount(0);
  });
}

test('synthetic signed-in session uses its account cache and never seeds guest messages', async ({
  page,
}) => {
  const accounts: string[] = [];
  await page.route('**/api/auth/get-session', async (route) => {
    await route.fulfill({
      json: {
        user: { id: 'synthetic-account', name: 'Synthetic User', email: 'user@example.invalid' },
      },
    });
  });
  await page.route('**/api/emails?*', async (route) => {
    accounts.push(route.request().headers()['x-mailbox-account-id']);
    await route.fulfill({ json: { emails: [], nextPageToken: null } });
  });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
  await expect(page.getByText('No emails to show.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sample inbox · No OAuth' })).toHaveCount(0);
  await expect.poll(() => accounts.length).toBeGreaterThan(0);
  expect(accounts.every((id) => id === 'synthetic-account')).toBe(true);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name))
  ).toEqual(['email-search-account:synthetic-account']);
});
