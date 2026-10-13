import { expect } from '@playwright/test';
import { test } from './local-test';

test.describe('open app navigation', () => {
  test('Open app link navigates to sign-in screen', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Open app' }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Open app' }).first().click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('button', { name: /connect gmail \(read-only\)/i })).toBeVisible({
      timeout: 15_000,
    });

    expect(consoleErrors).toEqual([]);
  });
});
