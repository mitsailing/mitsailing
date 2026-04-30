import { expect, test } from '@playwright/test';

test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('overlay closes on Escape, restores focus, and unlocks document scroll', async ({
    page,
  }) => {
    await page.goto('/');

    const openBtn = page.getByRole('button', { name: 'Open menu' });
    await openBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Main navigation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('nav').first()).toBeVisible();

    await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');

    await page.keyboard.press('Escape');

    await expect(dialog).toHaveCount(0);
    await expect(openBtn).toBeFocused();
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  });

  test('full-screen overlay matches viewport bounds', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();

    const dialog = page.getByRole('dialog', { name: 'Main navigation' });
    await expect(dialog).toBeVisible();

    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    expect(viewport).not.toBeNull();
    expect(box).not.toBeNull();
    if (viewport === null || box === null) {
      throw new Error('viewport or dialog bounding box was null');
    }
    expect(box.x).toBeCloseTo(0, 3);
    expect(box.y).toBeCloseTo(0, 3);
    expect(box.width).toBeCloseTo(viewport.width, 3);
    expect(box.height).toBeCloseTo(viewport.height, 3);
  });
});
