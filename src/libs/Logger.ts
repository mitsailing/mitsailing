import type { AsyncSink } from '@logtape/logtape';
import {
  configure,
  fromAsyncSink,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
} from '@logtape/logtape';
import { getSentrySink } from '@logtape/sentry';
import { Env } from './Env';
import {
  buildAppLoggerSinkNames,
  shouldForwardLogsToSentry,
} from './loggerSinks';

const betterStackSink: AsyncSink = async (record) => {
  await fetch(`https://${Env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN}`,
    },
    body: JSON.stringify(record),
  });
};

const canForwardToBetterStack =
  Boolean(Env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN) &&
  Boolean(Env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST);

const appSinks = buildAppLoggerSinkNames({
  forwardToBetterStack: canForwardToBetterStack,
  forwardToSentry: shouldForwardLogsToSentry(),
});

await configure({
  sinks: {
    console: getConsoleSink({ formatter: getJsonLinesFormatter() }),
    betterStack: fromAsyncSink(betterStackSink),
    sentry: getSentrySink(),
  },
  loggers: [
    {
      category: ['logtape', 'meta'],
      sinks: ['console'],
      lowestLevel: 'warning',
    },
    {
      category: ['app'],
      sinks: [...appSinks],
      lowestLevel: Env.NEXT_PUBLIC_LOGGING_LEVEL,
    },
  ],
});

export const logger = getLogger(['app']);
