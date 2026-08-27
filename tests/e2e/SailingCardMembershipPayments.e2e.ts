import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import {
  getCurrentSailingCardYear,
  getSailingCardExpirationDate,
} from '@/libs/mit-sailing/sailingCardValidity';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';
import { insertCurrentSailingCardOnboardingAcceptance } from '../helpers/e2e-sailing-card-onboarding';
import {
  extractCodeFromMessage,
  findLatestMessageTo,
} from '../helpers/mailpit';

const pool = new Pool({ connectionString: e2ePgConnectionString() });
const fixtureEmailPrefix = 'e2e-membership-payments-';

type PendingCardType = 'normal' | 'racing' | 'team_racing';

test.describe.configure({ mode: 'serial' });

async function cleanupMembershipPaymentFixtures() {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT "id" FROM "user" WHERE "email" LIKE $1',
    [`${fixtureEmailPrefix}%@example.com`]
  );
  const userIds = rows.map((row) => row.id);
  if (userIds.length === 0) {
    return;
  }

  await pool.query('DELETE FROM "payments" WHERE "user_id" = ANY($1)', [
    userIds,
  ]);
  await pool.query(
    'DELETE FROM "user_audit" WHERE "auditable_type" = $1 AND "auditable_id" = ANY($2)',
    ['user', userIds]
  );
  await pool.query(
    'DELETE FROM "sailing_card_requests" WHERE "user_id" = ANY($1)',
    [userIds]
  );
  await pool.query(
    'DELETE FROM "legal_agreement_acceptances" WHERE "user_id" = ANY($1)',
    [userIds]
  );
  await pool.query('DELETE FROM "session" WHERE "user_id" = ANY($1)', [
    userIds,
  ]);
  await pool.query('DELETE FROM "account" WHERE "user_id" = ANY($1)', [
    userIds,
  ]);
  await pool.query('DELETE FROM "user" WHERE "id" = ANY($1)', [userIds]);
}

test.beforeEach(async () => {
  await cleanupMembershipPaymentFixtures();
});

test.afterEach(async () => {
  await cleanupMembershipPaymentFixtures();
});

test.afterAll(async () => {
  await pool.end();
});

function fixtureEmail(slug: string) {
  return `${fixtureEmailPrefix}${slug}-${randomUUID()}@example.com`;
}

async function createBaseUser(props: {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly mitId?: string;
}) {
  const userId = `e2e-user-${randomUUID()}`;
  await pool.query(
    `INSERT INTO "user"
      ("id", "email", "name", "email_verified", "first_name", "last_name", "sailing_affiliation", "mit_id",
       "phone", "emergency_contact_name", "emergency_contact_phone", "sailing_card_requested_at", "created_at", "updated_at")
     VALUES
      ($1, $2, $3, true, $4, $5, 'WELLESLEY', $6, '+16175550100', 'Ada Lovelace', '+16175550101', NOW(), NOW(), NOW())`,
    [
      userId,
      props.email,
      `${props.firstName} ${props.lastName}`,
      props.firstName,
      props.lastName,
      props.mitId ?? null,
    ]
  );
  return userId;
}

async function markUserProfileOnboarded(userId: string) {
  await pool.query(
    `UPDATE "user"
     SET "phone" = '+16175550100',
         "emergency_contact_name" = 'Ada Lovelace',
         "emergency_contact_phone" = '+16175550101',
         "sailing_card_requested_at" = NOW(),
         "updated_at" = NOW()
     WHERE "id" = $1`,
    [userId]
  );
}

async function updatePendingCardRequest(props: {
  readonly cardType: PendingCardType;
  readonly firstName: string;
  readonly lastName: string;
  readonly mitId: string | null;
  readonly userId: string;
}) {
  const requestHasFitnessMembership = props.cardType === 'normal';
  await pool.query(
    `UPDATE "sailing_card_requests"
     SET "card_type" = $2,
         "has_fitness_membership" = $7,
         "first_name" = $3,
         "last_name" = $4,
         "sailing_affiliation" = 'WELLESLEY',
         "mit_id" = $5,
         "requested_at" = NOW(),
         "updated_at" = NOW()
     WHERE "user_id" = $1 AND "card_year" = $6`,
    [
      props.userId,
      props.cardType,
      props.firstName,
      props.lastName,
      props.mitId,
      getCurrentSailingCardYear(),
      requestHasFitnessMembership,
    ]
  );
  if (props.cardType === 'normal') {
    await pool.query(
      `UPDATE "user"
       SET "gym_membership_verified_at" = NOW(),
           "updated_at" = NOW()
       WHERE "id" = $1`,
      [props.userId]
    );
  }
}

async function completePendingCardOnboarding(props: {
  readonly cardType: PendingCardType;
  readonly firstName: string;
  readonly lastName: string;
  readonly mitId: string | null;
  readonly userId: string;
}) {
  await insertCurrentSailingCardOnboardingAcceptance({
    pool,
    userAgent: 'e2e-membership-payments',
    userId: props.userId,
  });
  await markUserProfileOnboarded(props.userId);
  await updatePendingCardRequest(props);
}

