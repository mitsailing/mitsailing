'use client';

import { Field, Label as HeadlessLabel } from '@headlessui/react';
import * as React from 'react';
import { useActionState } from 'react';
import { RegistrationBooleanSwitch } from '@/components/mit-sailing/events/RegistrationBooleanSwitch';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import type { PublicEventRegistrationFormState } from '@/libs/mit-sailing/eventRegistrationActions';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

export type EventRegistrationFormLabels = {
  autoApprovalNote: string;
  confirmButton: string;
  deposit: string;
  errorMessages: Record<EventRegistrationMutationCode, string>;
  questionsHeading: string;
  required: string;
  requiresApprovalNote: string;
  selectPlaceholder: string;
  submitRequestButton: string;
  feesHeading: string;
  phoneHelp: string;
  phoneLabel: string;
  swimAgreementHeading: string;
  swimAgreementLabel: string;
  teamBoatEmailLabel: string;
  teamBoatFullNameLabel: string;
  teamBoatHeading: string;
  teamCrewLabel: string;
  teamCrewNumberLabel: string;
  teamHelmLabel: string;
  teamNameLabel: string;
  teamSectionHeading: string;
};

type EventRegistrationCreateFormAction = (
  prevState: PublicEventRegistrationFormState,
  formData: FormData
) =>
  | PublicEventRegistrationFormState
  | Promise<PublicEventRegistrationFormState>;

type EventRegistrationFormProps = {
  createRegistrationAction: EventRegistrationCreateFormAction;
  event: PublicEventDetail;
  formPermalink: string;
  labels: EventRegistrationFormLabels;
  locale: string;
};

const registrationSelectClassName =
  'h-8 min-w-0 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm text-mit-text transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input-background dark:contrast-more:border-white';

const initialRegistrationFormState: PublicEventRegistrationFormState = {
  code: null,
  fieldErrors: {},
  status: 'idle',
  values: {},
};

function fieldValue(
  state: PublicEventRegistrationFormState,
  name: string
): string {
  return state.values[name]?.[0] ?? '';
}

function fieldValues(
  state: PublicEventRegistrationFormState,
  name: string
): string[] {
  return state.values[name] ?? [];
}

function fieldErrorMessage(props: {
  labels: EventRegistrationFormLabels;
  state: PublicEventRegistrationFormState;
  name: string;
}): string | null {
  const code = props.state.fieldErrors[props.name];
  return code ? props.labels.errorMessages[code] : null;
}

function FieldError(props: { id: string; message: string | null }) {
  if (!props.message) {
    return null;
  }
  return (
    <p
      className="text-sm font-medium text-destructive"
      data-registration-error="true"
      id={props.id}
    >
      {props.message}
    </p>
  );
}

function RequiredMarker(props: { label: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-1 text-mit-red dark:text-mit-red-ink"
      >
        *
      </span>
      <span className="sr-only"> {props.label}</span>
    </>
  );
}

function restoreInput(control: HTMLInputElement, values: string[]): void {
  if (control.hidden || control.type === 'hidden') {
    return;
  }
  if (control.type === 'checkbox' || control.type === 'radio') {
    control.checked = values.includes(control.value);
    return;
  }
  if (control.type === 'file') {
    return;
  }
  control.value = values[0] ?? '';
}

function restoreSelect(control: HTMLSelectElement, values: string[]): void {
  if (!control.multiple) {
    control.value = values[0] ?? '';
    return;
  }
  for (const option of control.options) {
    option.selected = values.includes(option.value);
  }
}

