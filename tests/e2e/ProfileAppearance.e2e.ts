import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

test.describe('Profile appearance', () => {
  test('profile owner applies dark appearance to the page', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/profile');

    await page.getByText('Dark', { exact: true }).click();

    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(page.locator('html')).toHaveClass('dark');
  });
});
