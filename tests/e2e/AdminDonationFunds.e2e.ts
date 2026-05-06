import { expect, test } from '@playwright/test';
import {
  donationFundHiddenForE2e,
  visibleDonationFundsInDisplayOrder,
} from '@/data/mit-sailing/donationFundsSeed';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

const hiddenFund = donationFundHiddenForE2e();
const hiddenFundId = hiddenFund.id;
const hiddenFundName = hiddenFund.name;

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

  test('toggling hidden fund visibility is reflected on public donate page', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto(`/admin/donation_funds/${hiddenFundId}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();

    const published = page.locator(
      'form input[name="isVisible"][type="checkbox"]'
    );
    await published.check();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/donation_funds/${hiddenFundId}/edit/?$`)
    );
    await expect(page.getByRole('status').getByText('Saved.')).toBeVisible();
    await published.uncheck();
    await published.check();

    await page.goto('/donate');
    await expect(
      page.getByRole('heading', { level: 3, name: hiddenFundName })
    ).toBeVisible();

    await page.goto(`/admin/donation_funds/${hiddenFundId}/edit`);
    await page
      .locator('form input[name="isVisible"][type="checkbox"]')
      .uncheck();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/donation_funds/${hiddenFundId}/edit/?$`)
    );
    await expect(page.getByRole('status').getByText('Saved.')).toBeVisible();

    await page.goto('/donate');
    await expect(
      page.getByRole('heading', { level: 3, name: hiddenFundName })
    ).toHaveCount(0);
  });
});
