import 'server-only';
import { Stripe } from 'stripe';
import { Env } from '@/libs/Env';

declare global {
  var cachedStripeClient: Stripe | undefined;
}

export function getStripeClient(): Stripe {
  if (!Env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key is not configured.');
  }

  const { cachedStripeClient } = globalThis;
  if (cachedStripeClient) {
    return cachedStripeClient;
  }

  const stripe = new Stripe(Env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-05-27.dahlia',
    typescript: true,
  });
  globalThis.cachedStripeClient = stripe;
  return stripe;
}
