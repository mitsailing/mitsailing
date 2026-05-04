import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

test.describe('Profile appearance', () => {
  test('account appearance applies dark class on html', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/profile/account/');

    await page.getByRole('radio', { name: 'Dark' }).click();

    await expect(page.locator('html')).toHaveClass('dark');
  });
});
