import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { nyYmd } from '@/lib/mit-sailing/nyTime';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

let pgPoolEnded = false;

async function closePgPool(): Promise<void> {
  if (pgPoolEnded) {
    return;
  }
  pgPoolEnded = true;
  try {
    await pool.end();
  } catch (error) {
    throw new Error('closePgPool failed while ending the Postgres pool.', {
      cause: error,
    });
  }
}

async function resetAdminEventRegistration(slug: string): Promise<void> {
  try {
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
  } catch (error) {
    throw new Error(
      `resetAdminEventRegistration failed for slug=${slug} adminEmail=${adminEmail}.`,
      { cause: error }
    );
  }
}

type EventRegistrationWindowSnapshot = {
  registration_start: Date | null;
  registration_end: Date | null;
};

async function openEventRegistrationWindow(
  slug: string
): Promise<EventRegistrationWindowSnapshot> {
  try {
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
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('openEventRegistrationWindow:')
    ) {
      throw error;
    }
    throw new Error(`openEventRegistrationWindow failed for slug=${slug}.`, {
      cause: error,
    });
  }
}

async function restoreEventRegistrationWindow(
  slug: string,
  original: EventRegistrationWindowSnapshot
): Promise<void> {
  try {
    await pool.query(
      `
        UPDATE "events"
        SET "registration_start" = $2,
            "registration_end" = $3
        WHERE "slug" = $1
      `,
      [slug, original.registration_start, original.registration_end]
    );
  } catch (error) {
    throw new Error(`restoreEventRegistrationWindow failed for slug=${slug}.`, {
      cause: error,
    });
  }
}

async function resetPavilionReservationRequest(props: {
  eventName: string;
  requesterEmail: string;
}): Promise<void> {
  try {
    await pool.query(
      `
        DELETE FROM "pavilion_reservation_requests"
        WHERE lower("event_name") = lower($1)
          AND lower("requester_email") = $2
      `,
      [props.eventName, props.requesterEmail.toLowerCase()]
    );
  } catch (error) {
    throw new Error(
      `resetPavilionReservationRequest failed for eventName=${props.eventName} requesterEmail=${props.requesterEmail}.`,
      { cause: error }
    );
  }
}

async function pavilionReservationRecord(props: {
  eventName: string;
  requesterEmail: string;
}): Promise<{ event_name: string; reference_code: string } | null> {
  const result = await pool.query<{
    event_name: string;
    reference_code: string;
  }>(
    `
      SELECT "event_name", "reference_code"
      FROM "pavilion_reservation_requests"
      WHERE lower("event_name") = lower($1)
        AND lower("requester_email") = $2
      ORDER BY "created_at" DESC
      LIMIT 1
    `,
    [props.eventName, props.requesterEmail.toLowerCase()]
  );
  return result.rows[0] ?? null;
}

function isoDateDaysFromNow(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return nyYmd(date);
}

