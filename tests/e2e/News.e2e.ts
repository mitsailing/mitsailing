import { expect, test } from '@playwright/test';

test.describe('News', () => {
  test('visitor collapse persists until news content changes', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.locator('[data-news-banner]');
    await expect(banner.getByText('Demo news')).toBeVisible();

    await banner
      .getByRole('button', { name: 'Collapse news to a short summary' })
      .click();
    await expect(banner.getByText('Demo news')).toHaveCount(0);
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return (
          cookies.find((cookie) => cookie.name === 'news-banner')?.value ?? ''
        );
      })
      .not.toBe('');

    await page.reload();
    await expect(banner.getByText('Demo news')).toHaveCount(0);

    await page.context().addCookies([
      {
        name: 'news-banner',
        url: page.url(),
        value: 'stale',
      },
    ]);
    await page.reload();
    await expect(banner.getByText('Demo news')).toBeVisible();
  });
});
