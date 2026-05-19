import type { getTranslations } from 'next-intl/server';
import { EventRegistrationForm as EventRegistrationFormClient } from '@/components/mit-sailing/events/EventRegistrationFormClient';
import type { EventRegistrationFormLabels } from '@/components/mit-sailing/events/EventRegistrationFormClient';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';

type EventRegistrationTranslations = Awaited<
  ReturnType<typeof getTranslations<'MitSailingEvents'>>
>;

export type { EventRegistrationFormLabels };
export { EventRegistrationFormClient as EventRegistrationForm };

export function eventRegistrationFormLabels(
  t: EventRegistrationTranslations
): EventRegistrationFormLabels {
  return {
    autoApprovalNote: t('registration_auto_approval_note'),
    confirmButton: t('registration_confirm_button'),
    deposit: t('fee_deposit'),
    errorMessages: {
      answers_invalid: t('registration_error_answers_invalid'),
      closed: t('registration_error_closed'),
      full: t('registration_error_full'),
      not_found: t('registration_error_not_found'),
      questions_required: t('registration_error_questions_required'),
      swim_agreement_required: t('registration_error_swim_agreement_required'),
      unknown: t('registration_error_unknown'),
    } satisfies Record<EventRegistrationMutationCode, string>,
    feesHeading: t('section_fees'),
    phoneHelp: t('registration_phone_help'),
    phoneLabel: t('registration_phone_label'),
    questionsHeading: t('section_questions'),
    required: t('question_required'),
    requiresApprovalNote: t('registration_requires_approval_note'),
    selectPlaceholder: t('registration_select_placeholder'),
    submitRequestButton: t('registration_submit_request_button'),
    swimAgreementHeading: t('registration_swim_agreement_heading'),
    swimAgreementLabel: t('registration_swim_agreement_label'),
    teamBoatEmailLabel: t('registration_team_boat_email_label'),
    teamBoatFullNameLabel: t('registration_team_boat_full_name_label'),
    teamBoatHeading: t('registration_team_boat_heading'),
    teamCrewLabel: t('registration_team_crew_label'),
    teamCrewNumberLabel: t('registration_team_crew_number_label'),
    teamHelmLabel: t('registration_team_helm_label'),
    teamNameLabel: t('registration_team_name_label'),
    teamSectionHeading: t('registration_team_section_heading'),
  };
}
