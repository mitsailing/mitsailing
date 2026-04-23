import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { formAlert } from '../helpers/e2e-alert';

/**
 * Do not import `prisma` from the app `DB` module here. Prisma 7’s client
 * sets `globalThis['__dirname']` in ESM, which makes Playwright mis-detect
 * the module as CommonJS and throw `ReferenceError: exports is not defined`.
 * @see https://github.com/prisma/prisma/issues/28838
 * @see https://github.com/microsoft/playwright/issues/37890
 * Raw SQL with `pg` matches `AccountLockout.e2e.ts` and keeps the harness simple.
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

test.describe('Auth', () => {
  test('registers, verifies, and signs in with Better Auth credentials', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(
      page.getByText(
        'Check your email to confirm your address before signing in.'
      )
    ).toBeVisible();

    const { rows: credentialRows } = await pool.query<{
      password: string | null;
    }>(
      `SELECT a."password" FROM "account" a
       INNER JOIN "user" u ON u."id" = a."user_id"
       WHERE u."email" = $1 AND a."provider_id" = $2
       LIMIT 1`,
      [email, 'credential']
    );
    const storedPassword = credentialRows[0]?.password;
    expect(storedPassword?.startsWith('$argon2id$')).toBe(true);

    await markEmailVerified(email);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();

    await cleanupByEmail(email);
  });

  test('rejects invalid credentials', async ({ page }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(formAlert(page)).toHaveText('Invalid email or password.');
  });

  test('surfaces an explicit error when signing up with an existing email', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(
      page.getByText(
        'Check your email to confirm your address before signing in.'
      )
    ).toBeVisible();

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(formAlert(page)).toContainText(
      'That email is already in the system.'
    );

    await cleanupByEmail(email);
  });

  test('blocks sign-in for unverified accounts', async ({ page }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(
      page.getByText(
        'Check your email to confirm your address before signing in.'
      )
    ).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(formAlert(page)).toContainText(
      'Verify your email before signing in.'
    );

    await cleanupByEmail(email);
  });
});
