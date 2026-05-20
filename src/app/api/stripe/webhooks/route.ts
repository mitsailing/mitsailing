import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { nyEventPaymentNotificationDateKey } from '@/libs/mit-sailing/eventPayments';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
} from '@/libs/stripe/stripeWebhookEvents';
import { getDefaultQueue } from '@/worker/defaultQueue';
import { enqueueEventPaymentEmailJob } from '@/worker/eventPaymentEmailJob';

function signatureHeader(request: Request): string | null {
  const signature = request.headers.get('stripe-signature')?.trim();
  if (!signature) {
    return null;
  }
  return signature;
}

/**
 * Stripe webhook endpoint for event payment state changes.
 *
 * @param request - Incoming Stripe webhook request
 * @returns JSON status
 */
export async function POST(request: Request) {
  const signature = signatureHeader(request);
  if (!signature) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!Env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = constructStripeWebhookEvent({
      rawBody,
      signature,
      stripe: getStripeClient(),
      webhookSecret: Env.STRIPE_WEBHOOK_SECRET,
    });
  } catch (error) {
    logger.error('Failed to verify Stripe webhook: {error}', { error });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const processResult = await processStripeWebhookEvent({ db: tx, event });
    return processResult;
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (result.duplicate) {
    return NextResponse.json({ duplicate: true, ok: true });
  }
  if (result.receiptPaymentId) {
    await enqueueEventPaymentEmailJob(getDefaultQueue(), {
      dateKey: nyEventPaymentNotificationDateKey(new Date()),
      kind: 'receipt',
      paymentId: result.receiptPaymentId,
    });
  }
  return NextResponse.json({ ok: true });
}
