import 'server-only';
import type { Stripe } from 'stripe';
import { Env } from '@/libs/Env';

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

type EmbeddedStripeCheckoutSessionCreateParams = Omit<
  Stripe.Checkout.SessionCreateParams,
  'ui_mode'
> & {
  ui_mode: 'embedded';
};

type StripeCheckoutSessionCreator = {
  checkout: {
    sessions: {
      create(
        params: EmbeddedStripeCheckoutSessionCreateParams,
        options: { idempotencyKey: string }
      ): Promise<StripeCheckoutSessionCreateResult>;
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

function e2eCheckoutSession(paymentId: string): {
  checkoutSessionId: string;
  clientSecret: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
} {
  return {
    checkoutSessionId: `cs_test_e2e_${paymentId}`,
    clientSecret: `cs_test_e2e_secret_${paymentId}`,
    stripeCustomerId: `cus_test_e2e_${paymentId}`,
    stripePaymentIntentId: `pi_test_e2e_${paymentId}`,
  };
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

  const { stripe: injectedStripe } = options;
  if (!injectedStripe && Env.IS_E2E === '1') {
    return e2eCheckoutSession(options.payment.id);
  }
  let stripe: Stripe | StripeCheckoutSessionCreator;
  if (injectedStripe) {
    stripe = injectedStripe;
  } else {
    const stripeClientModule = await import('@/libs/stripe/stripeClient');
    stripe = stripeClientModule.getStripeClient();
  }
  const metadata = {
    eventId: options.payment.eventId,
    paymentId: options.payment.id,
    registrationId: options.payment.registrationId,
    userId: options.payment.userId,
  };
  const params = {
    allow_promotion_codes: true,
    client_reference_id: options.payment.id,
    customer_creation: 'always',
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
    metadata,
    mode: 'payment',
    payment_intent_data: {
      metadata,
      setup_future_usage: 'off_session',
    },
    return_url: options.returnUrl,
    ui_mode: 'embedded',
  } satisfies EmbeddedStripeCheckoutSessionCreateParams;
  // @ts-expect-error Stripe 22.1.1 types lag the current Checkout API enum for embedded sessions.
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `event-payment-checkout-${options.payment.id}`,
  });

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
