import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const sentryBrowserStub = path.join(storybookDir, 'sentryNextjsBrowserStub.ts');

const stubbedSentryIds = new Set([
  '@sentry/nextjs',
  '@sentry/node',
  '@logtape/sentry',
]);

/**
 * Resolves Node Sentry packages to a browser stub before Vite pre-bundles them.
 *
 * @returns Vite plugin that intercepts Sentry package ids
 */
export function storybookSentryBrowserPlugin(): Plugin {
  return {
    name: 'storybook-sentry-browser-stub',
    enforce: 'pre',
    resolveId(id: string): string | undefined {
      if (stubbedSentryIds.has(id)) {
        return sentryBrowserStub;
      }
      return undefined;
    },
  };
}

/**
 * Vite alias list matching {@link storybookSentryBrowserPlugin} for configs
 * that merge `resolve.alias` without a custom plugin.
 */
export const sentryNextjsBrowserAlias = [
  { find: '@sentry/nextjs', replacement: sentryBrowserStub },
  { find: '@sentry/node', replacement: sentryBrowserStub },
  { find: '@logtape/sentry', replacement: sentryBrowserStub },
] as const;
