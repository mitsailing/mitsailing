import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { clearAnnualSailingCardState } from '@/libs/mit-sailing/sailingCardAnnualClearing';
import {
  SAILING_CARD_ANNUAL_CLEARING_JOB_NAME,
  SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID,
  processSailingCardAnnualClearingJob,
  registerSailingCardAnnualClearingScheduler,
} from '@/worker/sailingCardAnnualClearingJob';
import type { SailingCardAnnualClearingQueue } from '@/worker/sailingCardAnnualClearingJob';

type ClearAnnualSailingCardStateFn = typeof clearAnnualSailingCardState;

const mocks = vi.hoisted(() => ({
  clearAnnualSailingCardState: vi.fn<ClearAnnualSailingCardStateFn>(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/mit-sailing/sailingCardAnnualClearing', () => ({
  clearAnnualSailingCardState: mocks.clearAnnualSailingCardState,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

function schedulerQueueMock(): SailingCardAnnualClearingQueue {
  const upsertJobScheduler =
    vi.fn<SailingCardAnnualClearingQueue['upsertJobScheduler']>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- BullMQ Job test double
  upsertJobScheduler.mockResolvedValue({
    id: SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID,
  } as unknown as Job);
  return { upsertJobScheduler };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerSailingCardAnnualClearingScheduler', () => {
  it('registers one annual july 15 eastern clearing job', async () => {
    const queue = schedulerQueueMock();

    await registerSailingCardAnnualClearingScheduler(queue);

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID,
      { pattern: '0 0 0 15 7 *', tz: 'America/New_York' },
      expect.objectContaining({
        data: {},
        name: SAILING_CARD_ANNUAL_CLEARING_JOB_NAME,
      })
    );
  });
});

describe('processSailingCardAnnualClearingJob', () => {
  it('logs cleared records after annual state cleanup', async () => {
    mocks.clearAnnualSailingCardState.mockResolvedValue({ cleared: 7 });

    await processSailingCardAnnualClearingJob();

    expect(mocks.clearAnnualSailingCardState).toHaveBeenCalledWith({
      now: expect.any(Date),
    });
    expect(mocks.logger.info).toHaveBeenCalledWith(
      '[sailing-card-annual-clearing] cleared={cleared}',
      { cleared: 7 }
    );
  });

  it('logs safe error details and rethrows cleanup failures', async () => {
    const error = new TypeError('database unavailable');
    mocks.clearAnnualSailingCardState.mockRejectedValue(error);

    await expect(processSailingCardAnnualClearingJob()).rejects.toThrow(error);

    expect(mocks.logger.error).toHaveBeenCalledWith(
      '[sailing-card-annual-clearing] error_name={errorName} error_code={errorCode}',
      {
        errorCode: 'unknown',
        errorName: 'TypeError',
      }
    );
  });
});
