import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  sendPavilionReservationAbandonEmail: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    pavilionReservationRequest: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock('@/libs/email/pavilion-reservation-emails', () => ({
  sendPavilionReservationAbandonEmail:
    mocks.sendPavilionReservationAbandonEmail,
}));

vi.mock('@/libs/Env', () => ({
  Env: { NEXT_PUBLIC_APP_URL: 'https://mitsailing.com' },
}));

vi.mock('@/libs/Logger', () => ({
  logger: { error: vi.fn() },
}));

describe('processPavilionReservationAbandonEmailJob', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.updateMany.mockReset();
    mocks.sendPavilionReservationAbandonEmail.mockReset();
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('sends once for an open draft and records abandonEmailSentAt', async () => {
    mocks.findUnique.mockResolvedValue({
      abandonEmailSentAt: null,
      eventName: 'Dock party',
      referenceCode: 'PAV-TEST1234',
      requesterEmail: 'sailor@mit.edu',
      resumeToken: 'resume-token',
      status: 'draft',
    });

    const { processPavilionReservationAbandonEmailJob } =
      await import('@/worker/pavilionReservationAbandonEmailJob');
    await processPavilionReservationAbandonEmailJob({ requestId: 'req-1' });

    expect(mocks.sendPavilionReservationAbandonEmail).toHaveBeenCalledWith({
      eventName: 'Dock party',
      referenceCode: 'PAV-TEST1234',
      requesterEmail: 'sailor@mit.edu',
      resumeUrl: 'https://mitsailing.com/reserve?resume=resume-token',
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      data: { abandonEmailSentAt: expect.any(Date) },
      where: {
        abandonEmailSentAt: null,
        id: 'req-1',
        resumeToken: { not: null },
        status: 'draft',
      },
    });
    expect(mocks.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendPavilionReservationAbandonEmail.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('skips non-draft requests', async () => {
    mocks.findUnique.mockResolvedValue({
      abandonEmailSentAt: null,
      eventName: 'Dock party',
      referenceCode: 'PAV-TEST1234',
      requesterEmail: 'sailor@mit.edu',
      resumeToken: 'resume-token',
      status: 'pending',
    });

    const { processPavilionReservationAbandonEmailJob } =
      await import('@/worker/pavilionReservationAbandonEmailJob');
    await processPavilionReservationAbandonEmailJob({ requestId: 'req-1' });

    expect(mocks.sendPavilionReservationAbandonEmail).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('skips when abandon email already sent', async () => {
    mocks.findUnique.mockResolvedValue({
      abandonEmailSentAt: new Date('2026-08-28T12:00:00.000Z'),
      eventName: 'Dock party',
      referenceCode: 'PAV-TEST1234',
      requesterEmail: 'sailor@mit.edu',
      resumeToken: 'resume-token',
      status: 'draft',
    });

    const { processPavilionReservationAbandonEmailJob } =
      await import('@/worker/pavilionReservationAbandonEmailJob');
    await processPavilionReservationAbandonEmailJob({ requestId: 'req-1' });

    expect(mocks.sendPavilionReservationAbandonEmail).not.toHaveBeenCalled();
  });

  it('skips when resume token is missing', async () => {
    mocks.findUnique.mockResolvedValue({
      abandonEmailSentAt: null,
      eventName: 'Dock party',
      referenceCode: 'PAV-TEST1234',
      requesterEmail: 'sailor@mit.edu',
      resumeToken: null,
      status: 'draft',
    });

    const { processPavilionReservationAbandonEmailJob } =
      await import('@/worker/pavilionReservationAbandonEmailJob');
    await processPavilionReservationAbandonEmailJob({ requestId: 'req-1' });

    expect(mocks.sendPavilionReservationAbandonEmail).not.toHaveBeenCalled();
  });

  it('rolls back claim when send fails', async () => {
    mocks.findUnique.mockResolvedValue({
      abandonEmailSentAt: null,
      eventName: 'Dock party',
      referenceCode: 'PAV-TEST1234',
      requesterEmail: 'sailor@mit.edu',
      resumeToken: 'resume-token',
      status: 'draft',
    });
    mocks.sendPavilionReservationAbandonEmail.mockRejectedValue(
      new Error('smtp down')
    );

    const { processPavilionReservationAbandonEmailJob } =
      await import('@/worker/pavilionReservationAbandonEmailJob');
    await expect(
      processPavilionReservationAbandonEmailJob({ requestId: 'req-1' })
    ).rejects.toThrow('smtp down');

    expect(mocks.updateMany).toHaveBeenCalledWith({
      data: { abandonEmailSentAt: null },
      where: {
        abandonEmailSentAt: { not: null },
        id: 'req-1',
        status: 'draft',
      },
    });
  });

  it('skips send when draft promoted after claim', async () => {
    mocks.findUnique
      .mockResolvedValueOnce({
        abandonEmailSentAt: null,
        eventName: 'Dock party',
        referenceCode: 'PAV-TEST1234',
        requesterEmail: 'sailor@mit.edu',
        resumeToken: 'resume-token',
        status: 'draft',
      })
      .mockResolvedValueOnce({
        abandonEmailSentAt: expect.any(Date),
        eventName: 'Dock party',
        referenceCode: 'PAV-TEST1234',
        requesterEmail: 'sailor@mit.edu',
        resumeToken: null,
        status: 'pending',
      });

    const { processPavilionReservationAbandonEmailJob } =
      await import('@/worker/pavilionReservationAbandonEmailJob');
    await processPavilionReservationAbandonEmailJob({ requestId: 'req-1' });

    expect(mocks.sendPavilionReservationAbandonEmail).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      data: { abandonEmailSentAt: null },
      where: {
        abandonEmailSentAt: { not: null },
        id: 'req-1',
        status: 'draft',
      },
    });
  });
});
