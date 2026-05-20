import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type {
  PublicEventDetail,
  PublicEventRegistrationState,
} from '@/libs/mit-sailing/eventQueries';
import { publicRegistrationWindowPhase } from '@/libs/mit-sailing/eventRegistrationWindow';

export type PublicEventReservationState =
  | 'external'
  | 'unavailable'
  | 'approved'
  | 'pending'
  | 'opening_later'
  | 'closed'
  | 'full'
  | 'available';

function publicEventIsAtAcceptedCapacity(event: PublicEventDetail): boolean {
  return (
    !event.requiresApproval &&
    event.maxParticipants !== null &&
    event.approvedRegistrationCount >= event.maxParticipants
  );
}

function currentRegistrationReservationState(
  status: PublicEventRegistrationState['status'] | undefined
): 'approved' | 'pending' | null {
  if (status === EventRegistrationStatus.approved) {
    return 'approved';
  }
  if (status === EventRegistrationStatus.pending) {
    return 'pending';
  }
  if (status === EventRegistrationStatus.cancelled) {
    return null;
  }
  return null;
}

/**
 * Resolves public registration state in priority order: external/disabled
 * registration mode, existing active registration, registration window,
 * registration end, accepted capacity for auto-approved events (approved count
 * only; pending does not consume capacity), then available fallback.
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
    options.event.registrationMode === 'external' &&
    options.event.externalRegistrationUrl
  ) {
    return 'external';
  }
  if (options.event.registrationMode === 'none') {
    return 'unavailable';
  }
  const currentRegistrationState = currentRegistrationReservationState(
    options.currentRegistration?.status
  );
  if (currentRegistrationState !== null) {
    return currentRegistrationState;
  }
  const windowPhase = publicRegistrationWindowPhase({
    now: options.now,
    registrationStart: options.event.registrationStart,
    registrationEnd: options.event.registrationEnd,
  });
  if (windowPhase === 'before_start') {
    return 'opening_later';
  }
  if (windowPhase === 'after_end') {
    return 'closed';
  }
  if (publicEventIsAtAcceptedCapacity(options.event)) {
    return 'full';
  }
  return 'available';
}
