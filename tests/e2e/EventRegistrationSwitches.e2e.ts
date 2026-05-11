import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

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

test.afterAll(async () => {
  await pool.end();
});

test.describe('Event registration switches', () => {
  test('toggles swim agreement and optional picture switches from visible controls', async ({
    page,
  }) => {
    const slug = 'learn-to-sail-all-in-one';
    await resetAdminEventRegistration(slug);

    try {
      await signInAsAdmin(page);
      await page.goto(`/events/${slug}/register`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Learn to Sail — All-in-One',
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
      await resetAdminEventRegistration(slug);
    }
  });
});