async function selectPavilionReservationPickerDate(
  page: Page,
  isoDate: string
): Promise<void> {
  if (isoDate.slice(0, 7) !== isoDateDaysFromNow(2).slice(0, 7)) {
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await page
    .getByRole('button', {
      exact: true,
      name: String(Number(isoDate.slice(8, 10))),
    })
    .click();
}

test.afterAll(async () => {
  await closePgPool();
});

test.describe('MIT Sailing catalog', () => {
  test.describe.configure({ mode: 'serial' });

  test('/events renders event calendar', async ({ page }) => {
    await page.goto('/events?month=2026-04');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Events calendar' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Return to/ }).filter({
        hasText: 'April 2026',
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Learn-to-Sail Class 1-2-3' }).first()
    ).toBeVisible();
    const categoryFilters = page.getByLabel('Event category filters');
    await expect(
      categoryFilters.getByRole('link', { name: 'PE Class' })
    ).toBeVisible();
    await expect(
      categoryFilters.getByRole('link', { name: 'Bluewater' })
    ).toHaveCount(0);
  });

  test('/classes lists category sections', async ({ page }) => {
    await page.goto('/classes');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Classes' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Introduction' })
    ).toBeVisible();
  });

  test('/events/[slug] shows registration CTA when signed out', async ({
    page,
  }) => {
    const slug = 'bluewater-boston-provincetown';
    const registrationWindow = await openEventRegistrationWindow(slug);
    try {
      await page.goto(`/events/${slug}`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Bluewater: Boston to Provincetown Passage',
        })
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Log in to request a spot' })
      ).toBeVisible();
    } finally {
      await restoreEventRegistrationWindow(slug, registrationWindow);
    }
  });

  test('/events/[slug] shows registration state when signed in', async ({
    page,
  }) => {
    const slug = 'bluewater-boston-provincetown';
    await resetAdminEventRegistration(slug);
    const registrationWindow = await openEventRegistrationWindow(slug);
    try {
      await signInAsAdmin(page);

      await page.goto(`/events/${slug}`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Bluewater: Boston to Provincetown Passage',
        })
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Request a spot' })
      ).toBeVisible();
    } finally {
      await restoreEventRegistrationWindow(slug, registrationWindow);
    }
  });

  test('/events/[slug]/register submits registration from checkout page', async ({
    page,
  }) => {
    const slug = 'intercollegiate-overnight-series';
    await resetAdminEventRegistration(slug);
    const registrationWindow = await openEventRegistrationWindow(slug);

    try {
      await signInAsAdmin(page);

      await page.goto(`/events/${slug}`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Intercollegiate Overnight Series',
        })
      ).toBeVisible();
      await page.getByRole('link', { name: 'Request a spot' }).click();
      await expect(page).toHaveURL(new RegExp(`/events/${slug}/register$`));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Intercollegiate Overnight Series',
        })
      ).toBeVisible();
      await page.getByRole('textbox', { name: /phone/i }).fill('617-555-0100');
      await page.getByLabel(/Current sailing rating/).selectOption('Green');
      await page
        .getByRole('switch', {
          name: /Swim Agreement and Liability Release/,
        })
        .check();
      await page.getByRole('button', { name: 'Request a spot' }).click();

      await expect(
        page.getByRole('heading', { name: 'Your registration' })
      ).toBeVisible();
      await expect(page.getByText('Waiting for confirmation')).toBeVisible();
    } finally {
      await restoreEventRegistrationWindow(slug, registrationWindow);
      await resetAdminEventRegistration(slug);
    }
  });

  test('/classes/[slug] shows class detail', async ({ page }) => {
    await page.goto('/classes/intro-sailing-101');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Intro Sailing 101' })
    ).toBeVisible();
  });

  test('/reserve submits public reservation request', async ({ page }) => {
    const eventName = `E2E Pavilion Request ${Date.now()}`;
    const requesterEmail = `${eventName
      .toLowerCase()
      .replaceAll(' ', '-')}@example.com`;

    try {
      await resetPavilionReservationRequest({ eventName, requesterEmail });
      await page.goto('/reserve');

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Reserve a Pavilion',
        })
      ).toBeVisible();
      await page.getByLabel('Email address').fill(requesterEmail);
      await page
        .getByRole('article')
        .filter({ hasText: 'Casual party space' })
        .getByRole('button', { name: 'Select this option' })
        .click();
      await selectPavilionReservationPickerDate(page, isoDateDaysFromNow(14));
      await page.getByRole('button', { name: '10:00 AM' }).click();
      await page.getByRole('button', { name: '12:00 PM' }).click();
      await page
        .getByRole('button', { name: 'Next: contact information' })
        .click();

      await expect(page.getByLabel('Email address')).toHaveValue(
        requesterEmail
      );
      await page.getByLabel('Group type').selectOption('mit_student');
      await page.getByLabel('First name').fill('Pavilion');
      await page.getByLabel('Last name').fill('Requester');
      await page.getByLabel('Phone').fill('617-555-0142');
      await page.getByLabel('Event name').fill(eventName);
      await page.getByLabel('Event description').fill('E2E waterfront event.');

      await expect(
        page.getByRole('heading', { name: 'Review your reservation' })
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Submit reservation request' })
        .click();

      await expect(
        page.getByRole('heading', { name: 'Request received' })
      ).toBeVisible();
      await expect(page.getByText(/^PAV-/)).toBeVisible();
      await expect
        .poll(
          async () => {
            const reservation = await pavilionReservationRecord({
              eventName,
              requesterEmail,
            });
            return reservation?.event_name ?? null;
          },
          { timeout: 60_000 }
        )
        .toBe(eventName);
    } finally {
      await resetPavilionReservationRequest({ eventName, requesterEmail });
    }
  });

  test('/fleet lists boats', async ({ page }) => {
    await page.goto('/fleet');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Fleet' })
    ).toBeVisible();
  });

  test('/fleet/[slug] shows boat detail', async ({ page }) => {
    await page.goto('/fleet/tech-dinghy');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Tech dinghy' })
    ).toBeVisible();
  });

  test('/events shows New York-local schedule without timezone copy', async ({
    page,
  }) => {
    await page.goto('/events?month=2026-06');

    await expect(
      page.getByRole('link', { name: 'Dinghy Cup' }).first()
    ).toBeVisible();
    await expect(page.getByText('9:00 AM – 5:00 PM').first()).toBeVisible();
    await expect(page.getByText(/ ET\b/)).toHaveCount(0);
  });
});
