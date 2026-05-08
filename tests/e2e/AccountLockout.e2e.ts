import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { formAlert } from '../helpers/e2e-alert';
import {
  deleteAllMessages,
  extractLinkFromMessage,
  findLatestMessageTo,
} from '../helpers/mailpit';

/**
 * End-to-end test for the Devise-Lockable-style account-lock flow.
 *
 * Scenario under test:
 *   1. User registers and has their email verified out-of-band.
 *   2. They fail sign-in MAX_FAILED_ATTEMPTS times in a row; the account
 *      locks and a lockout email is sent.
 *   3. Clicking the unlock link in the email clears the failed-attempt
 *      rows and lands on /login?unlocked=1.
 *   4. A subsequent sign-in with the correct password succeeds.
 *
 * This is the key integration test for the auth hardening work because it
 * covers the three moving parts at once: before-middleware (lockout),
 * sendAccountLockedEmail + SMTP transport (email dispatch), and
 * /api/unlock-account (token verification + state cleanup).
 *
 * DB access note: we use `pg` directly rather than importing `@/libs/DB`
 * because Prisma 7's generated client emits
 * `globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))`,
 * which trips Playwright's CJS/ESM auto-detection with a
 * "ReferenceError: exports is not defined in ES module scope". See
 * https://github.com/prisma/prisma/issues/28838 and
 * https://github.com/microsoft/playwright/issues/37890. This is a simple
 * test harness anyway; raw SQL keeps the setup/teardown transparent.
 */

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/test_db?sslmode=disable';

const pool = new Pool({ connectionString: testDatabaseUrl });

test.afterAll(async () => {
  await pool.end();
});

const swallow = (error: unknown): void => {
  if (process.env.DEBUG_CLEANUP) {
    console.warn(error);
  }
};

async function cleanupByEmail(email: string) {
  try {
    await pool.query('DELETE FROM "failed_login_attempts" WHERE "email" = $1', [
      email,
    ]);
    await pool.query(
      `DELETE FROM "verification"
       WHERE "identifier" = $1
          OR "identifier" = $2`,
      [`email-verification-otp-${email}`, `forget-password-otp-${email}`]
    );
    await pool.query('DELETE FROM "user" WHERE "email" = $1', [email]);
  } catch (error) {
    swallow(error);
  }
}

async function markEmailVerified(email: string) {
  await pool.query(
    'UPDATE "user" SET "email_verified" = TRUE WHERE "email" = $1',
    [email]
  );
}

async function countFailedAttempts(email: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM "failed_login_attempts" WHERE "email" = $1',
    [email]
  );
  return Number(rows[0]?.count ?? '0');
}

test.describe('Account lockout', () => {
  test('locked-out sailor unlocks account from email link', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await deleteAllMessages();

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page).toHaveURL(/\/verify-email\?/);
    await expect(
      page.getByText('Enter the verification code we just sent to')
    ).toBeVisible();

    await markEmailVerified(email);
    await deleteAllMessages();

    // Five wrong-password attempts in a row. The sixth attempt — or even
    // the fifth, depending on whether the count is checked before or
    // after — trips the lockout. We loop to a generous max instead of
    // hard-coding so a future tweak to MAX_FAILED_ATTEMPTS doesn't
    // silently defeat this test.
    const MAX_ATTEMPTS = 6;
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill('definitely-not-the-password');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(formAlert(page)).toBeVisible();
    }

    // The lockout email arrives via Mailpit. Pattern matches the
    // absolute URL our email template renders.
    const lockoutMessage = await findLatestMessageTo(email);

    expect(lockoutMessage.Subject).toMatch(/lock/i);

    const unlockUrl = extractLinkFromMessage(
      lockoutMessage,
      /https?:\/\/[^\s"'<>]+\/api\/unlock-account\?token=[^\s"'<>]+/
    );

    // Follow the unlock link. The API route redirects to /login?unlocked=1.
    await page.goto(unlockUrl);
    await expect(page).toHaveURL(/\/login\?.*unlocked=1/);
    await expect(
      page.getByText('Your account is unlocked. You can sign in.')
    ).toBeVisible();

    // The failed-attempt rows must be gone so lockout doesn't immediately
    // retrip when the user signs in.
    expect(await countFailedAttempts(email)).toBe(0);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/');

    await cleanupByEmail(email);
  });
});
