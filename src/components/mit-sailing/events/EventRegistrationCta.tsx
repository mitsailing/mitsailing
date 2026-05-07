import { Check, Clock, LogIn, X } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import type {
  PublicEventDetail,
  PublicEventRegistrationState,
} from '@/libs/mit-sailing/eventQueries';
import { cancelPublicEventRegistrationAction } from '@/libs/mit-sailing/eventRegistrationActions';
import type { PublicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import { EventRegistrationLightbox } from './EventRegistrationLightbox';
import type { EventRegistrationLightboxLabels } from './EventRegistrationLightbox';

type EventRegistrationTranslations = Awaited<
  ReturnType<typeof getTranslations<'MitSailingEvents'>>
>;

type EventRegistrationCtaProps = {
  currentRegistration: PublicEventRegistrationState | null;
  event: PublicEventDetail;
  errorCode: string | null;
  isSignedIn: boolean;
  locale: string;
  registrationCloses: string;
  registrationOpens: string;
  reservationState: PublicEventReservationState;
  t: EventRegistrationTranslations;
};

function registrationErrorMessage(
  code: string | null,
  t: EventRegistrationTranslations
): string | null {
  if (code === 'closed') {
    return t('registration_error_closed');
  }
  if (code === 'full') {
    return t('registration_error_full');
  }
  if (code === 'questions_required') {
    return t('registration_error_questions_required');
  }
  if (code === 'swim_agreement_required') {
    return t('registration_error_swim_agreement_required');
  }
  if (code === 'not_found') {
    return t('registration_error_not_found');
  }
  if (code === 'unknown') {
    return t('registration_error_unknown');
  }
  return null;
}

function lightboxLabels(
  t: EventRegistrationTranslations
): EventRegistrationLightboxLabels {
  return {
    autoApprovalNote: t('registration_auto_approval_note'),
    cancel: t('registration_dialog_cancel'),
    checkboxLabel: t('registration_checkbox_label'),
    close: t('registration_dialog_close'),
    confirmButton: t('registration_confirm_button'),
    deposit: t('fee_deposit'),
    dialogEyebrow: t('registration_dialog_eyebrow'),
    feesHeading: t('section_fees'),
    questionsHeading: t('section_questions'),
    registerButton: t('registration_register_button'),
    requestButton: t('registration_request_button'),
    required: t('question_required'),
    requiresApprovalNote: t('registration_requires_approval_note'),
    selectPlaceholder: t('registration_select_placeholder'),
    submitRequestButton: t('registration_submit_request_button'),
    swimAgreementHeading: t('registration_swim_agreement_heading'),
    swimAgreementLabel: t('registration_swim_agreement_label'),
  };
}

function RegistrationNote(props: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-mit-text/70">{props.children}</p>
  );
}

function RegistrationStatusPill(props: {
  children: React.ReactNode;
  tone: 'good' | 'warning' | 'muted';
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
        props.tone === 'good' ? 'bg-emerald-50 text-emerald-900' : null,
        props.tone === 'warning' ? 'bg-amber-50 text-amber-900' : null,
        props.tone === 'muted' ? 'bg-muted text-mit-text' : null
      )}
    >
      {props.children}
    </div>
  );
}

export function EventRegistrationCta(props: EventRegistrationCtaProps) {
  const errorMessage = registrationErrorMessage(props.errorCode, props.t);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/events/${props.event.slug}`)}`;

  if (props.reservationState === 'approved') {
    const cancelAction = cancelPublicEventRegistrationAction.bind(
      null,
      props.locale,
      props.event.slug
    );
    return (
      <div className="flex flex-col items-start gap-2">
        <RegistrationStatusPill tone="good">
          <Check aria-hidden className="size-4" />
          {props.t('registration_status_going')}
        </RegistrationStatusPill>
        <form action={cancelAction}>
          <Button size="sm" type="submit" variant="link">
            {props.t('registration_cancel_button')}
          </Button>
        </form>
      </div>
    );
  }

  if (props.reservationState === 'pending') {
    const cancelAction = cancelPublicEventRegistrationAction.bind(
      null,
      props.locale,
      props.event.slug
    );
    return (
      <div className="flex flex-col items-start gap-2">
        <RegistrationStatusPill tone="warning">
          <Clock aria-hidden className="size-4" />
          {props.t('registration_status_pending')}
        </RegistrationStatusPill>
        <form action={cancelAction}>
          <Button size="sm" type="submit" variant="outline">
            {props.t('registration_cancel_request_button')}
          </Button>
        </form>
      </div>
    );
  }

  if (props.reservationState === 'opening_later') {
    return (
      <RegistrationStatusPill tone="muted">
        <Clock aria-hidden className="size-4" />
        {props.t('registration_opening_on', {
          date: props.registrationOpens,
        })}
      </RegistrationStatusPill>
    );
  }

  if (props.reservationState === 'closed') {
    return (
      <RegistrationStatusPill tone="muted">
        <X aria-hidden className="size-4" />
        {props.t('registration_closed')}
      </RegistrationStatusPill>
    );
  }

  if (props.reservationState === 'full') {
    return (
      <RegistrationStatusPill tone="muted">
        <X aria-hidden className="size-4" />
        {props.t('registration_full')}
      </RegistrationStatusPill>
    );
  }

  if (!props.isSignedIn) {
    return (
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full" size="lg" variant="mit">
          <Link href={loginHref}>
            <LogIn aria-hidden className="size-4" />
            {props.t('registration_login_button')}
          </Link>
        </Button>
        <RegistrationNote>
          {props.t('registration_login_note')}
        </RegistrationNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {errorMessage ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      <EventRegistrationLightbox
        event={props.event}
        labels={lightboxLabels(props.t)}
        locale={props.locale}
      />
    </div>
  );
}
