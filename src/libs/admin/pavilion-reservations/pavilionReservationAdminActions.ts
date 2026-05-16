'use server';

import { revalidatePath } from 'next/cache';
import { parseEasternDateTimeLocal } from '@/libs/admin/events/eventAdminSchemas';
import {
  adminPavilionReservationDetailPath,
  adminPavilionReservationIndexPath,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import {
  parseAdminPavilionReservationPaymentStatus,
  parseAdminPavilionReservationStatus,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { sendPavilionReservationStatusEmail } from '@/libs/email/pavilion-reservation-emails';
import { logger } from '@/libs/Logger';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import {
  isoCalendarDateFromPrismaDate,
  prismaDateFromIsoCalendar,
} from '@/libs/mit-sailing/isoCalendarDate';
import { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPricing';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservationPaymentStatusValue,
  PavilionReservationPersonaValue,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import enMessages from '@/locales/en.json';
import { getI18nPath } from '@/utils/Helpers';

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function formTextList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''));
}

function optionalText(value: string): string | null {
  return value.length > 0 ? value : null;
}

function positiveIntOrNull(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function centsOrNull(value: string): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.replaceAll(/[$,]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed * 100)
    : null;
}

function minutesFromTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const hour = Number.parseInt(match[1] ?? '', 10);
  const minute = Number.parseInt(match[2] ?? '', 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function paidAtFromForm(
  paymentStatus: PavilionReservationPaymentStatusValue,
  value: string
): Date | null {
  if (paymentStatus !== 'paid') {
    return null;
  }
  if (!value) {
    return new Date();
  }
  const parsed = parseEasternDateTimeLocal(value);
  return parsed ?? new Date();
}

function parsePersona(
  value: string
): PavilionReservationPersonaValue | undefined {
  return PAVILION_RESERVATION_PERSONAS.find((persona) => persona === value);
}

function totalCentsFromRows(
  rows: readonly { estimatedAmountCents: number | null }[]
): number | null {
  let total = 0;
  for (const row of rows) {
    if (row.estimatedAmountCents === null) {
      return null;
    }
    total += row.estimatedAmountCents;
  }
  return total;
}

function parseSlotRows(formData: FormData) {
  const slotIds = formTextList(formData, 'slotId');
  const removedSlotIds = new Set(formTextList(formData, 'removeSlotId'));
  const itemIds = formTextList(formData, 'slotItemId');
  const dates = formTextList(formData, 'slotDate');
  const starts = formTextList(formData, 'slotStart');
  const ends = formTextList(formData, 'slotEnd');
  const amounts = formTextList(formData, 'slotAmount');

  return itemIds.flatMap((itemId, index) => {
    const slotId = slotIds[index] ?? '';
    if (slotId && removedSlotIds.has(slotId)) {
      return [];
    }
    const requestedDate = prismaDateFromIsoCalendar(dates[index] ?? '');
    const startMinutes = minutesFromTime(starts[index] ?? '');
    const rawEndMinutes = minutesFromTime(ends[index] ?? '');
    if (
      !itemId ||
      !requestedDate ||
      startMinutes === null ||
      rawEndMinutes === null
    ) {
      return [];
    }
    const endMinutes =
      rawEndMinutes <= startMinutes ? rawEndMinutes + 24 * 60 : rawEndMinutes;
    if (endMinutes <= startMinutes || endMinutes > 26 * 60) {
      return [];
    }
    return [
      {
        itemId,
        requestedDate,
        startMinutes,
        endMinutes,
        estimatedAmountCents: centsOrNull(amounts[index] ?? ''),
        displayOrder: index,
      },
    ];
  });
}

function parseServiceRows(formData: FormData) {
  const selectedItemIds = new Set(formTextList(formData, 'serviceItemId'));
  const itemIds = formTextList(formData, 'serviceAmountItemId');
  const amounts = formTextList(formData, 'serviceAmount');
  return itemIds.flatMap((itemId, index) => {
    if (!selectedItemIds.has(itemId)) {
      return [];
    }
    return [
      {
        itemId,
        estimatedAmountCents: centsOrNull(amounts[index] ?? ''),
      },
    ];
  });
}

function catalogKindMismatches(props: {
  expectedKindByItemId: Map<string, 'service' | 'space'>;
  serviceRows: readonly { itemId: string }[];
  slotRows: readonly { itemId: string }[];
}): {
  actualKind: string;
  expectedKind: 'service' | 'space';
  itemId: string;
}[] {
  return [
    ...props.slotRows.map((row) => ({
      actualKind: props.expectedKindByItemId.get(row.itemId) ?? 'missing',
      expectedKind: 'space' as const,
      itemId: row.itemId,
    })),
    ...props.serviceRows.map((row) => ({
      actualKind: props.expectedKindByItemId.get(row.itemId) ?? 'missing',
      expectedKind: 'service' as const,
      itemId: row.itemId,
    })),
  ].filter((row) => row.actualKind !== row.expectedKind);
}

function statusFromForm(
  formData: FormData
): PavilionReservationStatusValue | undefined {
  return parseAdminPavilionReservationStatus(
    formText(formData, 'workflowStatus') || formText(formData, 'status')
  );
}

function missingPavilionReservationAdminRequiredFieldNames(props: {
  paymentStatus: PavilionReservationPaymentStatusValue | undefined;
  persona: PavilionReservationPersonaValue | undefined;
  status: PavilionReservationStatusValue | undefined;
}): string[] {
  const missing: string[] = [];
  if (!props.status) {
    missing.push('workflowStatus');
  }
  if (!props.paymentStatus) {
    missing.push('paymentStatus');
  }
  if (!props.persona) {
    missing.push('persona');
  }
  return missing;
}

function statusLabel(status: PavilionReservationStatusValue): string {
  switch (status) {
    case 'approved': {
      return enMessages.AdminPavilionReservations.status_approved;
    }
    case 'cancelled': {
      return enMessages.AdminPavilionReservations.status_cancelled;
    }
    case 'declined': {
      return enMessages.AdminPavilionReservations.status_declined;
    }
    case 'needs_info': {
      return enMessages.AdminPavilionReservations.status_needs_info;
    }
    case 'pending': {
      return enMessages.AdminPavilionReservations.status_pending;
    }
    default: {
      return status satisfies never;
    }
  }
}

function slotSignature(
  slots: readonly {
    endMinutes: number;
    itemId: string;
    requestedDate: Date;
    startMinutes: number;
  }[]
): string {
  return slots
    .map(
      (slot) =>
        `${slot.itemId}:${isoCalendarDateFromPrismaDate(slot.requestedDate)}:${slot.startMinutes}:${slot.endMinutes}`
    )
    .toSorted()
    .join('|');
}

function scheduleLinesForEmail(
  slots: readonly {
    endMinutes: number;
    itemName: string;
    requestedDate: Date;
    startMinutes: number;
  }[]
): string[] {
  return slots.map(
    (slot) =>
      `${slot.itemName}: ${formatEasternShortDateFromIsoCalendar(
        isoCalendarDateFromPrismaDate(slot.requestedDate)
      )} · ${formatPavilionReservationTimeLabel(slot.startMinutes)} - ${formatPavilionReservationTimeLabel(slot.endMinutes)}`
  );
}

/**
 * Updates editable admin fields, slots, services, payment metadata, and workflow status.
 *
 * @param locale - Active locale segment.
 * @param id - Reservation request id.
 * @param formData - Admin detail form payload.
 */
export async function updatePavilionReservationAdminAction(
  locale: string,
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  const status = statusFromForm(formData);
  const paymentStatus = parseAdminPavilionReservationPaymentStatus(
    formText(formData, 'paymentStatus')
  );
  const persona = parsePersona(formText(formData, 'persona'));

  if (!status || !paymentStatus || !persona) {
    const missingRequiredFields =
      missingPavilionReservationAdminRequiredFieldNames({
        paymentStatus,
        persona,
        status,
      });
    throw new Error(
      `Missing required fields: ${missingRequiredFields.join(', ')}`
    );
  }

  const slotRows = parseSlotRows(formData);
  const serviceRows = parseServiceRows(formData);
  const catalogItemIds = [
    ...new Set([
      ...slotRows.map((row) => row.itemId),
      ...serviceRows.map((row) => row.itemId),
    ]),
  ];
  const catalogItems =
    catalogItemIds.length > 0
      ? await prisma.pavilionReservableItem.findMany({
          where: { id: { in: catalogItemIds } },
          select: { id: true, kind: true },
        })
      : [];
  const kindByItemId = new Map(
    catalogItems.map((item) => [item.id, item.kind] as const)
  );
  const mismatchedCatalogKinds = catalogKindMismatches({
    expectedKindByItemId: kindByItemId,
    serviceRows,
    slotRows,
  });
  if (mismatchedCatalogKinds.length > 0) {
    logger.warn(
      '[pavilion-reservation:admin-update] request_id={requestId} catalog_item_kind_mismatches={catalogItemKindMismatches}',
      {
        catalogItemKindMismatches: mismatchedCatalogKinds,
        requestId: id,
      }
    );
    throw new Error('Catalog item kind mismatch for Pavilion reservation edit');
  }
  const estimatedTotalCents = totalCentsFromRows([...slotRows, ...serviceRows]);
  const before = await prisma.pavilionReservationRequest.findUnique({
    where: { id },
    select: {
      referenceCode: true,
      status: true,
      requesterEmail: true,
      eventName: true,
      slots: {
        select: {
          itemId: true,
          requestedDate: true,
          startMinutes: true,
          endMinutes: true,
        },
      },
    },
  });
  const statusChanged = before?.status !== status;
  const scheduleChanged =
    slotSignature(before?.slots ?? []) !== slotSignature(slotRows);

  await prisma.$transaction(async (tx) => {
    await tx.pavilionReservationRequest.update({
      where: { id },
      data: {
        status,
        paymentStatus,
        paidAt: paidAtFromForm(paymentStatus, formText(formData, 'paidAt')),
        persona,
        requesterEmail: formText(formData, 'requesterEmail'),
        firstName: formText(formData, 'firstName'),
        lastName: formText(formData, 'lastName'),
        phone: formText(formData, 'phone'),
        eventName: formText(formData, 'eventName'),
        groupName: optionalText(formText(formData, 'groupName')),
        groupSize: positiveIntOrNull(formText(formData, 'groupSize')),
        description: formText(formData, 'description'),
        hasTent: formData.get('hasTent') === 'on',
        servesAlcohol: formData.get('servesAlcohol') === 'on',
        projectTitle: optionalText(formText(formData, 'projectTitle')),
        advisorName: optionalText(formText(formData, 'advisorName')),
        advisorEmail: optionalText(formText(formData, 'advisorEmail')),
        costCenter: optionalText(formText(formData, 'costCenter')),
        mitId: optionalText(formText(formData, 'mitId')),
        mitAccount: optionalText(formText(formData, 'mitAccount')),
        estimatedTotalCents,
        adminNotes: optionalText(formText(formData, 'adminNotes')),
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
      },
    });
    await tx.pavilionReservationSlot.deleteMany({ where: { requestId: id } });
    if (slotRows.length > 0) {
      await tx.pavilionReservationSlot.createMany({
        data: slotRows.map((row) => ({
          ...row,
          requestId: id,
          itemKind: 'space',
        })),
      });
    }
    await tx.pavilionReservationService.deleteMany({
      where: { requestId: id },
    });
    if (serviceRows.length > 0) {
      await tx.pavilionReservationService.createMany({
        data: serviceRows.map((row) => ({
          ...row,
          requestId: id,
          itemKind: 'service',
        })),
      });
    }

    const latestAudit = await tx.userAudit.findFirst({
      where: {
        auditableId: id,
        auditableType: 'pavilion_reservation_requests',
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    await tx.userAudit.create({
      data: {
        auditableId: id,
        auditableType: 'pavilion_reservation_requests',
        action: 'update',
        auditedChanges: {
          after: {
            estimatedTotalCents,
            paymentStatus,
            slotCount: slotRows.length,
            status,
          },
          before: before
            ? {
                eventName: before.eventName,
                referenceCode: before.referenceCode,
                slotCount: before.slots.length,
                status: before.status,
              }
            : null,
        },
        userId: session.user.id,
        version: (latestAudit?.version ?? 0) + 1,
      },
    });
  });

  if (before && (statusChanged || scheduleChanged)) {
    try {
      const items = await prisma.pavilionReservableItem.findMany({
        where: { id: { in: slotRows.map((slot) => slot.itemId) } },
        select: { id: true, name: true },
      });
      const itemNameById = new Map(items.map((item) => [item.id, item.name]));
      await sendPavilionReservationStatusEmail({
        eventName: formText(formData, 'eventName') || before.eventName,
        referenceCode: before.referenceCode,
        requesterEmail:
          formText(formData, 'requesterEmail') || before.requesterEmail,
        scheduleLines: scheduleLinesForEmail(
          slotRows.map((slot) => ({
            ...slot,
            itemName: itemNameById.get(slot.itemId) ?? 'Pavilion space',
          }))
        ),
        status,
        statusLabel: statusLabel(status),
      });
    } catch (error) {
      logger.error(
        '[pavilion-reservation:admin-email] request_id={requestId} error_name={errorName} error_code={errorCode}',
        {
          errorCode: safeErrorCode(error) ?? 'unknown',
          errorName: safeErrorName(error),
          requestId: id,
        }
      );
    }
  }

  revalidatePath(getI18nPath(adminPavilionReservationIndexPath(), locale));
  revalidatePath(getI18nPath(adminPavilionReservationDetailPath(id), locale));
}
