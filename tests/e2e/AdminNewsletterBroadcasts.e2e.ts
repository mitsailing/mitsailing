import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

let pool: Pool | undefined;

function getPool(): Pool {
  pool ??= new Pool({ connectionString: e2ePgConnectionString() });
  return pool;
}

test.afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

async function createBroadcastPrerequisites(params: {
  listId: string;
  listName: string;
  listSlug: string;
  templateId: string;
  templateName: string;
  templateSlug: string;
}) {
  const database = getPool();
  await database.query(
    `INSERT INTO "newsletter_lists"
       ("id", "slug", "name", "description", "default_subscription", "visibility", "display_order", "is_archived", "created_at", "updated_at")
     VALUES ($1, $2, $3, $4, 'opt_out', 'public', 10, FALSE, NOW(), NOW())
     ON CONFLICT ("slug") DO UPDATE
       SET "name" = EXCLUDED."name",
           "description" = EXCLUDED."description",
           "is_archived" = FALSE,
           "updated_at" = NOW()`,
    [
      params.listId,
      params.listSlug,
      params.listName,
      'Mobile broadcast e2e list.',
    ]
  );
  await database.query(
    `INSERT INTO "newsletter_templates"
       ("id", "slug", "name", "description", "is_default", "created_at", "updated_at")
     VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
     ON CONFLICT ("slug") DO UPDATE
       SET "name" = EXCLUDED."name",
           "description" = EXCLUDED."description",
           "is_default" = FALSE,
           "updated_at" = NOW()`,
    [
      params.templateId,
      params.templateSlug,
      params.templateName,
      'Mobile broadcast e2e template.',
    ]
  );
}

async function cleanupBroadcastPrerequisites(params: {
  listId: string;
  subject: string;
  templateId: string;
}) {
  const database = getPool();
  await database.query(
    `DELETE FROM "newsletter_events"
     WHERE "broadcast_id" IN (
       SELECT "id" FROM "newsletter_broadcasts" WHERE "subject" = $1
     )`,
    [params.subject]
  );
  await database.query(
    'DELETE FROM "newsletter_broadcasts" WHERE "subject" = $1',
    [params.subject]
  );
  await database.query('DELETE FROM "newsletter_lists" WHERE "id" = $1', [
    params.listId,
  ]);
  await database.query('DELETE FROM "newsletter_templates" WHERE "id" = $1', [
    params.templateId,
  ]);
}

test.describe('Admin newsletter broadcasts', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });

  test('admin composes a newsletter broadcast on mobile', async ({
    page,
  }, testInfo) => {
    const runId = [
      testInfo.project.name,
      testInfo.workerIndex,
      testInfo.retry,
      Date.now(),
    ]
      .join('-')
      .replaceAll(/[^a-z0-9.-]/giu, '-');
    const listName = `Mobile racing ${runId}`;
    const subject = `Mobile newsletter ${runId}`;
    const templateName = `Mobile template ${runId}`;
    const listId = `e2e-list-${runId}`;
    const templateId = `e2e-template-${runId}`;
    await createBroadcastPrerequisites({
      listId,
      listName,
      listSlug: `mobile-racing-${runId}`,
      templateId,
      templateName,
      templateSlug: `mobile-template-${runId}`,
    });

    try {
      await signInAsAdmin(page);
      await page.goto('/admin/newsletter-broadcasts/new');
      await expect(
        page.getByRole('heading', {
          exact: true,
          name: 'New newsletter broadcast',
        })
      ).toBeVisible();

      await page.getByLabel('Subject').fill(subject);
      await page.getByLabel('Name').fill(`Draft ${runId}`);
      await page
        .getByLabel('Preview text')
        .fill('Mobile-friendly preview text.');
      await page.getByLabel('Template').selectOption({ label: templateName });
      await page
        .locator('label', { hasText: listName })
        .locator('input[type="checkbox"]')
        .check();

      const bodyEditor = page.getByRole('textbox', { name: 'Body' });
      await expect(bodyEditor).toBeVisible();
      const editorBox = await bodyEditor.boundingBox();
      expect(editorBox?.height ?? 0).toBeGreaterThanOrEqual(460);
      await bodyEditor.fill(
        'This is a full mobile newsletter draft for the sailing community.'
      );

      const saveButton = page.getByRole('button', {
        exact: true,
        name: 'Save draft',
      });
      const queueButton = page.getByRole('button', {
        exact: true,
        name: 'Queue broadcast',
      });
      await saveButton.scrollIntoViewIfNeeded();
      await expect(saveButton).toBeVisible();
      await expect(queueButton).toBeVisible();
      const saveBox = await saveButton.boundingBox();
      const queueBox = await queueButton.boundingBox();
      expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(queueBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(queueBox?.width ?? 0).toBeGreaterThanOrEqual(300);

      await saveButton.click();
      await expect(page).toHaveURL(
        /\/admin\/newsletter-broadcasts\?status=created/u
      );
      await expect(page.getByText('Broadcast draft saved.')).toBeVisible();
      await expect(page.getByRole('link', { name: subject })).toBeVisible();
    } finally {
      await cleanupBroadcastPrerequisites({ listId, subject, templateId });
    }
  });
});
