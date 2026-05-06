import { Buffer } from 'node:buffer';
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
const e2eImagePath = '/api/uploads/e2e-rich-text.png';
const e2ePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

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

    await page.route('**/api/admin/uploads', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ url: e2eImagePath }),
        });
        return;
      }
      await route.continue();
    });
    await page.route(`**${e2eImagePath}`, async (route) => {
      await route.fulfill({
        contentType: 'image/png',
        body: e2ePng,
      });
    });

    await page.goto('/admin/sailing_classes/new');
    await expect(page.getByRole('heading', { name: 'New row' })).toBeVisible();

    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Slug', { exact: true }).fill(slug);
    await page
      .locator('select[name="classCategoryId"]')
      .selectOption('cc-introduction');
    await page.getByLabel('Level', { exact: true }).fill('beginner');
    const descriptionEditor = page.getByTestId('catalog-rich-text-description');
    await descriptionEditor.scrollIntoViewIfNeeded();
    await descriptionEditor.click();
    await descriptionEditor.fill('E2E body');
    await expect(
      page.getByRole('button', { name: 'Upload image from computer' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Media library' })
    ).toBeVisible();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: 'Upload image from computer' })
      .click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'e2e-rich-text.png',
      mimeType: 'image/png',
      buffer: e2ePng,
    });
    await expect(
      descriptionEditor.locator(`img[src="${e2eImagePath}"]`)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/admin\/sailing_classes\/?$/);

    const introSection = introductionSection(page);
    await expect(introSection.getByText(name, { exact: true })).toBeVisible({
      timeout: NEW_ROW_IN_LIST_TIMEOUT_MS,
    });

    await page.goto(`/classes/${slug}/`);
    await expect(
      page.locator(
        `.cms-rich-text figure.image-style-align-right img[src="${e2eImagePath}"]`
      )
    ).toBeVisible();
    await page.goto('/admin/sailing_classes');

    await introSection
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('link', { name: 'Edit', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();
    const descriptionOnEdit = page.getByTestId('catalog-rich-text-description');
    await descriptionOnEdit.scrollIntoViewIfNeeded();
    await descriptionOnEdit.click();
    await descriptionOnEdit.fill('E2E body updated');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/sailing_classes/.*/edit/?$`)
    );
    await expect(page.getByRole('status').getByText('Saved.')).toBeVisible();

    await page.goto('/admin/sailing_classes');
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
