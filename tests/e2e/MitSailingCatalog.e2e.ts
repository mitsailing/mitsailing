import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/mitsailing_test';

const pool = new Pool({ connectionString: testDatabaseUrl });

let pgPoolEnded = false;

async function closePgPool(): Promise<void> {
  if (pgPoolEnded) {
    return;
  }
  pgPoolEnded = true;
  await pool.end();
}

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
  await closePgPool();
});

test.describe('MIT Sailing catalog', () => {
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
      page
        .getByRole('link', { name: 'Learn to Sail — Weekday (Apr 7–9)' })
        .first()
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
    await page.goto('/events/bluewater-boston-provincetown');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Bluewater: Boston to Provincetown Passage',
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Log in to register' })
    ).toBeVisible();
  });

  test('/events/[slug] shows registration state when signed in', async ({
    page,
  }) => {
    await signInAsAdmin(page);

    await page.goto('/events/bluewater-boston-provincetown');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Bluewater: Boston to Provincetown Passage',
      })
    ).toBeVisible();
    await expect(
      page
        .getByRole('button', {
          name: /Request to register|Cancel request|Cancel my registration/,
        })
        .or(page.getByText(/Pending acceptance|You’re going/))
    ).toBeVisible();
  });

  test('/events/[slug]/register submits registration from checkout page', async ({
    page,
  }) => {
    const slug = 'intercollegiate-overnight-series';
    await resetAdminEventRegistration(slug);

    try {
      await signInAsAdmin(page);

      await page.goto(`/events/${slug}`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Intercollegiate Overnight Series',
        })
      ).toBeVisible();
      await page.getByRole('button', { name: 'Request to register' }).click();
      await expect(page).toHaveURL(new RegExp(`/events/${slug}/register/?$`));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Intercollegiate Overnight Series',
        })
      ).toBeVisible();
      await page.getByLabel('Current sailing rating').selectOption('Green');
      await page.getByLabel(/I can swim/).check();
      await page
        .getByRole('button', { name: 'Submit registration request' })
        .click();

      await expect(
        page.getByRole('heading', { name: 'Your reservation' })
      ).toBeVisible();
      await expect(page.getByText('Pending acceptance')).toBeVisible();
    } finally {
      await resetAdminEventRegistration(slug);
    }
  });

  test('/classes/[slug] shows class detail', async ({ page }) => {
    await page.goto('/classes/intro-sailing-101');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Intro Sailing 101' })
    ).toBeVisible();
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
      page.getByRole('heading', { level: 1, name: 'Tech Dinghy' })
    ).toBeVisible();
  });

  test('/events shows New York-local schedule without timezone copy', async ({
    page,
  }) => {
    await page.goto('/events');

    const event = page
      .getByRole('article')
      .filter({ hasText: 'Boston Dinghy Cup' });
    await expect(
      event.getByText('Sat, Jun 13, 2026 · 9:00 AM – 5:00 PM')
    ).toBeVisible();
    await expect(event.getByText(/ ET\b/)).toHaveCount(0);
  });
});
