import { expect, test } from '@playwright/test';

test.describe('Site alerts', () => {
  test('visitor sees alert start dates on the home banner and alerts page', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.locator('[data-alert-banner]');
    await expect(banner.getByText('Demo site alert')).toBeVisible();
    await expect(banner.getByText('Wed, Jan 1, 2025')).toBeVisible();
    await expect(banner.getByText('Tue, Dec 31, 2030')).toHaveCount(0);

    await page.goto('/alerts');

    const article = page
      .getByRole('article')
      .filter({ hasText: 'Demo site alert' });
    await expect(article.getByText('Wed, Jan 1, 2025')).toBeVisible();
    await expect(article.getByText('Tue, Dec 31, 2030')).toHaveCount(0);
  });
});
