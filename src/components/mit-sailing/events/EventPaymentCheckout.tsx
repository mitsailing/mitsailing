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
      status: 'cancelled' | 'disputed' | 'handled' | 'paid' | 'refunded';
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
};

function isPayablePayment(
  payment: EventPaymentCheckoutPayment
): payment is Exclude<
  EventPaymentCheckoutPayment,
  null | { status: 'cancelled' | 'disputed' | 'handled' | 'paid' | 'refunded' }
> {
  return (
    payment !== null &&
    (payment.status === 'checkout_created' ||
      payment.status === 'past_due' ||
      payment.status === 'pending')
  );
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

export function EventPaymentCheckout(props: EventPaymentCheckoutProps) {
  const checkoutRef = React.useRef<HTMLElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const { clientSecretAction, payment, publishableKey } = props;
    const { checkoutLoadError } = props.labels;
    if (!isPayablePayment(payment) || !publishableKey) {
      return;
    }
    let cancelled = false;
    let mountedCheckout: { unmount: () => void } | null = null;

    const mountCheckout = async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe || cancelled) {
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
        if (cancelled || !checkoutRef.current) {
          checkout.unmount();
          return;
        }
        checkout.mount(checkoutRef.current);
        mountedCheckout = checkout;
      } catch {
        if (!cancelled) {
          setError(checkoutLoadError);
        }
      }
    };

    // eslint-disable-next-line no-void -- React effects cannot be async; cleanup handles the mounted checkout instance.
    void mountCheckout();

    return () => {
      cancelled = true;
      mountedCheckout?.unmount();
    };
  }, [
    props.clientSecretAction,
    props.labels.checkoutLoadError,
    props.payment,
    props.publishableKey,
  ]);

  if (!props.payment) {
    return (
      <StaticCheckoutState
        body={props.labels.noPaymentBody}
        labels={props.labels}
        payment={null}
        title={props.labels.noPaymentTitle}
      />
    );
  }

  if (!isPayablePayment(props.payment)) {
    return (
      <StaticCheckoutState
        body={props.labels.alreadyHandledBody}
        labels={props.labels}
        payment={props.payment}
        title={props.labels.alreadyHandledTitle}
      />
    );
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5">
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
