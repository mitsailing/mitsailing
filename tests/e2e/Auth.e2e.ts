import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { formAlert } from '../helpers/e2e-alert';
import {
  extractCodeFromMessage,
  findLatestMessageTo,
  findLatestMessageToMatching,
} from '../helpers/mailpit';

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

let pgPoolEnded = false;

test.afterAll(async () => {
  if (pgPoolEnded) {
    return;
  }
  pgPoolEnded = true;
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
    await pool.query('DELETE FROM "user" WHERE "email" = $1', [email]);
  } catch (error) {
    swallow(error);
  }
}

async function signUpWithEmailAndPassword(props: {
  email: string;
  page: Page;
  password: string;
}) {
  await props.page.getByLabel('Email').fill(props.email);
  await props.page.getByLabel('Password', { exact: true }).fill(props.password);
  await props.page.getByLabel('Confirm password').fill(props.password);
  await props.page.getByRole('button', { name: 'Sign up' }).click();
  await expect(props.page).toHaveURL(/\/verify-email\?/);
  await expect(
    props.page.getByText(
      `Enter the verification code we just sent to ${props.email}.`
    )
  ).toBeVisible();
}

async function verifyEmailWithLatestCode(page: Page, email: string) {
  const message = await findLatestMessageTo(email);
  expect(message.Subject).toMatch(/confirm/i);

  await page
    .getByLabel('Verification code')
    .fill(extractCodeFromMessage(message));
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function createVerifiedUser(props: {
  email: string;
  page: Page;
  password: string;
}) {
  await props.page.goto('/signup');
  await signUpWithEmailAndPassword(props);
  await verifyEmailWithLatestCode(props.page, props.email);
  await expect.poll(() => new URL(props.page.url()).pathname).toBe('/');
}

async function findLatestPasswordResetCode(email: string) {
  const resetMessage = await findLatestMessageToMatching({
    description: 'password reset message',
    email,
    matches: (message) =>
      /reset/i.test(message.Subject) ||
      /password reset/i.test(`${message.Text}\n${message.HTML}`),
  });

  return extractCodeFromMessage(resetMessage);
}

async function requestPasswordReset(props: {
  callbackUrl?: string;
  email: string;
  page: Page;
}) {
  await props.page.goto(
    `/forgot-password?callbackUrl=${encodeURIComponent(props.callbackUrl ?? '/')}`
  );
  await props.page.getByLabel('Email').fill(props.email);
  await props.page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(props.page).toHaveURL(/\/reset-password\?/);
  await expect(
    props.page.getByText(
      'If an account exists for this email, you will receive a reset code shortly.'
    )
  ).toHaveCount(0);

  return findLatestPasswordResetCode(props.email);
}

async function completeResetCodeStep(page: Page, resetCode: string) {
  await page.getByLabel('Reset code').fill(resetCode);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
}

async function submitNewPassword(props: {
  page: Page;
  password: string;
  passwordConfirmation: string;
}) {
  await props.page
    .getByLabel('New password', { exact: true })
    .fill(props.password);
  await props.page
    .getByLabel('Confirm new password')
    .fill(props.passwordConfirmation);
  await props.page.getByRole('button', { name: 'Update password' }).click();
}

async function expirePasswordResetCode(email: string) {
  const result = await pool.query(
    `UPDATE "verification"
     SET "expires_at" = NOW() - INTERVAL '1 minute'
     WHERE "identifier" = $1`,
    [`forget-password-otp-${email}`]
  );
  expect(result.rowCount).toBeGreaterThan(0);
}

async function signInWithEmailAndPassword(props: {
  email: string;
  page: Page;
  password: string;
}) {
  await props.page.goto('/login');
  await props.page.getByLabel('Email').fill(props.email);
  await props.page.getByLabel('Password').fill(props.password);
  await props.page.getByRole('button', { name: 'Sign in' }).click();
  await expect.poll(() => new URL(props.page.url()).pathname).toBe('/');
}

function differentResetCode(code: string) {
  return code === '000000' ? '111111' : '000000';
}

test.describe('Auth', () => {
  test.describe.configure({ mode: 'serial' });

  test('regression persona redirects away from auth-only pages', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';
    const authPaths = [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
    ] as const;

    try {
      await createVerifiedUser({ email, page, password });

      for (const path of authPaths) {
        await page.goto(`${path}?callbackUrl=${encodeURIComponent('/fleet/')}`);
        await expect
          .poll(() => new URL(page.url()).pathname)
          .toMatch(/^\/fleet\/?$/);
      }

      await page.goto(
        `/login?callbackUrl=${encodeURIComponent('https://example.com/phish')}`
      );
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    } finally {
      await cleanupByEmail(email);
    }
  });

  test('locked-out sailor sees an error banner for invalid unlock links', async ({
    page,
  }) => {
    await page.goto('/api/unlock-account?token=not-a-real-token');

    await expect(page).toHaveURL(/\/login\?error=unlock_invalid/);
    await expect(formAlert(page)).toHaveText(
      'That unlock link is invalid or has expired. Wait for automatic unlock.'
    );
  });

  test('visitor registers, verifies, and signs in with Better Auth credentials', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/signup');
    await signUpWithEmailAndPassword({ email, page, password });

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

    await verifyEmailWithLatestCode(page, email);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');

    await page.goto('/profile/');
    await expect(page).toHaveURL(/\/profile\/account/);
    const profileNav = page.getByRole('navigation', {
      name: 'Profile settings',
    });
    await expect(
      profileNav.getByRole('link', { name: 'Account', exact: true })
    ).toBeVisible();
    await expect(
      profileNav.getByRole('button', { name: 'Sign out' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Sign out' })
    ).toBeVisible();

    await cleanupByEmail(email);
  });

  test('visitor returns to the original page after login-to-signup verification', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/fleet');
    await page.getByRole('link', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login\/?\?.*callbackUrl=/);

    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/signup\/?\?.*callbackUrl=/);

    await signUpWithEmailAndPassword({ email, page, password });
    await verifyEmailWithLatestCode(page, email);

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toMatch(/^\/fleet\/?$/);

    await cleanupByEmail(email);
  });

  test('email-change persona changes the signed-in email after OTP confirmation', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const newEmail = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    try {
      await createVerifiedUser({ email, page, password });

      await page.goto('/profile/account/');
      await page.getByLabel('New email').fill(newEmail);
      await page
        .getByRole('button', { name: 'Send confirmation code' })
        .click();
      await expect(
        page.getByText(
          'Confirmation code sent. Enter it below to finish changing your email.'
        )
      ).toBeVisible();

      const message = await findLatestMessageTo(newEmail);
      expect(message.Subject).toMatch(/confirm/i);

      await page
        .getByLabel('Confirmation code')
        .fill(extractCodeFromMessage(message));
      await page.getByRole('button', { name: 'Confirm email' }).click();

      await expect(
        page.getByText('Your email address has been updated.')
      ).toBeVisible();
      await expect(page.getByText(newEmail, { exact: true })).toBeVisible();
    } finally {
      await cleanupByEmail(email);
      await cleanupByEmail(newEmail);
    }
  });

  test('visitor returns to the callback after OTP password reset', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';
    const resetPassword = 'Correct-Horse-Battery-Staple-2';

    await createVerifiedUser({ email, page, password });

    await page.context().clearCookies();
    const resetCode = await requestPasswordReset({
      callbackUrl: '/fleet/',
      email,
      page,
    });

    await page.getByLabel('Reset code').fill(differentResetCode(resetCode));
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(formAlert(page)).toHaveText('That code is invalid.');
    await expect(page.getByLabel('New password', { exact: true })).toBeHidden();

    await page.getByLabel('Reset code').fill(resetCode);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('New password', { exact: true }).fill(resetPassword);
    await page.getByLabel('Confirm new password').fill(resetPassword);
    await page.getByRole('button', { name: 'Update password' }).click();

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toMatch(/^\/fleet\/?$/);

    await cleanupByEmail(email);
  });

  test('visitor keeps a valid password reset code after a password mismatch', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';
    const resetPassword = 'Correct-Horse-Battery-Staple-2';

    await createVerifiedUser({ email, page, password });
    await page.context().clearCookies();
    const resetCode = await requestPasswordReset({ email, page });

    await completeResetCodeStep(page, resetCode);
    await submitNewPassword({
      page,
      password: resetPassword,
      passwordConfirmation: `${resetPassword}-mismatch`,
    });

    await expect(formAlert(page)).toHaveText('Passwords do not match.');
    await expect(
      page.getByLabel('New password', { exact: true })
    ).toBeVisible();
    await expect(page.getByLabel('Reset code')).toBeHidden();

    await submitNewPassword({
      page,
      password: resetPassword,
      passwordConfirmation: resetPassword,
    });

    await expect.poll(() => new URL(page.url()).pathname).toBe('/');

    await cleanupByEmail(email);
  });

  test('visitor sees expired message when a reset code expires before password submit', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';
    const resetPassword = 'Correct-Horse-Battery-Staple-2';

    await createVerifiedUser({ email, page, password });
    await page.context().clearCookies();
    const resetCode = await requestPasswordReset({ email, page });

    await completeResetCodeStep(page, resetCode);
    await expirePasswordResetCode(email);
    await submitNewPassword({
      page,
      password: resetPassword,
      passwordConfirmation: resetPassword,
    });

    await expect(formAlert(page)).toHaveText(
      'That code expired. Request a new reset code.'
    );
    await expect(formAlert(page)).not.toHaveText('That code is invalid.');
    await expect(page.getByLabel('Reset code')).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toBeHidden();

    await cleanupByEmail(email);
  });

  test('visitor requests a reset from the login email without a second send action', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await createVerifiedUser({ email, page, password });
    await page.context().clearCookies();

    await page.goto('/login?callbackUrl=/fleet/');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('link', { name: 'Forgot password?' }).click();

    await expect(page).toHaveURL(/\/reset-password\?/);
    await expect(page.getByLabel('Reset code')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Send reset code' })
    ).toHaveCount(0);
    await expect(
      page.getByText(
        'If an account exists for this email, you will receive a reset code shortly.'
      )
    ).toHaveCount(0);

    await findLatestPasswordResetCode(email);

    await cleanupByEmail(email);
  });

  test('profile owner revokes existing sessions after password reset', async ({
    browser,
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';
    const resetPassword = 'Correct-Horse-Battery-Staple-2';
    const otherContext = await browser.newContext();
    const resetContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    const resetPage = await resetContext.newPage();

    try {
      await createVerifiedUser({ email, page, password });
      await signInWithEmailAndPassword({
        email,
        page: otherPage,
        password,
      });

      const resetCode = await requestPasswordReset({
        email,
        page: resetPage,
      });
      await completeResetCodeStep(resetPage, resetCode);
      await submitNewPassword({
        page: resetPage,
        password: resetPassword,
        passwordConfirmation: resetPassword,
      });
      await expect.poll(() => new URL(resetPage.url()).pathname).toBe('/');

      await page.goto('/profile/account/');
      await expect(page).toHaveURL(/\/login\/?\?/);
      await otherPage.goto('/profile/account/');
      await expect(otherPage).toHaveURL(/\/login\/?\?/);
    } finally {
      await resetContext.close();
      await otherContext.close();
      await cleanupByEmail(email);
    }
  });

  test('visitor sees invalid credentials message', async ({ page }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(formAlert(page)).toHaveText('Invalid email or password.');
  });

  test('visitor sees an explicit error when signing up with an existing email', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/signup');
    await signUpWithEmailAndPassword({ email, page, password });

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

  test('unverified sailor is blocked from sign-in', async ({ page }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await page.goto('/signup');
    await signUpWithEmailAndPassword({ email, page, password });

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
