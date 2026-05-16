import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updatePavilionReservationAdminAction } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminActions';

const { prisma, requireAdmin } = vi.hoisted(() => {
  const transactionClient = {
    pavilionReservationRequest: {
      findUnique: vi.fn(async () => {
        await Promise.resolve();
        return {
          eventName: 'Dock event',
          referenceCode: 'PAV-0001',
          requesterEmail: 'sailor@example.com',
          slots: [],
          status: 'pending' as const,
        };
      }),
      updateMany: vi.fn(async () => {
        await Promise.resolve();
        return { count: 1 };
      }),
    },
    pavilionReservationService: {
      createMany: vi.fn(async () => {
        await Promise.resolve();
        return {};
      }),
      deleteMany: vi.fn(async () => {
        await Promise.resolve();
        return {};
      }),
    },
    pavilionReservationSlot: {
      createMany: vi.fn(async () => {
        await Promise.resolve();
        return {};
      }),
      deleteMany: vi.fn(async () => {
        await Promise.resolve();
        return {};
      }),
    },
    userAudit: {
      create: vi.fn(async () => {
        await Promise.resolve();
        return {};
      }),
      findFirst: vi.fn(async () => {
        await Promise.resolve();
        return null;
      }),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(
        async (work: (tx: typeof transactionClient) => Promise<unknown>) => {
          await Promise.resolve();
          return work(transactionClient);
        }
      ),
      pavilionReservableItem: {
        findMany: vi.fn(
          async (): Promise<{ id: string; kind: 'service' | 'space' }[]> => {
            await Promise.resolve();
            return [];
          }
        ),
      },
      __tx: transactionClient,
    },
    requireAdmin: vi.fn(() => ({ user: { id: 'user-1' } })),
  };
});

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth/dal', () => ({
  requireAdmin,
}));

vi.mock('@/libs/DB', () => ({
  prisma,
}));

vi.mock('@/libs/email/pavilion-reservation-emails', () => ({
  sendPavilionReservationStatusEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('updatePavilionReservationAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws with missing required field names when workflow fields are absent', async () => {
    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', new FormData())
    ).rejects.toThrow(
      'Missing required fields: workflowStatus, paymentStatus, persona'
    );
  });

  it('throws listing only invalid workflow fields', async () => {
    const formData = new FormData();
    formData.set('workflowStatus', 'pending');
    formData.set('paymentStatus', 'unpaid');
    formData.set('persona', 'not-a-persona');

    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', formData)
    ).rejects.toThrow('Missing required fields: persona');
  });

  it('rejects malformed paid timestamps', async () => {
    const formData = new FormData();
    formData.set('workflowStatus', 'pending');
    formData.set('paymentStatus', 'paid');
    formData.set('persona', 'mit_student');
    formData.set('paidAt', 'not-a-date');
    formData.set('updatedAt', new Date('2026-05-01T12:00:00Z').toISOString());

    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', formData)
    ).rejects.toThrow('Invalid paidAt');

    expect(
      prisma.__tx.pavilionReservationRequest.updateMany
    ).not.toHaveBeenCalled();
  });

  it('preserves canonical cross-midnight slot minutes', async () => {
    const formData = new FormData();
    formData.set('workflowStatus', 'pending');
    formData.set('paymentStatus', 'unpaid');
    formData.set('persona', 'mit_student');
    formData.set('updatedAt', new Date('2026-05-01T12:00:00Z').toISOString());
    formData.set('slotItemId', 'space-1');
    formData.set('slotDate', '2026-07-01');
    formData.set('slotStart', '1380');
    formData.set('slotEnd', '1500');
    prisma.pavilionReservableItem.findMany.mockResolvedValueOnce([
      { id: 'space-1', kind: 'space' },
    ]);

    await updatePavilionReservationAdminAction('en', 'req-1', formData);

    expect(prisma.__tx.pavilionReservationSlot.createMany).toHaveBeenCalledWith(
      {
        data: [
          expect.objectContaining({
            requestId: 'req-1',
            startMinutes: 1380,
            endMinutes: 1500,
          }),
        ],
      }
    );
  });

  it('rejects malformed slot rows before replacing slots', async () => {
    const formData = new FormData();
    formData.set('workflowStatus', 'pending');
    formData.set('paymentStatus', 'unpaid');
    formData.set('persona', 'mit_student');
    formData.set('updatedAt', new Date('2026-05-01T12:00:00Z').toISOString());
    formData.set('slotItemId', 'space-1');
    formData.set('slotDate', '2026-99-99');
    formData.set('slotStart', '540');
    formData.set('slotEnd', '600');

    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', formData)
    ).rejects.toThrow('Invalid Pavilion reservation slot row');

    expect(
      prisma.__tx.pavilionReservationSlot.deleteMany
    ).not.toHaveBeenCalled();
  });

  it('rejects stale admin edit tokens before replacing child rows', async () => {
    const formData = new FormData();
    formData.set('workflowStatus', 'pending');
    formData.set('paymentStatus', 'unpaid');
    formData.set('persona', 'mit_student');
    formData.set('updatedAt', new Date('2026-05-01T12:00:00Z').toISOString());
    prisma.__tx.pavilionReservationRequest.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', formData)
    ).rejects.toThrow('Pavilion reservation changed while editing');

    expect(
      prisma.__tx.pavilionReservationSlot.deleteMany
    ).not.toHaveBeenCalled();
  });
});
