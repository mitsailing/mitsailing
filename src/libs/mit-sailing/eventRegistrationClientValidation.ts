import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';
import { isValidEmailAddress } from '@/utils/emailValidation';
import { normalizeUsPhone } from '@/utils/phoneValidation';

const formDataString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const formDataHasTrue = (formData: FormData, name: string) =>
  formData.getAll(name).includes('true');

const teamBoatMemberFieldName = (props: {
  readonly boatNumber: number;
  readonly boatsPerTeam: number;
  readonly position: number;
  readonly suffix: 'email' | 'name';
}) => {
  if (props.boatsPerTeam === 1) {
    return `teamBoatMember_${props.position}_${props.suffix}`;
  }
  return `teamBoatMember_${props.boatNumber}_${props.position}_${props.suffix}`;
};

function collectTeamRegistrationFieldErrors(options: {
  readonly event: PublicEventDetail;
  readonly fieldErrors: Record<string, EventRegistrationMutationCode>;
  readonly formData: FormData;
}) {
  if (!options.event.teamRegistration.usesTeamRegistration) {
    return;
  }
  if (formDataString(options.formData, 'teamName') === '') {
    options.fieldErrors.teamName = 'questions_required';
  }
  const { boatsPerTeam } = options.event.teamRegistration;
  const { personsPerBoat } = options.event.teamRegistration;
  for (let boatIndex = 0; boatIndex < boatsPerTeam; boatIndex += 1) {
    const boatNumber = boatIndex + 1;
    for (let position = 0; position < personsPerBoat; position += 1) {
      const nameField = teamBoatMemberFieldName({
        boatNumber,
        boatsPerTeam,
        position,
        suffix: 'name',
      });
      const emailField = teamBoatMemberFieldName({
        boatNumber,
        boatsPerTeam,
        position,
        suffix: 'email',
      });
      if (formDataString(options.formData, nameField) === '') {
        options.fieldErrors[nameField] = 'questions_required';
      }
      const email = formDataString(options.formData, emailField);
      if (email === '') {
        options.fieldErrors[emailField] = 'questions_required';
      } else if (!isValidEmailAddress(email)) {
        options.fieldErrors[emailField] = 'answers_invalid';
      }
    }
  }
}

function collectRequiredQuestionFieldErrors(options: {
  readonly event: PublicEventDetail;
  readonly fieldErrors: Record<string, EventRegistrationMutationCode>;
  readonly formData: FormData;
}) {
  for (const question of options.event.registrationQuestions) {
    if (!question.required) {
      continue;
    }
    const name = `question_${question.id}`;
    if (question.answerType === 'checkbox') {
      if (!formDataHasTrue(options.formData, name)) {
        options.fieldErrors[name] = 'questions_required';
      }
      continue;
    }
    if (formDataString(options.formData, name) === '') {
      options.fieldErrors[name] = 'questions_required';
    }
  }
}

/**
 * Collects client-side required-field errors before a server registration action.
 *
 * @param props - Event definition and submitted FormData
 * @returns Field-name → mutation code map (empty when client checks pass)
 */
export function collectEventRegistrationClientFieldErrors(props: {
  readonly event: PublicEventDetail;
  readonly formData: FormData;
}): Record<string, EventRegistrationMutationCode> {
  const fieldErrors: Record<string, EventRegistrationMutationCode> = {};

  if (props.event.entryFees.length > 1) {
    const feeId = formDataString(props.formData, 'eventEntryFeeId');
    if (feeId === '') {
      fieldErrors.eventEntryFeeId = 'questions_required';
    }
  }

  collectTeamRegistrationFieldErrors({
    event: props.event,
    fieldErrors,
    formData: props.formData,
  });
  collectRequiredQuestionFieldErrors({
    event: props.event,
    fieldErrors,
    formData: props.formData,
  });

  const phone = formDataString(props.formData, 'phone');
  if (phone === '') {
    fieldErrors.phone = 'questions_required';
  } else if (!normalizeUsPhone(phone).ok) {
    fieldErrors.phone = 'answers_invalid';
  }

  if (!formDataHasTrue(props.formData, 'swimAgreementAccepted')) {
    fieldErrors.swimAgreementAccepted = 'swim_agreement_required';
  }

  return fieldErrors;
}
