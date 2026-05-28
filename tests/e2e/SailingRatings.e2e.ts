import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';
import { insertCurrentSailingCardOnboardingAcceptance } from '../helpers/e2e-sailing-card-onboarding';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

const usernameId = 'username';
const e2eTechRatingId = 'rating-tech';

test.afterAll(async () => {
  await pool.end();
});

async function grantTechRatingForProfileTest() {
  const admin = await pool.query<{ id: string }>(
    'SELECT "id" FROM "user" WHERE "email" = $1 LIMIT 1',
    [adminEmail]
  );
  const adminId = admin.rows[0]?.id;
  if (!adminId) {
    throw new Error('Seeded admin user missing');
  }

  const user = await pool.query<{ id: string }>(
    `UPDATE "user"
     SET "phone" = $2,
         "emergency_contact_name" = $3,
         "emergency_contact_phone" = $4,
         "sailing_card_requested_at" = COALESCE("sailing_card_requested_at", NOW())
     WHERE "id" = $1
     RETURNING "id"`,
    [usernameId, '+16172531234', 'Taylor Test', '+16172534321']
  );
  const userId = user.rows[0]?.id;
  if (!userId) {
    throw new Error('Seeded profile test user missing');
  }
  await insertCurrentSailingCardOnboardingAcceptance({
    pool,
    userAgent: 'e2e-sailing-ratings',
    userId,
  });

  await pool.query(
    `INSERT INTO "user_sailing_ratings"
      ("id", "user_id", "sailing_rating_id", "issued_by_user_id", "issued_at", "created_at", "updated_at")
     VALUES
      ($1, $2, $3, $4, NOW(), NOW(), NOW())
     ON CONFLICT ("user_id", "sailing_rating_id") DO UPDATE
     SET "issued_by_user_id" = EXCLUDED."issued_by_user_id",
         "issued_at" = EXCLUDED."issued_at",
         "updated_at" = NOW()`,
    ['e2e-username-tech-rating', usernameId, e2eTechRatingId, adminId]
  );
}

async function revokeTechRatingForProfileTest() {
  await pool.query(
    `DELETE FROM "user_sailing_ratings"
     WHERE "user_id" = $1 AND "sailing_rating_id" = $2`,
    [usernameId, e2eTechRatingId]
  );
}

/**
 * Waits until the seeded user has or lacks the tech rating row (e2e `pg` pool, not Prisma).
 *
 * @param present - When true, poll until the row exists; when false, until absent.
 */
