import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { submitCatalogSave } from '../helpers/e2e-catalog-form';

/**
 * Admin news create saves once and shows up on the list and home banner.
 */
test.describe('Admin news', () => {
  test('admin creates published news that shows on the list and home banner', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/news/new');
    await expect(page.getByRole('heading', { name: 'New row' })).toBeVisible();

    const marker = `E2E news ${Date.now()}`;
    const bodyEditor = page.locator('.ProseMirror[aria-label="Body"]');
    await bodyEditor.click();
    await page.keyboard.type(marker);
    const bodyHtml = await page.locator('input[name="body"]').inputValue();
    expect(bodyHtml).toContain(marker);
    await page.getByLabel('Published on site').check();

    await submitCatalogSave(page);
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit\/?$/);

    await page.goto('/admin/news');
    const createdRow = page.getByRole('row').filter({ hasText: marker });
    await expect(createdRow).toBeVisible();

    await page.goto('/');
    const banner = page.locator('[data-news-banner]');
    await expect(banner.getByText(marker)).toBeVisible();

    await page.goto('/admin/news');
    await createdRow.getByRole('link', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/news\/?$/);
    await expect(page.getByRole('row').filter({ hasText: marker })).toHaveCount(
      0
    );
  });
});
