import { expect, test } from '@playwright/test';

/**
 * Mobile-viewport smoke test for the public landing page.
 *
 * Runs under both the `desktop` and `mobile` Playwright projects (see
 * playwright.config.ts). The `mobile` project uses a 390px iPhone 13
 * viewport — the fleet mobile target.
 *
 * The signed-in cockpit requires Google OAuth, so the primary signed-in
 * flow is verified manually against the mobile conventions doc.
 */
test.describe('landing page', () => {
  test('renders the product narrative and shared footer surfaces with no horizontal scroll', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Kinetic/i);

    await expect(
      page.getByRole('heading', {
        name: /remember the email.*not the exact words/i,
        level: 1,
      })
    ).toBeVisible();

    await expect(page.getByText(/local-first inbox intelligence/i)).toBeVisible();
    await expect(page.getByText(/ranked locally.*nothing uploaded/i)).toBeVisible();

    await expect(
      page.getByRole('link', { name: /connect gmail and search/i }).first()
    ).toBeVisible();

    await expect(page.locator('[data-ai-provider]')).toHaveCount(5);
    await expect(page.locator('portfolio-project-strip')).toHaveCount(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('the primary CTA is a large enough touch target', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /connect gmail and search/i }).first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
