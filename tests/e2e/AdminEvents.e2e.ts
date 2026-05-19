import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

const SEED_EVENT_NAME = 'Bluewater: Boston to Provincetown Passage';

test.describe('Admin events', () => {
  test('shows event admin list and editor sections', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto('/admin/events?scope=all');

    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: SEED_EVENT_NAME,
      })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'New event' })).toBeVisible();

    await page.getByRole('link', { name: SEED_EVENT_NAME }).click();

    await expect(page).toHaveURL(
      /\/admin\/events\/bluewater-boston-provincetown\/?$/
    );
    await page.getByRole('link', { name: 'Edit' }).click();

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
    const roster = page.getByRole('table', { name: 'Registration roster' });
    await expect(roster).toBeVisible();
    await expect(
      roster.getByRole('columnheader', { name: 'Attendee' })
    ).toBeVisible();
    await expect(
      roster.getByRole('columnheader', { name: 'Status' })
    ).toBeVisible();
    await expect(
      roster.getByRole('columnheader', { name: 'Registered' })
    ).toBeVisible();
    await expect(
      roster.getByRole('columnheader', { name: 'Swim agreement' })
    ).toBeVisible();
    await expect(
      roster.getByRole('columnheader', {
        name: 'Preferred watch role',
      })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bulk email' })
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });

    const usernameRow = page
      .getByRole('listitem')
      .filter({ hasText: 'Username' });
    await expect(usernameRow.getByLabel('Actions for Username')).toBeVisible();
    await usernameRow.getByLabel('View answers for Username').click();
    await expect(
      page.getByRole('table', { name: 'Answers for Username' })
    ).toBeVisible();

    await usernameRow.getByLabel('Actions for Username').click();
    await usernameRow.getByRole('menuitem', { name: 'Approve' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Confirm approve for Username' })
    ).toContainText('Approve Username and mark confirmed?');
  });
});
