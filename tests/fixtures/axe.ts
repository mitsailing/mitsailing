import { AxeBuilder } from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';

type AxeFixtures = {
  makeAxeBuilder: () => AxeBuilder;
};

/**
 * Playwright `test` extended with a factory for WCAG-tagged {@link AxeBuilder} instances.
 */
export const test = base.extend<AxeFixtures>({
  makeAxeBuilder: async ({ page }, useFixture) => {
    await useFixture(() =>
      new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
      ])
    );
  },
});

export { expect };
