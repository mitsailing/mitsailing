'use client';

import { loadStripe } from '@stripe/stripe-js';
import { ExternalLink } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { safeExternalHttpHref } from '@/libs/mit-sailing/cmsHref';

export type EventPaymentCheckoutActionResult =
  | { clientSecret: string; status: 'ok' }
  | { message: string; status: 'unavailable' };

export type EventPaymentCheckoutPayment =
  | {
      amount: string;
      receiptUrl: string | null;
      status: 'checkout_created' | 'past_due' | 'pending';
      statusLabel: string;
    }
  | {
      amount: string;
      receiptUrl: string | null;
      status:
        | 'cancelled'
        | 'disputed'
        | 'handled'
        | 'needs_review'
        | 'paid'
        | 'refunded';
      statusLabel: string;
    }
  | null;

type EventPaymentCheckoutLabels = {
  amountLabel: string;
  alreadyHandledBody: string;
  alreadyHandledTitle: string;
  checkoutLoadError: string;
  checkoutLoading: string;
  checkoutRegionLabel: string;
  checkoutUnavailable: string;
  noPaymentBody: string;
  noPaymentTitle: string;
  paidReceipt: string;
  statusLabel: string;
};

type EventPaymentCheckoutProps = {
  clientSecretAction: () => Promise<EventPaymentCheckoutActionResult>;
  labels: EventPaymentCheckoutLabels;
  payment: EventPaymentCheckoutPayment;
  publishableKey: string | undefined;
  title: string;
};

type SetCheckoutError = React.Dispatch<React.SetStateAction<string | null>>;

type PayableEventPaymentCheckoutPayment = Exclude<
  EventPaymentCheckoutPayment,
  null | {
    status:
      | 'cancelled'
      | 'disputed'
      | 'handled'
      | 'needs_review'
      | 'paid'
      | 'refunded';
  }
>;

function isPayablePayment(
  payment: EventPaymentCheckoutPayment
): payment is PayableEventPaymentCheckoutPayment {
  return (
    payment !== null &&
    (payment.status === 'checkout_created' ||
      payment.status === 'past_due' ||
      payment.status === 'pending')
  );
}

function checkoutTarget(
  ref: React.RefObject<HTMLElement | null>
): HTMLElement | null {
  return ref.current;
}

function checkoutEffectWasCancelled(state: { cancelled: boolean }): boolean {
  return state.cancelled;
}

function cancelCheckoutEffect(state: { cancelled: boolean }) {
  state.cancelled = true;
}

function PaymentSummary(props: {
  amount: string;
  labels: EventPaymentCheckoutLabels;
  status: string;
}) {
  return (
    <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
          {props.labels.amountLabel}
        </dt>
        <dd className="mt-1 text-base font-semibold text-foreground">
          {props.amount}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
          {props.labels.statusLabel}
        </dt>
        <dd className="mt-1 text-base font-semibold text-foreground">
          {props.status}
        </dd>
      </div>
    </dl>
  );
}

function StaticCheckoutState(props: {
  body: string;
  labels: EventPaymentCheckoutLabels;
  payment: Exclude<EventPaymentCheckoutPayment, null> | null;
  title: string;
}) {
  const receiptHref = safeExternalHttpHref(props.payment?.receiptUrl);
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-mit-serif text-3xl font-semibold tracking-tight text-mit-text">
          {props.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-mit-readable-ink">
          {props.body}
        </p>
      </div>
      {props.payment ? (
        <PaymentSummary
          amount={props.payment.amount}
          labels={props.labels}
          status={props.payment.statusLabel}
        />
      ) : null}
      {receiptHref ? (
        <Button asChild className="w-fit" size="sm" variant="outline">
          {/* nosemgrep: typescript.react.security.audit.react-href-var.react-href-var */}
          <a href={receiptHref} rel="noopener noreferrer" target="_blank">
            <ExternalLink aria-hidden className="size-4" />
            {props.labels.paidReceipt}
          </a>
        </Button>
      ) : null}
    </section>
  );
}

