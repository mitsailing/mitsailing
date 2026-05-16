import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listAdminPavilionReservationRows,
  parseAdminPavilionReservationDateFilter,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';

const { pavilionReservationRequestFindMany, pavilionReservationSlotFindMany } =
  vi.hoisted(() => ({
    pavilionReservationRequestFindMany: vi.fn(),
    pavilionReservationSlotFindMany: vi.fn(),
  }));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    pavilionReservationRequest: {
      findMany: pavilionReservationRequestFindMany,
    },
    pavilionReservationSlot: {
      findMany: pavilionReservationSlotFindMany,
    },
  },
}));

const reservationDate = new Date('2026-05-15T00:00:00Z');
const pavilionItem = { id: 'pavilion', name: 'Pavilion' };

function listRequestRow(
  props: Partial<{
    id: string;
    status: 'pending' | 'approved';
    referenceCode: string;
    eventName: string;
    slotId: string;
    startMinutes: number;
    endMinutes: number;
  }> = {}
) {
  return {
    id: props.id ?? 'pending-1',
    referenceCode: props.referenceCode ?? 'PAV-PENDING',
    status: props.status ?? 'pending',
    paymentStatus: 'unpaid' as const,
    paidAt: null,
    persona: 'mit_student' as const,
    requesterEmail: 'sailor@example.com',
    firstName: 'Sally',
    lastName: 'Sailor',
    eventName: props.eventName ?? 'Pending event',
    groupSize: null,
    estimatedTotalCents: null,
    createdAt: new Date('2026-05-10T12:00:00Z'),
    slots: [
      {
        id: props.slotId ?? 'pending-slot',
        requestedDate: reservationDate,
        startMinutes: props.startMinutes ?? 9 * 60,
        endMinutes: props.endMinutes ?? 11 * 60,
        item: pavilionItem,
      },
    ],
    _count: { slots: 1, services: 0 },
  };
}

function conflictSlot(
  props: Partial<{
    id: string;
    requestId: string;
    status: 'pending' | 'approved';
    referenceCode: string;
    startMinutes: number;
    endMinutes: number;
  }> = {}
) {
  return {
    id: props.id ?? 'approved-slot',
    requestId: props.requestId ?? 'approved-1',
    requestedDate: reservationDate,
    startMinutes: props.startMinutes ?? 10 * 60,
    endMinutes: props.endMinutes ?? 12 * 60,
    item: pavilionItem,
    request: {
      referenceCode: props.referenceCode ?? 'PAV-APPROVED',
      eventName: 'Approved event',
      status: props.status ?? 'approved',
      paymentStatus: 'unpaid' as const,
    },
  };
}

describe('parseAdminPavilionReservationDateFilter', () => {
  it('rejects impossible calendar dates', () => {
    expect(parseAdminPavilionReservationDateFilter('2026-99-99')).toBe(
      undefined
    );
  });

  it('accepts valid calendar dates', () => {
    expect(parseAdminPavilionReservationDateFilter('2026-05-16')).toBe(
      '2026-05-16'
    );
  });
});

describe('listAdminPavilionReservationRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pavilionReservationRequestFindMany.mockResolvedValue([]);
    pavilionReservationSlotFindMany.mockResolvedValue([]);
  });

  it('applies multi-field search filters to the list query', async () => {
    await listAdminPavilionReservationRows(
      {
        search: 'dock',
        sort: 'createdAt',
        direction: 'desc',
      },
      ['2026-05-10']
    );

    expect(pavilionReservationRequestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              referenceCode: { contains: 'dock', mode: 'insensitive' },
            }),
            expect.objectContaining({
              groupName: { contains: 'dock', mode: 'insensitive' },
            }),
          ]),
        }),
      })
    );
    expect(pavilionReservationSlotFindMany).not.toHaveBeenCalled();
  });

  it('marks hard conflicts from reservations outside the filtered list', async () => {
    pavilionReservationRequestFindMany.mockResolvedValue([
      listRequestRow({ status: 'pending' }),
    ]);
    pavilionReservationSlotFindMany.mockResolvedValue([
      conflictSlot({ status: 'approved' }),
      conflictSlot({
        id: 'pending-slot',
        requestId: 'pending-1',
        status: 'pending',
        referenceCode: 'PAV-PENDING',
        startMinutes: 9 * 60,
        endMinutes: 11 * 60,
      }),
    ]);

    const result = await listAdminPavilionReservationRows(
      {
        status: 'pending',
        sort: 'createdAt',
        direction: 'desc',
      },
      ['2026-05-10']
    );

    expect(pavilionReservationSlotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestedDate: { in: [reservationDate] } },
      })
    );
    expect(result.rows[0]?.conflictSeverity).toBe('hard');
  });
});
