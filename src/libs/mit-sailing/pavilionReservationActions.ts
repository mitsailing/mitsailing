'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { instantForNyWallClock } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import { sendPavilionReservationSubmittedEmail } from '@/libs/email/pavilion-reservation-emails';
import { logger } from '@/libs/Logger';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import {
  estimatedServiceAmountCents,
  estimatedSlotAmountCents,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import { listVisiblePavilionReservableItems } from '@/libs/mit-sailing/pavilionReservationQueries';
import { parsePavilionReservationFormData } from '@/libs/mit-sailing/pavilionReservationSchemas';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservationErrorKey,
  PavilionReservableItemDto,
  PavilionReservationSlotInput,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

const PAVILION_REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIN_NOTICE_HOURS = 48;
const DUPLICATE_REQUEST_WINDOW_MINUTES = 5;

function referenceCodeFromBytes(bytes: Buffer): string {
  const chars = Array.from(bytes, (byte) => {
    const index = byte % PAVILION_REFERENCE_ALPHABET.length;
    return PAVILION_REFERENCE_ALPHABET[index] ?? 'X';
  }).join('');
  return `PAV-${chars}`;
}

async function generateReferenceCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const referenceCode = referenceCodeFromBytes(randomBytes(8));
    const existing = await prisma.pavilionReservationRequest.findUnique({
      where: { referenceCode },
      select: { id: true },
    });
    if (!existing) {
      return referenceCode;
    }
  }
  return referenceCodeFromBytes(randomBytes(12));
}

function slotStartInstant(slot: PavilionReservationSlotInput): Date | null {
  const date = prismaDateFromIsoCalendar(slot.date);
  if (!date) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = Math.floor(slot.startMinutes / 60);
  const minute = slot.startMinutes % 60;
  return instantForNyWallClock(year, month, day, hour, minute);
}

function slotsSatisfyNoticeRule(
  slots: PavilionReservationSlotInput[],
  now: Date
): boolean {
  const minimumStart = now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000;
  return slots.every((slot) => {
    const instant = slotStartInstant(slot);
    return instant !== null && instant.getTime() >= minimumStart;
  });
}

function mapItemsById(
  items: PavilionReservableItemDto[]
): Map<string, PavilionReservableItemDto> {
  return new Map(items.map((item) => [item.id, item]));
}

function fieldErrorsFromParseError(): PavilionReservationErrorKey[] {
  return ['error_validation'];
}

function unknownErrorState(error: unknown): PavilionReservationSubmitState {
  logger.error(
    '[pavilion-reservation:create] error_name={errorName} error_code={errorCode}',
    {
      errorCode: safeErrorCode(error) ?? 'unknown',
      errorName: safeErrorName(error),
    }
  );
  return { status: 'error', errors: ['error_unknown'] };
}

async function hasRecentMatchingReservationRequest(props: {
  eventName: string;
  now: Date;
  requesterEmail: string;
}): Promise<boolean> {
  const createdAt = new Date(
    props.now.getTime() - DUPLICATE_REQUEST_WINDOW_MINUTES * 60 * 1000
  );
  const recentRequest = await prisma.pavilionReservationRequest.findFirst({
    where: {
      createdAt: { gte: createdAt },
      eventName: props.eventName,
      requesterEmail: props.requesterEmail,
    },
    select: { id: true },
  });
  return recentRequest !== null;
}

function scheduleLinesForEmail(props: {
  itemById: Map<string, PavilionReservableItemDto>;
  slots: PavilionReservationSlotInput[];
}): string[] {
  return props.slots.map((slot) => {
    const itemName = props.itemById.get(slot.itemId)?.name ?? 'Pavilion space';
    return `${itemName}: ${formatEasternShortDateFromIsoCalendar(slot.date)} · ${formatPavilionReservationTimeLabel(slot.startMinutes)} - ${formatPavilionReservationTimeLabel(slot.endMinutes)}`;
  });
}

/**
 * Persists a public, unauthenticated Pavilion reservation request.
 *
 * @param locale - Active locale segment.
 * @param _prevState - Previous action state.
 * @param formData - Submitted wizard form data.
 * @returns Confirmation state with the server-generated reference code.
 */
