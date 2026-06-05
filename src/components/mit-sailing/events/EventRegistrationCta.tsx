import { ArrowRight, Check, Clock, CreditCard, LogIn, X } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { PaymentStatus } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { Link } from '@/libs/I18nNavigation';
import type {
  PublicEventDetail,
  PublicEventRegistrationState,
} from '@/libs/mit-sailing/eventQueries';
import { eventRegistrationErrorMessage } from '@/libs/mit-sailing/eventRegistrationErrors';
import type { PublicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';
import { eventUsesLearnToSailWaitlist } from '@/libs/mit-sailing/learnToSailEvents';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
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
  currentRegistration: PublicEventRegistrationState | null;
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
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:text-red-100"
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
      aria-live="polite"
      className={cn(
        'inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold motion-safe:transition-colors motion-reduce:transition-none sm:w-auto',
        registrationStatusPillToneClassName[props.tone]
      )}
      role="status"
    >
      {props.children}
    </div>
  );
}

function RegistrationOutcomeNote(props: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-mit-text">{props.children}</p>
  );
}

function isPaymentDue(
  payment: PublicEventRegistrationState['payment']
): payment is NonNullable<PublicEventRegistrationState['payment']> {
  return (
    payment !== null &&
    payment !== undefined &&
    (payment.status === PaymentStatus.checkout_created ||
      payment.status === PaymentStatus.past_due ||
      payment.status === PaymentStatus.pending)
  );
}

function learnToSailClassRequestsLabel(props: {
  count: number;
  t: EventRegistrationTranslations;
}): string {
  return props.t(
    props.count === 1
      ? 'learn_to_sail_class_request_one'
      : 'learn_to_sail_class_requests_many',
    { count: props.count }
  );
}

function learnToSailSpotsLabel(props: {
  count: number;
  t: EventRegistrationTranslations;
}): string {
  return props.t(
    props.count === 1 ? 'learn_to_sail_spot_one' : 'learn_to_sail_spots_many',
    { count: props.count }
  );
}

function LearnToSailWaitlistNote(props: {
  event: PublicEventDetail;
  t: EventRegistrationTranslations;
}) {
  if (!eventUsesLearnToSailWaitlist(props.event)) {
    return null;
  }
  const requestCount =
    props.event.pendingRegistrationCount +
    props.event.approvedRegistrationCount;
  return (
    <div className="rounded-lg border border-mit-red/30 bg-mit-red-highlight p-3 text-sm text-mit-readable-ink">
      <div className="mb-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-mit-red px-2 py-1 text-xs font-semibold text-white">
          {props.t('learn_to_sail_waitlist_badge')}
        </span>
        <span className="rounded-full bg-mit-red px-2 py-1 text-xs font-semibold text-white">
          {props.t('learn_to_sail_not_first_come')}
        </span>
        {requestCount > 0 ? (
          <span className="rounded-full border border-mit-line bg-background px-2 py-1 text-xs font-semibold text-mit-readable-ink">
            {learnToSailClassRequestsLabel({
              count: requestCount,
              t: props.t,
            })}
          </span>
        ) : null}
        {props.event.maxParticipants === null ? null : (
          <span className="rounded-full border border-mit-line bg-background px-2 py-1 text-xs font-semibold text-mit-readable-ink">
            {learnToSailSpotsLabel({
              count: props.event.maxParticipants,
              t: props.t,
            })}
          </span>
        )}
      </div>
      <p className="m-0 leading-relaxed font-medium">
        {props.t('learn_to_sail_request_rule')}
      </p>
    </div>
  );
}

type EventRegistrationCtaLinks = {
  readonly checkoutHref: string;
  readonly eventsHref: string;
  readonly loginHref: string;
  readonly registrationHref: string;
};

function eventRegistrationCtaLinks(props: {
  readonly event: PublicEventDetail;
  readonly locale: string;
}): EventRegistrationCtaLinks {
  const registrationHref = getI18nPath(
    `/events/${encodeURIComponent(props.event.slug)}/register`,
    props.locale
  );
  return {
    checkoutHref: getI18nPath(
      `/events/${encodeURIComponent(props.event.slug)}/checkout`,
      props.locale
    ),
    eventsHref: getI18nPath('/events', props.locale),
    loginHref: authHrefWithCallback(
      getI18nPath('/login', props.locale),
      registrationHref
    ),
    registrationHref,
  };
}

function CancelRegistrationForm(props: {
  readonly action: EventRegistrationCancelFormAction;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <form action={props.action} className="w-full sm:w-auto">
      <Button className="min-h-11 px-0" size="sm" type="submit" variant="link">
        {props.t('registration_cancel_button')}
      </Button>
    </form>
  );
}

function PaymentDueRecovery(props: {
  readonly checkoutHref: string;
  readonly locale: string;
  readonly payment: NonNullable<PublicEventRegistrationState['payment']>;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <div className="w-full rounded-lg border border-mit-line bg-muted/30 p-3">
      <p className="text-sm font-semibold text-foreground">
        {props.t('registration_payment_due', {
          amount: formatUsdMinorUnitsAsCurrency(
            props.payment.amountCents,
            props.locale
          ),
        })}
      </p>
      <Button asChild className="mt-3 min-h-11 w-full" size="sm" variant="mit">
        <Link href={props.checkoutHref}>
          <CreditCard aria-hidden className="size-4" />
          {props.t('registration_pay_button')}
        </Link>
      </Button>
    </div>
  );
}

