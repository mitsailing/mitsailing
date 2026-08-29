import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';
import {
  sentryNextjsBrowserAlias,
  storybookSentryBrowserPlugin,
} from './sentryNextjsBrowserAlias';

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
      plugins: [storybookSentryBrowserPlugin()],
      resolve: {
        alias: sentryNextjsBrowserAlias,
      },
    });
  },
};
export default config;
