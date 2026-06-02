import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

test.describe('Admin email templates', () => {
  test('admin previews and saves an editable email template draft', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/email-templates');

    await expect(
      page.getByRole('heading', { name: 'Email templates', exact: true })
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Event payment request', exact: true })
      .first()
      .click();

    await expect(
      page.getByRole('heading', {
        name: 'Event payment request',
        exact: true,
      })
    ).toBeVisible();
    await expect(page.getByLabel('Subject')).toBeVisible();
    await expect(page.getByLabel('Preview text')).toBeVisible();
    await expect(
      page.locator('[contenteditable="true"]').first()
    ).toBeVisible();
    await expect(
      page.getByTitle('Email template preview', { exact: true })
    ).toBeVisible();

    const marker = `E2E email template ${Date.now()}`;
    await page.getByLabel('Subject').fill(`Payment requested ${marker}`);
    await page.getByLabel('Preview text').fill(`Preview ${marker}`);
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page).toHaveURL(
      /\/admin\/email-templates\/event_payment_request\?status=draft_saved/
    );
    await expect(page.getByText('Draft saved.')).toBeVisible();
    await expect(page.getByLabel('Subject')).toHaveValue(
      `Payment requested ${marker}`
    );
  });
});
