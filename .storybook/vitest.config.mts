import './vitest-env-defaults.mts';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import type { PlaywrightProviderOptions } from '@vitest/browser-playwright';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

type PlaywrightLaunchOptions = PlaywrightProviderOptions['launchOptions'];

const ciChromeLaunchOptions: PlaywrightLaunchOptions | undefined = process.env
  .CI
  ? { channel: 'chrome' }
  : undefined;
const storybookBrowserProvider = ciChromeLaunchOptions
  ? playwright({ launchOptions: ciChromeLaunchOptions })
  : playwright();

export default defineConfig({
  optimizeDeps: {
    // PR client surfaces import @sentry/nextjs; pre-bundle so Vitest browser
    // runs do not mid-test reload when Vite discovers it (CI flake).
    include: ['@sentry/nextjs'],
  },
  plugins: [
    // The plugin will run tests for the stories defined in your Storybook config
    // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
    storybookTest(),
  ],
  server: {
    watch: {
      ignored: ['**/sailing-wp/**'],
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'sailing-wp/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: storybookBrowserProvider,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
