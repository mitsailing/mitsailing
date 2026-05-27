import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { e2ePgConnectionString } from './e2e-database-url';
import { insertCurrentSailingCardOnboardingAcceptance } from './e2e-sailing-card-onboarding';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'dev-local-change-me';

async function markAdminOnboardingComplete(): Promise<void> {
  const pool = new Pool({ connectionString: e2ePgConnectionString() });
  try {
    await pool.query('BEGIN');
    const user = await pool.query<{ id: string }>(
      `UPDATE "user"
       SET "phone" = $2,
           "emergency_contact_name" = $3,
           "emergency_contact_phone" = $4,
           "sailing_card_requested_at" = COALESCE("sailing_card_requested_at", NOW())
       WHERE "email" = $1
       RETURNING "id"`,
      [adminEmail, '+16172531234', 'Taylor Test', '+16172534321']
    );
    const userId = user.rows[0]?.id;
    if (userId) {
      await insertCurrentSailingCardOnboardingAcceptance({
        pool,
        userAgent: 'e2e-admin-sign-in',
        userId,
      });
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Signs in as the seeded admin user from the e2e DB (see `e2e:seed`).
 *
 * @param page - Playwright page
 * @param options - Optional current-page and destination assertions.
 */
export async function signInAsAdmin(
  page: Page,
  options?: { expectedPath?: string; preserveCurrentPage?: boolean }
): Promise<void> {
  await markAdminOnboardingComplete();
  if (!options?.preserveCurrentPage) {
    await page.goto('/login');
  }
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(options?.expectedPath ?? '/');
}
