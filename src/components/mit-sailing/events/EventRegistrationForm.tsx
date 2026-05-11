import type { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { createPublicEventRegistrationAction } from '@/libs/mit-sailing/eventRegistrationActions';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

type EventRegistrationTranslations = Awaited<
  ReturnType<typeof getTranslations<'MitSailingEvents'>>
>;

export type EventRegistrationFormLabels = {
  autoApprovalNote: string;
  checkboxLabel: string;
  confirmButton: string;
  deposit: string;
  questionsHeading: string;
  required: string;
  requiresApprovalNote: string;
  selectPlaceholder: string;
  submitRequestButton: string;
  feesHeading: string;
  swimAgreementHeading: string;
  swimAgreementLabel: string;
};

export function eventRegistrationFormLabels(
  t: EventRegistrationTranslations
): EventRegistrationFormLabels {
  return {
    autoApprovalNote: t('registration_auto_approval_note'),
    checkboxLabel: t('registration_checkbox_label'),
    confirmButton: t('registration_confirm_button'),
    deposit: t('fee_deposit'),
    feesHeading: t('section_fees'),
    questionsHeading: t('section_questions'),
    required: t('question_required'),
    requiresApprovalNote: t('registration_requires_approval_note'),
    selectPlaceholder: t('registration_select_placeholder'),
    submitRequestButton: t('registration_submit_request_button'),
    swimAgreementHeading: t('registration_swim_agreement_heading'),
    swimAgreementLabel: t('registration_swim_agreement_label'),
  };
}

type EventRegistrationFormProps = {
  event: PublicEventDetail;
  labels: EventRegistrationFormLabels;
  locale: string;
};

const registrationSelectClassName =
  'min-h-9 rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-mit-text transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-white/45 dark:bg-white/5 dark:text-white dark:focus-visible:border-white dark:focus-visible:ring-white/30 dark:contrast-more:border-white';

const registrationCheckboxClassName =
  'size-4 rounded border border-input bg-background text-primary transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-white/45 dark:bg-white/5 dark:focus-visible:border-white dark:focus-visible:ring-white/30 dark:contrast-more:border-white';

function QuestionField(props: {
  question: PublicEventDetail['registrationQuestions'][number];
  labels: EventRegistrationFormLabels;
}) {
  const name = `question_${props.question.id}`;
  const checkboxId = `registration-question-${props.question.id}-checkbox`;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0 text-sm text-mit-text">
      <legend className="w-full px-0 font-semibold text-mit-text">
        {props.question.questionText}
        {props.question.required ? (
          <span
            aria-label={props.labels.required}
            className="ml-1 text-mit-red-ink"
          >
            *
          </span>
        ) : null}
      </legend>
      {props.question.answerType === 'select' ? (
        <select
          className={registrationSelectClassName}
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
      ) : null}
      {props.question.answerType === 'checkbox' ? (
        <label
          className="flex cursor-pointer items-center gap-2"
          htmlFor={checkboxId}
        >
          <input
            aria-required={props.question.required ? true : undefined}
            className={registrationCheckboxClassName}
            id={checkboxId}
            name={name}
            type="checkbox"
            value="true"
          />
          {props.question.required ? (
            <input name={name} type="hidden" value="false" />
          ) : null}
          <span className="text-xs text-mit-text/70 dark:text-white">
            {props.labels.checkboxLabel}
          </span>
        </label>
      ) : null}
      {props.question.answerType === 'text' ? (
        <Textarea
          className="min-h-20"
          name={name}
          required={props.question.required}
        />
      ) : null}
    </fieldset>
  );
}

function SwimAgreementField(props: { labels: EventRegistrationFormLabels }) {
  return (
    <section
      aria-labelledby="event-registration-swim-heading"
      className="flex flex-col gap-2"
    >
      <h3
        className="font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-swim-heading"
      >
        {props.labels.swimAgreementHeading}
        <span
          aria-label={props.labels.required}
          className="ml-1 text-mit-red-ink"
        >
          *
        </span>
      </h3>
      <label className="flex items-start gap-3 rounded-md border border-mit-line bg-background p-3 text-sm leading-relaxed text-mit-text dark:border-white/35 dark:bg-white/5 dark:text-white">
        <input
          className={`${registrationCheckboxClassName} mt-0.5`}
          name="swimAgreementAccepted"
          required
          type="checkbox"
          value="true"
        />
        <span>{props.labels.swimAgreementLabel}</span>
      </label>
    </section>
  );
}

function RegistrationQuestions(props: {
  event: PublicEventDetail;
  labels: EventRegistrationFormLabels;
}) {
  if (props.event.registrationQuestions.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="event-registration-questions-heading"
      className="border-t border-mit-line pt-4 dark:border-white/20"
    >
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
}) {
  if (props.event.entryFees.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="event-registration-fees-heading"
      className="rounded-lg border border-mit-line bg-mit-surface/60 p-4 dark:border-white/35 dark:bg-white/5"
    >
      <h3
        className="mb-3 font-mit-serif text-lg font-semibold tracking-tight text-mit-text dark:text-white"
        id="event-registration-fees-heading"
      >
        {props.labels.feesHeading}
      </h3>
      <dl className="m-0 space-y-2 p-0">
        {props.event.entryFees.map((fee) => (
          <div
            className="flex items-baseline justify-between gap-4 text-sm text-mit-text dark:text-white"
            key={fee.id}
          >
            <dt className="text-mit-text dark:text-white">
              {fee.description}
              {fee.isDeposit ? (
                <span className="ml-2 rounded-sm bg-mit-red-highlight px-1.5 py-0.5 text-xs font-semibold text-mit-red-ink">
                  {props.labels.deposit}
                </span>
              ) : null}
            </dt>
            <dd className="m-0 font-semibold text-mit-text dark:text-white">
              {formatUsdMinorUnitsAsCurrency(fee.amountCents, props.locale)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EventRegistrationForm(props: EventRegistrationFormProps) {
  const action = createPublicEventRegistrationAction.bind(
    null,
    props.locale,
    props.event.slug
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <SwimAgreementField labels={props.labels} />
      <RegistrationQuestions event={props.event} labels={props.labels} />
      <RegistrationFeeSummary
        event={props.event}
        labels={props.labels}
        locale={props.locale}
      />

      <p className="text-xs leading-relaxed text-mit-text/70 dark:text-white">
        {props.event.requiresApproval
          ? props.labels.requiresApprovalNote
          : props.labels.autoApprovalNote}
      </p>

      <Button className="w-full" type="submit" variant="mit">
        {props.event.requiresApproval
          ? props.labels.submitRequestButton
          : props.labels.confirmButton}
      </Button>
    </form>
  );
}
