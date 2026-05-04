import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

/**
 * Grouped sailing-class admin UI: one `<table>` per category under an `<h2>`.
 *
 * @param page - Authenticated admin page
 * @returns Locator for the section whose heading is “Introduction”
 */
function introductionSection(page: Page) {
  return page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Introduction', exact: true }),
  });
}

const NEW_ROW_IN_LIST_TIMEOUT_MS = 20_000;

test.describe('Admin sailing classes', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sees grouped sailing classes index with seeded row', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/sailing_classes');
    await expect(
      page.getByRole('heading', { name: 'Classes', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Introduction', exact: true })
    ).toBeVisible();
    await expect(
      introductionSection(page)
        .getByRole('table')
        .getByText('Intro Sailing 101')
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Status' }).first()
    ).toBeVisible();
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add row' })).toBeVisible();
  });

  test('admin creates, edits, and deletes a sailing class', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    const slug = `e2e-class-${Date.now()}`;
    const name = `E2E class ${slug}`;

    await page.goto('/admin/sailing_classes/new');
    await expect(page.getByRole('heading', { name: 'New row' })).toBeVisible();

    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Slug', { exact: true }).fill(slug);
    await page
      .locator('select[name="classCategoryId"]')
      .selectOption('cc-introduction');
    await page.getByLabel('Level', { exact: true }).fill('beginner');
    const descriptionField = page.locator('textarea[name="description"]');
    await descriptionField.scrollIntoViewIfNeeded();
    await descriptionField.fill('E2E body');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/?$/);

    const introSection = introductionSection(page);
    await expect(introSection.getByText(name, { exact: true })).toBeVisible({
      timeout: NEW_ROW_IN_LIST_TIMEOUT_MS,
    });

    await introSection
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('link', { name: 'Edit', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();
    const descriptionOnEdit = page.locator('textarea[name="description"]');
    await descriptionOnEdit.scrollIntoViewIfNeeded();
    await descriptionOnEdit.fill('E2E body updated');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/?$/);

    await introSection
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('link', { name: 'Delete', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Delete catalog item' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/?$/);
    await expect(introSection.getByText(name, { exact: true })).toHaveCount(0);
  });
});
