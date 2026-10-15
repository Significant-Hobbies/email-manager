import { expect } from '@playwright/test';
import { test } from './local-test';

test('signed-in Gmail search keeps the latest query and settles without a refetch loop', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'search-recovery-fixture',
          name: 'Synthetic User',
          email: 'audit@example.invalid',
        },
      },
    })
  );

  let releaseOld!: () => void;
  let releaseCurrent!: () => void;
  const oldResponse = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const currentResponse = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queries: string[] = [];
  await page.route('**/api/emails?*', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    queries.push(query);
    if (query === 'flight') await oldResponse;
    if (query === 'garden') await currentResponse;
    try {
      await route.fulfill({
        json: {
          emails:
            query === 'flight'
              ? [
                  {
                    id: 'old-result',
                    threadId: 'old-thread',
                    subject: 'Old flight result',
                    from: 'Synthetic Sender <sender@example.invalid>',
                    to: 'audit@example.invalid',
                    snippet: 'Fictional result.',
                    body: 'Synthetic local-only message.',
                    date: '2026-10-01T00:00:00.000Z',
                    labelIds: ['INBOX'],
                  },
                ]
              : [],
          nextPageToken: null,
        },
      });
    } catch {
      // The earlier request is allowed to have been aborted by the client.
    }
  });

  await page.goto('/app');
  const search = page.getByPlaceholder('Search Gmail (from:, has:attachment, newer_than:7d)');
  await expect(search).toBeVisible();
  await search.fill('flight');
  await expect.poll(() => queries.filter((query) => query === 'flight').length).toBe(1);
  await search.fill('garden');
  await expect.poll(() => queries.filter((query) => query === 'garden').length).toBe(1);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText('Loading…')).toBeVisible();
    await expect(page.getByText('No matches for "garden"')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    await page.screenshot({ path: testInfo.outputPath(`search-pending-${width}.png`) });
  }

  releaseCurrent();
  await expect(page.getByText('No matches for "garden"')).toBeVisible();
  await expect(page.getByText('No matching messages')).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    await page.screenshot({ path: testInfo.outputPath(`search-empty-${width}.png`) });
  }
  releaseOld();
  await page.waitForTimeout(350);
  expect(queries.filter((query) => query === 'garden')).toHaveLength(1);
  await expect(page.getByText('Old flight result')).toHaveCount(0);
});
