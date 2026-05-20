import 'server-only';
import type { Stripe } from 'stripe';

type StripeWebhookConstructEvent = {
  webhooks: {
    constructEvent: (
      rawBody: Buffer | string,
      signature: string,
      secret: string
    ) => Stripe.Event;
  };
};

export function constructStripeWebhookEvent(options: {
  rawBody: Buffer | string;
  signature: string;
  stripe: StripeWebhookConstructEvent;
  webhookSecret: string;
}): Stripe.Event {
  return options.stripe.webhooks.constructEvent(
    options.rawBody,
    options.signature,
    options.webhookSecret
  );
}

export function stripeEventCreatedAtDate(event: Pick<Stripe.Event, 'created'>) {
  return new Date(event.created * 1000);
}
