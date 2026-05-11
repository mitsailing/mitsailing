import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type {
  PublicEventDetail,
  PublicEventRegistrationState,
} from '@/libs/mit-sailing/eventQueries';

export type PublicEventReservationState =
  | 'external'
  | 'approved'
  | 'pending'
  | 'opening_later'
  | 'closed'
  | 'full'
  | 'available';

function publicEventIsAtAcceptedCapacity(event: PublicEventDetail): boolean {
  return (
    event.maxParticipants !== null &&
    event.approvedRegistrationCount >= event.maxParticipants
  );
}

/**
 * Resolves public registration state in priority order: external event detail,
 * existing approved or pending registration, registration window, registration
 * end, accepted capacity (approved count only — pending does not consume
 * capacity), then available fallback.
 *
 * @param options - Current registration, event detail, and comparison time
 * @returns Public reservation state for rendering and action guards
 */
export function publicEventReservationState(options: {
  currentRegistration: PublicEventRegistrationState | null;
  event: PublicEventDetail;
  now: Date;
}): PublicEventReservationState {
  if (
    options.event.detailPageKind === 'external' &&
    options.event.externalDetailUrl
  ) {
    return 'external';
  }
  if (
    options.currentRegistration?.status === EventRegistrationStatus.approved
  ) {
    return 'approved';
  }
  if (options.currentRegistration?.status === EventRegistrationStatus.pending) {
    return 'pending';
  }
  if (
    options.event.registrationStart &&
    options.now < options.event.registrationStart
  ) {
    return 'opening_later';
  }
  if (
    options.event.registrationEnd &&
    options.now >= options.event.registrationEnd
  ) {
    return 'closed';
  }
  if (publicEventIsAtAcceptedCapacity(options.event)) {
    return 'full';
  }
  return 'available';
}