function useEmbeddedCheckout(props: {
  checkoutLoadError: string;
  checkoutRef: React.RefObject<HTMLElement | null>;
  clientSecretAction: () => Promise<EventPaymentCheckoutActionResult>;
  payment: EventPaymentCheckoutPayment;
  publishableKey: string | undefined;
  setError: SetCheckoutError;
}) {
  const { checkoutLoadError } = props;
  const { checkoutRef } = props;
  const { clientSecretAction } = props;
  const { payment } = props;
  const { publishableKey } = props;
  const { setError } = props;

  React.useEffect(() => {
    if (!isPayablePayment(payment) || !publishableKey) {
      return;
    }
    setError(null);
    const effectState = { cancelled: false };
    let mountedCheckout: { unmount: () => void } | null = null;

    const mountCheckout = async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (checkoutEffectWasCancelled(effectState)) {
          return;
        }
        if (!stripe) {
          setError(checkoutLoadError);
          return;
        }
        const checkout = await stripe.createEmbeddedCheckoutPage({
          fetchClientSecret: async () => {
            const result = await clientSecretAction();
            if (result.status === 'unavailable') {
              throw new Error(result.message);
            }
            return result.clientSecret;
          },
        });
        if (checkoutEffectWasCancelled(effectState)) {
          checkout.unmount();
          return;
        }
        const target = checkoutTarget(checkoutRef);
        if (!target) {
          checkout.unmount();
          return;
        }
        checkout.mount(target);
        mountedCheckout = checkout;
      } catch {
        if (!checkoutEffectWasCancelled(effectState)) {
          setError(checkoutLoadError);
        }
      }
    };

    // eslint-disable-next-line no-void -- React effects cannot be async; cleanup handles the mounted checkout instance.
    void mountCheckout();

    return () => {
      cancelCheckoutEffect(effectState);
      mountedCheckout?.unmount();
    };
  }, [
    checkoutLoadError,
    checkoutRef,
    clientSecretAction,
    payment,
    publishableKey,
    setError,
  ]);
}

function ActiveCheckoutState(
  props: EventPaymentCheckoutProps & {
    payment: PayableEventPaymentCheckoutPayment;
  }
) {
  const checkoutRef = React.useRef<HTMLElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  useEmbeddedCheckout({
    checkoutLoadError: props.labels.checkoutLoadError,
    checkoutRef,
    clientSecretAction: props.clientSecretAction,
    payment: props.payment,
    publishableKey: props.publishableKey,
    setError,
  });

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="font-mit-serif text-3xl font-semibold tracking-tight text-mit-text">
        {props.title}
      </h1>
      <PaymentSummary
        amount={props.payment.amount}
        labels={props.labels}
        status={props.payment.statusLabel}
      />
      {error ? (
        <p
          className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <section
        aria-label={props.labels.checkoutRegionLabel}
        className={cn(
          'min-h-[420px] rounded-lg border border-border bg-card p-3',
          'sm:p-4'
        )}
        ref={checkoutRef}
      >
        <p className="text-sm text-mit-readable-ink">
          {props.labels.checkoutLoading}
        </p>
      </section>
    </section>
  );
}

export function EventPaymentCheckout(props: EventPaymentCheckoutProps) {
  const { payment } = props;

  if (!payment) {
    return (
      <StaticCheckoutState
        body={props.labels.noPaymentBody}
        labels={props.labels}
        payment={null}
        title={props.labels.noPaymentTitle}
      />
    );
  }

  if (!isPayablePayment(payment)) {
    return (
      <StaticCheckoutState
        body={props.labels.alreadyHandledBody}
        labels={props.labels}
        payment={payment}
        title={props.labels.alreadyHandledTitle}
      />
    );
  }

  if (!props.publishableKey) {
    return (
      <section className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-mit-serif text-3xl font-semibold tracking-tight text-mit-text">
          {props.title}
        </h1>
        <PaymentSummary
          amount={payment.amount}
          labels={props.labels}
          status={payment.statusLabel}
        />
        <p
          className="rounded-lg border border-mit-line bg-muted/30 px-3 py-2 text-sm text-mit-readable-ink"
          role="status"
        >
          {props.labels.checkoutUnavailable}
        </p>
      </section>
    );
  }

  return <ActiveCheckoutState {...props} payment={payment} />;
}
