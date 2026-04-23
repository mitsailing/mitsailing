import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('English only', () => {
    test('shows English content on the homepage', async ({ page }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Boilerplate Code for Your Next.js Project with Tailwind CSS',
        })
      ).toBeVisible();
    });

    test('shows English content on the sign-in page', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(
        page.getByRole('heading', { name: 'Sign in' })
      ).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
    });
  });
});
