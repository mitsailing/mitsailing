import { AxeBuilder } from '@axe-core/playwright';
import { test as base } from '@playwright/test';

type AxeFixture = {
  makeAxeBuilder: () => AxeBuilder;
};

/**
 * Shared axe configuration for route-level scans (Microsoft Playwright docs
 * pattern). WCAG tags align with Accessibility Insights automated checks.
 */
/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture `use`, not React */
export const test = base.extend<AxeFixture>({
  makeAxeBuilder: async ({ page }, use) => {
    const makeAxeBuilder = () =>
      new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
      ]);

    await use(makeAxeBuilder);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

export { expect } from '@playwright/test';
