import 'server-only';
import type {
  PavilionReservationPaymentStatusValue,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';

export type AdminPavilionReservationScheduleSlot = {
  id: string;
  requestId: string;
  referenceCode: string;
  eventName: string;
  status: PavilionReservationStatusValue;
  paymentStatus: PavilionReservationPaymentStatusValue;
  itemId: string;
  itemName: string;
  requestedDate: Date;
  startMinutes: number;
  endMinutes: number;
};

export type AdminPavilionReservationConflictSeverity = 'hard' | 'soft';

export type AdminPavilionReservationCalendarSegment = {
  id: string;
  requestId: string;
  referenceCode: string;
  eventName: string;
  status: PavilionReservationStatusValue;
  paymentStatus: PavilionReservationPaymentStatusValue;
  itemId: string;
  itemName: string;
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
};

const adminPavilionReservationHardBlockingStatuses = [
  'approved',
  'needs_info',
] as const satisfies readonly PavilionReservationStatusValue[];

const adminPavilionReservationSoftConflictStatuses = [
  'pending',
] as const satisfies readonly PavilionReservationStatusValue[];

export function adminPavilionReservationDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function adminPavilionReservationWeekStart(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return adminPavilionReservationWeekStart(
      adminPavilionReservationDateKey(new Date())
    );
  }
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return adminPavilionReservationDateKey(date);
}

export function adminPavilionReservationWeekKeys(weekStartKey: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStartKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return adminPavilionReservationDateKey(date);
  });
}

export function adminPavilionReservationAddDays(
  dateKey: string,
  days: number
): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return adminPavilionReservationDateKey(date);
}

function isAdminPavilionReservationConflictStatus(
  status: PavilionReservationStatusValue
): boolean {
  return (
    adminPavilionReservationHardBlockingStatuses.some(
      (blockingStatus) => blockingStatus === status
    ) ||
    adminPavilionReservationSoftConflictStatuses.some(
      (blockingStatus) => blockingStatus === status
    )
  );
}

function adminPavilionReservationSlotConflictSeverity(
  left: PavilionReservationStatusValue,
  right: PavilionReservationStatusValue
): AdminPavilionReservationConflictSeverity | null {
  if (
    !isAdminPavilionReservationConflictStatus(left) ||
    !isAdminPavilionReservationConflictStatus(right)
  ) {
    return null;
  }
  return adminPavilionReservationHardBlockingStatuses.some(
    (status) => status === left || status === right
  )
    ? 'hard'
    : 'soft';
}

function adminPavilionReservationSlotsOverlap(
  left: Pick<
    AdminPavilionReservationScheduleSlot,
    'endMinutes' | 'itemId' | 'requestedDate' | 'startMinutes'
  >,
  right: Pick<
    AdminPavilionReservationScheduleSlot,
    'endMinutes' | 'itemId' | 'requestedDate' | 'startMinutes'
  >
): boolean {
  return (
    left.itemId === right.itemId &&
    adminPavilionReservationDateKey(left.requestedDate) ===
      adminPavilionReservationDateKey(right.requestedDate) &&
    left.startMinutes < right.endMinutes &&
    right.startMinutes < left.endMinutes
  );
}

export function buildAdminPavilionReservationConflictGraph(
  slots: readonly AdminPavilionReservationScheduleSlot[]
): Map<
  string,
  {
    hard: Set<string>;
    soft: Set<string>;
  }
