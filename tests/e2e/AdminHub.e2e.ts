import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import {
  extractCodeFromMessage,
  findLatestMessageTo,
} from '../helpers/mailpit';

let cleanupPool: Pool | undefined;

/**
 * Lazily creates a pool when `Env.TEST_DATABASE_URL` is set (avoids import-time failure).
 *
 * @returns A Postgres pool, or `null` when no test database URL is configured.
 */
function getCleanupPool(): Pool | null {
  const url = Env.TEST_DATABASE_URL;
  if (!url) {
    return null;
  }
  cleanupPool ??= new Pool({ connectionString: url });
  return cleanupPool;
}

let pgPoolEnded = false;

test.afterAll(async () => {
  if (pgPoolEnded || !cleanupPool) {
    return;
  }
  pgPoolEnded = true;
  await cleanupPool.end();
});

const swallow = (error: unknown): void => {
  if (Env.DEBUG_CLEANUP) {
    console.warn(error);
  }
};

async function cleanupByEmail(email: string) {
  const pool = getCleanupPool();
  if (!pool) {
    return;
  }
  try {
    await pool.query('DELETE FROM "failed_login_attempts" WHERE "email" = $1', [
      email,
    ]);
    await pool.query(
      `DELETE FROM "verification"
       WHERE "identifier" = $1
          OR "identifier" = $2
          OR "identifier" LIKE $3
          OR "identifier" LIKE $4`,
      [
        `email-verification-otp-${email}`,
        `forget-password-otp-${email}`,
        `change-email-otp-${email}-%`,
        `change-email-otp-%-${email}`,
      ]
    );
    await pool.query(
      `DELETE FROM "session"
       WHERE "user_id" = (SELECT "id" FROM "user" WHERE "email" = $1)`,
      [email]
    );
    await pool.query(
      `DELETE FROM "account"
       WHERE "user_id" = (SELECT "id" FROM "user" WHERE "email" = $1)`,
      [email]
    );
    await pool.query('DELETE FROM "user" WHERE "email" = $1', [email]);
  } catch (error) {
    swallow(error);
  }
}

async function signUpWithEmailAndPassword(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/verify-email\?/);
}

async function verifyEmailWithLatestCode(page: Page, email: string) {
  const message = await findLatestMessageTo(email);
  expect(message.Subject).toMatch(/confirm/i);

  await page
    .getByLabel('Verification code')
    .fill(extractCodeFromMessage(message));
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function createVerifiedUser(page: Page, email: string, password: string) {
  await signUpWithEmailAndPassword(page, email, password);
  await verifyEmailWithLatestCode(page, email);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
}

async function expectSignInPage(page: Page) {
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/login\/?$/);
}

function normalizeCallbackPath(callbackUrl: string | null) {
  if (callbackUrl === null) {
    return null;
  }

  const withoutDefaultLocale = callbackUrl.replace(/^\/en(?=\/|$)/, '');
  const withoutTrailingSlash =
    withoutDefaultLocale.length > 1
      ? withoutDefaultLocale.replace(/\/$/, '')
      : withoutDefaultLocale;

  return withoutTrailingSlash === '' ? '/' : withoutTrailingSlash;
}

async function expectSignInCallback(page: Page, callbackUrl: string) {
  await expectSignInPage(page);
  await expect
    .poll(() =>
      normalizeCallbackPath(new URL(page.url()).searchParams.get('callbackUrl'))
    )
    .toBe(callbackUrl);
}

