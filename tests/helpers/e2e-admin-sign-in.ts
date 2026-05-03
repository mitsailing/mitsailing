import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'dev-local-change-me';

/**
 * Signs in as the seeded admin user from the e2e DB (see `e2e:seed`).
 *
 * @param page - Playwright page
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
}
