import { expect, test } from '@playwright/test';

test.describe('MIT Sailing catalog (classes + fleet)', () => {
  test('/classes lists category sections', async ({ page }) => {
    await page.goto('/classes');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Classes' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Introduction' })
    ).toBeVisible();
  });

  test('/classes/[slug] shows class detail', async ({ page }) => {
    await page.goto('/classes/intro-sailing-101');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Intro Sailing 101' })
    ).toBeVisible();
  });

  test('/fleet lists boats', async ({ page }) => {
    await page.goto('/fleet');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Fleet' })
    ).toBeVisible();
  });

  test('/fleet/[slug] shows boat detail', async ({ page }) => {
    await page.goto('/fleet/tech-dinghy');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Tech Dinghy' })
    ).toBeVisible();
  });
});