test.describe('Admin hub and users', () => {
  test('Visitor redirects from catalog admin resources to sign-in', async ({
    page,
  }) => {
    await page.goto('/admin/donation_funds/');
    await expectSignInPage(page);
  });

  test('Visitor redirects from admin home to sign-in', async ({ page }) => {
    await page.goto('/admin');
    await expectSignInPage(page);
  });

  test('Admin sees the admin index at /admin', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Administration' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Users', exact: true }).first()
    ).toBeVisible();
  });

  test('Admin sees users, Add user, and impersonation controls', async ({
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

  test('Admin sees Admin header link on a public page after sign-in', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/donate');
    const adminLink = page.getByRole('link', { name: 'Admin', exact: true });
    await expect(adminLink).toBeVisible();
    await expect(adminLink).toHaveAttribute('href', /\/admin\/?$/);
  });

  test('Admin revokes and restores a banned sailor sign-in', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    try {
      await createVerifiedUser(page, email, password);
      const signedInUserCookies = await page.context().cookies();

      await page.context().clearCookies();
      await signInAsAdmin(page);
      await page.goto('/admin/users');

      await page
        .getByRole('row')
        .filter({ hasText: email })
        .getByRole('link', { name: 'Edit' })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Edit user' })
      ).toBeVisible();
      await page.getByLabel('Banned').check();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe('/admin/users');

      await page.context().clearCookies();
      await page.context().addCookies(signedInUserCookies);
      await page.goto('/profile/account');
      await expectSignInCallback(page, '/profile/account');

      await page.context().clearCookies();
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(
        page.getByRole('alert').filter({
          hasText:
            'Your account has been disabled. Contact support if you believe this is an error.',
        })
      ).toBeVisible();
      await expect(
        page.getByRole('alert').filter({
          hasText: 'Verify your email before signing in.',
        })
      ).toHaveCount(0);
      await expect(
        page.getByRole('alert').filter({
          hasText: 'Invalid email or password.',
        })
      ).toHaveCount(0);
      await expect(
        page.getByRole('alert').filter({
          hasText: 'Your account is temporarily locked',
        })
      ).toHaveCount(0);
      await expect(
        page.getByRole('alert').filter({
          hasText: 'Too many attempts.',
        })
      ).toHaveCount(0);
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toMatch(/\/login\/?$/);

      await page.context().clearCookies();
      await signInAsAdmin(page);
      await page.goto('/admin/users');
      await page
        .getByRole('row')
        .filter({ hasText: email })
        .getByRole('link', { name: 'Edit' })
        .click();
      await page.getByLabel('Banned').uncheck();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe('/admin/users');

      await page.context().clearCookies();
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    } finally {
      await cleanupByEmail(email);
    }
  });

  test('Sailor and impersonating admin are blocked from admin pages', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    try {
      await createVerifiedUser(page, email, password);

      await page.goto('/admin');
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');
      await expect(
        page.getByRole('heading', { name: 'Administration' })
      ).toHaveCount(0);

      await page.context().clearCookies();
      await signInAsAdmin(page);
      await page.goto('/admin/users');

      const userRow = page.getByRole('row').filter({ hasText: email });
      await expect(userRow).toBeVisible();
      await userRow.getByRole('button', { name: 'View as user' }).click();

      await expect.poll(() => new URL(page.url()).pathname).toBe('/');
      const impersonationNotice = page.getByText(
        'You are viewing the site as another user.'
      );
      const weatherConditionsLink = page.getByLabel(
        'MIT Sailing current weather conditions. Opens in a new tab.'
      );
      await expect(impersonationNotice).toBeVisible();
      await expect(weatherConditionsLink).toBeVisible();
      const impersonationBox = await impersonationNotice.boundingBox();
      const weatherBox = await weatherConditionsLink.boundingBox();
      expect(impersonationBox).not.toBeNull();
      expect(weatherBox).not.toBeNull();
      if (!(impersonationBox && weatherBox)) {
        throw new Error('Expected impersonation and weather bars to render.');
      }
      expect(impersonationBox.y).toBeLessThan(weatherBox.y);

      await page.goto('/profile/account/');
      await expect(
        page.getByText('You are viewing the site as another user.')
      ).toBeVisible();
      await expect(
        page
          .getByRole('banner')
          .getByRole('link', { name: 'Admin', exact: true })
      ).toHaveCount(0);

      await page.goto('/admin');
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');

      await page.goto('/profile/account/');
      await page.getByRole('button', { name: 'Exit impersonation' }).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toMatch(/^\/admin\/users\/?$/);
      await expect(
        page.getByRole('heading', { name: 'Users', exact: true })
      ).toBeVisible();
    } finally {
      await cleanupByEmail(email);
    }
  });
});
