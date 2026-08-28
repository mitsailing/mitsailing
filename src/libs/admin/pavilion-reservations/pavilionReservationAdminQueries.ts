import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import {
  adminPavilionReservationConflictSeverityFromGraphEntry,
  adminPavilionReservationSlotConflicts,
  buildAdminPavilionReservationConflictGraph,
  listAdminPavilionReservationCalendarSegments,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminSchedule';
import type {
  AdminPavilionReservationCalendarSegment,
  AdminPavilionReservationConflictSeverity,
  AdminPavilionReservationScheduleSlot,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminSchedule';
import { prisma } from '@/libs/DB';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import type {
  PavilionPricingTypeValue,
  PavilionReservableItemKindValue,
  PavilionReservationPaymentStatusValue,
  PavilionReservationPersonaValue,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';

export type AdminPavilionReservationSortKey =
  | 'createdAt'
  | 'eventName'
  | 'requester'
  | 'status'
  | 'firstSlot'
  | 'estimate'
  | 'paymentStatus';

export type AdminPavilionReservationSortDirection = 'asc' | 'desc';

export type AdminPavilionReservationListFilters = {
  date?: string;
  paymentStatus?: PavilionReservationPaymentStatusValue;
  search?: string;
  sort: AdminPavilionReservationSortKey;
  status?: PavilionReservationStatusValue;
  direction: AdminPavilionReservationSortDirection;
};

export type AdminPavilionReservableItemOption = {
  id: string;
  kind: PavilionReservableItemKindValue;
  name: string;
  pricingType: PavilionPricingTypeValue;
  displayOrder: number;
};

export type AdminPavilionReservationListRow = {
  id: string;
  referenceCode: string;
  status: PavilionReservationStatusValue;
  paymentStatus: PavilionReservationPaymentStatusValue;
  paidAt: Date | null;
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  firstName: string;
  lastName: string;
  eventName: string;
  groupSize: number | null;
  estimatedTotalCents: number | null;
  createdAt: Date;
  firstSlotDate: Date | null;
  firstSlotStartMinutes: number | null;
  slotCount: number;
  serviceCount: number;
  conflictSeverity: AdminPavilionReservationConflictSeverity | null;
};

export type AdminPavilionReservationDetail = Omit<
  AdminPavilionReservationListRow,
  'conflictSeverity' | 'serviceCount' | 'slotCount'
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
  updatedAt: Date;
  adminNotes: string | null;
  abandonEmailSentAt: Date | null;
  resumeToken: string | null;
  reviewedBy: { id: string; name: string; email: string } | null;
  slots: {
    id: string;
    requestedDate: Date;
    startMinutes: number;
    endMinutes: number;
    estimatedAmountCents: number | null;
    displayOrder: number;
    item: { id: string; name: string; pricingType: PavilionPricingTypeValue };
    conflictSeverity: AdminPavilionReservationConflictSeverity | null;
    conflictingRequestIds: string[];
  }[];
  services: {
    id: string;
    estimatedAmountCents: number | null;
    item: { id: string; name: string; pricingType: PavilionPricingTypeValue };
  }[];
};

export type AdminPavilionReservationListResult = {
  rows: AdminPavilionReservationListRow[];
  calendarSegments: AdminPavilionReservationCalendarSegment[];
};

export const adminPavilionReservationStatuses = [
  'pending',
  'needs_info',
  'approved',
  'declined',
  'cancelled',
  'draft',
] as const satisfies readonly PavilionReservationStatusValue[];

export const adminPavilionReservationWorkflowStatuses =
  adminPavilionReservationStatuses.filter((status) => status !== 'draft');

export const adminPavilionReservationPaymentStatuses = [
  'unpaid',
  'partial',
  'paid',
  'waived',
] as const satisfies readonly PavilionReservationPaymentStatusValue[];

const adminPavilionReservationSortKeys = [
  'createdAt',
  'eventName',
  'requester',
  'status',
  'firstSlot',
  'estimate',
  'paymentStatus',
] as const satisfies readonly AdminPavilionReservationSortKey[];

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAdminPavilionReservationStatus(
  value: string | undefined
): value is PavilionReservationStatusValue {
  return adminPavilionReservationStatuses.some((status) => status === value);
}

function isAdminPavilionReservationPaymentStatus(
  value: string | undefined
): value is PavilionReservationPaymentStatusValue {
  return adminPavilionReservationPaymentStatuses.some(
    (status) => status === value
  );
}

function isAdminPavilionReservationSortKey(
  value: string | undefined
): value is AdminPavilionReservationSortKey {
  return adminPavilionReservationSortKeys.some((sort) => sort === value);
}

export function parseAdminPavilionReservationStatus(
  value: string | string[] | undefined
): PavilionReservationStatusValue | undefined {
  const first = firstString(value);
  return isAdminPavilionReservationStatus(first) ? first : undefined;
}

export function parseAdminPavilionReservationPaymentStatus(
  value: string | string[] | undefined
): PavilionReservationPaymentStatusValue | undefined {
  const first = firstString(value);
  return isAdminPavilionReservationPaymentStatus(first) ? first : undefined;
}

export function parseAdminPavilionReservationSortKey(
  value: string | string[] | undefined
): AdminPavilionReservationSortKey {
  const first = firstString(value);
  return isAdminPavilionReservationSortKey(first) ? first : 'createdAt';
}

export function parseAdminPavilionReservationSortDirection(
  value: string | string[] | undefined
): AdminPavilionReservationSortDirection {
  return firstString(value) === 'asc' ? 'asc' : 'desc';
}

export function parseAdminPavilionReservationDateFilter(
  value: string | string[] | undefined
): string | undefined {
  const first = firstString(value);
  return first && prismaDateFromIsoCalendar(first) ? first : undefined;
}

export function parseAdminPavilionReservationSearch(
  value: string | string[] | undefined
): string | undefined {
  const first = firstString(value)?.trim();
  return first && first.length > 0 ? first.slice(0, 120) : undefined;
}

function firstSlot(
  slots: { requestedDate: Date; startMinutes: number }[]
): { date: Date; startMinutes: number } | null {
  const sorted = [...slots].toSorted((left, right) => {
    const dateDiff =
      left.requestedDate.getTime() - right.requestedDate.getTime();
    return dateDiff === 0 ? left.startMinutes - right.startMinutes : dateDiff;
  });
  const [slot] = sorted;
  return slot
    ? { date: slot.requestedDate, startMinutes: slot.startMinutes }
    : null;
}

function compareNullableNumber(
  left: number | null,
  right: number | null
): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

const adminPavilionReservationListRequestSelect = {
  id: true,
  referenceCode: true,
  status: true,
  paymentStatus: true,
  paidAt: true,
  persona: true,
  requesterEmail: true,
  firstName: true,
  lastName: true,
  eventName: true,
  groupSize: true,
  estimatedTotalCents: true,
  createdAt: true,
  slots: {
    select: {
      id: true,
      requestedDate: true,
      startMinutes: true,
      endMinutes: true,
      item: { select: { id: true, name: true } },
    },
  },
  _count: { select: { slots: true, services: true } },
} as const satisfies Prisma.PavilionReservationRequestSelect;

type AdminPavilionReservationListRequestRow =
  Prisma.PavilionReservationRequestGetPayload<{
    select: typeof adminPavilionReservationListRequestSelect;
  }>;

function adminPavilionReservationListSearchWhere(
  search: string | undefined
): Prisma.PavilionReservationRequestWhereInput {
  if (!search) {
    return {};
  }
  return {
    OR: [
      { referenceCode: { contains: search, mode: 'insensitive' } },
      { requesterEmail: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { eventName: { contains: search, mode: 'insensitive' } },
      { groupName: { contains: search, mode: 'insensitive' } },
    ],
  };
}

function adminPavilionReservationListStatusWhere(
  filters: AdminPavilionReservationListFilters,
  hasSearch: boolean
): Prisma.PavilionReservationRequestWhereInput {
  if (filters.status) {
    return { status: filters.status };
  }
  if (hasSearch) {
    return {};
  }
  return { status: { not: 'draft' } };
}

function adminPavilionReservationListWhere(
  filters: AdminPavilionReservationListFilters
): Prisma.PavilionReservationRequestWhereInput {
  const searchWhere = adminPavilionReservationListSearchWhere(filters.search);
  const hasSearch = Boolean(filters.search?.trim());
  return {
    ...adminPavilionReservationListStatusWhere(filters, hasSearch),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...searchWhere,
    ...(filters.date
      ? {
          slots: {
            some: { requestedDate: new Date(`${filters.date}T00:00:00Z`) },
          },
        }
      : {}),
  };
}

function scheduleSlotsFromListRequestRow(
  row: AdminPavilionReservationListRequestRow
): AdminPavilionReservationScheduleSlot[] {
  return row.slots.map((slot) => ({
    id: slot.id,
    requestId: row.id,
    referenceCode: row.referenceCode,
    eventName: row.eventName,
    status: row.status,
    paymentStatus: row.paymentStatus,
    itemId: slot.item.id,
    itemName: slot.item.name,
    requestedDate: slot.requestedDate,
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
  }));
}

function uniqueRequestedDatesFromListRows(
  rows: AdminPavilionReservationListRequestRow[]
): Date[] {
  const seen = new Set<number>();
  const dates: Date[] = [];
  for (const row of rows) {
    for (const slot of row.slots) {
      const time = slot.requestedDate.getTime();
      if (!seen.has(time)) {
        seen.add(time);
        dates.push(slot.requestedDate);
      }
    }
  }
  return dates;
}

async function listAdminPavilionReservationConflictScheduleSlots(
  requestedDates: Date[]
): Promise<AdminPavilionReservationScheduleSlot[]> {
  if (requestedDates.length === 0) {
    return [];
  }
  const slots = await prisma.pavilionReservationSlot.findMany({
    where: { requestedDate: { in: requestedDates } },
    select: {
      id: true,
      requestId: true,
      requestedDate: true,
      startMinutes: true,
      endMinutes: true,
      item: { select: { id: true, name: true } },
      request: {
        select: {
          referenceCode: true,
          eventName: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
  });
  return slots.map((slot) => ({
    id: slot.id,
    requestId: slot.requestId,
    referenceCode: slot.request.referenceCode,
    eventName: slot.request.eventName,
    status: slot.request.status,
    paymentStatus: slot.request.paymentStatus,
    itemId: slot.item.id,
    itemName: slot.item.name,
    requestedDate: slot.requestedDate,
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
  }));
}

function mapAdminPavilionReservationListRow(
  row: AdminPavilionReservationListRequestRow,
  conflictGraph: ReturnType<typeof buildAdminPavilionReservationConflictGraph>
): AdminPavilionReservationListRow {
  const rowFirstSlot = firstSlot(row.slots);
  const conflictSeverity =
    adminPavilionReservationConflictSeverityFromGraphEntry(
      conflictGraph.get(row.id)
    );
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    status: row.status,
    paymentStatus: row.paymentStatus,
    paidAt: row.paidAt,
    persona: row.persona,
    requesterEmail: row.requesterEmail,
    firstName: row.firstName,
    lastName: row.lastName,
    eventName: row.eventName,
    groupSize: row.groupSize,
    estimatedTotalCents: row.estimatedTotalCents,
    createdAt: row.createdAt,
    firstSlotDate: rowFirstSlot?.date ?? null,
    firstSlotStartMinutes: rowFirstSlot?.startMinutes ?? null,
    slotCount: row._count.slots,
    serviceCount: row._count.services,
    conflictSeverity,
  };
}

function sortAdminPavilionReservationRows(
  rows: AdminPavilionReservationListRow[],
  sort: AdminPavilionReservationSortKey,
  direction: AdminPavilionReservationSortDirection
): AdminPavilionReservationListRow[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...rows].toSorted((left, right) => {
    let result = 0;
    if (sort === 'eventName') {
      result = left.eventName.localeCompare(right.eventName);
    } else if (sort === 'requester') {
      result = `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`
      );
    } else if (sort === 'status') {
      result = left.status.localeCompare(right.status);
    } else if (sort === 'firstSlot') {
      result = compareNullableNumber(
        left.firstSlotDate?.getTime() ?? null,
        right.firstSlotDate?.getTime() ?? null
      );
      if (result === 0) {
        result = compareNullableNumber(
          left.firstSlotStartMinutes,
          right.firstSlotStartMinutes
        );
      }
    } else if (sort === 'estimate') {
      result = compareNullableNumber(
        left.estimatedTotalCents,
        right.estimatedTotalCents
      );
    } else if (sort === 'paymentStatus') {
      result = left.paymentStatus.localeCompare(right.paymentStatus);
    } else {
      result = left.createdAt.getTime() - right.createdAt.getTime();
    }
    return result === 0
      ? right.createdAt.getTime() - left.createdAt.getTime()
      : result * multiplier;
  });
}

export async function listAdminPavilionReservableItemOptions(): Promise<
  AdminPavilionReservableItemOption[]
> {
  const items = await prisma.pavilionReservableItem.findMany({
    orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      kind: true,
      name: true,
      pricingType: true,
      displayOrder: true,
    },
  });
  return items;
}

export async function listAdminPavilionReservationRows(
  filters: AdminPavilionReservationListFilters,
  weekDateKeys: readonly string[]
): Promise<AdminPavilionReservationListResult> {
  const rows = await prisma.pavilionReservationRequest.findMany({
    where: adminPavilionReservationListWhere(filters),
    select: adminPavilionReservationListRequestSelect,
  });

  const calendarScheduleSlots = rows.flatMap(scheduleSlotsFromListRequestRow);
  const conflictScheduleSlots =
    await listAdminPavilionReservationConflictScheduleSlots(
      uniqueRequestedDatesFromListRows(rows)
    );
  const conflictGraph = buildAdminPavilionReservationConflictGraph(
    conflictScheduleSlots
  );
  const mappedRows = rows.map((row) =>
    mapAdminPavilionReservationListRow(row, conflictGraph)
  );

  return {
    rows: sortAdminPavilionReservationRows(
      mappedRows,
      filters.sort,
      filters.direction
    ),
    calendarSegments: listAdminPavilionReservationCalendarSegments(
      calendarScheduleSlots,
      weekDateKeys
    ),
  };
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
      paymentStatus: true,
      paidAt: true,
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
      updatedAt: true,
      reviewedAt: true,
      adminNotes: true,
      abandonEmailSentAt: true,
      resumeToken: true,
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

  if (!reservation) {
    return null;
  }

  const sameDaySlots = await prisma.pavilionReservationSlot.findMany({
    where: {
      requestedDate: {
        in: reservation.slots.map((slot) => slot.requestedDate),
      },
    },
    select: {
      id: true,
      requestId: true,
      requestedDate: true,
      startMinutes: true,
      endMinutes: true,
      item: { select: { id: true, name: true } },
      request: {
        select: {
          referenceCode: true,
          eventName: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
  });
  const scheduleSlots: AdminPavilionReservationScheduleSlot[] =
    sameDaySlots.map((slot) => ({
      id: slot.id,
      requestId: slot.requestId,
      referenceCode: slot.request.referenceCode,
      eventName: slot.request.eventName,
      status: slot.request.status,
      paymentStatus: slot.request.paymentStatus,
      itemId: slot.item.id,
      itemName: slot.item.name,
      requestedDate: slot.requestedDate,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
    }));
  const slots = reservation.slots.map((slot) => {
    const scheduleSlot: AdminPavilionReservationScheduleSlot = {
      id: slot.id,
      requestId: reservation.id,
      referenceCode: reservation.referenceCode,
      eventName: reservation.eventName,
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      itemId: slot.item.id,
      itemName: slot.item.name,
      requestedDate: slot.requestedDate,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
    };
    return {
      ...slot,
      ...adminPavilionReservationSlotConflicts(scheduleSlot, scheduleSlots),
    };
  });
  const first = firstSlot(reservation.slots);

  return {
    ...reservation,
    firstSlotDate: first?.date ?? null,
    firstSlotStartMinutes: first?.startMinutes ?? null,
    slots,
  };
}
