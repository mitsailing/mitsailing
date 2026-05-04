import { expect, takeSnapshot, test } from '@chromatic-com/playwright';

test.describe('Visual testing', () => {
  test.describe('Static pages', () => {
    test('should take screenshot of the homepage', async ({
      page,
    }, testInfo) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Sail the Charles River',
        })
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the contact page', async ({
      page,
    }, testInfo) => {
      await page.goto('/contact');

      await expect(
        page.getByRole('heading', { name: 'Contact' })
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the about page', async ({
      page,
    }, testInfo) => {
      await page.goto('/about');

      await expect(
        page.getByText('The MIT Sailing Pavilion exists', { exact: false })
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the MIT Nautical Association page', async ({
      page,
    }, testInfo) => {
      await page.goto('/about/mitna', { waitUntil: 'domcontentloaded' });

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /About MIT Nautical Association/,
        })
      ).toBeVisible({ timeout: 20_000 });

      await takeSnapshot(page, testInfo);
    });
  });
});
