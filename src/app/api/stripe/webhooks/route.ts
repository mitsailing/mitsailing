import { NextResponse } from 'next/server';
import type { Stripe } from 'stripe';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { handleMembershipStripeWebhookEvent } from '@/libs/mit-sailing/membershipBilling/membershipWebhookEvents';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
  stripeWebhookReceiptEnqueuePendingError,
} from '@/libs/stripe/stripeWebhookEvents';
import { getDefaultQueue } from '@/worker/defaultQueue';
import { enqueueEventPaymentEmailJob } from '@/worker/eventPaymentEmailJob';

const stripeWebhookMaxBodyBytes = 256 * 1024;

function signatureHeader(request: Request): string | null {
  const signature = request.headers.get('stripe-signature')?.trim();
  if (!signature) {
    return null;
  }
  return signature;
}

async function stripeWebhookRawBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(contentLength) &&
    contentLength > stripeWebhookMaxBodyBytes
  ) {
    return null;
  }
  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    receivedBytes += chunk.value.byteLength;
    if (receivedBytes > stripeWebhookMaxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
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

  const rawBody = await stripeWebhookRawBody(request);
  if (rawBody === null) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }
  let event: Stripe.Event;
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

  const result = await prisma
    .$transaction(async (tx) => {
      const processResult = await processStripeWebhookEvent({
        db: tx,
        event,
        handlers: [handleMembershipStripeWebhookEvent],
      });
      return processResult;
    })
    .catch((error: unknown) => {
      logger.error('Failed to process Stripe webhook: {error}', { error });
      return null;
    });
  if (!result) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (result.duplicate) {
    return NextResponse.json({ duplicate: true, ok: true });
  }
  if (result.receiptJob) {
    try {
      await enqueueEventPaymentEmailJob(getDefaultQueue(), {
        dateKey: result.receiptJob.dateKey,
        kind: 'receipt',
        paymentId: result.receiptJob.paymentId,
      });
      await prisma.stripeWebhookEvent.update({
        data: { processedAt: new Date(), processingError: null },
        where: { id: result.stripeWebhookEventId },
      });
    } catch (error) {
      logger.error('Failed to enqueue Stripe webhook receipt job: {error}', {
        error,
      });
      try {
        await prisma.stripeWebhookEvent.update({
          data: {
            processingError: stripeWebhookReceiptEnqueuePendingError(error),
          },
          where: { id: result.stripeWebhookEventId },
        });
      } catch (updateError) {
        logger.error(
          'Failed to persist Stripe webhook receipt enqueue error: {error}',
          { error: updateError }
        );
      }
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