> {
  const graph = new Map<string, { hard: Set<string>; soft: Set<string> }>();
  const upsert = (id: string) => {
    let entry = graph.get(id);
    if (!entry) {
      entry = { hard: new Set<string>(), soft: new Set<string>() };
      graph.set(id, entry);
    }
    return entry;
  };

  for (let leftIndex = 0; leftIndex < slots.length; leftIndex += 1) {
    const left = slots[leftIndex];
    if (!left || !isAdminPavilionReservationConflictStatus(left.status)) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < slots.length;
      rightIndex += 1
    ) {
      const right = slots[rightIndex];
      if (
        !right ||
        left.requestId === right.requestId ||
        !adminPavilionReservationSlotsOverlap(left, right)
      ) {
        continue;
      }
      const severity = adminPavilionReservationSlotConflictSeverity(
        left.status,
        right.status
      );
      if (!severity) {
        continue;
      }
      upsert(left.requestId)[severity].add(right.requestId);
      upsert(right.requestId)[severity].add(left.requestId);
    }
  }
  return graph;
}

function listOverlappingAdminPavilionReservationSlots(
  slot: AdminPavilionReservationScheduleSlot,
  candidates: readonly AdminPavilionReservationScheduleSlot[]
): AdminPavilionReservationScheduleSlot[] {
  return candidates.filter(
    (candidate) =>
      candidate.requestId !== slot.requestId &&
      adminPavilionReservationSlotsOverlap(slot, candidate)
  );
}

function conflictingAdminPavilionReservationRequestIds(
  overlappingSlots: readonly AdminPavilionReservationScheduleSlot[]
): string[] {
  return [...new Set(overlappingSlots.map((candidate) => candidate.requestId))];
}

function adminPavilionReservationConflictSeverityForSlot(
  slot: AdminPavilionReservationScheduleSlot,
  overlappingSlots: readonly AdminPavilionReservationScheduleSlot[]
): AdminPavilionReservationConflictSeverity | null {
  let severity: AdminPavilionReservationConflictSeverity | null = null;
  for (const candidate of overlappingSlots) {
    const pairSeverity = adminPavilionReservationSlotConflictSeverity(
      slot.status,
      candidate.status
    );
    if (pairSeverity === 'hard') {
      return 'hard';
    }
    if (pairSeverity === 'soft') {
      severity = 'soft';
    }
  }
  return severity;
}

export type AdminPavilionReservationRequestConflictEntry = {
  hard: Set<string>;
  soft: Set<string>;
};

export function adminPavilionReservationConflictSeverityFromGraphEntry(
  conflicts: AdminPavilionReservationRequestConflictEntry | undefined
): AdminPavilionReservationConflictSeverity | null {
  if (!conflicts) {
    return null;
  }
  if (conflicts.hard.size > 0) {
    return 'hard';
  }
  return conflicts.soft.size > 0 ? 'soft' : null;
}

export type AdminPavilionReservationSlotConflicts = {
  conflictSeverity: AdminPavilionReservationConflictSeverity | null;
  conflictingRequestIds: string[];
};

export function adminPavilionReservationSlotConflicts(
  slot: AdminPavilionReservationScheduleSlot,
  candidates: readonly AdminPavilionReservationScheduleSlot[]
): AdminPavilionReservationSlotConflicts {
  const overlappingSlots = listOverlappingAdminPavilionReservationSlots(
    slot,
    candidates
  );
  return {
    conflictSeverity: adminPavilionReservationConflictSeverityForSlot(
      slot,
      overlappingSlots
    ),
    conflictingRequestIds:
      conflictingAdminPavilionReservationRequestIds(overlappingSlots),
  };
}

export function listAdminPavilionReservationCalendarSegments(
  slots: readonly AdminPavilionReservationScheduleSlot[],
  dateKeys: readonly string[]
): AdminPavilionReservationCalendarSegment[] {
  const dateKeySet = new Set(dateKeys);
  return slots.flatMap((slot) => {
    const dateKey = adminPavilionReservationDateKey(slot.requestedDate);
    if (!dateKeySet.has(dateKey)) {
      return [];
    }
    return [
      {
        id: slot.id,
        requestId: slot.requestId,
        referenceCode: slot.referenceCode,
        eventName: slot.eventName,
        status: slot.status,
        paymentStatus: slot.paymentStatus,
        itemId: slot.itemId,
        itemName: slot.itemName,
        dateKey,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      },
    ];
  });
}
