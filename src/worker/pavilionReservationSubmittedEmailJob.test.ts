import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueuePavilionReservationSubmittedEmail,
  PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME,
  processPavilionReservationSubmittedEmailJob,
} from '@/worker/pavilionReservationSubmittedEmailJob';
import type { PavilionReservationSubmittedEmailQueue } from '@/worker/pavilionReservationSubmittedEmailJob';

const {
  loggerError,
  reservationFindUnique,
  sendPavilionReservationSubmittedEmail,
} = vi.hoisted(() => ({
  loggerError: vi.fn(),
  reservationFindUnique: vi.fn(),
  sendPavilionReservationSubmittedEmail: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    pavilionReservationRequest: {
      findUnique: reservationFindUnique,
    },
  },
}));

vi.mock('@/libs/email/pavilion-reservation-emails', () => ({
  sendPavilionReservationSubmittedEmail,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loggerError,
  },
}));

const testReferenceCode = 'PAV-TESTREF';
const testRequesterEmail = 'test.requester@example.com';

const jobData = {
  referenceCode: testReferenceCode,
};

const reservationRow = {
  eventName: 'Late night pavilion booking',
  requesterEmail: testRequesterEmail,
  slots: [
    {
      endMinutes: 26 * 60,
      item: { name: 'Casual party space' },
      requestedDate: new Date('2026-07-01T00:00:00.000Z'),
      startMinutes: 25 * 60,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// biome-ignore lint/security/noSecrets: Test subject name contains no credential.
describe('enqueuePavilionReservationSubmittedEmail', () => {
  it('adds submitted email job with reference-only data and retry backoff', async () => {
    const queue: PavilionReservationSubmittedEmailQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    await enqueuePavilionReservationSubmittedEmail(queue, jobData);

    expect(queue.add).toHaveBeenCalledWith(
      PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME,
      jobData,
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        jobId: `${PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME}-${testReferenceCode}`,
      })
    );
  });
});

// biome-ignore lint/security/noSecrets: Test subject name contains no credential.
describe('processPavilionReservationSubmittedEmailJob', () => {
  it('loads persisted reservation details before sending submitted email', async () => {
    reservationFindUnique.mockResolvedValue(reservationRow);
    sendPavilionReservationSubmittedEmail.mockImplementation(async () => {});

    await processPavilionReservationSubmittedEmailJob(jobData);

    expect(reservationFindUnique).toHaveBeenCalledWith({
      select: {
        eventName: true,
        requesterEmail: true,
        slots: {
          orderBy: { displayOrder: 'asc' },
          select: {
            endMinutes: true,
            item: { select: { name: true } },
            requestedDate: true,
            startMinutes: true,
          },
        },
      },
      where: { referenceCode: testReferenceCode },
    });
    expect(sendPavilionReservationSubmittedEmail).toHaveBeenCalledWith({
      eventName: 'Late night pavilion booking',
      referenceCode: testReferenceCode,
      requesterEmail: testRequesterEmail,
      scheduleLines: [
        'Casual party space: Wed, Jul 1, 2026 · 1:00 AM (next day) - 2:00 AM (next day)',
      ],
    });
  });

  it('skips deleted reservation requests', async () => {
    reservationFindUnique.mockResolvedValue(null);

    await processPavilionReservationSubmittedEmailJob(jobData);

    expect(sendPavilionReservationSubmittedEmail).not.toHaveBeenCalled();
  });

  it('logs and rethrows email failures for BullMQ retry', async () => {
    const error = Object.assign(new Error('Resend timeout'), {
      code: 'ETIMEDOUT',
    });
    reservationFindUnique.mockResolvedValue(reservationRow);
    sendPavilionReservationSubmittedEmail.mockRejectedValue(error);

    await expect(
      processPavilionReservationSubmittedEmailJob(jobData)
    ).rejects.toThrow('Resend timeout');

    expect(loggerError).toHaveBeenCalledWith(
      '[pavilion-reservation:create-email] reference_code={referenceCode} error_name={errorName} error_code={errorCode}',
      {
        errorCode: 'ETIMEDOUT',
        errorName: 'Error',
        referenceCode: testReferenceCode,
      }
    );
  });
});
