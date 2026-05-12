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

test.describe('Desktop navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opens classes dropdown and navigates to introduction', async ({
    page,
  }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const classesButton = nav.getByRole('button', { name: /classes/i });
    const introductionLink = nav.getByRole('link', {
      name: 'Introduction',
      exact: true,
    });

    await classesButton.click();
    await expect(classesButton).toHaveAttribute('aria-expanded', 'true');
    await expect(introductionLink).toBeVisible();

    await introductionLink.click();
    await expect(page).toHaveURL(/\/classes\/?#introduction$/u);
    await expect(
      page.getByRole('heading', { level: 1, name: /classes/i })
    ).toBeVisible();
  });

  test('opens fleet dropdown and navigates to tech dinghy', async ({
    page,
  }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const fleetButton = nav.getByRole('button', { name: 'Fleet' });
    const techDinghyLink = nav.getByRole('link', {
      name: 'Tech dinghy',
      exact: true,
    });

    await fleetButton.click();
    await expect(fleetButton).toHaveAttribute('aria-expanded', 'true');
    await expect(techDinghyLink).toBeVisible();

    await techDinghyLink.click();
    await expect(page).toHaveURL(/\/fleet\/tech-dinghy\/?$/u);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tech dinghy' })
    ).toBeVisible();
  });
});
