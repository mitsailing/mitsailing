import type { JobsOptions, Queue } from 'bullmq';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { logger } from '@/libs/Logger';
import { clearAnnualSailingCardState } from '@/libs/mit-sailing/sailingCardAnnualClearing';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

export const SAILING_CARD_ANNUAL_CLEARING_JOB_NAME =
  'sailing-card-annual-clearing';
export const SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID =
  'sailing-card-annual-clearing-july-15-eastern';

const SAILING_CARD_ANNUAL_CLEARING_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 10 },
  removeOnFail: { count: 50 },
};

type SailingCardAnnualClearingJobData = Record<string, never>;

export type SailingCardAnnualClearingQueue = Pick<
  Queue<SailingCardAnnualClearingJobData>,
  'upsertJobScheduler'
>;

export async function registerSailingCardAnnualClearingScheduler(
  queue: SailingCardAnnualClearingQueue
): Promise<void> {
  await queue.upsertJobScheduler(
    SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID,
    { pattern: '0 0 0 15 7 *', tz: EVENTS_TIME_ZONE },
    {
      data: {},
      name: SAILING_CARD_ANNUAL_CLEARING_JOB_NAME,
      opts: SAILING_CARD_ANNUAL_CLEARING_JOB_OPTS,
    }
  );
}

export async function processSailingCardAnnualClearingJob(): Promise<void> {
  try {
    const result = await clearAnnualSailingCardState({ now: new Date() });
    logger.info('[sailing-card-annual-clearing] cleared={cleared}', {
      cleared: result.cleared,
    });
  } catch (error) {
    logger.error(
      '[sailing-card-annual-clearing] error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
      }
    );
    throw error;
  }
}