async function createPendingCardUser(props: {
  readonly cardType: PendingCardType;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly mitId: string | null;
}) {
  const userId = await createBaseUser({
    email: props.email,
    firstName: props.firstName,
    lastName: props.lastName,
    mitId: props.mitId ?? undefined,
  });

  await completePendingCardOnboarding({
    cardType: props.cardType,
    firstName: props.firstName,
    lastName: props.lastName,
    mitId: props.mitId,
    userId,
  });
  return userId;
}

async function createIssuedCardUser(cardNumber: number) {
  const email = fixtureEmail('issued-card');
  const userId = await createBaseUser({
    email,
    firstName: 'Issued',
    lastName: 'Card',
  });
  await insertCurrentSailingCardOnboardingAcceptance({
    pool,
    userAgent: 'e2e-membership-payments',
    userId,
  });
  const cardYear = getCurrentSailingCardYear();
  await pool.query(
    `UPDATE "user"
     SET "sailing_card_year" = $2,
         "sailing_card_number" = $3,
         "sailing_card_issued_at" = NOW(),
         "sailing_card_expires_on" = $4,
         "sailing_card_requested_at" = NULL,
         "updated_at" = NOW()
     WHERE "id" = $1`,
    [userId, cardYear, cardNumber, getSailingCardExpirationDate(cardYear)]
  );
  await pool.query(
    `UPDATE "sailing_card_requests"
     SET "status" = 'approved',
         "approved_at" = NOW(),
         "issued_card_number" = $2,
         "updated_at" = NOW()
     WHERE "user_id" = $1 AND "card_year" = $3`,
    [userId, cardNumber, cardYear]
  );
  return userId;
}

async function signUpVerifiedSailor(props: {
  readonly email: string;
  readonly page: Page;
  readonly password: string;
}) {
  await props.page.goto('/signup');
  await props.page.getByLabel('Email').fill(props.email);
  await props.page.getByLabel('Password', { exact: true }).fill(props.password);
  await props.page.getByLabel('Confirm password').fill(props.password);
  await props.page.getByRole('button', { name: 'Sign up' }).click();
  await expect(props.page).toHaveURL(/\/verify-email\?/);

  const message = await findLatestMessageTo(props.email);
  await props.page
    .getByLabel('Verification code')
    .fill(extractCodeFromMessage(message));
  await props.page.getByRole('button', { name: 'Continue' }).click();
  await expect
    .poll(() => new URL(props.page.url()).pathname)
    .toBe('/onboarding');
}

async function openAdminUserProfile(props: {
  readonly page: Page;
  readonly query: string;
  readonly userName: string;
}) {
  await props.page.goto('/admin/users');
  await props.page
    .getByRole('searchbox', { name: 'Search users' })
    .fill(props.query);
  await props.page.getByRole('link', { name: props.userName }).click();
  await expect(props.page).toHaveURL(/\/admin\/users\/[^/]+$/);
}

const sailingCardPdfUrlPattern = /\/api\/admin\/users\/.+\/sailing-card\/pdf$/u;

async function expectPrintCardPopup(page: Page) {
  const context = page.context();
  const [popup, response] = await Promise.all([
    page.waitForEvent('popup'),
    context.waitForEvent('response', {
      predicate: (res) =>
        res.request().method() === 'GET' &&
        sailingCardPdfUrlPattern.test(res.url()),
    }),
    page.getByRole('link', { name: 'Print card' }).click(),
  ]);

  expect(response.url()).toMatch(sailingCardPdfUrlPattern);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  await popup.close();
}

async function findUserIdByEmail(email: string) {
  const userResult = await pool.query<{ id: string }>(
    'SELECT "id" FROM "user" WHERE "email" = $1',
    [email]
  );
  const userId = userResult.rows[0]?.id;
  if (!userId) {
    throw new Error(`Unable to find member ${email}`);
  }
  return userId;
}

async function markLegacyPaidUserOnboarded(userId: string) {
  await insertCurrentSailingCardOnboardingAcceptance({
    pool,
    userAgent: 'e2e-membership-payments',
    userId,
  });
  await pool.query(
    `UPDATE "user"
     SET "first_name" = 'Legacy',
         "last_name" = 'Paid',
         "sailing_affiliation" = 'WELLESLEY',
         "phone" = '+16175550100',
         "emergency_contact_name" = 'Ada Lovelace',
         "emergency_contact_phone" = '+16175550101',
         "sailing_card_requested_at" = NOW(),
         "updated_at" = NOW()
     WHERE "id" = $1`,
    [userId]
  );
}