function approvedRegistrationStatusLabel(props: {
  readonly paymentIsDue: boolean;
  readonly t: EventRegistrationTranslations;
  readonly usesLearnToSailWaitlist: boolean;
}) {
  if (props.paymentIsDue) {
    return props.t('registration_status_payment_due');
  }
  return props.t(
    props.usesLearnToSailWaitlist
      ? 'learn_to_sail_status_confirmed'
      : 'registration_status_going'
  );
}

function ApprovedRegistrationCta(props: {
  readonly cancelRegistrationAction: EventRegistrationCancelFormAction;
  readonly currentRegistration: PublicEventRegistrationState | null;
  readonly errorMessage: string | null;
  readonly links: EventRegistrationCtaLinks;
  readonly locale: string;
  readonly t: EventRegistrationTranslations;
  readonly usesLearnToSailWaitlist: boolean;
}) {
  const payment = props.currentRegistration?.payment ?? null;
  const paymentIsDue = isPaymentDue(payment);
  return (
    <div className="flex flex-col items-start gap-3">
      <RegistrationErrorAlert message={props.errorMessage} />
      <RegistrationStatusPill tone={paymentIsDue ? 'warning' : 'good'}>
        {paymentIsDue ? (
          <CreditCard aria-hidden className="size-4" />
        ) : (
          <Check aria-hidden className="size-4" />
        )}
        {approvedRegistrationStatusLabel({
          paymentIsDue,
          t: props.t,
          usesLearnToSailWaitlist: props.usesLearnToSailWaitlist,
        })}
      </RegistrationStatusPill>
      {paymentIsDue ? null : (
        <RegistrationOutcomeNote>
          {props.t(
            props.usesLearnToSailWaitlist
              ? 'learn_to_sail_confirmed_note'
              : 'registration_confirmed_note'
          )}
        </RegistrationOutcomeNote>
      )}
      {paymentIsDue ? (
        <PaymentDueRecovery
          checkoutHref={props.links.checkoutHref}
          locale={props.locale}
          payment={payment}
          t={props.t}
        />
      ) : null}
      <CancelRegistrationForm
        action={props.cancelRegistrationAction}
        t={props.t}
      />
    </div>
  );
}

function PendingRegistrationCta(props: {
  readonly cancelRegistrationAction: EventRegistrationCancelFormAction;
  readonly errorMessage: string | null;
  readonly event: PublicEventDetail;
  readonly t: EventRegistrationTranslations;
  readonly usesLearnToSailWaitlist: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <RegistrationErrorAlert message={props.errorMessage} />
      <RegistrationStatusPill tone="warning">
        <Clock aria-hidden className="size-4" />
        {props.t(
          props.usesLearnToSailWaitlist
            ? 'learn_to_sail_status_requested'
            : 'registration_status_pending'
        )}
      </RegistrationStatusPill>
      <RegistrationOutcomeNote>
        {props.t(
          props.usesLearnToSailWaitlist
            ? 'learn_to_sail_requested_note'
            : 'registration_pending_note'
        )}
      </RegistrationOutcomeNote>
      <LearnToSailWaitlistNote event={props.event} t={props.t} />
      <form action={props.cancelRegistrationAction} className="w-full">
        <Button
          className="min-h-11 w-full bg-background text-mit-text"
          size="sm"
          type="submit"
          variant="outline"
        >
          {props.t('registration_cancel_request_button')}
        </Button>
      </form>
    </div>
  );
}

function OpeningLaterRegistrationCta(props: {
  readonly errorMessage: string | null;
  readonly event: PublicEventDetail;
  readonly registrationOpens: string;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <RegistrationErrorAlert message={props.errorMessage} />
      <RegistrationStatusPill tone="muted">
        <Clock aria-hidden className="size-4" />
        {props.t('registration_opening_on', {
          date: props.registrationOpens,
        })}
      </RegistrationStatusPill>
      <LearnToSailWaitlistNote event={props.event} t={props.t} />
    </div>
  );
}

