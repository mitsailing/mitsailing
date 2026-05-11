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
import { eventRegistrationErrorMessage } from '@/libs/mit-sailing/eventRegistrationErrors';
import type { PublicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';

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

function RegistrationNote(props: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-mit-text/70 dark:text-white">
      {props.children}
    </p>
  );
}

type RegistrationStatusPillTone = 'good' | 'warning' | 'muted';

const registrationStatusPillToneClassName: Record<
  RegistrationStatusPillTone,
  string
> = {
  good: 'bg-mit-success/10 text-mit-success',
  warning: 'bg-mit-warning/10 text-mit-warning',
  muted: 'bg-muted text-muted-foreground',
};

function RegistrationStatusPill(props: {
  children: React.ReactNode;
  tone: RegistrationStatusPillTone;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
        registrationStatusPillToneClassName[props.tone]
      )}
    >
      {props.children}
    </div>
  );
}

export function EventRegistrationCta(props: EventRegistrationCtaProps) {
  const errorMessage = eventRegistrationErrorMessage(props.errorCode, props.t);
  const registrationHref = `/events/${props.event.slug}/register`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(registrationHref)}`;

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
      <Button asChild className="w-full" size="lg" variant="mit">
        <Link href={registrationHref}>
          {props.event.requiresApproval
            ? props.t('registration_request_button')
            : props.t('registration_register_button')}
        </Link>
      </Button>
    </div>
  );
}