async function insertLegacyPaidMembershipPayment(props: {
  readonly email: string;
  readonly userId: string;
}) {
  await pool.query(
    `INSERT INTO "payments"
      ("id", "purpose", "source", "user_id", "amount_cents", "currency", "status", "card_year", "card_type",
       "legacy_source_table", "legacy_source_id", "legacy_category", "legacy_description", "legacy_settled",
       "payer_name", "payer_email", "created_at", "updated_at")
     VALUES
      ($1, 'membership', 'legacy', $2, 12000, 'usd', 'paid', $3, 'racing',
       'payments', $4, 'racing', 'Racing Card E2E', true, 'Legacy Paid', $5, NOW(), NOW())`,
    [
      `e2e-payment-${randomUUID()}`,
      props.userId,
      getCurrentSailingCardYear(),
      `legacy-${randomUUID()}`,
      props.email,
    ]
  );
}

test('admin searches users without leaving the users page', async ({
  page,
}) => {
  const email = fixtureEmail('user-search');
  await createBaseUser({
    email,
    firstName: 'Searchable',
    lastName: 'Sailor',
  });
  await signInAsAdmin(page);
  await page.goto('/admin/users');
  const originalUrl = page.url();

  await page.getByRole('searchbox', { name: 'Search users' }).fill(email);

  await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
  await expect(page).toHaveURL(originalUrl);

  await page
    .getByRole('searchbox', { name: 'Search users' })
    .fill('not-a-real-sailor');
  await expect(page.getByText('No users match that search.')).toBeVisible();
});

test('admin opens pending card user profile by MIT ID search', async ({
  page,
}) => {
  const mitId = '987654321';
  const email = fixtureEmail('card-search');
  await createPendingCardUser({
    cardType: 'normal',
    email,
    firstName: 'Grace',
    lastName: 'Hopper',
    mitId,
  });
  await signInAsAdmin(page);

  await openAdminUserProfile({ page, query: mitId, userName: 'Grace Hopper' });

  await expect(page.getByText('Suggested issue number')).toBeVisible();
  await expect(
    page.getByRole('form', { name: 'Issue sailing card' })
  ).toBeVisible();
});

test('admin manually assigns card number 110', async ({ page }) => {
  const email = fixtureEmail('manual-card');
  const userId = await createPendingCardUser({
    cardType: 'normal',
    email,
    firstName: 'Grace',
    lastName: 'Hopper',
    mitId: null,
  });
  await signInAsAdmin(page);
  await openAdminUserProfile({ page, query: email, userName: 'Grace Hopper' });

  await page.getByLabel('Card number').fill('110');
  await page.getByRole('button', { name: 'Issue' }).click();

  await expect
    .poll(async () => {
      const result = await pool.query<{ sailing_card_number: number | null }>(
        'SELECT "sailing_card_number" FROM "user" WHERE "id" = $1',
        [userId]
      );
      return result.rows[0]?.sailing_card_number;
    })
    .toBe(110);
});

test('admin opens printed sailing card pdf from user page', async ({
  page,
}) => {
  const userId = await createIssuedCardUser(111);
  const userResult = await pool.query<{ email: string }>(
    'SELECT "email" FROM "user" WHERE "id" = $1',
    [userId]
  );
  const email = userResult.rows[0]?.email;
  if (!email) {
    throw new Error('Expected issued card user email.');
  }

  await signInAsAdmin(page);
  await openAdminUserProfile({ page, query: email, userName: 'Issued Card' });

  await expectPrintCardPopup(page);
});

test('duplicate card number for the same year fails', async ({ page }) => {
  await createIssuedCardUser(110);
  const email = fixtureEmail('duplicate-card');
  await createPendingCardUser({
    cardType: 'normal',
    email,
    firstName: 'Grace',
    lastName: 'Hopper',
    mitId: null,
  });
  await signInAsAdmin(page);
  await openAdminUserProfile({ page, query: email, userName: 'Grace Hopper' });

  await page.getByLabel('Card number').fill('110');
  await page.getByRole('button', { name: 'Issue' }).click();

  await expect(
    page.getByText('That card number is already in use.')
  ).toBeVisible();
});

test('paid racing without payment requires a bypass note', async ({ page }) => {
  const email = fixtureEmail('bypass-note');
  await createPendingCardUser({
    cardType: 'racing',
    email,
    firstName: 'Grace',
    lastName: 'Hopper',
    mitId: null,
  });
  await signInAsAdmin(page);
  await openAdminUserProfile({ page, query: email, userName: 'Grace Hopper' });

  await expect(page.getByLabel('Payment bypass note')).toBeVisible();
  await expect(page.getByLabel('Payment bypass note')).toHaveAttribute(
    'required',
    ''
  );
});

test('legacy-paid member sees paid status without Stripe receipt', async ({
  page,
}) => {
  const email = fixtureEmail('legacy-paid');
  const password = `Qa1-${randomUUID()}-Password`;
  await signUpVerifiedSailor({ email, page, password });
  const userId = await findUserIdByEmail(email);
  await markLegacyPaidUserOnboarded(userId);
  await insertLegacyPaidMembershipPayment({ email, userId });

  await page.goto('/profile/payments');

  await expect(
    page.getByText(
      `${getCurrentSailingCardYear()} Pavilion racing sailing card`
    )
  ).toBeVisible();
  await expect(page.getByText('Paid')).toBeVisible();
  await expect(page.getByText('No Stripe receipt')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Receipt' })).toHaveCount(0);
});
