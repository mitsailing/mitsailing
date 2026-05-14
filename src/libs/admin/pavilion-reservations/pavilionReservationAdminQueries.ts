import 'server-only';
import { prisma } from '@/libs/DB';
import type {
  PavilionReservationPersonaValue,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';

export type AdminPavilionReservationListFilters = {
  status?: PavilionReservationStatusValue;
};

export type AdminPavilionReservationListRow = {
  id: string;
  referenceCode: string;
  status: PavilionReservationStatusValue;
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  firstName: string;
  lastName: string;
  eventName: string;
  groupSize: number | null;
  estimatedTotalCents: number | null;
  createdAt: Date;
  slotCount: number;
  serviceCount: number;
};

export type AdminPavilionReservationDetail = Omit<
  AdminPavilionReservationListRow,
  'serviceCount' | 'slotCount'
> & {
  phone: string;
  groupName: string | null;
  description: string;
  hasTent: boolean;
  servesAlcohol: boolean;
  projectTitle: string | null;
  advisorName: string | null;
  advisorEmail: string | null;
  costCenter: string | null;
  mitId: string | null;
  mitAccount: string | null;
  reviewedAt: Date | null;
  adminNotes: string | null;
  reviewedBy: { id: string; name: string; email: string } | null;
  slots: {
    id: string;
    requestedDate: Date;
    startMinutes: number;
    endMinutes: number;
    estimatedAmountCents: number | null;
    displayOrder: number;
    item: { id: string; name: string; pricingType: string };
  }[];
  services: {
    id: string;
    estimatedAmountCents: number | null;
    item: { id: string; name: string; pricingType: string };
  }[];
};

export const adminPavilionReservationStatuses = [
  'pending',
  'approved',
  'declined',
  'cancelled',
] as const satisfies readonly PavilionReservationStatusValue[];

function isAdminPavilionReservationStatus(
  value: string | undefined
): value is PavilionReservationStatusValue {
  return adminPavilionReservationStatuses.some((status) => status === value);
}

export function parseAdminPavilionReservationStatus(
  value: string | string[] | undefined
): PavilionReservationStatusValue | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return isAdminPavilionReservationStatus(first) ? first : undefined;
}

export async function listAdminPavilionReservationRows(
  filters: AdminPavilionReservationListFilters
): Promise<AdminPavilionReservationListRow[]> {
  const rows = await prisma.pavilionReservationRequest.findMany({
    where: filters.status ? { status: filters.status } : {},
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      referenceCode: true,
      status: true,
      persona: true,
      requesterEmail: true,
      firstName: true,
      lastName: true,
      eventName: true,
      groupSize: true,
      estimatedTotalCents: true,
      createdAt: true,
      _count: { select: { slots: true, services: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    referenceCode: row.referenceCode,
    status: row.status,
    persona: row.persona,
    requesterEmail: row.requesterEmail,
    firstName: row.firstName,
    lastName: row.lastName,
    eventName: row.eventName,
    groupSize: row.groupSize,
    estimatedTotalCents: row.estimatedTotalCents,
    createdAt: row.createdAt,
    slotCount: row._count.slots,
    serviceCount: row._count.services,
  }));
}

export async function getAdminPavilionReservationById(
  id: string
): Promise<AdminPavilionReservationDetail | null> {
  const reservation = await prisma.pavilionReservationRequest.findUnique({
    where: { id },
    select: {
      id: true,
      referenceCode: true,
      status: true,
      persona: true,
      requesterEmail: true,
      firstName: true,
      lastName: true,
      phone: true,
      eventName: true,
      groupName: true,
      groupSize: true,
      description: true,
      hasTent: true,
      servesAlcohol: true,
      projectTitle: true,
      advisorName: true,
      advisorEmail: true,
      costCenter: true,
      mitId: true,
      mitAccount: true,
      estimatedTotalCents: true,
      createdAt: true,
      reviewedAt: true,
      adminNotes: true,
      reviewedBy: { select: { id: true, name: true, email: true } },
      slots: {
        orderBy: [{ displayOrder: 'asc' }],
        select: {
          id: true,
          requestedDate: true,
          startMinutes: true,
          endMinutes: true,
          estimatedAmountCents: true,
          displayOrder: true,
          item: { select: { id: true, name: true, pricingType: true } },
        },
      },
      services: {
        orderBy: [{ item: { displayOrder: 'asc' } }],
        select: {
          id: true,
          estimatedAmountCents: true,
          item: { select: { id: true, name: true, pricingType: true } },
        },
      },
    },
  });
  return reservation;
}
