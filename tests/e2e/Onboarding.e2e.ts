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

type EventRegistrationWindowSnapshot = {
  registration_end: Date | null;
  registration_start: Date | null;
};

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

async function openEventRegistrationWindow(
  slug: string
): Promise<EventRegistrationWindowSnapshot> {
  const { rows } = await pool.query<EventRegistrationWindowSnapshot>(
    `
      SELECT "registration_start", "registration_end"
      FROM "events"
      WHERE "slug" = $1
    `,
    [slug]
  );
  const [original] = rows;

  if (!original) {
    throw new Error(`No event row for slug=${slug}.`);
  }

  await pool.query(
    `
      UPDATE "events"
      SET "registration_start" = now() - interval '1 day',
          "registration_end" = now() + interval '30 days'
      WHERE "slug" = $1
    `,
    [slug]
  );

  return original;
}

async function restoreEventRegistrationWindow(
  slug: string,
  original: EventRegistrationWindowSnapshot
) {
  await pool.query(
    `
      UPDATE "events"
      SET "registration_start" = $2,
          "registration_end" = $3
      WHERE "slug" = $1
    `,
    [slug, original.registration_start, original.registration_end]
  );
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
  test.describe.configure({ mode: 'serial' });

  test('keeps new sailors on onboarding even when sign-up has a public callback', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const credential = `Qa1-${faker.string.alphanumeric(20)}`;

    try {
      await signUpVerifiedSailor({
        email,
        page,
        password: credential,
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
    const credential = `Qa1-${faker.string.alphanumeric(20)}`;

    try {
      await signUpVerifiedSailor({ email, page, password: credential });
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

  test('returns sailors to event registration after onboarding', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const credential = `Qa1-${faker.string.alphanumeric(20)}`;
    const slug = 'intercollegiate-overnight-series';
    const registrationWindow = await openEventRegistrationWindow(slug);

    try {
      await signUpVerifiedSailor({ email, page, password: credential });
      await page.goto(`/events/${slug}/register`);
      await expect(page).toHaveURL(
        `/onboarding?callbackUrl=%2Fevents%2F${slug}%2Fregister`
      );

      await page.getByLabel('Affiliation').selectOption({ label: 'Wellesley' });
      await page.getByLabel('First name').fill('Grace');
      await page.getByLabel('Last name').fill('Hopper');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByLabel('Date of birth').fill('01/02/2000');
      await page.getByLabel('Your phone number').fill('617-555-0100');
      await page.getByLabel('Emergency contact name').fill('Ada Lovelace');
      await page.getByLabel('Emergency contact phone').fill('617-555-0101');
      await page.getByRole('radio', { name: /^Yes/ }).check();
      await page
        .getByLabel(
          'I have read and agree to the swim agreement and liability release.'
        )
        .check();
      await page.getByRole('button', { name: 'Request sailing card' }).click();

      await expect(page).toHaveURL(`/events/${slug}/register`);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Intercollegiate Overnight Series',
        })
      ).toBeVisible();
    } finally {
      await restoreEventRegistrationWindow(slug, registrationWindow);
      await cleanupByEmail(email);
    }
  });
});
