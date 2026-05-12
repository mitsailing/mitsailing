import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

const adminEmail =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

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

  await pool.query(
    `INSERT INTO "user_sailing_ratings"
      ("id", "user_id", "sailing_rating_id", "issued_by_user_id", "issued_at", "created_at", "updated_at")
     VALUES
      ($1, $2, $3, $4, NOW(), NOW(), NOW())
     ON CONFLICT ("user_id", "sailing_rating_id") DO UPDATE
     SET "issued_by_user_id" = EXCLUDED."issued_by_user_id",
         "issued_at" = EXCLUDED."issued_at",
         "updated_at" = NOW()`,
    ['e2e-user-ak-tech-rating', 'user-ak', 'rating-tech', adminId]
  );
}

async function revokeTechRatingForProfileTest() {
  await pool.query(
    `DELETE FROM "user_sailing_ratings"
     WHERE "user_id" = $1 AND "sailing_rating_id" = $2`,
    ['user-ak', 'rating-tech']
  );
}

test.describe('Sailing ratings', () => {
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
      .filter({ hasText: 'ak@mit.edu' })
      .getByRole('link', { name: 'Andrew Kelley' })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Andrew Kelley' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ratings' })).toBeVisible();

    const techRow = page.getByRole('row').filter({ hasText: 'Tech Rating' });
    await expect(techRow.getByText('Not yet obtained')).toBeVisible();
    await techRow.getByRole('button', { name: 'Give Rating' }).click();
    await expect(techRow.getByRole('button', { name: 'Revoke' })).toBeVisible();
    await expect(techRow.getByText('Not yet obtained')).toHaveCount(0);

    await techRow.getByRole('button', { name: 'Revoke' }).click();
    await expect(
      techRow.getByRole('button', { name: 'Give Rating' })
    ).toBeVisible();
    await expect(techRow.getByText('Not yet obtained')).toBeVisible();
  });

  test('admin edit page keeps ratings actions off account form', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users/user-ak/edit');

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
        .filter({ hasText: 'ak@mit.edu' })
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
