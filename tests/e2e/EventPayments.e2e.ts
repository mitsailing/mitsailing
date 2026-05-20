import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';
const fixtureSlugPrefix = 'e2e-stripe-payments-';
const pool = new Pool({ connectionString: e2ePgConnectionString() });

type EventFixture = {
  eventId: string;
  feeId: string;
  name: string;
  slug: string;
};

type PaymentRow = {
  id: string;
  status: string;
};

type PaymentSettingsRow = {
  address_city: string | null;
  address_line1: string | null;
  address_name: string | null;
  address_postal_code: string | null;
  address_preset: string;
  address_state: string | null;
  payment_deadline_at: Date | null;
  payments_enabled: boolean;
};

async function cleanupPaymentFixtures(): Promise<void> {
  await pool.query(
    `
      DELETE FROM "event_payment_notifications"
      WHERE "payment_id" IN (
        SELECT ep."id"
        FROM "event_payments" ep
        JOIN "events" e ON e."id" = ep."event_id"
        WHERE e."slug" LIKE $1
      )
    `,
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    `
      DELETE FROM "event_payments" ep
      USING "events" e
      WHERE e."id" = ep."event_id" AND e."slug" LIKE $1
    `,
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    `
      DELETE FROM "event_registration_answers"
      WHERE "registration_id" IN (
        SELECT er."id"
        FROM "event_registrations" er
        JOIN "events" e ON e."id" = er."event_id"
        WHERE e."slug" LIKE $1
      )
    `,
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    `
      DELETE FROM "event_registrations" er
      USING "events" e
      WHERE e."id" = er."event_id" AND e."slug" LIKE $1
    `,
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    'DELETE FROM "event_entry_fees" WHERE "event_id" IN (SELECT "id" FROM "events" WHERE "slug" LIKE $1)',
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    'DELETE FROM "event_dates" WHERE "event_id" IN (SELECT "id" FROM "events" WHERE "slug" LIKE $1)',
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    'DELETE FROM "event_admins" WHERE "event_id" IN (SELECT "id" FROM "events" WHERE "slug" LIKE $1)',
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query('DELETE FROM "events" WHERE "slug" LIKE $1', [
    `${fixtureSlugPrefix}%`,
  ]);
}

async function adminUserId(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    'SELECT "id" FROM "user" WHERE lower("email") = $1',
    [adminEmail]
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('Seeded admin user was not found in the e2e database.');
  }
  return id;
}

async function firstEventCategoryId(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    'SELECT "id" FROM "event_categories" ORDER BY "display_order", "name" LIMIT 1'
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('No event category seed data was found.');
  }
  return id;
}

async function createPaymentEvent(options: {
  amountCents?: number;
  name: string;
  paymentDeadlineAt?: string | null;
  paymentsEnabled?: boolean;
  requiresApproval: boolean;
}): Promise<EventFixture> {
  const eventId = randomUUID();
  const feeId = randomUUID();
  const slug = `${fixtureSlugPrefix}${randomUUID()}`;
  const categoryId = await firstEventCategoryId();
  await pool.query(
    `
      INSERT INTO "events" (
        "id",
        "name",
        "short_name",
        "event_category_id",
        "description",
        "slug",
        "is_special",
        "max_participants",
        "requires_approval",
        "registration_start",
        "registration_end",
        "created_at",
        "detail_page_kind",
        "is_published",
        "payments_enabled",
        "payment_deadline_at",
        "address_preset",
        "address_name",
        "address_line1",
        "address_city",
        "address_state",
        "address_postal_code",
        "address_country"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, false, 30, $7,
        '2026-01-01T00:00:00.000Z',
        '2026-12-31T23:59:00.000Z',
        NOW(),
        'standard',
        true,
        $8,
        $9,
        'pavilion',
        'MIT Sailing Pavilion',
        '134 Memorial Dr',
        'Cambridge',
        'MA',
        '02139',
        'US'
      )
    `,
    [
      eventId,
      options.name,
      options.name,
      categoryId,
      `${options.name} e2e fixture`,
      slug,
      options.requiresApproval,
      options.paymentsEnabled ?? true,
      options.paymentDeadlineAt ?? '2026-08-01T16:00:00.000Z',
    ]
  );
  await pool.query(
    `
      INSERT INTO "event_dates" ("id", "event_id", "start_datetime", "end_datetime")
      VALUES ($1, $2, '2026-08-15T14:00:00.000Z', '2026-08-15T18:00:00.000Z')
    `,
    [randomUUID(), eventId]
  );
  await pool.query(
    `
      INSERT INTO "event_entry_fees" ("id", "event_id", "description", "amount_cents", "is_deposit")
      VALUES ($1, $2, 'Event registration', $3, false)
    `,
    [feeId, eventId, options.amountCents ?? 4200]
  );

  return { eventId, feeId, name: options.name, slug };
}