async function waitForTechRatingRowPresent(present: boolean) {
  const stateLabel = present ? 'granted' : 'revoked';
  await expect
    .poll(
      async () => {
        const result = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1
               FROM "user_sailing_ratings"
              WHERE "user_id" = $1
                AND "sailing_rating_id" = $2
           ) AS "exists"`,
          [usernameId, e2eTechRatingId]
        );
        return result.rows[0]?.exists ?? false;
      },
      { message: `tech rating ${stateLabel} in e2e database` }
    )
    .toBe(present);
}

test.describe('Sailing ratings', () => {
  // Override root `fullyParallel`: shared `username` / `rating-tech` rows must not
  // race with concurrent hooks/tests from this file on other workers.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    await revokeTechRatingForProfileTest();
  });

  test.afterEach(async () => {
    await revokeTechRatingForProfileTest();
  });

  test('/ratings shows public rating catalog', async ({ page }) => {
    await page.goto('/ratings');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Sailing ratings' })
    ).toBeVisible();
    await expect(
      page.getByRole('rowheader', { name: /Tech Rating/ })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Rating' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Boats' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Wind' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Guide' })
    ).toBeVisible();
    await expect(
      page.getByRole('rowheader', { name: /Provisional Rating/ })
    ).toBeVisible();
    await expect(
      page.getByRole('rowheader', { name: /Bluewater Crew/ })
    ).toBeVisible();
    await expect(
      page.getByRole('rowheader', { name: /Bluewater Skipper/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Deprecated ratings' })
    ).toHaveCount(0);
  });

  test('boat detail shows required rating', async ({ page }) => {
    await page.goto('/fleet/tech-dinghy');

    await expect(
      page.getByRole('heading', { level: 2, name: 'Required rating' })
    ).toBeVisible();
    const techRatingLink = page.getByRole('link', { name: 'Tech Rating' });
    await expect(techRatingLink).toBeVisible();
    await expect(techRatingLink).toHaveAttribute(
      'href',
      '/ratings#tech-rating'
    );
    await expect(page.getByText('Required class')).toHaveCount(0);
  });

  test('class detail shows required and grantable ratings', async ({
    page,
  }) => {
    await page.goto('/classes/intro-sailing-101');

    await expect(
      page.getByRole('heading', { name: 'Ratings staff may grant' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Tech Rating' })
    ).toHaveAttribute('href', '/ratings#tech-rating');
    await expect(page.getByText('Related events')).toBeVisible();
  });

  test('admin grants and revokes ratings from user show page', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users');

    await page
      .getByRole('row')
      .filter({ hasText: 'username@example.com' })
      .getByRole('link', { name: 'Username' })
      .click();

    await expect(page.getByRole('heading', { name: 'Username' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ratings' })).toBeVisible();

    const techRow = page.getByRole('row').filter({ hasText: 'Tech Rating' });
    await expect(techRow.getByText('Not yet obtained')).toBeVisible();
    await techRow.getByRole('button', { name: 'Give Rating' }).click();
    await waitForTechRatingRowPresent(true);
    await page.reload();
    await expect(techRow.getByRole('button', { name: 'Revoke' })).toBeVisible();
    await expect(techRow.getByText('Not yet obtained')).toHaveCount(0);

    await techRow.getByRole('button', { name: 'Revoke' }).click();
    await waitForTechRatingRowPresent(false);
    await page.reload();
    await expect(techRow.getByRole('button', { name: 'Revoke' })).toHaveCount(
      0
    );
    await expect(
      techRow.getByRole('button', { name: 'Give Rating' })
    ).toBeVisible();
    await expect(techRow.getByText('Not yet obtained')).toBeVisible();
  });

  test('admin edit page keeps ratings actions off account form', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users/username/edit');

    await expect(
      page.getByRole('heading', { name: 'Edit user' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Give Rating' })).toHaveCount(
      0
    );
    await expect(page.getByRole('heading', { name: 'Ratings' })).toHaveCount(0);
  });

  test.describe('profile ratings with tech grant', () => {
    test.beforeEach(async () => {
      await grantTechRatingForProfileTest();
    });

    test.afterEach(async () => {
      await revokeTechRatingForProfileTest();
    });

    test('profile ratings show issuer and date', async ({ page }) => {
      await signInAsAdmin(page);

      await page.goto('/admin/users');
      await page
        .getByRole('row')
        .filter({ hasText: 'username@example.com' })
        .getByRole('button', { name: 'View as user' })
        .click();
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');

      await page.goto('/profile/ratings');
      await expect(
        page.getByRole('heading', { name: 'Sailing ratings' })
      ).toBeVisible();
      await expect(
        page.getByRole('rowheader', { name: 'Tech Rating' })
      ).toBeVisible();
      await expect(
        page.getByText(/Issued [A-Z][a-z]{2} \d{1,2}, 20\d{2} by Administrator/)
      ).toBeVisible();
      const techRatingRow = page.getByRole('row').filter({
        has: page.getByRole('rowheader', { name: 'Tech Rating' }),
      });
      await expect(
        techRatingRow.getByRole('link', { name: 'Tech dinghy' })
      ).toBeVisible();
      await expect(
        techRatingRow.getByRole('link', { name: 'Mashnee' })
      ).toBeVisible();
    });
  });

  test('melges detail shows advanced 420 rating', async ({ page }) => {
    await page.goto('/fleet/melges-15');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Melges 15' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '420: Advanced' })
    ).toBeVisible();
  });

  test('mashnee detail separates access and skipper ratings', async ({
    page,
  }) => {
    await page.goto('/fleet/mashnee');

    const requiredSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Required rating' }) });
    const advancedSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Advanced ratings' }) });

    await expect(
      requiredSection.getByRole('link', { name: 'Tech Rating' })
    ).toBeVisible();
    await expect(
      requiredSection.getByRole('link', { name: 'Bluewater Skipper' })
    ).toHaveCount(0);
    await expect(
      advancedSection.getByRole('link', { name: 'Bluewater Crew' })
    ).toBeVisible();
    await expect(
      advancedSection.getByRole('link', { name: 'Bluewater Skipper' })
    ).toBeVisible();
  });
});
