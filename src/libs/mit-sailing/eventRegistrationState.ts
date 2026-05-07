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

function publicEventIsAtCapacity(event: PublicEventDetail): boolean {
  const reservedSlots =
    event.approvedRegistrationCount + event.pendingRegistrationCount;
  return (
    event.maxParticipants !== null && reservedSlots >= event.maxParticipants
  );
}

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
    options.now > options.event.registrationEnd
  ) {
    return 'closed';
  }
  if (publicEventIsAtCapacity(options.event)) {
    return 'full';
  }
  return 'available';
}
