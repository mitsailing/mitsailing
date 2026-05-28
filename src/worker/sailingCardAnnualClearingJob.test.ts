import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import {
  SAILING_CARD_ANNUAL_CLEARING_JOB_NAME,
  SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID,
  registerSailingCardAnnualClearingScheduler,
} from '@/worker/sailingCardAnnualClearingJob';
import type { SailingCardAnnualClearingQueue } from '@/worker/sailingCardAnnualClearingJob';

vi.mock('server-only', () => ({}));

function schedulerQueueMock(): SailingCardAnnualClearingQueue {
  const upsertJobScheduler =
    vi.fn<SailingCardAnnualClearingQueue['upsertJobScheduler']>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- BullMQ Job test double
  upsertJobScheduler.mockResolvedValue({
    id: SAILING_CARD_ANNUAL_CLEARING_SCHEDULER_ID,
  } as unknown as Job);
  return { upsertJobScheduler };
}

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
