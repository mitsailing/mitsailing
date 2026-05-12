import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

test.describe('Admin catalog lists', () => {
  test('admin sees event categories list', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/event_categories');
    await expect(
      page.getByRole('heading', { name: 'Event categories', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('table').getByText('Bluewater')).toBeVisible();
  });

  test('admin sees class categories list', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/class_categories');
    await expect(
      page.getByRole('heading', { name: 'Class categories', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('table').getByText('Introduction', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('table').getByText('introduction', { exact: true })
    ).toBeVisible();
  });

  test('admin sees fleet list with seeded boat', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/fleet');
    await expect(
      page.getByRole('heading', { name: 'Fleet', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('table').getByText('Tech dinghy')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add row' })).toBeVisible();
  });
});
