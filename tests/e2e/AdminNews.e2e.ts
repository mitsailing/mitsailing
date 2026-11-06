import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { submitCatalogSave } from '../helpers/e2e-catalog-form';

/**
 * Covers `/admin/news` CRUD paths, including `<input type="date">`
 * values that must be `YYYY-MM-DD` for native constraint validation to allow submit.
 */
test.describe('Admin news', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sees news index with seeded demo row', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/news');
    await expect(
      page.getByRole('heading', { name: 'News', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add row' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'Demo news' })
    ).toBeVisible();
  });

  test('admin creates news with default date inputs then deletes', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/news/new');
    await expect(page.getByRole('heading', { name: 'New row' })).toBeVisible();

    const startInput = page.locator('input[name="startDate"]');
    const lastInput = page.locator('input[name="lastDate"]');
    await expect(startInput).toHaveAttribute('type', 'date');
    await expect(lastInput).toHaveAttribute('type', 'date');
    await expect(page.getByLabel('Published on site')).toBeVisible();

    const startValue = await startInput.inputValue();
    const lastValue = await lastInput.inputValue();
    expect(startValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lastValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lastValue >= startValue).toBe(true);

    const marker = `E2E news ${Date.now()}`;
    const bodyEditor = page.locator('.ProseMirror[aria-label="Body"]');
    await bodyEditor.click();
    await page.keyboard.type(marker);
    await expect(page.locator('input[name="body"]')).toHaveValue(
      new RegExp(marker, 'u')
    );

    await submitCatalogSave(page);
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit\/?$/);
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();

    await page.goto('/admin/news');
    const createdRow = page.getByRole('row').filter({ hasText: marker });
    await expect(createdRow).toBeVisible();

    await page.goto('/');
    await expect(
      page.locator('[data-news-banner]').getByText(marker)
    ).toHaveCount(0);

    await page.goto('/admin/news');
    await createdRow.getByRole('link', { name: 'Delete', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Delete catalog item' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/news\/?$/);
    await expect(page.getByRole('row').filter({ hasText: marker })).toHaveCount(
      0
    );
  });

  test('admin news mutation refreshes public banner cache', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-news-banner]')).toBeVisible();

    await signInAsAdmin(page);
    await page.goto('/admin/news/new');

    const marker = `E2E cached banner news ${Date.now()}`;
    const bodyEditor = page.locator('.ProseMirror[aria-label="Body"]');
    await bodyEditor.click();
    await page.keyboard.type(marker);
    await expect(page.locator('input[name="body"]')).toHaveValue(
      new RegExp(marker, 'u')
    );
    await page.getByLabel('Published on site').check();

    await submitCatalogSave(page);
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\/edit\/?$/);

    await page.goto('/admin/news');
    await expect(
      page.getByRole('row').filter({ hasText: marker })
    ).toBeVisible();

    await page.goto('/');
    const banner = page.locator('[data-news-banner]');
    await banner
      .getByRole('button', { name: 'Expand news to show messages' })
      .click();
    await expect(banner.getByText(marker)).toBeVisible();

    await page.goto('/admin/news');
    await page
      .getByRole('row')
      .filter({ hasText: marker })
      .getByRole('link', { name: 'Delete', exact: true })
      .click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/news\/?$/);

    await page.goto('/');
    await expect(banner.getByText(marker)).toHaveCount(0);
  });
});