export async function submitPavilionReservationRequestAction(
  locale: string,
  _prevState: PavilionReservationSubmitState,
  formData: FormData
): Promise<PavilionReservationSubmitState> {
  const parsed = parsePavilionReservationFormData(formData);
  if (!parsed.success) {
    return { status: 'error', errors: fieldErrorsFromParseError() };
  }

  const catalog = await listVisiblePavilionReservableItems();
  const itemById = mapItemsById(catalog);
  const { slots } = parsed.data;
  const serviceIds = [...new Set(parsed.data.services)];

  const now = new Date();
  if (!slotsSatisfyNoticeRule(slots, now)) {
    return { status: 'error', errors: ['error_notice'] };
  }

  if (
    slots.some((slot) => itemById.get(slot.itemId)?.kind !== 'space') ||
    serviceIds.some((serviceId) => itemById.get(serviceId)?.kind !== 'service')
  ) {
    return { status: 'error', errors: ['error_catalog'] };
  }

  if (
    await hasRecentMatchingReservationRequest({
      eventName: parsed.data.eventName,
      now,
      requesterEmail: parsed.data.requesterEmail,
    })
  ) {
    return { status: 'error', errors: ['error_rate_limited'] };
  }

  const referenceCode = await generateReferenceCode();
  const slotIndexByItemId = new Map<string, number>();
  const slotRows = slots.map((slot, index) => {
    const item = itemById.get(slot.itemId);
    const requestedDate = prismaDateFromIsoCalendar(slot.date);
    const slotIndexForItem = slotIndexByItemId.get(slot.itemId) ?? 0;
    slotIndexByItemId.set(slot.itemId, slotIndexForItem + 1);
    if (!item || !requestedDate) {
      return null;
    }
    return {
      itemId: slot.itemId,
      requestedDate,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      estimatedAmountCents: estimatedSlotAmountCents({
        item,
        persona: parsed.data.persona,
        slot,
        slotIndexForItem,
      }),
      displayOrder: index,
    };
  });

  if (slotRows.some((row) => row === null)) {
    return { status: 'error', errors: ['error_validation'] };
  }

  const serviceRows = serviceIds.flatMap((serviceId) => {
    const item = itemById.get(serviceId);
    if (!item) {
      return [];
    }
    return [
      {
        itemId: serviceId,
        estimatedAmountCents: estimatedServiceAmountCents({
          item,
          persona: parsed.data.persona,
        }),
      },
    ];
  });

  let estimatedTotalCents: number | null = 0;
  for (const row of [...slotRows, ...serviceRows]) {
    if (
      estimatedTotalCents === null ||
      row === null ||
      row.estimatedAmountCents === null
    ) {
      estimatedTotalCents = null;
    } else {
      estimatedTotalCents += row.estimatedAmountCents;
    }
  }

  try {
    await prisma.pavilionReservationRequest.create({
      data: {
        referenceCode,
        persona: parsed.data.persona,
        requesterEmail: parsed.data.requesterEmail,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        eventName: parsed.data.eventName,
        groupName: parsed.data.groupName,
        groupSize: parsed.data.groupSize,
        description: parsed.data.description,
        hasTent: parsed.data.hasTent,
        servesAlcohol: parsed.data.servesAlcohol,
        projectTitle: parsed.data.projectTitle,
        advisorName: parsed.data.advisorName,
        advisorEmail: parsed.data.advisorEmail,
        costCenter: parsed.data.costCenter,
        mitId: parsed.data.mitId,
        mitAccount: parsed.data.mitAccount,
        estimatedTotalCents,
        slots: {
          create: slotRows.map((row) => {
            if (row === null) {
              throw new Error('Invalid Pavilion reservation slot row');
            }
            return row;
          }),
        },
        services: { create: serviceRows },
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return unknownErrorState(error);
  }

  try {
    await sendPavilionReservationSubmittedEmail({
      eventName: parsed.data.eventName,
      referenceCode,
      requesterEmail: parsed.data.requesterEmail,
      scheduleLines: scheduleLinesForEmail({ itemById, slots }),
    });
  } catch (error) {
    logger.error(
      '[pavilion-reservation:create-email] reference_code={referenceCode} error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
        referenceCode,
      }
    );
  }

  revalidatePath(`/${locale}/admin/pavilion-reservations`);
  return { status: 'confirmed', referenceCode, errors: [] };
}
