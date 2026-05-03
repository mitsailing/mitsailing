import { expect, test } from '@playwright/test';
import {
  DONATION_FUND_SEED_ROWS,
  SAMPLE_DONATION_URL,
  visibleDonationFundsInDisplayOrder,
} from '@/data/mit-sailing/donationFundsSeed';

/**
 * Public donate page: funds come from `donation_funds` (seed), ordered by
 * `display_order`, excluding `is_visible = false`.
 */
test.describe('Donate page', () => {
  test('/donate shows hero and visible funds in display order', async ({
    page,
  }) => {
    await page.goto('/donate');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Giving to MIT Sailing' })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { level: 2, name: 'Make a gift online' })
    ).toBeVisible();

    const expectedVisible = visibleDonationFundsInDisplayOrder();
    const hiddenFunds = DONATION_FUND_SEED_ROWS.filter((row) => !row.isVisible);

    const fundSection = page
      .locator('#donate-individual-heading')
      .locator('+ ul');
    const fundTitles = fundSection.getByRole('heading', { level: 3 });

    await expect(fundTitles).toHaveCount(expectedVisible.length);

    const topThree = expectedVisible.slice(0, 3);
    expect(topThree).toHaveLength(3);
    for (const [index, row] of topThree.entries()) {
      await expect(fundTitles.nth(index)).toHaveText(row.name);
    }

    for (const hidden of hiddenFunds) {
      await expect(
        page.getByRole('heading', {
          name: hidden.name,
        })
      ).toHaveCount(0);
    }

    const giveLinks = fundSection.getByRole('link', { name: 'Give' });
    await expect(giveLinks).toHaveCount(expectedVisible.length);
    for (let index = 0; index < expectedVisible.length; index += 1) {
      await expect(giveLinks.nth(index)).toHaveAttribute(
        'href',
        SAMPLE_DONATION_URL
      );
    }
  });
});
