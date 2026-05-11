import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { submitCatalogSave } from '../helpers/e2e-catalog-form';

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
      page.getByRole('table').getByText('Intro Sailing 101')
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
    const descriptionField = page.getByLabel('Description');
    await descriptionField.scrollIntoViewIfNeeded();
    await descriptionField.fill('E2E body');

    await submitCatalogSave(page);
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/[^/]+\/edit\/?$/);
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();

    await page.goto(`/classes/${slug}`);
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(page.getByText('E2E body', { exact: true })).toBeVisible();

    await page.goto('/admin/sailing_classes');
    await expect(page.getByRole('table').getByText(name)).toBeVisible();

    await page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('link', { name: 'Edit', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();
    const descriptionOnEdit = page.getByLabel('Description');
    await descriptionOnEdit.scrollIntoViewIfNeeded();
    await descriptionOnEdit.fill('E2E body updated');
    await submitCatalogSave(page);
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/[^/]+\/edit\/?$/);

    await page.goto(`/classes/${slug}`);
    await expect(
      page.getByText('E2E body updated', { exact: true })
    ).toBeVisible();

    await page.goto('/admin/sailing_classes');
    await page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('link', { name: 'Delete', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Delete catalog item' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/?$/);
    await expect(page.getByRole('table').getByText(name)).toHaveCount(0);
  });
});
