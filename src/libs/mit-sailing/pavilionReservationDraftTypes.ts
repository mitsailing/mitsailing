import type { PavilionReservationPersonaValue } from '@/libs/mit-sailing/pavilionReservationTypes';

type PavilionReservationWizardDraftSlot = Readonly<{
  id: string;
  itemId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
}>;

type PavilionReservationWizardDraftContact = Readonly<{
  firstName: string;
  lastName: string;
  phone: string;
  eventName: string;
  groupName: string;
  groupSize: string;
  description: string;
  hasTent: boolean;
  servesAlcohol: boolean;
  projectTitle: string;
  advisorName: string;
  advisorEmail: string;
  costCenter: string;
  mitId: string;
  mitAccount: string;
}>;

export type PavilionReservationWizardDraft = Readonly<{
  step: 'contact' | 'spaces';
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  slots: PavilionReservationWizardDraftSlot[];
  selectedServiceIds: string[];
  contact: PavilionReservationWizardDraftContact;
}>;

export type UpsertPavilionReservationDraftInput = Readonly<{
  contact: PavilionReservationWizardDraftContact;
  persona: PavilionReservationPersonaValue;
  requestId?: string | null;
  requesterEmail: string;
  resumeToken?: string | null;
  selectedServiceIds: readonly string[];
  slots: readonly PavilionReservationWizardDraftSlot[];
  step: 'contact' | 'spaces';
}>;

export type UpsertPavilionReservationDraftResult =
  | { ok: true; requestId: string; resumeToken: string }
  | { ok: false };

/**
 * Infers wizard step from saved draft contact fields.
 *
 * @param contact - Draft contact fields from the database
 * @returns Wizard step seed for resume
 */
export function pavilionReservationDraftWizardStepFromContact(
  contact: Readonly<{
    advisorEmail: string | null;
    advisorName: string | null;
    costCenter: string | null;
    description: string;
    eventName: string;
    firstName: string;
    groupName: string | null;
    lastName: string;
    mitAccount: string | null;
    mitId: string | null;
    phone: string;
    projectTitle: string | null;
  }>
): 'contact' | 'spaces' {
  const hasContactProgress = [
    contact.firstName,
    contact.lastName,
    contact.phone,
    contact.eventName,
    contact.description,
    contact.groupName,
    contact.projectTitle,
    contact.advisorName,
    contact.advisorEmail,
    contact.costCenter,
    contact.mitId,
    contact.mitAccount,
  ].some((value) => (value?.trim() ?? '') !== '');

  return hasContactProgress ? 'contact' : 'spaces';
}
