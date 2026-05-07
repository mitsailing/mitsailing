import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

test.describe('Admin events', () => {
  test('shows event admin list and editor sections', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto('/admin/events');

    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: 'Bluewater: Boston to Provincetown Passage',
      })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'New event' })).toBeVisible();

    await page
      .getByRole('link', { name: 'Bluewater: Boston to Provincetown Passage' })
      .click();

    await expect(page).toHaveURL(
      /\/admin\/events\/bluewater-boston-provincetown\/edit\/?$/
    );
    await expect(page.getByRole('heading', { name: 'Basics' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Dates and times' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Contacts / event admins' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Custom registration questions' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Entry fees and deposits' })
    ).toBeVisible();
  });

  test('shows registrations status controls', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto(
      '/admin/events/bluewater-boston-provincetown/registrations'
    );

    await expect(
      page.getByRole('heading', {
        name: 'Bluewater: Boston to Provincetown Passage',
      })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Pending/ })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Registration answers' }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bulk email' })
    ).toBeVisible();
  });
});
