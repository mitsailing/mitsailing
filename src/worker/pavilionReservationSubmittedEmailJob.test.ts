import { describe, expect, it, vi } from 'vitest';
import {
  enqueuePavilionReservationSubmittedEmail,
  PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME,
  processPavilionReservationSubmittedEmailJob,
} from '@/worker/pavilionReservationSubmittedEmailJob';
import type { PavilionReservationSubmittedEmailQueue } from '@/worker/pavilionReservationSubmittedEmailJob';

const { loggerError, sendPavilionReservationSubmittedEmail } = vi.hoisted(
  () => ({
    loggerError: vi.fn(),
    sendPavilionReservationSubmittedEmail: vi.fn(),
  })
);

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
  eventName: 'Late night pavilion booking',
  referenceCode: testReferenceCode,
  requesterEmail: testRequesterEmail,
  scheduleLines: ['Casual party space: Wed, Jul 1, 2026'],
};

// biome-ignore lint/security/noSecrets: Test subject name contains no credential.
describe('enqueuePavilionReservationSubmittedEmail', () => {
  it('adds submitted email job with retry backoff', async () => {
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
        jobId: `${PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME}:${testReferenceCode}`,
      })
    );
  });
});

// biome-ignore lint/security/noSecrets: Test subject name contains no credential.
describe('processPavilionReservationSubmittedEmailJob', () => {
  it('sends submitted email from job data', async () => {
    sendPavilionReservationSubmittedEmail.mockImplementation(async () => {});

    await processPavilionReservationSubmittedEmailJob(jobData);

    expect(sendPavilionReservationSubmittedEmail).toHaveBeenCalledWith(jobData);
  });

  it('logs and rethrows email failures for BullMQ retry', async () => {
    const error = Object.assign(new Error('Resend timeout'), {
      code: 'ETIMEDOUT',
    });
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
