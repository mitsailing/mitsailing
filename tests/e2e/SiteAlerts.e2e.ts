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

  test('visitor minimize persists until new or edited alerts appear', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.locator('[data-alert-banner]');
    await expect(banner.getByText('Demo site alert')).toBeVisible();

    await banner
      .getByRole('button', { name: 'Collapse site alerts to a short summary' })
      .click();
    await expect(banner.getByText('Demo site alert')).toHaveCount(0);

    await page.reload();
    await expect(banner.getByText('Demo site alert')).toHaveCount(0);

    await page.evaluate(() => {
      window.localStorage.setItem(
        'mit-sailing:site-alert-banner:v1',
        JSON.stringify({
          collapsed: true,
          alerts: [
            {
              id: 'seed-site-alert-demo-through-2030',
              contentFingerprint: 'stale-alert-content',
            },
          ],
        })
      );
    });
    await page.reload();
    await expect(banner.getByText('Demo site alert')).toBeVisible();
  });
});
