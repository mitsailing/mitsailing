import * as Sentry from '@sentry/nextjs';
import { initSentryNode, sentryNodeOptions } from '@/libs/sentry-node-init';

/**
 * Shared Node + Edge SDK options. Initialization runs only from this file
 * (no root `sentry.server.config.ts` / `sentry.edge.config.ts`) to avoid duplicate
 * `Sentry.init` and to keep the DSN on `NEXT_PUBLIC_SENTRY_DSN`.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
export function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    return;
  }
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    initSentryNode();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(sentryNodeOptions);
  }
}

export const onRequestError = Sentry.captureRequestError;
