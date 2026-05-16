'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
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
import { parsePavilionReservationPersona } from '@/libs/mit-sailing/pavilionReservationPersonas';
import { pavilionReservationStoredSlotMinutesFromTokens } from '@/libs/mit-sailing/pavilionReservationSlotMinutes';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservationPaymentStatusValue,
  PavilionReservationPersonaValue,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import enMessages from '@/locales/en.json';
import { isValidMarketingEmail } from '@/utils/emailValidation';
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

// Whole-dollar USD only; stored as integer cents (always a multiple of 100).
function wholeDollarsCentsOrNull(value: string): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.replaceAll(/[$,]/g, '').trim();
  if (!/^\d+(\.\d+)?$/u.test(normalized)) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed) * 100
    : null;
}

function requireAdminContactFields(props: {
  description: string;
  eventName: string;
  firstName: string;
  lastName: string;
  phone: string;
  requesterEmail: string;
}): void {
  const missing: string[] = [];
  if (!props.requesterEmail) {
    missing.push('requesterEmail');
  } else if (!isValidMarketingEmail(props.requesterEmail)) {
    throw new Error('Invalid requester email');
  }
  if (!props.firstName) {
    missing.push('firstName');
  }
  if (!props.lastName) {
    missing.push('lastName');
  }
  if (!props.phone) {
    missing.push('phone');
  }
  if (!props.eventName) {
    missing.push('eventName');
  }
  if (!props.description) {
    missing.push('description');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

function dateFromFormToken(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  if (!parsed) {
    throw new Error('Invalid paidAt');
  }
  return parsed;
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
    const date = dates[index] ?? '';
    const start = starts[index] ?? '';
    const end = ends[index] ?? '';
    const amount = amounts[index] ?? '';
    const hasSlotInput = [slotId, itemId, date, start, end, amount].some(
      (value) => value.length > 0
    );
    if (!hasSlotInput) {
      return [];
    }
    const requestedDate = prismaDateFromIsoCalendar(date);
    const slotMinutes = pavilionReservationStoredSlotMinutesFromTokens({
      startToken: start,
      endToken: end,
    });
    if (!itemId || !requestedDate || slotMinutes === null) {
      throw new Error('Invalid Pavilion reservation slot row');
    }
    return [
      {
        itemId,
        requestedDate,
        startMinutes: slotMinutes.startMinutes,
        endMinutes: slotMinutes.endMinutes,
        estimatedAmountCents: wholeDollarsCentsOrNull(amount),
        displayOrder: index,
      },
    ];
  });
}

function parseServiceRows(formData: FormData) {
  const selectedItemIds = formTextList(formData, 'serviceItemId');
  const amountItemIds = formTextList(formData, 'serviceAmountItemId');
  const amounts = formTextList(formData, 'serviceAmount');

  return selectedItemIds.map((itemId) => {
    const amountIndex = amountItemIds.indexOf(itemId);
    if (amountIndex === -1) {
      throw new Error('Invalid Pavilion reservation service row');
    }
    return {
      itemId,
      estimatedAmountCents: wholeDollarsCentsOrNull(amounts[amountIndex] ?? ''),
    };
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
    .toSorted((first, second) => first.localeCompare(second))
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
  const persona = parsePavilionReservationPersona(
    formText(formData, 'persona')
  );

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

  const requesterEmail = formText(formData, 'requesterEmail');
  const firstName = formText(formData, 'firstName');
  const lastName = formText(formData, 'lastName');
  const phone = formText(formData, 'phone');
  const eventName = formText(formData, 'eventName');
  const description = formText(formData, 'description');
  requireAdminContactFields({
    description,
    eventName,
    firstName,
    lastName,
    phone,
    requesterEmail,
  });

  const slotRows = parseSlotRows(formData);
  const serviceRows = parseServiceRows(formData);
  const updatedAt = dateFromFormToken(formText(formData, 'updatedAt'));
  if (!updatedAt) {
    throw new Error('Missing Pavilion reservation edit token');
  }
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

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.pavilionReservationRequest.findUnique({
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
    if (!before) {
      throw new Error('Pavilion reservation not found');
    }
    const statusChanged = before.status !== status;
    const scheduleChanged =
      slotSignature(before.slots) !== slotSignature(slotRows);

    const updateResult = await tx.pavilionReservationRequest.updateMany({
      where: { id, updatedAt },
      data: {
        status,
        paymentStatus,
        paidAt: paidAtFromForm(paymentStatus, formText(formData, 'paidAt')),
        persona,
        requesterEmail,
        firstName,
        lastName,
        phone,
        eventName,
        groupName: optionalText(formText(formData, 'groupName')),
        groupSize: positiveIntOrNull(formText(formData, 'groupSize')),
        description,
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
    if (updateResult.count !== 1) {
      throw new Error(
        'Pavilion reservation changed while editing. Reload before saving again.'
      );
    }
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
    return { before, scheduleChanged, statusChanged };
  });

  if (result.statusChanged || result.scheduleChanged) {
    const emailEventName =
      formText(formData, 'eventName') || result.before.eventName;
    const emailRequester =
      formText(formData, 'requesterEmail') || result.before.requesterEmail;
    after(async () => {
      try {
        const items = await prisma.pavilionReservableItem.findMany({
          where: { id: { in: slotRows.map((slot) => slot.itemId) } },
          select: { id: true, name: true },
        });
        const itemNameById = new Map(items.map((item) => [item.id, item.name]));
        await sendPavilionReservationStatusEmail({
          eventName: emailEventName,
          referenceCode: result.before.referenceCode,
          requesterEmail: emailRequester,
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
    });
  }

  revalidatePath(getI18nPath(adminPavilionReservationIndexPath(), locale));
  revalidatePath(getI18nPath(adminPavilionReservationDetailPath(id), locale));
}
