import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

type EventRegistrationWindowSnapshot = {
  registration_end: Date | null;
  registration_start: Date | null;
};

async function resetAdminEventRegistration(slug: string): Promise<void> {
  await pool.query(
    `
      DELETE FROM "event_registration_answers"
      WHERE "registration_id" IN (
        SELECT er."id"
        FROM "event_registrations" er
        JOIN "events" e ON e."id" = er."event_id"
        JOIN "user" u ON u."id" = er."user_id"
        WHERE e."slug" = $1 AND lower(u."email") = $2
      )
    `,
    [slug, adminEmail]
  );
  await pool.query(
    `
      DELETE FROM "event_registrations" er
      USING "events" e, "user" u
      WHERE e."id" = er."event_id"
        AND u."id" = er."user_id"
        AND e."slug" = $1
        AND lower(u."email") = $2
    `,
    [slug, adminEmail]
  );
}

async function openEventRegistrationWindow(
  slug: string
): Promise<EventRegistrationWindowSnapshot> {
  const selectResult = await pool.query<EventRegistrationWindowSnapshot>(
    `
      SELECT "registration_start", "registration_end"
      FROM "events"
      WHERE "slug" = $1
    `,
    [slug]
  );
  const [original] = selectResult.rows;
  if (!original) {
    throw new Error(
      `openEventRegistrationWindow: no event row for slug=${slug}.`
    );
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
  return {
    registration_start: original.registration_start,
    registration_end: original.registration_end,
  };
}

async function restoreEventRegistrationWindow(
  slug: string,
  window: EventRegistrationWindowSnapshot
): Promise<void> {
  await pool.query(
    `
      UPDATE "events"
      SET "registration_start" = $2,
          "registration_end" = $3
      WHERE "slug" = $1
    `,
    [slug, window.registration_start, window.registration_end]
  );
}

test.afterAll(async () => {
  await pool.end();
});

test.describe('Event registration switches', () => {
  test('toggles swim agreement and optional picture switches from visible controls', async ({
    page,
  }) => {
    const slug = 'learn-to-sail-all-in-one';
    await resetAdminEventRegistration(slug);
    const registrationWindow = await openEventRegistrationWindow(slug);

    try {
      await signInAsAdmin(page);
      await page.goto(`/events/${slug}/register`);
      await expect(page).toHaveURL(new RegExp(`/events/${slug}/register$`));

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Learn to Sail Class - All-in-One',
        })
      ).toBeVisible();

      const swimAgreementSwitch = page.getByRole('switch', {
        name: /Swim Agreement and Liability Release/,
      });
      const photoSwitch = page.getByRole('switch', {
        name: 'OK to use your photo for MITNA promotion?',
      });

      await swimAgreementSwitch.click();
      await expect(swimAgreementSwitch).toBeChecked();

      await photoSwitch.click();
      await expect(photoSwitch).toBeChecked();

      await page
        .getByText('I agree to the Swim Agreement and Liability Release.', {
          exact: true,
        })
        .click();
      await expect(swimAgreementSwitch).not.toBeChecked();

      await page
        .getByText('OK to use your photo for MITNA promotion?', {
          exact: true,
        })
        .click();
      await expect(photoSwitch).not.toBeChecked();
    } finally {
      await restoreEventRegistrationWindow(slug, registrationWindow);
      await resetAdminEventRegistration(slug);
    }
  });
});
