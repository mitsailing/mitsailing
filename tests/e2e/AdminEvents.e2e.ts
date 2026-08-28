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
      /\/admin\/events\/bluewater-boston-provincetown$/
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
      page.getByRole('heading', { name: 'Entry fees' })
    ).toBeVisible();

    const descriptionEditor = page.locator(
      '#event-description .ProseMirror[role="textbox"][aria-label="Description"]'
    );
    await expect(descriptionEditor).toBeVisible();
    await descriptionEditor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('Admin rich text e2e description update');
    await expect(
      page.locator('input[type="hidden"][name="description"]')
    ).toHaveValue(/Admin rich text e2e description update/u);
    await page.getByRole('button', { name: 'Save event details' }).click();

    await expect(page).toHaveURL(
      /\/admin\/events\/bluewater-boston-provincetown\?status=saved$/
    );
    await expect(page.getByRole('status')).toHaveText('Event saved.');
    await page.goto('/events/bluewater-boston-provincetown');
    await expect(
      page.locator('p', { hasText: 'Admin rich text e2e description update' })
    ).toBeVisible();
  });

  test('shows registrations status controls', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto(
      '/admin/events/bluewater-boston-provincetown/registrations'
    );
    await expect(page).toHaveURL(
      /\/admin\/events\/bluewater-boston-provincetown#registrations$/
    );

    await expect(
      page.getByRole('heading', {
        name: 'Bluewater: Boston to Provincetown Passage',
      })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Pending/ })).toBeVisible();
    const roster = page.getByRole('list', { name: 'Registration roster' });
    await expect(roster).toBeVisible();
    await expect(roster.getByText('Attendee').first()).toBeVisible();
    await expect(roster.getByText('Status').first()).toBeVisible();
    await expect(roster.getByText('Registered').first()).toBeVisible();
    await expect(roster.getByText('Swim agreement').first()).toBeVisible();
    await expect(
      roster.getByText('Preferred watch role').first()
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Payment requests' })
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });

    const usernameRegistration = roster
      .getByRole('listitem')
      .filter({ hasText: 'Username' });
    await expect(
      usernameRegistration.getByLabel('Actions for Username')
    ).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Answers for Username' })
    ).toHaveCount(0);

    await usernameRegistration.getByLabel('Actions for Username').click();
    await usernameRegistration
      .getByRole('menuitem', { name: 'Approve' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Confirm approve for Username' })
    ).toContainText('Approve Username and mark confirmed?');
  });
});
