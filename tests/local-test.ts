import { test as base } from '@playwright/test';

/** No provider traffic or real sessions in browser regression checks. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
        await route.abort();
      } else if (url.pathname === '/api/auth/get-session') {
        await route.fulfill({ json: null });
      } else if (url.pathname.startsWith('/api/')) {
        await route.fulfill({
          status: 503,
          json: { message: 'Synthetic sign-in failure. Try again.' },
        });
      } else {
        await route.continue();
      }
    });
    await use(page);
  },
});
