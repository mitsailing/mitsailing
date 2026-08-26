import { expect, test } from '@playwright/test';
import {
  donationFundHiddenForE2e,
  visibleDonationFundsInDisplayOrder,
} from '@/data/mit-sailing/donationFundsSeed';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { submitCatalogSave } from '../helpers/e2e-catalog-form';

const hiddenFundName = donationFundHiddenForE2e().name;

test.describe('Admin donation funds', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sees index and seeded funds in the list', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Administration' })
    ).toBeVisible();

    await page.goto('/admin/donation_funds');
    await expect(
      page.getByRole('heading', {
        name: 'Donation funds',
        exact: true,
      })
    ).toBeVisible();

    await expect(page.getByRole('link', { name: 'Add row' })).toBeVisible();

    const orderedVisible = visibleDonationFundsInDisplayOrder();
    expect(orderedVisible.length).toBeGreaterThan(0);
    const [firstVisible] = orderedVisible;
    if (firstVisible === undefined) {
      throw new Error('missing seeded donation funds');
    }
    await expect(
      page.getByRole('table').getByText(firstVisible.name)
    ).toBeVisible();

    await expect(page.getByText(hiddenFundName).first()).toBeVisible();

    const headers = page.getByRole('columnheader');
    await expect(headers.nth(1)).toHaveText('Name');

    const nameToEdit = page.getByRole('link', {
      name: firstVisible.name,
      exact: true,
    });
    await expect(nameToEdit.first()).toBeVisible();
    await expect(nameToEdit.first()).toHaveAttribute(
      'href',
      new RegExp(
        `/admin/donation_funds/${encodeURIComponent(firstVisible.id)}/edit`
      )
    );
  });

  test('admin blocked submit shows validation summary on new fund form', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/donation_funds/new');
    await page.getByLabel('Designation ID').fill('e2e-validation-blocked');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.locator('[data-slot="form-error-summary"]')
    ).toContainText('Fix the following errors');
    await expect(page.getByRole('button', { name: /Name:/u })).toBeVisible();
  });

  test('toggling hidden fund visibility is reflected on public donate page', async ({
    page,
  }) => {
    await signInAsAdmin(page);

    const suffix = Date.now();
    const fundId = `e2e-${suffix}`;
    const fundName = `E2E hidden donation fund ${suffix}`;

    await page.goto('/admin/donation_funds/new');
    await page.getByLabel('Designation ID').fill(fundId);
    await page.getByLabel('Name', { exact: true }).fill(fundName);
    await page
      .getByLabel('Description')
      .fill('E2E donation fund used to verify public visibility toggles.');
    await page.getByLabel('URL').fill('https://example.com');
    await page
      .locator('form input[name="isVisible"][type="checkbox"]')
      .uncheck();
    await submitCatalogSave(page);
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();
    const editUrl = page.url();

    await page.goto('/donate');
    await expect(
      page.getByRole('heading', { level: 3, name: fundName })
    ).toHaveCount(0);

    await page.goto(editUrl);
    const visible = page.locator(
      'form input[name="isVisible"][type="checkbox"]'
    );
    await visible.check();
    await submitCatalogSave(page);
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();

    await page.goto('/donate');
    await expect(
      page.getByRole('heading', { level: 3, name: fundName })
    ).toBeVisible();

    await page.goto(editUrl);
    await page
      .locator('form input[name="isVisible"][type="checkbox"]')
      .uncheck();
    await submitCatalogSave(page);
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();

    await page.goto('/donate');
    await expect(
      page.getByRole('heading', { level: 3, name: fundName })
    ).toHaveCount(0);

    await page.goto('/admin/donation_funds');
    await page
      .getByRole('row')
      .filter({ hasText: fundName })
      .getByRole('link', { name: 'Delete', exact: true })
      .click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/donation_funds\/?$/);
    await expect(page.getByRole('table').getByText(fundName)).toHaveCount(0);
  });
});
