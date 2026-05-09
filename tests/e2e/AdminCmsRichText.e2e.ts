import { expect, test } from '@playwright/test';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lcK0nQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Admin CMS rich text', () => {
  test('admin edits body with uploaded selected aligned image', async ({
    page,
  }) => {
    await signInAsAdmin(page);

    const marker = `E2E CMS rich body ${Date.now()}`;
    await page.goto('/admin/cms_page_blocks/cms-block-about-intro/edit');

    const editor = page.locator('.ProseMirror[aria-label="Body"]');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(marker);

    await page.locator('input[type="file"]').setInputFiles({
      buffer: PNG_BYTES,
      mimeType: 'image/png',
      name: 'e2e-cms-rich.png',
    });
    await expect(page.locator('input[name="body"]')).toHaveValue(
      /\/cms-media\/.+\/e2e-cms-rich\.png/u
    );

    await page.getByRole('button', { name: 'Select existing image' }).click();
    await page.getByRole('button', { name: 'e2e-cms-rich.png' }).click();
    await editor.locator('img[src*="/cms-media/"]').last().click();
    await page.getByRole('button', { name: 'Align image right' }).click();

    await expect(page.locator('input[name="body"]')).toHaveValue(
      /data-align="right"/u
    );
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(
      /\/admin\/cms_page_blocks\?page=cms-page-about$/u
    );

    await page.goto('/profile/account/');
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/u);

    await page.goto('/about/');
    const richText = page.locator('.cms-rich-text').filter({ hasText: marker });
    await expect(richText).toBeVisible();
    await expect(richText.locator('img[data-align="right"]')).toBeVisible();

    await page.goto('/profile/account/');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/u);

    await page.goto('/about/');
    await expect(page.locator('html')).toHaveClass(/dark/u);
    await expect(richText).toBeVisible();
    await expect(richText.locator('img[data-align="right"]')).toBeVisible();
  });
});
