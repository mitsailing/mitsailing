import { Check, Clock, LogIn, X } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { Link } from '@/libs/I18nNavigation';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { eventRegistrationErrorMessage } from '@/libs/mit-sailing/eventRegistrationErrors';
import type { PublicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import { getI18nPath } from '@/utils/Helpers';

type EventRegistrationTranslations = Awaited<
  ReturnType<typeof getTranslations<'MitSailingEvents'>>
>;

/** Bound cancel handler supplied by the server parent (Next.js form `action`). */
type EventRegistrationCancelFormAction = (
  formData: FormData
) => void | Promise<void>;

type EventRegistrationCtaProps = {
  cancelRegistrationAction: EventRegistrationCancelFormAction;
  event: PublicEventDetail;
  errorCode: string | null;
  isSignedIn: boolean;
  locale: string;
  registrationOpens: string;
  reservationState: PublicEventReservationState;
  t: EventRegistrationTranslations;
};

function RegistrationNote(props: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {props.children}
    </p>
  );
}

function RegistrationErrorAlert(props: { message: string | null }) {
  if (!props.message) {
    return null;
  }
  return (
    <p
      className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      {props.message}
    </p>
  );
}

type RegistrationStatusPillTone = 'good' | 'warning' | 'muted';

const registrationStatusPillToneClassName: Record<
  RegistrationStatusPillTone,
  string
> = {
  good: 'bg-mit-success/10 text-mit-success-ink',
  warning: 'bg-mit-warning/10 text-mit-warning-ink',
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
  const registrationHref = getI18nPath(
    `/events/${encodeURIComponent(props.event.slug)}/register`,
    props.locale
  );
  const loginHref = authHrefWithCallback(
    getI18nPath('/login', props.locale),
    registrationHref
  );

  if (props.reservationState === 'approved') {
    return (
      <div className="flex flex-col items-start gap-2">
        <RegistrationErrorAlert message={errorMessage} />
        <RegistrationStatusPill tone="good">
          <Check aria-hidden className="size-4" />
          {props.t('registration_status_going')}
        </RegistrationStatusPill>
        <form action={props.cancelRegistrationAction}>
          <Button size="sm" type="submit" variant="link">
            {props.t('registration_cancel_button')}
          </Button>
        </form>
      </div>
    );
  }

  if (props.reservationState === 'pending') {
    return (
      <div className="flex flex-col items-start gap-2">
        <RegistrationErrorAlert message={errorMessage} />
        <RegistrationStatusPill tone="warning">
          <Clock aria-hidden className="size-4" />
          {props.t('registration_status_pending')}
        </RegistrationStatusPill>
        <form action={props.cancelRegistrationAction}>
          <Button size="sm" type="submit" variant="outline">
            {props.t('registration_cancel_request_button')}
          </Button>
        </form>
      </div>
    );
  }

  if (props.reservationState === 'opening_later') {
    return (
      <div className="flex flex-col items-start gap-2">
        <RegistrationErrorAlert message={errorMessage} />
        <RegistrationStatusPill tone="muted">
          <Clock aria-hidden className="size-4" />
          {props.t('registration_opening_on', {
            date: props.registrationOpens,
          })}
        </RegistrationStatusPill>
      </div>
    );
  }

  if (props.reservationState === 'closed') {
    return <RegistrationErrorAlert message={errorMessage} />;
  }

  if (props.reservationState === 'full') {
    return (
      <div className="flex flex-col items-start gap-2">
        <RegistrationErrorAlert message={errorMessage} />
        <RegistrationStatusPill tone="muted">
          <X aria-hidden className="size-4" />
          {props.t('registration_full')}
        </RegistrationStatusPill>
      </div>
    );
  }

  if (!props.isSignedIn) {
    return (
      <div className="flex flex-col gap-2">
        <RegistrationErrorAlert message={errorMessage} />
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
      <RegistrationErrorAlert message={errorMessage} />
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
