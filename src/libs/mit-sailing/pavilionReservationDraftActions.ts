'use server';

import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import type { PrismaClient } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import {
  generatePavilionReservationReferenceCode,
  mapPavilionReservableItemsById,
} from '@/libs/mit-sailing/pavilionReservationCatalogHelpers';
import { findPavilionReservationDraftByResumeTokenRow } from '@/libs/mit-sailing/pavilionReservationDraftCleanup';
import { findPavilionReservationDraftByResumeToken } from '@/libs/mit-sailing/pavilionReservationDraftQueries';
import type { PavilionReservationResumeSeed } from '@/libs/mit-sailing/pavilionReservationDraftQueries';
import type {
  UpsertPavilionReservationDraftInput,
  UpsertPavilionReservationDraftResult,
} from '@/libs/mit-sailing/pavilionReservationDraftTypes';
import { listVisiblePavilionReservableItems } from '@/libs/mit-sailing/pavilionReservationQueries';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';
import { getDefaultQueue } from '@/worker/defaultQueue';
import { enqueuePavilionReservationAbandonEmail } from '@/worker/pavilionReservationAbandonEmailJob';

export type {
  UpsertPavilionReservationDraftInput,
  UpsertPavilionReservationDraftResult,
} from '@/libs/mit-sailing/pavilionReservationDraftTypes';

type DraftRow = Readonly<{
  id: string;
  resumeToken: string | null;
  status: string;
}>;

function newResumeToken(): string {
  return randomBytes(32).toString('hex');
}

function groupSizeFromDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function resolveDraftForUpsert(
  tx: Pick<PrismaClient, 'pavilionReservationRequest'>,
  props: {
    requestId: string | null;
    resumeToken: string | null;
  }
): Promise<DraftRow | null | 'mismatch'> {
  const trimmedToken = props.resumeToken?.trim() ?? null;
  if (!trimmedToken) {
    return null;
  }

  const byToken = await findPavilionReservationDraftByResumeTokenRow(
    tx,
    trimmedToken
  );
  if (!byToken) {
    return null;
  }

  const requestId = props.requestId?.trim() ?? null;
  if (requestId && byToken.id !== requestId) {
    return 'mismatch';
  }

  return byToken;
}

/**
 * Loads a draft seed for same-tab session resume using a stored token.
 *
 * @param resumeToken - Opaque resume token from sessionStorage
 * @returns Wizard seed or null when missing/not draft
 */
export async function loadPavilionReservationDraftByResumeTokenAction(
  resumeToken: string
): Promise<PavilionReservationResumeSeed | null> {
  const seed = await findPavilionReservationDraftByResumeToken(resumeToken);
  return seed;
}

/**
 * Creates or updates an incomplete pavilion reservation (`status = draft`).
 *
 * @param input - Wizard draft payload
 * @returns Request id and resume token when saved
 */
export async function upsertPavilionReservationDraftAction(
  input: UpsertPavilionReservationDraftInput
): Promise<UpsertPavilionReservationDraftResult> {
  const requesterEmail = normalizeEmailAddress(input.requesterEmail);
  if (!isValidEmailAddress(requesterEmail)) {
    return { ok: false };
  }

  try {
    const catalog = await listVisiblePavilionReservableItems();
    const itemById = mapPavilionReservableItemsById(catalog);
    const { contact } = input;
    const slotRows = input.slots.flatMap((slot, index) => {
      const item = itemById.get(slot.itemId);
      const requestedDate = prismaDateFromIsoCalendar(slot.date);
      if (item?.kind !== 'space' || !requestedDate) {
        return [];
      }
      return [
        {
          displayOrder: index,
          endMinutes: slot.endMinutes,
          itemId: slot.itemId,
          itemKind: item.kind,
          requestedDate,
          startMinutes: slot.startMinutes,
        },
      ];
    });
    const serviceRows = [...new Set(input.selectedServiceIds)].flatMap(
      (serviceId) => {
        const item = itemById.get(serviceId);
        if (item?.kind !== 'service') {
          return [];
        }
        return [{ itemId: serviceId, itemKind: item.kind }];
      }
    );

    const saved = await prisma.$transaction(async (tx) => {
      const existingId = input.requestId?.trim() ?? null;
      if (existingId) {
        const requestedRow = await tx.pavilionReservationRequest.findUnique({
          select: { status: true },
          where: { id: existingId },
        });
        if (requestedRow && requestedRow.status !== 'draft') {
          return null;
        }
      }

      const contactData = {
        advisorEmail: contact.advisorEmail.trim() || null,
        advisorName: contact.advisorName.trim() || null,
        costCenter: contact.costCenter.trim() || null,
        description: contact.description,
        eventName: contact.eventName,
        firstName: contact.firstName,
        groupName: contact.groupName.trim() || null,
        groupSize: groupSizeFromDraft(contact.groupSize),
        hasTent: contact.hasTent,
        lastName: contact.lastName,
        mitAccount: contact.mitAccount.trim() || null,
        mitId: contact.mitId.trim() || null,
        persona: input.persona,
        phone: contact.phone,
        projectTitle: contact.projectTitle.trim() || null,
        requesterEmail,
        servesAlcohol: contact.servesAlcohol,
      };

      const existing = await resolveDraftForUpsert(tx, {
        requestId: existingId,
        resumeToken: input.resumeToken ?? null,
      });
      if (existing === 'mismatch') {
        return null;
      }

      if (existing?.status === 'draft') {
        const nextResumeToken = existing.resumeToken ?? newResumeToken();
        await tx.pavilionReservationSlot.deleteMany({
          where: { requestId: existing.id },
        });
        await tx.pavilionReservationService.deleteMany({
          where: { requestId: existing.id },
        });
        await tx.pavilionReservationRequest.update({
          data: {
            ...contactData,
            resumeToken: nextResumeToken,
            services: { create: serviceRows },
            slots: { create: slotRows },
            status: 'draft',
          },
          where: { id: existing.id },
        });
        return { requestId: existing.id, resumeToken: nextResumeToken };
      }

      const referenceCode = await generatePavilionReservationReferenceCode(tx);
      const resumeToken = newResumeToken();
      const created = await tx.pavilionReservationRequest.create({
        data: {
          ...contactData,
          referenceCode,
          resumeToken,
          services: { create: serviceRows },
          slots: { create: slotRows },
          status: 'draft',
        },
        select: { id: true },
      });
      return { requestId: created.id, resumeToken };
    });

    if (!saved) {
      return { ok: false };
    }

    after(async () => {
      try {
        await enqueuePavilionReservationAbandonEmail(getDefaultQueue(), {
          requestId: saved.requestId,
        });
      } catch (error) {
        logger.error(
          '[pavilion-reservation:abandon-email-enqueue] request_id={requestId} error_name={errorName} error_code={errorCode}',
          {
            errorCode: safeErrorCode(error) ?? 'unknown',
            errorName: safeErrorName(error),
            requestId: saved.requestId,
          }
        );
      }
    });

    return {
      ok: true,
      requestId: saved.requestId,
      resumeToken: saved.resumeToken,
    };
  } catch (error) {
    logger.error(
      '[pavilion-reservation:draft-upsert] error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
      }
    );
    return { ok: false };
  }
}
