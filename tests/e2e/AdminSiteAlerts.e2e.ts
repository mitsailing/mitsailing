import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

/**
 * Covers `/admin/site_alerts` CRUD paths that were previously untested (catalog
 * infra existed without Playwright coverage), including `<input type="date">`
 * values that must be `YYYY-MM-DD` for native constraint validation to allow submit.
 */
test.describe('Admin site alerts', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sees site alerts index with seeded demo row', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/site_alerts');
    await expect(
      page.getByRole('heading', { name: 'Site alerts', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add row' })).toBeVisible();
    await expect(
      page.getByRole('table').getByText('Demo site alert')
    ).toBeVisible();
  });

  test('admin creates site alert with default date inputs then deletes', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/site_alerts/new');
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

    const marker = `E2E site alert ${Date.now()}`;
    await page.getByLabel('Alert message').fill(marker);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/admin\/site_alerts\/?$/);

    await expect(page.getByRole('table').getByText(marker)).toBeVisible();

    await page.goto('/');
    await expect(
      page.locator('[data-alert-banner]').getByText(marker)
    ).toHaveCount(0);

    await page.goto('/admin/site_alerts');
    await page
      .getByRole('row')
      .filter({ hasText: marker })
      .getByRole('link', { name: 'Delete', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Delete catalog item' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/site_alerts\/?$/);
    await expect(page.getByRole('table').getByText(marker)).toHaveCount(0);
  });

  test('admin site alert mutation refreshes public banner cache', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-alert-banner]')).toBeVisible();

    await signInAsAdmin(page);
    await page.goto('/admin/site_alerts/new');

    const marker = `E2E cached banner alert ${Date.now()}`;
    await page.getByLabel('Alert message').fill(marker);
    await page.getByLabel('Published on site').check();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/admin\/site_alerts\/?$/);
    await expect(page.getByRole('table').getByText(marker)).toBeVisible();

    await page.goto('/');
    const banner = page.locator('[data-alert-banner]');
    await expect(banner.getByText(marker)).toBeVisible();

    await page.goto('/admin/site_alerts');
    await page
      .getByRole('row')
      .filter({ hasText: marker })
      .getByRole('link', { name: 'Delete', exact: true })
      .click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/site_alerts\/?$/);

    await page.goto('/');
    await expect(banner.getByText(marker)).toHaveCount(0);
  });
});
