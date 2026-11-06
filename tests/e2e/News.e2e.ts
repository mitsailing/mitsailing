import { expect, test } from '@playwright/test';

test.describe('News', () => {
  test('visitor sees news start dates on the home banner and news page', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.locator('[data-news-banner]');
    await expect(banner.getByText('1 news item.')).toBeVisible();
    await expect(banner.getByText('Demo news')).toHaveCount(0);

    await banner
      .getByRole('button', { name: 'Expand news to show messages' })
      .click();
    await expect(banner.getByText('Demo news')).toBeVisible();
    await expect(banner.getByText('Wed, Jan 1, 2025')).toBeVisible();
    await expect(banner.getByText('Tue, Dec 31, 2030')).toHaveCount(0);

    await page.goto('/news');

    const article = page.getByRole('article').filter({ hasText: 'Demo news' });
    await expect(article.getByText('Wed, Jan 1, 2025')).toBeVisible();
    await expect(article.getByText('Tue, Dec 31, 2030')).toHaveCount(0);
  });

  test('visitor collapse persists until new or edited news appears', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.locator('[data-news-banner]');
    await expect(banner.getByText('1 news item.')).toBeVisible();
    await banner
      .getByRole('button', { name: 'Expand news to show messages' })
      .click();
    await expect(banner.getByText('Demo news')).toBeVisible();

    await banner
      .getByRole('button', { name: 'Collapse news to a short summary' })
      .click();
    await expect(banner.getByText('Demo news')).toHaveCount(0);

    await page.reload();
    await expect(banner.getByText('Demo news')).toHaveCount(0);

    await page.evaluate(() => {
      window.localStorage.setItem(
        'mit-sailing:news-banner:v1',
        JSON.stringify({
          collapsed: true,
          alerts: [
            {
              id: 'seed-site-alert-demo-through-2030',
              contentFingerprint: 'stale-news-content',
            },
          ],
        })
      );
    });
    await page.reload();
    await expect(banner.getByText('Demo news')).toBeVisible();
  });
});
