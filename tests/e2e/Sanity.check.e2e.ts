import { expect, test } from '@playwright/test';

// Checkly is a tool used to monitor deployed environments, such as production or preview environments.
// It runs end-to-end tests with the `.check.e2e.ts` extension after each deployment to ensure that the environment is up and running.
// With Checkly, you can monitor your production environment and run `*.check.e2e.ts` tests regularly at a frequency of your choice.
// If the tests fail, Checkly will notify you via email, Slack, or other channels of your choice.
// On the other hand, E2E tests ending with `*.e2e.ts` are only run before deployment.
// You can run them locally or on CI to ensure that the application is ready for deployment.

test.describe('Sanity', () => {
  test.describe('Static pages', () => {
    test('should display the homepage', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should navigate to the about page', async ({ page }) => {
      await page.goto('/');

      await page
        .locator('header nav')
        .getByRole('link', { name: 'About' })
        .click();

      await expect(page).toHaveURL(/about$/);

      await expect(
        page.getByRole('heading', { level: 1, name: /About MIT Sailing/ })
      ).toBeVisible();
    });

    test('should navigate to the contact page', async ({ page }) => {
      await page.goto('/contact');

      await expect(page).toHaveURL(/contact$/);

      await expect(
        page.getByRole('heading', { name: 'Contact' })
      ).toBeVisible();
    });
  });
});