async function createRegistrationWithPayment(options: {
  event: EventFixture;
  manualHandledNote?: string;
  receiptUrl?: string | null;
  status: 'handled' | 'paid' | 'past_due' | 'pending';
}): Promise<string> {
  const userId = await adminUserId();
  const registrationId = randomUUID();
  const paymentId = randomUUID();
  await pool.query(
    `
      INSERT INTO "event_registrations" (
        "id",
        "event_id",
        "user_id",
        "status",
        "created_at",
        "swim_agreement_accepted_at"
      )
      VALUES ($1, $2, $3, 'approved', NOW(), NOW())
    `,
    [registrationId, options.event.eventId, userId]
  );
  await pool.query(
    `
      INSERT INTO "event_payments" (
        "id",
        "event_id",
        "registration_id",
        "user_id",
        "selected_fee_id",
        "selected_fee_description",
        "amount_cents",
        "currency",
        "status",
        "stripe_receipt_url",
        "manual_handled_note",
        "manual_handled_by_user_id",
        "manual_handled_at",
        "created_at",
        "updated_at"
      )
      VALUES (
        $1, $2, $3, $4, $5, 'Event registration', 4200, 'usd',
        $6::event_payment_status, $7, $8,
        CASE WHEN $6::text = 'handled' THEN $4 ELSE NULL END,
        CASE WHEN $6::text = 'handled' THEN NOW() ELSE NULL END,
        NOW(),
        NOW()
      )
    `,
    [
      paymentId,
      options.event.eventId,
      registrationId,
      userId,
      options.event.feeId,
      options.status,
      options.receiptUrl ?? null,
      options.manualHandledNote ?? null,
    ]
  );
  return paymentId;
}

async function paymentRowsForEvent(slug: string): Promise<PaymentRow[]> {
  const result = await pool.query<PaymentRow>(
    `
      SELECT ep."id", ep."status"
      FROM "event_payments" ep
      JOIN "events" e ON e."id" = ep."event_id"
      WHERE e."slug" = $1
      ORDER BY ep."created_at" DESC
    `,
    [slug]
  );
  return result.rows;
}

