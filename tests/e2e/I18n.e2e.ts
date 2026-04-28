import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('English only', () => {
    test('shows English content on the homepage', async ({ page }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Sail the Charles River',
        })
      ).toBeVisible();
    });

    test('shows English content on the login page', async ({ page }) => {
      await page.goto('/login');

      await expect(
        page.getByRole('heading', { name: 'Sign in' })
      ).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
    });
  });
});
