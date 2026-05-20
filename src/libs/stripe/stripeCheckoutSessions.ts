import 'server-only';
import type { Stripe } from 'stripe';

export type EventPaymentCheckoutSessionPayment = {
  amountCents: number;
  currency: string;
  eventId: string;
  id: string;
  registrationId: string;
  selectedFeeDescription: string;
  userId: string;
};

type StripeCheckoutSessionCreateResult = Pick<
  Stripe.Checkout.Session,
  'client_secret' | 'customer' | 'id' | 'payment_intent'
>;

type StripeCheckoutSessionCreator = {
  checkout: {
    sessions: {
      create: (
        params: Stripe.Checkout.SessionCreateParams,
        options: { idempotencyKey: string }
      ) => Promise<StripeCheckoutSessionCreateResult>;
    };
  };
};

function stripeExpandableId(
  value: string | { id: string } | null
): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return value?.id ?? null;
}

export async function createEmbeddedEventPaymentCheckoutSession(options: {
  payment: EventPaymentCheckoutSessionPayment;
  returnUrl: string;
  stripe?: StripeCheckoutSessionCreator;
}): Promise<{
  checkoutSessionId: string;
  clientSecret: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
}> {
  if (options.payment.currency !== 'usd') {
    throw new TypeError('Event payments only support usd currency.');
  }
  if (
    !Number.isInteger(options.payment.amountCents) ||
    options.payment.amountCents <= 0
  ) {
    throw new TypeError('Event payment amount must be positive integer cents.');
  }

  let { stripe } = options;
  if (!stripe) {
    const stripeClientModule = await import('@/libs/stripe/stripeClient');
    stripe = stripeClientModule.getStripeClient();
  }
  const session = await stripe.checkout.sessions.create(
    {
      client_reference_id: options.payment.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: options.payment.selectedFeeDescription,
            },
            unit_amount: options.payment.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        eventId: options.payment.eventId,
        paymentId: options.payment.id,
        registrationId: options.payment.registrationId,
        userId: options.payment.userId,
      },
      mode: 'payment',
      return_url: options.returnUrl,
      ui_mode: 'embedded_page',
    },
    {
      idempotencyKey: `event-payment-checkout-${options.payment.id}`,
    }
  );

  if (!session.client_secret) {
    throw new Error(
      'Stripe did not return an embedded checkout client secret.'
    );
  }

  return {
    checkoutSessionId: session.id,
    clientSecret: session.client_secret,
    stripeCustomerId: stripeExpandableId(session.customer),
    stripePaymentIntentId: stripeExpandableId(session.payment_intent),
  };
}
