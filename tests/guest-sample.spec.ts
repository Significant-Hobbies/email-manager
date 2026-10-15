import { expect, type Page } from '@playwright/test';
import { test } from './local-test';

async function matchSlowRead(page: Page) {
  await page.route('**/api/emails?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fallback();
  });
}

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

test('failed session check stays out of guest mode and retries the selected view', async ({
  page,
}, testInfo) => {
  let unavailable = true;
  await page.route('**/api/auth/get-session', (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { error: 'Synthetic session outage' } })
      : route.fulfill({
          json: {
            user: {
              id: 'session-recovery-fixture',
              name: 'Synthetic User',
              email: 'audit@example.invalid',
            },
          },
        })
  );
  await page.route('**/api/emails?*', (route) =>
    route.fulfill({ json: { emails: [], nextPageToken: null } })
  );

  for (const width of [390, 768, 1440]) {
    unavailable = true;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/app?recovery-width=${width}#analytics`);
    await expect(page.getByRole('alert')).toContainText('Could not check your session');
    await expect(page.getByRole('heading', { name: 'Sample inbox · No OAuth' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    await page.screenshot({ path: testInfo.outputPath(`session-error-${width}.png`) });
    unavailable = false;
    await page.getByRole('button', { name: 'Try again' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#analytics$/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});

test('failed synthetic Inbox sync is an error and retries without fake emptiness', async ({
  page,
}) => {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'inbox-error-fixture', name: 'Synthetic User', email: 'audit@example.invalid' },
      },
    })
  );
  let fail = true;
  let calls = 0;
  await page.route('**/api/emails?*', (route) => {
    calls++;
    return fail
      ? route.fulfill({ status: 503, json: { error: 'Synthetic mailbox unavailable' } })
      : route.fulfill({ json: { emails: [], nextPageToken: null } });
  });
  await matchSlowRead(page);
  await page.goto('/app');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No emails to show.')).toHaveCount(0);
  const before = calls;
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('No emails to show.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBeGreaterThan(before);
});

test('Analytics and Insights finish a small exhausted cache without repeated loading loops', async ({
  page,
}) => {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'small-cache-fixture', name: 'Synthetic User', email: 'audit@example.invalid' },
      },
    })
  );
  await page.route('**/api/emails?*', (route) =>
    route.fulfill({
      json: {
        emails: [
          {
            id: 'synthetic-message',
            threadId: 'synthetic-thread',
            subject: 'Synthetic appointment',
            from: 'Synthetic Sender <sender@example.invalid>',
            to: 'audit@example.invalid',
            snippet: 'Fictional appointment.',
            body: 'Synthetic local-only message.',
            date: '2026-10-01T00:00:00.000Z',
            labelIds: ['INBOX'],
          },
        ],
        nextPageToken: null,
      },
    })
  );
  await page.goto('/app#analytics');
  const sender = page.getByRole('button', { name: /Synthetic Sender.*sender@example.invalid/ });
  await expect(sender).toBeVisible();
  await sender.evaluate((node) => {
    (window as Window & { stableSender?: Element }).stableSender = node;
  });
  await page.waitForTimeout(1000);
  expect(
    await page.evaluate(
      () => (window as Window & { stableSender?: Element }).stableSender?.isConnected
    )
  ).toBe(true);
  await expect(page.getByText(/Syncing inbox…/)).toHaveCount(0);
  await page.goto('/app#insights');
  await expect(
    page.getByText('No repeated filter patterns found in the sampled inbox.')
  ).toBeVisible();
  await expect(page.getByText('Sampling...')).toHaveCount(0);
});

test('workspace import failure is retryable without losing the current view', async ({ page }) => {
  let failed = true;
  let attempts = 0;
  await page.route('**/assets/bootstrap-*.js', (route) => {
    attempts++;
    return failed ? route.abort('failed') : route.continue();
  });
  await page.goto('/app#analytics');
  await expect(page.getByRole('alert')).toHaveText('Could not open the workspace.');
  failed = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => attempts).toBeGreaterThan(1);
  await expect(page.getByRole('heading', { name: 'Sample inbox · No OAuth' })).toBeVisible();
  await expect(page).toHaveURL(/\/app#analytics$/);
});
test('Subscriptions retries the failed account sync and distinguishes a successful empty mailbox', async ({
  page,
}) => {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: { id: 'inbox-error-fixture', name: 'Synthetic User', email: 'audit@example.invalid' },
      },
    })
  );
  let fail = true;
  let calls = 0;
  await page.route('**/api/emails?*', (route) => {
    calls++;
    return fail
      ? route.fulfill({ status: 503, json: { error: 'Synthetic mailbox unavailable' } })
      : route.fulfill({ json: { emails: [], nextPageToken: null } });
  });
  await matchSlowRead(page);
  await page.goto('/app#subscriptions');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No subscriptions found in your synced emails.')).toHaveCount(0);
  const before = calls;
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('No subscriptions found in your synced emails.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBeGreaterThan(before);
});
