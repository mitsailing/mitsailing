import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { findLatestMessageToContaining } from '../helpers/mailpit';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('Set TEST_DATABASE_URL or DATABASE_URL before contact e2e.');
}

const pool = new Pool({ connectionString: testDatabaseUrl });

test.afterAll(async () => {
  await pool.end();
});

async function deleteContactByEmail(email: string): Promise<void> {
  await pool.query('DELETE FROM "contact_submissions" WHERE "email" = $1', [
    email,
  ]);
}

test.describe('Contact and directions', () => {
  let contactEmailToDelete: string | null = null;

  test.afterEach(async () => {
    if (contactEmailToDelete) {
      await deleteContactByEmail(contactEmailToDelete);
      contactEmailToDelete = null;
    }
  });

  test('/contact shows form, hours, locations, and Mashnee link', async ({
    page,
  }) => {
    await page.goto('/contact');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Contact us' })
    ).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Pavilion Hours' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: /Open this address in maps \(Street address\)/,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Directions from MIT to Mashnee' })
    ).toHaveAttribute('href', /\/contact\/mashnee-directions\/?$/);
  });

  test('/contact/mashnee-directions shows bluewater directions', async ({
    page,
  }) => {
    await page.goto('/contact/mashnee-directions');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Directions to Mashnee' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Back to contact and directions' })
    ).toHaveAttribute('href', /\/contact\/?$/);
    await expect(
      page
        .locator('address')
        .getByText('Boston Waterboat Marina', { exact: true })
    ).toBeVisible();
  });

  test('submits contact form and manages stored submission in admin', async ({
    page,
  }) => {
    const email = `contact-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const name = `Contact ${faker.person.firstName()}`;
    const message = `Please help me understand the membership process ${faker.string.alphanumeric(8)}.`;
    contactEmailToDelete = email;

    await deleteContactByEmail(email);

    await page.goto('/contact');
    await page.getByLabel('Full name').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('textbox', { name: 'Message' }).fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Thanks. Your message was sent to MIT Sailing support.',
      { timeout: 20_000 }
    );

    const mail = await findLatestMessageToContaining(
      'support@mitsailing.com',
      email
    );
    expect(mail.Subject).toBe('New MIT Sailing contact submission');

    const stored = await pool.query<{ id: string }>(
      'SELECT "id" FROM "contact_submissions" WHERE "email" = $1',
      [email]
    );
    expect(stored.rows).toHaveLength(1);

    await signInAsAdmin(page);
    await page.goto('/admin/contact_submissions');
    await expect(
      page.getByRole('heading', { name: 'Contact submissions' })
    ).toBeVisible();
    await page.getByRole('link', { name }).click();

    await expect(
      page.getByRole('heading', { name: 'Contact submission' })
    ).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();

    await page.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(page.getByText('Submission status updated.')).toBeVisible();
    await expect(page.getByText('Resolved').first()).toBeVisible();

    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Archived').first()).toBeVisible();

    await page.getByRole('button', { name: 'Reopen' }).click();
    await expect(page.getByText('Unread').first()).toBeVisible();

    await page
      .getByLabel(
        'I understand this permanently deletes the stored submission.'
      )
      .check();
    await page.getByRole('button', { name: 'Delete submission' }).click();

    await expect(page).toHaveURL(
      /\/admin\/contact_submissions\/?\?status=deleted$/
    );
    await expect(page.getByText('Contact submission deleted.')).toBeVisible();

    const afterDelete = await pool.query<{ id: string }>(
      'SELECT "id" FROM "contact_submissions" WHERE "email" = $1',
      [email]
    );
    expect(afterDelete.rows).toHaveLength(0);
    contactEmailToDelete = null;
  });
});
