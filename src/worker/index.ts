import '@/libs/sentry-worker-init';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { startWorkerRuntime } from '@/worker/workerRuntime';

function logWorkerLifecycleFailure(options: {
  context: 'shutdown' | 'startup';
  error: unknown;
}): void {
  logger.error(
    '[worker:{context}] worker {context} failed error_name={errorName} error_code={errorCode}',
    {
      context: options.context,
      errorCode: safeErrorCode(options.error) ?? 'unknown',
      errorName: safeErrorName(options.error),
    }
  );
}

async function main(): Promise<void> {
  const redisUrl = Env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the BullMQ worker');
  }

  const runtime = await startWorkerRuntime({
    newsletterWorkerConcurrency: Env.NEWSLETTER_WORKER_CONCURRENCY,
    redisUrl,
  });

  const shutdown = async (): Promise<void> => {
    await runtime.close();
    process.exit(0);
  };

  const handleSignal = async (): Promise<void> => {
    try {
      await shutdown();
    } catch (error: unknown) {
      logWorkerLifecycleFailure({ context: 'shutdown', error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleSignal();
  });
  process.on('SIGINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleSignal();
  });
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    logWorkerLifecycleFailure({ context: 'startup', error });
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
