import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';
import {
  sentryNextjsBrowserAlias,
  storybookSentryBrowserPlugin,
} from './sentryNextjsBrowserAlias';

const newsBannerCollapseActionStub = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'newsBannerCollapseActionStub.ts'
);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  staticDirs: ['../public'],
  features: {
    experimentalRSC: true,
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      optimizeDeps: {
        include: ['better-auth-audit-logs/client'],
      },
      plugins: [storybookSentryBrowserPlugin()],
      resolve: {
        alias: [
          {
            find: '@/libs/mit-sailing/newsBannerCollapseAction',
            replacement: newsBannerCollapseActionStub,
          },
          ...sentryNextjsBrowserAlias,
        ],
      },
    });
  },
};
export default config;
