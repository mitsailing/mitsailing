import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as CmsMediaProcessingJobModule from '@/worker/cmsMediaProcessingJob';
import { CMS_MEDIA_PROCESSING_JOB_NAME } from '@/worker/cmsMediaProcessingJob';
import type * as EventPaymentEmailJobModule from '@/worker/eventPaymentEmailJob';
import {
  EVENT_PAYMENT_DAILY_NOTIFICATIONS_JOB_NAME,
  EVENT_PAYMENT_EMAIL_JOB_NAME,
} from '@/worker/eventPaymentEmailJob';
import type * as LegacyMysqlSyncJobModule from '@/worker/legacyMysqlSyncJob';
import { LEGACY_MYSQL_SYNC_JOB_NAME } from '@/worker/legacyMysqlSyncJob';
import type * as PavilionReservationSubmittedEmailJobModule from '@/worker/pavilionReservationSubmittedEmailJob';
import { PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME } from '@/worker/pavilionReservationSubmittedEmailJob';
import type * as SailingCardAnnualClearingJobModule from '@/worker/sailingCardAnnualClearingJob';
import { SAILING_CARD_ANNUAL_CLEARING_JOB_NAME } from '@/worker/sailingCardAnnualClearingJob';

const mocks = vi.hoisted(() => ({
  processCmsMediaProcessingJob: vi.fn(),
  processEventPaymentEmailJob: vi.fn(),
  processLegacyMysqlSyncJob: vi.fn(),
  processNewsletterBroadcast: vi.fn(),
  processPavilionReservationSubmittedEmailJob: vi.fn(),
  processSailingCardAnnualClearingJob: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/newsletter/newsletterBroadcasts', () => ({
  processNewsletterBroadcast: mocks.processNewsletterBroadcast,
}));

vi.mock('@/worker/cmsMediaProcessingJob', async (importOriginal) => {
  const actual = await importOriginal<typeof CmsMediaProcessingJobModule>();
  return {
    ...actual,
    processCmsMediaProcessingJob: mocks.processCmsMediaProcessingJob,
  };
});

vi.mock('@/worker/eventPaymentEmailJob', async (importOriginal) => {
  const actual = await importOriginal<typeof EventPaymentEmailJobModule>();
  return {
    ...actual,
    processEventPaymentEmailJob: mocks.processEventPaymentEmailJob,
  };
});

vi.mock('@/worker/legacyMysqlSyncJob', async (importOriginal) => {
  const actual = await importOriginal<typeof LegacyMysqlSyncJobModule>();
  return {
    ...actual,
    processLegacyMysqlSyncJob: mocks.processLegacyMysqlSyncJob,
  };
});

vi.mock(
  '@/worker/pavilionReservationSubmittedEmailJob',
  async (importOriginal) => {
    const actual =
      await importOriginal<typeof PavilionReservationSubmittedEmailJobModule>();
    return {
      ...actual,
      processPavilionReservationSubmittedEmailJob:
        mocks.processPavilionReservationSubmittedEmailJob,
    };
  }
);

vi.mock('@/worker/sailingCardAnnualClearingJob', async (importOriginal) => {
  const actual =
    await importOriginal<typeof SailingCardAnnualClearingJobModule>();
  return {
    ...actual,
    processSailingCardAnnualClearingJob:
      mocks.processSailingCardAnnualClearingJob,
  };
});

function queueMock(): Pick<Queue, 'add'> {
  return { add: vi.fn() };
}

describe('worker dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes annual sailing-card clearing jobs to the clearing processor', async () => {
    const { processDefaultQueueJob } = await import('@/worker/workerDispatch');

    await processDefaultQueueJob(
      { data: {}, name: SAILING_CARD_ANNUAL_CLEARING_JOB_NAME },
      queueMock()
    );

    expect(mocks.processSailingCardAnnualClearingJob).toHaveBeenCalledOnce();
    expect(mocks.processLegacyMysqlSyncJob).not.toHaveBeenCalled();
  });

  it('passes payment jobs the queue for follow-up notifications', async () => {
    const { processDefaultQueueJob } = await import('@/worker/workerDispatch');
    const queue = queueMock();
    const data = { dateKey: '2026-06-01', kind: 'request', paymentId: 'p1' };

    await processDefaultQueueJob(
      { data, name: EVENT_PAYMENT_EMAIL_JOB_NAME },
      queue
    );

    expect(mocks.processEventPaymentEmailJob).toHaveBeenCalledWith(data, queue);
  });

  it('passes daily payment notification jobs the queue', async () => {
    const { processDefaultQueueJob } = await import('@/worker/workerDispatch');
    const queue = queueMock();
    const data = { dateKey: '2026-06-01', kind: 'daily' };

    await processDefaultQueueJob(
      { data, name: EVENT_PAYMENT_DAILY_NOTIFICATIONS_JOB_NAME },
      queue
    );

    expect(mocks.processEventPaymentEmailJob).toHaveBeenCalledWith(data, queue);
  });

  it('passes job data to data-driven default queue processors', async () => {
    const { processDefaultQueueJob } = await import('@/worker/workerDispatch');
    const mediaData = { assetId: 'asset-1' };
    const reservationData = { reservationId: 'reservation-1' };

    await processDefaultQueueJob(
      { data: mediaData, name: CMS_MEDIA_PROCESSING_JOB_NAME },
      queueMock()
    );
    await processDefaultQueueJob(
      {
        data: reservationData,
        name: PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME,
      },
      queueMock()
    );
    await processDefaultQueueJob(
      { data: {}, name: LEGACY_MYSQL_SYNC_JOB_NAME },
      queueMock()
    );

    expect(mocks.processCmsMediaProcessingJob).toHaveBeenCalledWith(mediaData);
    expect(
      mocks.processPavilionReservationSubmittedEmailJob
    ).toHaveBeenCalledWith(reservationData);
    expect(mocks.processLegacyMysqlSyncJob).toHaveBeenCalledOnce();
  });

  it('rejects unknown default queue jobs instead of silently dropping them', async () => {
    const { processDefaultQueueJob } = await import('@/worker/workerDispatch');

    await expect(
      processDefaultQueueJob({ data: {}, name: 'unknown-job' }, queueMock())
    ).rejects.toThrow('Unknown worker job: unknown-job');
  });

  it('routes newsletter jobs by broadcast id', async () => {
    const { processNewsletterQueueJob } =
      await import('@/worker/workerDispatch');

    await processNewsletterQueueJob({ data: { broadcastId: 'broadcast-1' } });

    expect(mocks.processNewsletterBroadcast).toHaveBeenCalledWith(
      'broadcast-1'
    );
  });
});
