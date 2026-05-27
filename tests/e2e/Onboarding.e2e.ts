import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';
import {
  extractCodeFromMessage,
  findLatestMessageTo,
} from '../helpers/mailpit';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

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

async function signUpVerifiedSailor(props: {
  email: string;
  page: Page;
  password: string;
  signupUrl?: string;
}) {
  await props.page.goto(props.signupUrl ?? '/signup');
  await props.page.getByLabel('Email').fill(props.email);
  await props.page.getByLabel('Password', { exact: true }).fill(props.password);
  await props.page.getByLabel('Confirm password').fill(props.password);
  await props.page.getByRole('button', { name: 'Sign up' }).click();
  await expect(props.page).toHaveURL(/\/verify-email\?/);

  const message = await findLatestMessageTo(props.email);
  expect(message.Subject).toMatch(/confirm/i);
  await props.page
    .getByLabel('Verification code')
    .fill(extractCodeFromMessage(message));
  await props.page.getByRole('button', { name: 'Continue' }).click();
  await expect
    .poll(() => new URL(props.page.url()).pathname)
    .toBe('/onboarding');
}

test.describe('Onboarding', () => {
  test('keeps new sailors on onboarding even when sign-up has a public callback', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    try {
      await signUpVerifiedSailor({
        email,
        page,
        password,
        signupUrl: '/signup?callbackUrl=%2Ffleet',
      });
      await expect(
        page.getByRole('heading', { name: 'Sailing card onboarding' })
      ).toBeVisible();
    } finally {
      await cleanupByEmail(email);
    }
  });

  test('shows the affiliation placeholder and visible options', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    try {
      await signUpVerifiedSailor({ email, page, password });
      await expect(
        page.getByRole('heading', { name: 'Sailing card onboarding' })
      ).toBeVisible();

      const affiliation = page.getByRole('combobox', { name: 'Affiliation' });
      await expect(affiliation).toHaveValue('');
      await expect(affiliation.locator('option')).toHaveCount(15);
      await expect(affiliation.locator('option')).toHaveText([
        'Select an affiliation',
        'MIT student',
        'MIT faculty',
        'MIT staff',
        'MIT alum',
        'MIT family',
        'MIT affiliate',
        'Wellesley',
        'Brandeis',
        'Northeastern',
        'Winsor',
        'Brooks',
        'NROTC',
        'Other student',
        'Other non-student',
      ]);
    } finally {
      await cleanupByEmail(email);
    }
  });
});