function restoreFormValues(
  form: HTMLFormElement,
  valuesByName: Record<string, string[]>
): void {
  for (const control of form.elements) {
    if (
      !(
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    const values = valuesByName[control.name];
    if (!values) {
      continue;
    }
    if (control instanceof HTMLInputElement) {
      restoreInput(control, values);
      continue;
    }
    if (control instanceof HTMLSelectElement) {
      restoreSelect(control, values);
      continue;
    }
    control.value = values[0] ?? '';
  }
}

function QuestionField(props: {
  question: PublicEventDetail['registrationQuestions'][number];
  labels: EventRegistrationFormLabels;
  state: PublicEventRegistrationFormState;
}) {
  const name = `question_${props.question.id}`;
  const controlId = `registration-question-${props.question.id}`;
  const switchId = `registration-question-${props.question.id}-switch`;
  const errorId = `${controlId}-error`;
  const errorMessage = fieldErrorMessage({
    labels: props.labels,
    name,
    state: props.state,
  });
  const describedBy = errorMessage ? errorId : undefined;
  const questionLabel = (
    <>
      {props.question.questionText}
      {props.question.required ? (
        <RequiredMarker label={props.labels.required} />
      ) : null}
    </>
  );

  return (
    <div className="flex min-w-0 scroll-mt-28 flex-col gap-2 text-sm text-mit-text">
      {props.question.answerType === 'select' ? (
        <>
          <label
            className="w-full px-0 font-semibold text-mit-text"
            htmlFor={controlId}
          >
            {questionLabel}
          </label>
          <select
            aria-describedby={describedBy}
            aria-invalid={errorMessage ? true : undefined}
            className={registrationSelectClassName}
            defaultValue={fieldValue(props.state, name)}
            id={controlId}
            name={name}
            required={props.question.required}
          >
            <option value="">{props.labels.selectPlaceholder}</option>
            {props.question.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FieldError id={errorId} message={errorMessage} />
        </>
      ) : null}
      {props.question.answerType === 'checkbox' ? (
        <>
          <Field className="flex items-start gap-3">
            <RegistrationBooleanSwitch
              aria-describedby={describedBy}
              aria-invalid={errorMessage ? true : undefined}
              aria-labelledby={controlId}
              aria-required={props.question.required}
              className="mt-0.5 shrink-0"
              defaultChecked={fieldValues(props.state, name).includes('true')}
              id={switchId}
              name={name}
            />
            <HeadlessLabel className="min-w-0 flex-1 cursor-pointer leading-relaxed font-normal text-mit-text">
              <span className="font-semibold text-mit-text" id={controlId}>
                {questionLabel}
              </span>
            </HeadlessLabel>
          </Field>
          <FieldError id={errorId} message={errorMessage} />
        </>
      ) : null}
      {props.question.answerType === 'text' ? (
        <>
          <label
            className="w-full px-0 font-semibold text-mit-text"
            htmlFor={controlId}
          >
            {questionLabel}
          </label>
          <Textarea
            aria-describedby={describedBy}
            aria-invalid={errorMessage ? true : undefined}
            className="min-h-20"
            defaultValue={fieldValue(props.state, name)}
            id={controlId}
            name={name}
            required={props.question.required}
          />
          <FieldError id={errorId} message={errorMessage} />
        </>
      ) : null}
    </div>
  );
}

function SwimAgreementField(props: {
  labels: EventRegistrationFormLabels;
  state: PublicEventRegistrationFormState;
}) {
  const errorId = 'event-registration-swim-error';
  const errorMessage = fieldErrorMessage({
    labels: props.labels,
    name: 'swimAgreementAccepted',
    state: props.state,
  });
  return (
    <section
      aria-labelledby="event-registration-swim-heading"
      className="flex scroll-mt-28 flex-col gap-2"
    >
      <h3
        className="font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-swim-heading"
      >
        {props.labels.swimAgreementHeading}
        <RequiredMarker label={props.labels.required} />
      </h3>
      <Field className="flex items-start gap-3 rounded-md border border-border bg-card p-4 text-sm text-mit-text">
        <RegistrationBooleanSwitch
          aria-describedby={
            errorMessage
              ? `event-registration-swim-agreement-copy ${errorId}`
              : 'event-registration-swim-agreement-copy'
          }
          aria-invalid={errorMessage ? true : undefined}
          aria-labelledby="event-registration-swim-heading event-registration-swim-agreement-copy"
          className="mt-0.5 shrink-0"
          defaultChecked={fieldValues(
            props.state,
            'swimAgreementAccepted'
          ).includes('true')}
          id="event-registration-swim-agreement-switch"
          name="swimAgreementAccepted"
        />
        <HeadlessLabel
          className="min-w-0 flex-1 cursor-pointer leading-relaxed font-normal text-mit-text"
          id="event-registration-swim-agreement-copy"
        >
          {props.labels.swimAgreementLabel}
        </HeadlessLabel>
      </Field>
      <FieldError id={errorId} message={errorMessage} />
    </section>
  );
}

function PhoneField(props: {
  labels: EventRegistrationFormLabels;
  state: PublicEventRegistrationFormState;
}) {
  const controlId = 'event-registration-phone';
  const errorId = `${controlId}-error`;
  const helpId = `${controlId}-help`;
  const errorMessage = fieldErrorMessage({
    labels: props.labels,
    name: 'phone',
    state: props.state,
  });
  const describedBy = errorMessage ? `${helpId} ${errorId}` : helpId;

  return (
    <div className="flex min-w-0 scroll-mt-28 flex-col gap-2 text-sm text-mit-text">
      <label
        className="w-full px-0 font-semibold text-mit-text"
        htmlFor={controlId}
      >
        {props.labels.phoneLabel}
        <RequiredMarker label={props.labels.required} />
      </label>
      <Input
        aria-describedby={describedBy}
        aria-invalid={errorMessage ? true : undefined}
        autoComplete="tel"
        defaultValue={fieldValue(props.state, 'phone')}
        id={controlId}
        name="phone"
        required
        type="tel"
      />
      <p className="text-xs leading-relaxed text-muted-foreground" id={helpId}>
        {props.labels.phoneHelp}
      </p>
      <FieldError id={errorId} message={errorMessage} />
    </div>
  );
}

function teamBoatMemberPositionLabel(props: {
  labels: EventRegistrationFormLabels;
  personsPerBoat: number;
  position: number;
}): string {
  if (props.position === 0) {
    return props.labels.teamHelmLabel;
  }
  if (props.position === 1 && props.personsPerBoat === 2) {
    return props.labels.teamCrewLabel;
  }
  return props.labels.teamCrewNumberLabel.replace(
    '{number}',
    String(props.position)
  );
}

function teamBoatHeading(props: {
  labels: EventRegistrationFormLabels;
  boatNumber: number;
}): string {
  return props.labels.teamBoatHeading.replace(
    '{number}',
    String(props.boatNumber)
  );
}

function teamBoatMemberFieldName(props: {
  boatNumber: number;
  boatsPerTeam: number;
  position: number;
  suffix: 'email' | 'name';
}): string {
  if (props.boatsPerTeam === 1) {
    return `teamBoatMember_${props.position}_${props.suffix}`;
  }
  return `teamBoatMember_${props.boatNumber}_${props.position}_${props.suffix}`;
}

function TeamBoatMemberField(props: {
  boatNumber: number;
  boatsPerTeam: number;
  labels: EventRegistrationFormLabels;
  personsPerBoat: number;
  position: number;
  state: PublicEventRegistrationFormState;
}) {
  const positionLabel = teamBoatMemberPositionLabel({
    labels: props.labels,
    personsPerBoat: props.personsPerBoat,
    position: props.position,
  });
  const nameFieldName = teamBoatMemberFieldName({
    boatNumber: props.boatNumber,
    boatsPerTeam: props.boatsPerTeam,
    position: props.position,
    suffix: 'name',
  });
  const emailFieldName = teamBoatMemberFieldName({
    boatNumber: props.boatNumber,
    boatsPerTeam: props.boatsPerTeam,
    position: props.position,
    suffix: 'email',
  });
  const nameControlId = `event-registration-${nameFieldName}`;
  const emailControlId = `event-registration-${emailFieldName}`;
  const nameErrorId = `${nameControlId}-error`;
  const emailErrorId = `${emailControlId}-error`;
  const nameErrorMessage = fieldErrorMessage({
    labels: props.labels,
    name: nameFieldName,
    state: props.state,
  });
  const emailErrorMessage = fieldErrorMessage({
    labels: props.labels,
    name: emailFieldName,
    state: props.state,
  });

  return (
    <div className="grid gap-2 rounded-md border border-border bg-card p-4 text-sm text-mit-text sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <label
          className="w-full px-0 font-semibold text-mit-text"
          htmlFor={nameControlId}
        >
          {positionLabel} {props.labels.teamBoatFullNameLabel}
        </label>
        <Input
          aria-describedby={nameErrorMessage ? nameErrorId : undefined}
          aria-invalid={nameErrorMessage ? true : undefined}
          autoComplete="name"
          defaultValue={fieldValue(props.state, nameFieldName)}
          id={nameControlId}
          name={nameFieldName}
          type="text"
        />
        <FieldError id={nameErrorId} message={nameErrorMessage} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <label
          className="w-full px-0 font-semibold text-mit-text"
          htmlFor={emailControlId}
        >
          {positionLabel} {props.labels.teamBoatEmailLabel}
        </label>
        <Input
          aria-describedby={emailErrorMessage ? emailErrorId : undefined}
          aria-invalid={emailErrorMessage ? true : undefined}
          autoComplete="email"
          defaultValue={fieldValue(props.state, emailFieldName)}
          id={emailControlId}
          name={emailFieldName}
          type="email"
        />
        <FieldError id={emailErrorId} message={emailErrorMessage} />
      </div>
    </div>
  );
}

function TeamRegistrationFields(props: {
  event: PublicEventDetail;
  labels: EventRegistrationFormLabels;
  state: PublicEventRegistrationFormState;
}) {
  if (!props.event.teamRegistration.usesTeamRegistration) {
    return null;
  }
  const teamNameErrorId = 'event-registration-team-name-error';
  const teamNameErrorMessage = fieldErrorMessage({
    labels: props.labels,
    name: 'teamName',
    state: props.state,
  });

  return (
    <section
      aria-labelledby="event-registration-team-heading"
      className="flex scroll-mt-28 flex-col gap-4"
    >
      <h3
        className="font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-team-heading"
      >
        {props.labels.teamSectionHeading}
      </h3>
      <div className="flex min-w-0 flex-col gap-2 text-sm text-mit-text">
        <label
          className="w-full px-0 font-semibold text-mit-text"
          htmlFor="event-registration-team-name"
        >
          {props.labels.teamNameLabel}
          <RequiredMarker label={props.labels.required} />
        </label>
        <Input
          aria-describedby={teamNameErrorMessage ? teamNameErrorId : undefined}
          aria-invalid={teamNameErrorMessage ? true : undefined}
          defaultValue={fieldValue(props.state, 'teamName')}
          id="event-registration-team-name"
          name="teamName"
          required
          type="text"
        />
        <FieldError id={teamNameErrorId} message={teamNameErrorMessage} />
      </div>
      {Array.from(
        { length: props.event.teamRegistration.boatsPerTeam },
        (_boatValue, boatIndex) => {
          const boatNumber = boatIndex + 1;
          const headingId = `event-registration-team-boat-${boatNumber}-heading`;
          return (
            <section
              aria-labelledby={headingId}
              className="flex flex-col gap-3"
              key={boatNumber}
            >
              <h4
                className="font-mit-serif text-base font-semibold tracking-tight text-mit-text"
                id={headingId}
              >
                {teamBoatHeading({
                  boatNumber,
                  labels: props.labels,
                })}
              </h4>
              {Array.from(
                { length: props.event.teamRegistration.personsPerBoat },
                (_value, position) => (
                  <TeamBoatMemberField
                    boatNumber={boatNumber}
                    boatsPerTeam={props.event.teamRegistration.boatsPerTeam}
                    key={`${boatNumber}-${position}`}
                    labels={props.labels}
                    personsPerBoat={props.event.teamRegistration.personsPerBoat}
                    position={position}
                    state={props.state}
                  />
                )
              )}
            </section>
          );
        }
      )}
    </section>
  );
}

function RegistrationQuestions(props: {
  event: PublicEventDetail;
  labels: EventRegistrationFormLabels;
  state: PublicEventRegistrationFormState;
}) {
  if (props.event.registrationQuestions.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="event-registration-questions-heading">
      <h3
        className="mb-3 font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-questions-heading"
      >
        {props.labels.questionsHeading}
      </h3>
      <div className="flex flex-col gap-4">
        {props.event.registrationQuestions.map((question) => (
          <QuestionField
            key={question.id}
            labels={props.labels}
            question={question}
            state={props.state}
          />
        ))}
      </div>
    </section>
  );
}

function RegistrationFeeSummary(props: {
  event: PublicEventDetail;
  labels: EventRegistrationFormLabels;
  locale: string;
  state: PublicEventRegistrationFormState;
}) {
  if (props.event.entryFees.length === 0) {
    return null;
  }
  const controlId = 'event-registration-fees';
  const errorId = `${controlId}-error`;
  const errorMessage = fieldErrorMessage({
    labels: props.labels,
    name: 'eventEntryFeeId',
    state: props.state,
  });
  if (props.event.entryFees.length > 1) {
    return (
      <fieldset
        aria-describedby={errorMessage ? errorId : undefined}
        aria-invalid={errorMessage ? true : undefined}
        aria-labelledby="event-registration-fees-heading"
        aria-required="true"
        className="rounded-lg border border-border bg-card p-4"
      >
        <legend
          className="mb-3 font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
          id="event-registration-fees-heading"
        >
          {props.labels.feesHeading}
          <RequiredMarker label={props.labels.required} />
        </legend>
        <div className="flex flex-col gap-2">
          {props.event.entryFees.map((fee) => (
            <label
              className="flex cursor-pointer items-baseline justify-between gap-4 rounded-md border border-border bg-background px-3 py-2 text-sm text-mit-text has-checked:border-mit-red has-checked:bg-mit-red-highlight/60"
              key={fee.id}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <input
                  className="size-4 shrink-0 accent-mit-red"
                  defaultChecked={
                    fieldValue(props.state, 'eventEntryFeeId') === fee.id
                  }
                  name="eventEntryFeeId"
                  required
                  type="radio"
                  value={fee.id}
                />
                <span className="min-w-0">
                  {fee.description}
                  {fee.isDeposit ? (
                    <span className="ml-2 rounded-sm bg-mit-red-highlight px-1.5 py-0.5 text-xs font-semibold text-mit-red dark:text-mit-red-ink">
                      {props.labels.deposit}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-mit-text">
                {formatUsdMinorUnitsAsCurrency(fee.amountCents, props.locale)}
              </span>
            </label>
          ))}
        </div>
        <FieldError id={errorId} message={errorMessage} />
      </fieldset>
    );
  }
  return (
    <section
      aria-labelledby="event-registration-fees-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h3
        className="mb-3 font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-fees-heading"
      >
        {props.labels.feesHeading}
      </h3>
      <dl className="m-0 space-y-2 p-0">
        {props.event.entryFees.map((fee) => (
          <div
            className="flex items-baseline justify-between gap-4 text-sm text-mit-text"
            key={fee.id}
          >
            <dt className="text-mit-text">
              {fee.description}
              {fee.isDeposit ? (
                <span className="ml-2 rounded-sm bg-mit-red-highlight px-1.5 py-0.5 text-xs font-semibold text-mit-red dark:text-mit-red-ink">
                  {props.labels.deposit}
                </span>
              ) : null}
            </dt>
            <dd className="m-0 font-semibold text-mit-text">
              {formatUsdMinorUnitsAsCurrency(fee.amountCents, props.locale)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EventRegistrationForm(props: EventRegistrationFormProps) {
  const [state, formAction] = useActionState(
    props.createRegistrationAction,
    initialRegistrationFormState,
    props.formPermalink
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const submitLabel = props.event.requiresApproval
    ? props.labels.submitRequestButton
    : props.labels.confirmButton;
  const formError =
    state.status === 'error' && Object.keys(state.fieldErrors).length === 0
      ? props.labels.errorMessages[state.code ?? 'unknown']
      : null;

  React.useEffect(() => {
    if (state.status !== 'error') {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    restoreFormValues(form, state.values);
    const target = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) {
      return;
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
      ref={formRef}
    >
      {formError ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-registration-error="true"
        >
          {formError}
        </p>
      ) : null}
      {props.event.requiresPhone ? (
        <PhoneField labels={props.labels} state={state} />
      ) : null}
      <TeamRegistrationFields
        event={props.event}
        labels={props.labels}
        state={state}
      />
      <SwimAgreementField labels={props.labels} state={state} />
      <RegistrationQuestions
        event={props.event}
        labels={props.labels}
        state={state}
      />
      <RegistrationFeeSummary
        event={props.event}
        labels={props.labels}
        locale={props.locale}
        state={state}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        {props.event.requiresApproval
          ? props.labels.requiresApprovalNote
          : props.labels.autoApprovalNote}
      </p>

      <SubmitButton
        className="w-full"
        pendingLabel={submitLabel}
        type="submit"
        variant="mit"
      >
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
