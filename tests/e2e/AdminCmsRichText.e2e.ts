import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import { submitCatalogSave } from '../helpers/e2e-catalog-form';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lcK0nQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Admin CMS rich text', () => {
  test('admin edits body with uploaded selected aligned image', async ({
    page,
  }, testInfo) => {
    await signInAsAdmin(page);

    await page.goto('/admin/cms_pages');
    await page
      .getByRole('row')
      .filter({ hasText: '/about' })
      .getByRole('link', { name: 'View page' })
      .click();
    await expect(page).toHaveURL(/\/about$/u);
    await expect(
      page.getByRole('heading', { level: 1, name: 'About MIT Sailing' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Edit this page' })
    ).toHaveAttribute('href', '/admin/cms_pages/cms-page-about/edit');

    const runId = [
      testInfo.project.name,
      testInfo.workerIndex,
      testInfo.retry,
      Date.now(),
    ]
      .join('-')
      .replaceAll(/[^a-z0-9.-]/giu, '-');
    const marker = `E2E CMS rich body ${runId}`;
    const mediaFilename = `e2e-cms-rich-${runId}.png`;
    await page.goto('/admin/cms_page_blocks/cms-block-about-intro/edit');
    await expect(page.getByRole('link', { name: 'View page' })).toHaveAttribute(
      'href',
      '/about'
    );
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();

    const editor = page.locator('.ProseMirror[aria-label="Body"]');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(marker);
    const preview = page.locator('section', {
      has: page.getByRole('heading', { name: 'Preview' }),
    });
    await expect(preview.getByText(marker)).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles({
      buffer: PNG_BYTES,
      mimeType: 'image/png',
      name: mediaFilename,
    });
    await expect(page.locator('input[name="body"]')).toHaveValue(
      new RegExp(`/cms-media/.+/${mediaFilename.replaceAll('.', '\\.')}`, 'u')
    );

    await page
      .getByRole('button', { exact: true, name: 'Select existing image' })
      .click();
    await page
      .getByRole('button', { exact: true, name: mediaFilename })
      .click();
    await editor.locator('img[src*="/cms-media/"]').last().click();
    await page.getByRole('button', { name: 'Align image right' }).click();

    await expect(page.locator('input[name="body"]')).toHaveValue(
      /data-align="right"/u
    );
    await submitCatalogSave(page);
    await expect(page).toHaveURL(
      /\/admin\/cms_page_blocks\/cms-block-about-intro\/edit\?page=cms-page-about$/u
    );
    await expect(page.getByRole('heading', { name: 'Edit row' })).toBeVisible();

    await page.goto('/about');
    await expect(
      page.getByRole('link', { name: 'Edit this page' })
    ).toHaveAttribute('href', '/admin/cms_pages/cms-page-about/edit');
    const richText = page.locator('.cms-rich-text').filter({ hasText: marker });
    await expect(richText).toBeVisible();
    await expect(richText.locator('img[data-align="right"]')).toBeVisible();
  });

  test('admin sees edit links on catalog detail pages', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto('/classes/intro-sailing-101');
    await expect(
      page.getByRole('link', { name: 'Edit this page' })
    ).toHaveAttribute(
      'href',
      '/admin/sailing_classes/class-intro-sailing-101/edit'
    );

    await page.goto('/fleet/tech-dinghy');
    await expect(
      page.getByRole('link', { name: 'Edit this page' })
    ).toHaveAttribute('href', '/admin/fleet/boat-tech-dinghy/edit');

    await page.goto('/events/boston-dinghy-cup');
    await expect(
      page.getByRole('link', { name: 'Edit this page' })
    ).toHaveAttribute('href', '/admin/events/boston-dinghy-cup/edit');
  });
});
