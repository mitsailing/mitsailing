'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { createPublicEventRegistrationAction } from '@/libs/mit-sailing/eventRegistrationActions';

export type EventRegistrationLightboxLabels = {
  autoApprovalNote: string;
  cancel: string;
  checkboxLabel: string;
  close: string;
  confirmButton: string;
  deposit: string;
  dialogEyebrow: string;
  questionsHeading: string;
  registerButton: string;
  requestButton: string;
  required: string;
  requiresApprovalNote: string;
  selectPlaceholder: string;
  submitRequestButton: string;
  feesHeading: string;
  swimAgreementHeading: string;
  swimAgreementLabel: string;
};

type EventRegistrationLightboxProps = {
  event: PublicEventDetail;
  labels: EventRegistrationLightboxLabels;
  locale: string;
};

function QuestionField(props: {
  question: PublicEventDetail['registrationQuestions'][number];
  labels: EventRegistrationLightboxLabels;
}) {
  const name = `question_${props.question.id}`;
  return (
    <label className="flex flex-col gap-1.5 text-sm text-mit-text">
      <span className="font-semibold">
        {props.question.questionText}
        {props.question.required ? (
          <span
            aria-label={props.labels.required}
            className="ml-1 text-mit-red-ink"
          >
            *
          </span>
        ) : null}
      </span>
      {props.question.answerType === 'select' ? (
        <select
          className="min-h-9 rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
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
        <span className="flex items-center gap-2">
          <input
            className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            name={name}
            required={props.question.required}
            type="checkbox"
            value="true"
          />
          <span className="text-xs text-mit-text/70">
            {props.labels.checkboxLabel}
          </span>
        </span>
      ) : null}
      {props.question.answerType === 'text' ? (
        <Textarea
          className="min-h-20"
          name={name}
          required={props.question.required}
        />
      ) : null}
    </label>
  );
}

function SwimAgreementField(props: {
  labels: EventRegistrationLightboxLabels;
}) {
  return (
    <section aria-labelledby="event-registration-swim-heading">
      <h3
        className="mb-2 font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
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
      <label className="flex items-start gap-3 rounded-md border border-mit-line bg-background p-3 text-sm leading-relaxed text-mit-text">
        <input
          className="mt-0.5 size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
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
  labels: EventRegistrationLightboxLabels;
}) {
  if (props.event.registrationQuestions.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="event-registration-questions-dialog-heading">
      <h3
        className="mb-3 font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-questions-dialog-heading"
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
  labels: EventRegistrationLightboxLabels;
  locale: string;
}) {
  if (props.event.entryFees.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="event-registration-fees-dialog-heading"
      className="rounded-lg border border-mit-line bg-mit-surface/60 p-4"
    >
      <h3
        className="mb-3 font-mit-serif text-lg font-semibold tracking-tight text-mit-text"
        id="event-registration-fees-dialog-heading"
      >
        {props.labels.feesHeading}
      </h3>
      <dl className="m-0 space-y-2 p-0">
        {props.event.entryFees.map((fee) => (
          <div
            className="flex items-baseline justify-between gap-4 text-sm"
            key={fee.id}
          >
            <dt className="text-mit-text">
              {fee.description}
              {fee.isDeposit ? (
                <span className="ml-2 rounded-sm bg-mit-red-highlight px-1.5 py-0.5 text-xs font-semibold text-mit-red-ink">
                  {props.labels.deposit}
                </span>
              ) : null}
            </dt>
            <dd className="m-0 font-semibold text-mit-text">
              {new Intl.NumberFormat(props.locale, {
                style: 'currency',
                currency: 'USD',
              }).format(fee.amountCents / 100)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EventRegistrationLightbox(
  props: EventRegistrationLightboxProps
) {
  const action = createPublicEventRegistrationAction.bind(
    null,
    props.locale,
    props.event.slug
  );
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <Button className="w-full" size="lg" type="button" variant="mit">
          {props.event.requiresApproval
            ? props.labels.requestButton
            : props.labels.registerButton}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto px-4 py-8">
          <div className="mx-auto grid w-full max-w-2xl gap-0 rounded-lg border border-mit-line bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-mit-line px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-bold tracking-widest text-mit-red-ink uppercase">
                  {props.labels.dialogEyebrow}
                </p>
                <DialogPrimitive.Title className="font-mit-serif text-xl font-semibold tracking-tight text-mit-text">
                  {props.event.name}
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close
                aria-label={props.labels.close}
                className="rounded-sm p-1 text-mit-text hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                type="button"
              >
                <X aria-hidden className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <form action={action} className="flex flex-col gap-6 px-6 py-5">
              <SwimAgreementField labels={props.labels} />
              <RegistrationQuestions
                event={props.event}
                labels={props.labels}
              />
              <RegistrationFeeSummary
                event={props.event}
                labels={props.labels}
                locale={props.locale}
              />

              <p className="text-xs leading-relaxed text-mit-text/70">
                {props.event.requiresApproval
                  ? props.labels.requiresApprovalNote
                  : props.labels.autoApprovalNote}
              </p>

              <div className="flex justify-end gap-2 border-t border-mit-line pt-4">
                <DialogPrimitive.Close asChild>
                  <Button type="button" variant="ghost">
                    {props.labels.cancel}
                  </Button>
                </DialogPrimitive.Close>
                <Button type="submit" variant="mit">
                  {props.event.requiresApproval
                    ? props.labels.submitRequestButton
                    : props.labels.confirmButton}
                </Button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
