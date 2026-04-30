import type { Preview } from '@storybook/nextjs-vite';
import { StorybookIntlRoot } from './StorybookIntlRoot';

const preview: Preview = {
  decorators: [
    (Story) => (
      <StorybookIntlRoot>
        <Story />
      </StorybookIntlRoot>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true, // Enable App Router support
    },
    docs: {
      toc: true, // Enable table of contents
    },
    a11y: {
      // Fail Vitest browser runs and CI on serious violations once stories exist.
      test: 'error',
    },
  },
  tags: ['autodocs'],
};

export default preview;