async function paymentRequestCount(paymentId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM "event_payment_notifications"
      WHERE "payment_id" = $1 AND "kind" = 'request'
    `,
    [paymentId]
  );
  return Number(result.rows[0]?.count ?? '0');
}

async function paymentSettingsForEvent(
  slug: string
): Promise<PaymentSettingsRow> {
  const result = await pool.query<PaymentSettingsRow>(
    `
      SELECT
        "payments_enabled",
        "payment_deadline_at",
        "address_preset",
        "address_name",
        "address_line1",
        "address_city",
        "address_state",
        "address_postal_code"
      FROM "events"
      WHERE "slug" = $1
  `,
    [slug]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error(`Fixture event ${slug} was not found.`);
  }
  return row;
}

async function mountMockStripeCheckout(page: Page): Promise<void> {
  await page.route(/^https:\/\/js\.stripe\.com\/.*/u, async (route) => {
    await route.fulfill({
      body: `
        window.Stripe = function () {
          return {
            createEmbeddedCheckoutPage: async function (options) {
              const clientSecret = await options.fetchClientSecret();
              return {
                mount: function (element) {
                  element.innerHTML =
                    '<div role="status">Embedded checkout ready</div>' +
                    '<p data-testid="stripe-client-secret">' +
                    clientSecret +
                    '</p>';
                },
                unmount: function () {}
              };
            }
          };
        };
        window.Stripe.version = 'e2e';
      `,
      contentType: 'application/javascript',
    });
  });
}

async function submitRegistration(options: {
  buttonName: string;
  eventName: string;
  page: Page;
  slug: string;
}): Promise<void> {
  await options.page.goto(`/events/${options.slug}/register`);
  await expect(
    options.page.getByRole('heading', {
      level: 1,
      name: options.eventName,
    })
  ).toBeVisible();
  await options.page
    .getByRole('switch', { name: /Swim Agreement and Liability Release/ })
    .click();
  await options.page.getByRole('button', { name: options.buttonName }).click();
}

test.beforeEach(async () => {
  await cleanupPaymentFixtures();
});

test.afterEach(async () => {
  await cleanupPaymentFixtures();
});

test.afterAll(async () => {
  await pool.end();
});

test.describe('Event payments', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin enables payments with deadline and custom address', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E paid clinic settings',
      paymentDeadlineAt: null,
      paymentsEnabled: false,
      requiresApproval: false,
    });
    await signInAsAdmin(page);

    await page.goto(`/admin/events/${event.slug}/edit`);
    await page.getByLabel('Collect payment for approved registrations').check();
    await page.getByLabel('Payment deadline').fill('2026-08-01T12:00');
    await page.getByLabel('Custom address').check();
    await page.getByLabel('Location name').fill('MIT Sailing Test Dock');
    await page.getByLabel('Address line 1').fill('77 Massachusetts Ave');
    await page.getByLabel('City').fill('Cambridge');
    await page.getByLabel('State').fill('MA');
    await page.getByLabel('Postal code').fill('02139');
    await page.getByRole('button', { name: 'Save payment settings' }).click();

    await expect
      .poll(async () => {
        const settings = await paymentSettingsForEvent(event.slug);
        return settings;
      })
      .toMatchObject({
        address_city: 'Cambridge',
        address_line1: '77 Massachusetts Ave',
        address_name: 'MIT Sailing Test Dock',
        address_postal_code: '02139',
        address_preset: 'custom',
        address_state: 'MA',
        payments_enabled: true,
      });
  });

  test('auto-approved paid registration lands on embedded checkout page', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E auto paid clinic',
      requiresApproval: false,
    });
    await mountMockStripeCheckout(page);
    await signInAsAdmin(page);

    await submitRegistration({
      buttonName: 'Confirm registration',
      eventName: event.name,
      page,
      slug: event.slug,
    });

    await expect(page).toHaveURL(
      new RegExp(`/events/${event.slug}/checkout/?$`)
    );
    await expect(
      page.getByRole('region', { name: 'Secure Stripe checkout' })
    ).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(
      'Embedded checkout ready'
    );
    await expect(page.getByTestId('stripe-client-secret')).toContainText(
      'cs_test_e2e_secret_'
    );
    await expect
      .poll(async () => {
        const rows = await paymentRowsForEvent(event.slug);
        return rows;
      })
      .toMatchObject([{ status: 'checkout_created' }]);
  });

  test('approval-required registration creates payment request after approval', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E approval paid clinic',
      requiresApproval: true,
    });
    await signInAsAdmin(page);

    await submitRegistration({
      buttonName: 'Submit registration request',
      eventName: event.name,
      page,
      slug: event.slug,
    });
    await expect(page).toHaveURL(new RegExp(`/events/${event.slug}/?$`));

    await page.goto(`/admin/events/${event.slug}/registrations`);
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^Pending$/ })
        .first()
    ).toBeVisible();

    await expect
      .poll(async () => {
        const rows = await paymentRowsForEvent(event.slug);
        return rows;
      })
      .toMatchObject([{ status: 'pending' }]);
    const [payment] = await paymentRowsForEvent(event.slug);
    if (!payment) {
      throw new Error('Approval did not create an event payment.');
    }
    await expect
      .poll(async () => {
        const count = await paymentRequestCount(payment.id);
        return count;
      })
      .toBe(1);
  });

  test('admin resends overdue request and marks payment handled', async ({
    page,
  }) => {
    const event = await createPaymentEvent({
      name: 'E2E overdue paid clinic',
      paymentDeadlineAt: '2026-05-01T16:00:00.000Z',
      requiresApproval: false,
    });
    const paymentId = await createRegistrationWithPayment({
      event,
      status: 'past_due',
    });
    await signInAsAdmin(page);

    await page.goto(`/admin/events/${event.slug}/registrations`);
    await expect(page.getByText('Past due')).toBeVisible();

    await page.getByRole('button', { name: 'Resend request' }).click();
    await expect
      .poll(async () => {
        const count = await paymentRequestCount(paymentId);
        return count;
      })
      .toBe(1);

    await page
      .getByLabel('Manual payment note')
      .fill('Paid by check at the pavilion.');
    await page.getByRole('button', { name: 'Mark handled' }).click();

    await expect(page.getByText('Handled')).toBeVisible();
    await page.getByText('Manual handling note').click();
    await expect(
      page.getByText('Paid by check at the pavilion.')
    ).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await paymentRowsForEvent(event.slug);
        return rows;
      })
      .toMatchObject([{ id: paymentId, status: 'handled' }]);
  });

  test('profile shows payment receipt and manual handled behavior', async ({
    page,
  }) => {
    const paidEvent = await createPaymentEvent({
      name: 'E2E paid receipt clinic',
      requiresApproval: false,
    });
    const handledEvent = await createPaymentEvent({
      name: 'E2E handled receipt clinic',
      requiresApproval: false,
    });
    await createRegistrationWithPayment({
      event: paidEvent,
      receiptUrl: 'https://pay.stripe.com/receipts/e2e-paid',
      status: 'paid',
    });
    await createRegistrationWithPayment({
      event: handledEvent,
      manualHandledNote: 'Handled outside Stripe.',
      receiptUrl: 'https://pay.stripe.com/receipts/e2e-handled',
      status: 'handled',
    });
    await signInAsAdmin(page);

    await page.goto('/profile/payments');

    const paidRow = page.getByRole('row', { name: /E2E paid receipt clinic/ });
    await expect(paidRow).toContainText('$42.00');
    await expect(paidRow).toContainText('Paid');
    await expect(
      paidRow.getByRole('link', { exact: true, name: 'Receipt' })
    ).toHaveAttribute('href', 'https://pay.stripe.com/receipts/e2e-paid');

    const handledRow = page.getByRole('row', {
      name: /E2E handled receipt clinic/,
    });
    await expect(handledRow).toContainText('Handled by MIT Sailing');
    await expect(handledRow).toContainText('None');
    await expect(
      handledRow.getByRole('link', { exact: true, name: 'Receipt' })
    ).toHaveCount(0);
  });
});
