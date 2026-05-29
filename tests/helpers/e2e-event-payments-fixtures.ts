import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { e2ePgConnectionString } from './e2e-database-url';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';
const fixtureSlugPrefix = `e2e-stripe-payments-${randomUUID()}-`;
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

export type PaymentSettingsRow = {
  address_city: string | null;
  address_line1: string | null;
  address_name: string | null;
  address_postal_code: string | null;
  address_preset: string;
  address_state: string | null;
  payment_deadline_at: Date | null;
  payments_enabled: boolean;
};

export async function cleanupPaymentFixtures(): Promise<void> {
  await pool.query(
    `
      DELETE FROM "event_payment_notifications"
      WHERE "payment_id" IN (
        SELECT ep."id"
        FROM "payments" ep
        JOIN "events" e ON e."id" = ep."event_id"
        WHERE e."slug" LIKE $1
      )
    `,
    [`${fixtureSlugPrefix}%`]
  );
  await pool.query(
    `
      DELETE FROM "payments" ep
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

export async function createPaymentEvent(options: {
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
  const registrationStart = new Date(Date.now() - 86_400_000).toISOString();
  const registrationEnd = new Date(Date.now() + 180 * 86_400_000).toISOString();
  const eventStart = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const eventEnd = new Date(
    Date.now() + 30 * 86_400_000 + 14_400_000
  ).toISOString();
  const paymentDeadlineAt =
    options.paymentDeadlineAt === undefined
      ? new Date(Date.now() + 14 * 86_400_000).toISOString()
      : options.paymentDeadlineAt;
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
        $10,
        $11,
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
      paymentDeadlineAt,
      registrationStart,
      registrationEnd,
    ]
  );
  await pool.query(
    `
      INSERT INTO "event_dates" ("id", "event_id", "start_datetime", "end_datetime")
      VALUES ($1, $2, $3, $4)
    `,
    [randomUUID(), eventId, eventStart, eventEnd]
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

async function insertApprovedRegistration(options: {
  eventId: string;
  registrationId: string;
  userId: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO "event_registrations" (
        "id",
        "event_id",
        "user_id",
        "status",
        "phone",
        "created_at",
        "swim_agreement_accepted_at"
      )
      VALUES ($1, $2, $3, 'approved', '617-555-0142', NOW(), NOW())
    `,
    [options.registrationId, options.eventId, options.userId]
  );
}

async function insertEventPayment(options: {
  event: EventFixture;
  manualHandledNote?: string;
  paymentId: string;
  receiptUrl?: string | null;
  registrationId: string;
  status: 'handled' | 'paid' | 'past_due' | 'pending';
  userId: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO "payments" (
        "id",
        "purpose",
        "source",
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
        $1, 'event', 'stripe', $2, $3, $4, $5, 'Event registration', 4200, 'usd',
        $6::payment_status, $7, $8,
        CASE WHEN $6::text = 'handled' THEN $4 ELSE NULL END,
        CASE WHEN $6::text = 'handled' THEN NOW() ELSE NULL END,
        NOW(),
        NOW()
      )
    `,
    [
      options.paymentId,
      options.event.eventId,
      options.registrationId,
      options.userId,
      options.event.feeId,
      options.status,
      options.receiptUrl ?? null,
      options.manualHandledNote ?? null,
    ]
  );
}

export async function createRegistrationWithPayment(options: {
  event: EventFixture;
  manualHandledNote?: string;
  receiptUrl?: string | null;
  status: 'handled' | 'paid' | 'past_due' | 'pending';
}): Promise<string> {
  const userId = await adminUserId();
  const registrationId = randomUUID();
  const paymentId = randomUUID();
  await insertApprovedRegistration({
    eventId: options.event.eventId,
    registrationId,
    userId,
  });
  await insertEventPayment({
    event: options.event,
    manualHandledNote: options.manualHandledNote,
    paymentId,
    receiptUrl: options.receiptUrl,
    registrationId,
    status: options.status,
    userId,
  });
  return paymentId;
}

export async function paymentRowsForEvent(slug: string): Promise<PaymentRow[]> {
  const result = await pool.query<PaymentRow>(
    `
      SELECT ep."id", ep."status"
      FROM "payments" ep
      JOIN "events" e ON e."id" = ep."event_id"
      WHERE e."slug" = $1
      ORDER BY ep."created_at" DESC
    `,
    [slug]
  );
  return result.rows;
}

export async function paymentRequestCount(paymentId: string): Promise<number> {
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

export async function markPaymentHandledFixture(options: {
  note: string;
  paymentId: string;
}): Promise<void> {
  const adminId = await adminUserId();
  await pool.query(
    `
      UPDATE "payments"
      SET "status" = 'handled',
          "manual_handled_note" = $2,
          "manual_handled_by_user_id" = $3,
          "manual_handled_at" = NOW(),
          "updated_at" = NOW()
      WHERE "id" = $1
    `,
    [options.paymentId, options.note, adminId]
  );
}

export async function paymentSettingsForEvent(
  slug: string
): Promise<PaymentSettingsRow> {
  const result = await pool.query<PaymentSettingsRow>(
    `
      SELECT
        "payments_enabled",
        "payment_deadline_at" AT TIME ZONE 'UTC' AS "payment_deadline_at",
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

export async function mountMockStripeCheckout(page: Page): Promise<void> {
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

export async function submitRegistration(options: {
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
    .getByRole('switch', { name: /Swim Agreement and Liability Release/u })
    .click();
  const phoneInput = options.page.getByLabel('Phone');
  if (await phoneInput.isVisible()) {
    await phoneInput.fill('617-555-0137');
  }
  await options.page.getByRole('button', { name: options.buttonName }).click();
}

export async function endPaymentFixturePool(): Promise<void> {
  await pool.end();
}
