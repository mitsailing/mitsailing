import 'server-only';
import { prisma } from '@/libs/DB';
import { isoCalendarDateFromPrismaDate } from '@/libs/mit-sailing/isoCalendarDate';
import { pavilionReservationDraftWizardStepFromContact } from '@/libs/mit-sailing/pavilionReservationDraftTypes';
import type { PavilionReservationWizardDraft } from '@/libs/mit-sailing/pavilionReservationDraftTypes';
import type { PavilionReservationPersonaValue } from '@/libs/mit-sailing/pavilionReservationTypes';

export type PavilionReservationResumeSeed = Readonly<{
  draft: PavilionReservationWizardDraft;
  requestId: string;
  resumeToken: string;
}>;

/**
 * Loads an incomplete draft for `/reserve?resume=`.
 *
 * @param token - Opaque resume token
 * @returns Wizard seed or null when missing/not draft
 */
export async function findPavilionReservationDraftByResumeToken(
  token: string
): Promise<PavilionReservationResumeSeed | null> {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const reservation = await prisma.pavilionReservationRequest.findFirst({
    select: {
      advisorEmail: true,
      advisorName: true,
      costCenter: true,
      description: true,
      eventName: true,
      firstName: true,
      groupName: true,
      groupSize: true,
      hasTent: true,
      id: true,
      lastName: true,
      mitAccount: true,
      mitId: true,
      persona: true,
      phone: true,
      projectTitle: true,
      requesterEmail: true,
      resumeToken: true,
      servesAlcohol: true,
      services: { select: { itemId: true } },
      slots: {
        orderBy: { displayOrder: 'asc' },
        select: {
          endMinutes: true,
          id: true,
          itemId: true,
          requestedDate: true,
          startMinutes: true,
        },
      },
    },
    where: { resumeToken: trimmed, status: 'draft' },
  });

  if (!reservation || !reservation.resumeToken) {
    return null;
  }

  return {
    requestId: reservation.id,
    resumeToken: reservation.resumeToken,
    draft: {
      contact: {
        advisorEmail: reservation.advisorEmail ?? '',
        advisorName: reservation.advisorName ?? '',
        costCenter: reservation.costCenter ?? '',
        description: reservation.description,
        eventName: reservation.eventName,
        firstName: reservation.firstName,
        groupName: reservation.groupName ?? '',
        groupSize:
          reservation.groupSize === null ? '' : String(reservation.groupSize),
        hasTent: reservation.hasTent,
        lastName: reservation.lastName,
        mitAccount: reservation.mitAccount ?? '',
        mitId: reservation.mitId ?? '',
        phone: reservation.phone,
        projectTitle: reservation.projectTitle ?? '',
        servesAlcohol: reservation.servesAlcohol,
      },
      persona: reservation.persona as PavilionReservationPersonaValue,
      requesterEmail: reservation.requesterEmail,
      selectedServiceIds: reservation.services.map((service) => service.itemId),
      slots: reservation.slots.map((slot) => ({
        date: isoCalendarDateFromPrismaDate(slot.requestedDate),
        endMinutes: slot.endMinutes,
        id: slot.id,
        itemId: slot.itemId,
        startMinutes: slot.startMinutes,
      })),
      step: pavilionReservationDraftWizardStepFromContact(reservation),
    },
  };
}
