import type { getTranslations } from 'next-intl/server';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { AdminStatusSemanticTone } from '@/lib/mit-sailing/tokens';
import type {
  AdminEventRegistrationCounts,
  AdminEventRegistrationDto,
  AdminEventRegistrationsDto,
} from '@/libs/admin/events/eventAdminQueries';

export type AdminEventRegistrationsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

export type RegistrationFilter = 'all' | 'pending' | 'approved' | 'cancelled';

export type RegistrationQuestionColumn = {
  id: string;
  questionText: string;
  displayOrder: number;
};

export const registrationFilters: RegistrationFilter[] = [
  'all',
  EventRegistrationStatus.pending,
  EventRegistrationStatus.approved,
  EventRegistrationStatus.cancelled,
];

export function hasPhoneColumn(event: AdminEventRegistrationsDto): boolean {
  return (
    event.requiresPhone ||
    event.registrations.some(
      (registration) => (registration.phone ?? '').trim().length > 0
    )
  );
}

export function hasFeeColumn(event: AdminEventRegistrationsDto): boolean {
  return (
    (event.entryFees?.length ?? 0) > 0 ||
    event.registrations.some(
      (registration) => (registration.entryFee ?? null) !== null
    )
  );
}

export function hasTeamBoatColumn(event: AdminEventRegistrationsDto): boolean {
  return (
    event.usesTeamRegistration ||
    event.registrations.some(
      (registration) =>
        registration.registrationTeam !== null ||
        registration.boatMembers.length > 0
    )
  );
}

export function countForFilter(
  filter: RegistrationFilter,
  counts: AdminEventRegistrationCounts
): number {
  if (filter === 'all') {
    return counts.pending + counts.approved + counts.cancelled;
  }
  return counts[filter];
}

export function registrationVisible(
  registration: AdminEventRegistrationDto,
  filter: RegistrationFilter
): boolean {
  return filter === 'all' || registration.status === filter;
}

export function statusLabel(
  status: RegistrationFilter,
  t: AdminEventRegistrationsTranslations
): string {
  if (status === 'all') {
    return t('registration_filter_all');
  }
  if (status === EventRegistrationStatus.pending) {
    return t('registration_status_pending');
  }
  if (status === EventRegistrationStatus.approved) {
    return t('registration_status_approved');
  }
  return t('registration_status_cancelled');
}

export function emptyStatusMessage(
  status: Exclude<RegistrationFilter, 'all'>,
  t: AdminEventRegistrationsTranslations
): string {
  if (status === EventRegistrationStatus.approved) {
    return t('registrations_empty_status_approved');
  }
  if (status === EventRegistrationStatus.pending) {
    return t('registrations_empty_status_pending');
  }
  return t('registrations_empty_status_cancelled');
}

export function registrationStatusTone(
  status: AdminEventRegistrationDto['status']
): AdminStatusSemanticTone {
  if (status === EventRegistrationStatus.approved) {
    return 'success';
  }
  if (status === EventRegistrationStatus.cancelled) {
    return 'danger';
  }
  return 'neutral';
}

export function registrationQuestionColumns(
  event: AdminEventRegistrationsDto
): RegistrationQuestionColumn[] {
  const columns = new Map<string, RegistrationQuestionColumn>();
  for (const question of event.questions) {
    columns.set(question.id, {
      displayOrder: question.displayOrder,
      id: question.id,
      questionText: question.questionText,
    });
  }
  for (const registration of event.registrations) {
    for (const answer of registration.answers) {
      if (!columns.has(answer.question.id)) {
        columns.set(answer.question.id, answer.question);
      }
    }
  }
  return [...columns.values()].toSorted(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.questionText.localeCompare(b.questionText)
  );
}

export function answerValueForQuestion(
  registration: AdminEventRegistrationDto,
  questionId: string,
  t: AdminEventRegistrationsTranslations
): string {
  const answer = registration.answers.find(
    (registrationAnswer) => registrationAnswer.question.id === questionId
  );
  if (!answer || answer.value.trim().length === 0) {
    return t('empty_value');
  }
  return answer.value;
}
