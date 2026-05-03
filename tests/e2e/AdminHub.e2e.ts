import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

test.describe('Admin hub and users', () => {
  test('redirects catalog resource visitors to sign-in', async ({ page }) => {
    await page.goto('/admin/donation_funds/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects /admin visitors to sign-in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows admin index at /admin', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Administration' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Users', exact: true }).first()
    ).toBeVisible();
  });

  test('users index lists accounts, Add user, and impersonation control', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users');
    await expect(
      page.getByRole('heading', { name: 'Users', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'View as user' }).first()
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader').first()).toHaveText('Name');
    await page.getByRole('link', { name: 'Add user' }).click();
    await expect(page).toHaveURL(/\/admin\/users\/new\/?$/);
    await expect(page.getByRole('heading', { name: 'New user' })).toBeVisible();
  });

  test('shows Admin header link on a public page after admin sign-in', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/donate');
    const adminLink = page.getByRole('link', { name: 'Admin', exact: true });
    await expect(adminLink).toBeVisible();
    await expect(adminLink).toHaveAttribute('href', /\/admin\/?$/);
  });
});
