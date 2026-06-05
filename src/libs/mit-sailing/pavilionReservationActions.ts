'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { after } from 'next/server';
import type { PrismaClient } from '@/generated/prisma/client';
import {
  addNyCalendarDays,
  instantForNyWallClock,
} from '@/lib/mit-sailing/nyTime';
import { adminPavilionReservationIndexPath } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import {
  estimatedServiceAmountCents,
  estimatedSlotAmountCents,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import { listVisiblePavilionReservableItems } from '@/libs/mit-sailing/pavilionReservationQueries';
import { parsePavilionReservationFormData } from '@/libs/mit-sailing/pavilionReservationSchemas';
import type {
  PavilionReservationErrorKey,
  PavilionReservableItemDto,
  PavilionReservationSlotInput,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { getI18nPath } from '@/utils/Helpers';
import { getDefaultQueue } from '@/worker/defaultQueue';
import { enqueuePavilionReservationSubmittedEmail } from '@/worker/pavilionReservationSubmittedEmailJob';

const PAVILION_REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIN_NOTICE_HOURS = 48;
const DUPLICATE_REQUEST_WINDOW_MINUTES = 5;
const PAVILION_RESERVATION_SUBMIT_TX_MAX_WAIT_MS = 5000;
const PAVILION_RESERVATION_SUBMIT_TX_TIMEOUT_MS = 10_000;

function referenceCodeFromBytes(bytes: Buffer): string {
  const chars = Array.from(bytes, (byte) => {
    const index = byte % PAVILION_REFERENCE_ALPHABET.length;
    return PAVILION_REFERENCE_ALPHABET[index] ?? 'X';
  }).join('');
  return `PAV-${chars}`;
}

async function generateReferenceCode(
  db: Pick<PrismaClient, 'pavilionReservationRequest'>
): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const referenceCode = referenceCodeFromBytes(randomBytes(8));
    const existing = await db.pavilionReservationRequest.findUnique({
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
  const dateKey =
    slot.startMinutes >= 24 * 60 ? addNyCalendarDays(slot.date, 1) : slot.date;
  const minutes =
    slot.startMinutes >= 24 * 60
      ? slot.startMinutes - 24 * 60
      : slot.startMinutes;
  const date = prismaDateFromIsoCalendar(dateKey);
  if (!date) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
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

function validationErrorState(): PavilionReservationSubmitState {
  return { status: 'error', errors: fieldErrorsFromParseError() };
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

function pavilionReservationDedupeLockKey(props: {
  eventName: string;
  requesterEmail: string;
}): string {
  return `pavilion_reservation_submit_dedupe:v1:${JSON.stringify([
    props.requesterEmail,
    props.eventName,
  ])}`;
}

async function hasRecentMatchingReservationRequest(props: {
  db: Pick<PrismaClient, 'pavilionReservationRequest'>;
  eventName: string;
  now: Date;
  requesterEmail: string;
}): Promise<boolean> {
  const createdAt = new Date(
    props.now.getTime() - DUPLICATE_REQUEST_WINDOW_MINUTES * 60 * 1000
  );
  const recentRequest = await props.db.pavilionReservationRequest.findFirst({
    where: {
      createdAt: { gte: createdAt },
      eventName: props.eventName,
      requesterEmail: props.requesterEmail,
    },
    select: { id: true },
  });
  return recentRequest !== null;
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
    return validationErrorState();
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
      itemKind: item.kind,
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
    return validationErrorState();
  }

  const serviceRows = serviceIds.flatMap((serviceId) => {
    const item = itemById.get(serviceId);
    if (!item) {
      return [];
    }
    return [
      {
        itemId: serviceId,
        itemKind: item.kind,
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

  let referenceCode: string;
  try {
    const persistence = await prisma.$transaction(
      async (tx) => {
        const lockKey = pavilionReservationDedupeLockKey({
          eventName: parsed.data.eventName,
          requesterEmail: parsed.data.requesterEmail,
        });
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        if (
          await hasRecentMatchingReservationRequest({
            db: tx,
            eventName: parsed.data.eventName,
            now,
            requesterEmail: parsed.data.requesterEmail,
          })
        ) {
          return { kind: 'rate_limited' as const };
        }

        const nextReferenceCode = await generateReferenceCode(tx);
        await tx.pavilionReservationRequest.create({
          data: {
            referenceCode: nextReferenceCode,
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

        return { kind: 'created' as const, referenceCode: nextReferenceCode };
      },
      {
        maxWait: PAVILION_RESERVATION_SUBMIT_TX_MAX_WAIT_MS,
        timeout: PAVILION_RESERVATION_SUBMIT_TX_TIMEOUT_MS,
      }
    );

    if (persistence.kind === 'rate_limited') {
      return { status: 'error', errors: ['error_rate_limited'] };
    }
    ({ referenceCode } = persistence);
  } catch (error) {
    unstable_rethrow(error);
    return unknownErrorState(error);
  }

  after(async () => {
    try {
      await enqueuePavilionReservationSubmittedEmail(getDefaultQueue(), {
        referenceCode,
      });
    } catch (error) {
      logger.error(
        '[pavilion-reservation:create-email-enqueue] reference_code={referenceCode} error_name={errorName} error_code={errorCode}',
        {
          errorCode: safeErrorCode(error) ?? 'unknown',
          errorName: safeErrorName(error),
          referenceCode,
        }
      );
    }
  });

  revalidatePath(getI18nPath(adminPavilionReservationIndexPath(), locale));
  return { status: 'confirmed', referenceCode, errors: [] };
}