function ClosedRegistrationCta(props: {
  readonly errorMessage: string | null;
  readonly eventsHref: string;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <RegistrationErrorAlert message={props.errorMessage} />
      <Button
        asChild
        className="min-h-11 bg-background text-mit-text"
        size="sm"
        variant="outline"
      >
        <Link href={props.eventsHref}>
          {props.t('registration_view_other_events')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function FullRegistrationCta(props: {
  readonly errorMessage: string | null;
  readonly event: PublicEventDetail;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <RegistrationErrorAlert message={props.errorMessage} />
      <RegistrationStatusPill tone="muted">
        <X aria-hidden className="size-4" />
        {props.t('registration_full')}
      </RegistrationStatusPill>
      <LearnToSailWaitlistNote event={props.event} t={props.t} />
    </div>
  );
}

function SignedOutRegistrationCta(props: {
  readonly errorMessage: string | null;
  readonly event: PublicEventDetail;
  readonly loginHref: string;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <div className="flex flex-col gap-2">
      <RegistrationErrorAlert message={props.errorMessage} />
      <LearnToSailWaitlistNote event={props.event} t={props.t} />
      <Button asChild className="min-h-11 w-full" size="lg" variant="mit">
        <Link href={props.loginHref}>
          <LogIn aria-hidden className="size-4" />
          {props.t(
            props.event.requiresApproval
              ? 'registration_login_request_button'
              : 'registration_login_button'
          )}
        </Link>
      </Button>
      <RegistrationNote>{props.t('registration_login_note')}</RegistrationNote>
    </div>
  );
}

function AvailableRegistrationCta(props: {
  readonly errorMessage: string | null;
  readonly event: PublicEventDetail;
  readonly registrationHref: string;
  readonly t: EventRegistrationTranslations;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RegistrationErrorAlert message={props.errorMessage} />
      <LearnToSailWaitlistNote event={props.event} t={props.t} />
      <Button asChild className="min-h-11 w-full" size="lg" variant="mit">
        <Link href={props.registrationHref}>
          {props.event.requiresApproval
            ? props.t('registration_request_button')
            : props.t('registration_register_button')}
        </Link>
      </Button>
    </div>
  );
}

type EventRegistrationCtaRenderContext = {
  readonly errorMessage: string | null;
  readonly links: EventRegistrationCtaLinks;
  readonly props: EventRegistrationCtaProps;
  readonly usesLearnToSailWaitlist: boolean;
};

function renderApprovedRegistrationCta(
  context: EventRegistrationCtaRenderContext
) {
  return (
    <ApprovedRegistrationCta
      cancelRegistrationAction={context.props.cancelRegistrationAction}
      currentRegistration={context.props.currentRegistration}
      errorMessage={context.errorMessage}
      links={context.links}
      locale={context.props.locale}
      t={context.props.t}
      usesLearnToSailWaitlist={context.usesLearnToSailWaitlist}
    />
  );
}

function renderPendingRegistrationCta(
  context: EventRegistrationCtaRenderContext
) {
  return (
    <PendingRegistrationCta
      cancelRegistrationAction={context.props.cancelRegistrationAction}
      errorMessage={context.errorMessage}
      event={context.props.event}
      t={context.props.t}
      usesLearnToSailWaitlist={context.usesLearnToSailWaitlist}
    />
  );
}

function renderAvailableRegistrationCta(
  context: EventRegistrationCtaRenderContext
) {
  if (!context.props.isSignedIn) {
    return (
      <SignedOutRegistrationCta
        errorMessage={context.errorMessage}
        event={context.props.event}
        loginHref={context.links.loginHref}
        t={context.props.t}
      />
    );
  }
  return (
    <AvailableRegistrationCta
      errorMessage={context.errorMessage}
      event={context.props.event}
      registrationHref={context.links.registrationHref}
      t={context.props.t}
    />
  );
}

function renderOpeningLaterRegistrationCta(
  context: EventRegistrationCtaRenderContext
) {
  return (
    <OpeningLaterRegistrationCta
      errorMessage={context.errorMessage}
      event={context.props.event}
      registrationOpens={context.props.registrationOpens}
      t={context.props.t}
    />
  );
}

function renderClosedRegistrationCta(
  context: EventRegistrationCtaRenderContext
) {
  return (
    <ClosedRegistrationCta
      errorMessage={context.errorMessage}
      eventsHref={context.links.eventsHref}
      t={context.props.t}
    />
  );
}

function renderFullRegistrationCta(context: EventRegistrationCtaRenderContext) {
  return (
    <FullRegistrationCta
      errorMessage={context.errorMessage}
      event={context.props.event}
      t={context.props.t}
    />
  );
}

function renderNoLocalRegistrationCta() {
  return null;
}

const eventRegistrationCtaRenderers: Record<
  PublicEventReservationState,
  (context: EventRegistrationCtaRenderContext) => React.ReactNode
> = {
  approved: renderApprovedRegistrationCta,
  available: renderAvailableRegistrationCta,
  closed: renderClosedRegistrationCta,
  external: renderNoLocalRegistrationCta,
  full: renderFullRegistrationCta,
  opening_later: renderOpeningLaterRegistrationCta,
  pending: renderPendingRegistrationCta,
  unavailable: renderNoLocalRegistrationCta,
};

export function EventRegistrationCta(
  props: EventRegistrationCtaProps
): React.ReactNode {
  const errorMessage = eventRegistrationErrorMessage(props.errorCode, props.t);
  const links = eventRegistrationCtaLinks({
    event: props.event,
    locale: props.locale,
  });
  const usesLearnToSailWaitlist = eventUsesLearnToSailWaitlist(props.event);
  return eventRegistrationCtaRenderers[props.reservationState]({
    errorMessage,
    links,
    props,
    usesLearnToSailWaitlist,
  });
}
