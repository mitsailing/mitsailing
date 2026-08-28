import { initSentryNode } from '@/libs/sentry-node-init';

/** Side-effect: start Sentry before the worker logs errors through LogTape. */
initSentryNode();
