import type { AxeBuilder } from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures/axe';
import { mergePublicA11yPaths } from '../helpers/a11y-public-paths';

const THEMES = ['light', 'dark'] as const;

let publicPaths: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }, testInfo) => {
  const {
    project: {
      use: { baseURL },
    },
  } = testInfo;
  if (!baseURL) {
    throw new Error('Playwright baseURL is required for a11y route discovery');
  }
  const res = await request.get(`${baseURL}/sitemap.xml`);
  if (!res.ok()) {
    throw new Error(`sitemap fetch failed: HTTP ${res.status()}`);
  }
  const xml = await res.text();
  publicPaths = mergePublicA11yPaths(baseURL, xml);
  if (publicPaths.length === 0) {
    throw new Error('No public paths resolved for accessibility scan');
  }
});

async function scanPublicPathsForTheme(
  theme: (typeof THEMES)[number],
  page: Page,
  makeAxeBuilder: () => AxeBuilder,
  testInfo: TestInfo
) {
  for (const path of publicPaths) {
    const safeName = path === '/' ? 'home' : path.replaceAll('/', '_');
    const storedTheme = theme === 'dark' ? 'dark' : 'light';
    await test.step(`${theme}: ${path || '/'}`, async () => {
      await page.context().clearCookies();
      await page.addInitScript((stored) => {
        localStorage.setItem('mitsailing-theme', stored);
      }, storedTheme);
      await page.emulateMedia({
        colorScheme: theme === 'dark' ? 'dark' : 'light',
      });

      const response = await page.goto(path, {
        waitUntil: 'domcontentloaded',
      });
      expect(
        response?.ok(),
        `${path} returned HTTP ${response?.status()}`
      ).toBeTruthy();

      const accessibilityScanResults = await makeAxeBuilder().analyze();

      await testInfo.attach(`axe-${theme}-${safeName}.json`, {
        body: JSON.stringify(accessibilityScanResults, null, 2),
        contentType: 'application/json',
      });

      expect(
        accessibilityScanResults.violations,
        JSON.stringify(accessibilityScanResults.violations, null, 2)
      ).toEqual([]);
    });
  }
}

test.describe('Accessibility (axe WCAG 2.x A/AA)', () => {
  test('no detectable violations — light theme', async ({
    page,
    makeAxeBuilder,
  }, testInfo) => {
    await scanPublicPathsForTheme('light', page, makeAxeBuilder, testInfo);
  });

  test('no detectable violations — dark theme', async ({
    page,
    makeAxeBuilder,
  }, testInfo) => {
    await scanPublicPathsForTheme('dark', page, makeAxeBuilder, testInfo);
  });
});
