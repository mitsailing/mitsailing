import { NextResponse } from 'next/server';
import type { Stripe } from 'stripe';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { nyEventPaymentNotificationDateKey } from '@/libs/mit-sailing/eventPayments';
import { handleMembershipStripeWebhookEvent } from '@/libs/mit-sailing/membershipBilling/membershipWebhookEvents';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
  stripeEventCreatedAtDate,
  stripeWebhookReceiptEnqueuePendingError,
} from '@/libs/stripe/stripeWebhookEvents';
import { getDefaultQueue } from '@/worker/defaultQueue';
import { enqueueEventPaymentEmailJob } from '@/worker/eventPaymentEmailJob';
import { enqueueMembershipPaymentReminderJob } from '@/worker/membershipPaymentReminderJob';

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

function stripeObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function stripeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function membershipPaymentReminderJobForEvent(event: Stripe.Event) {
  if (event.type !== 'checkout.session.expired') {
    return null;
  }
  const object = stripeObject(event.data.object);
  const metadata = stripeObject(object?.metadata);
  const paymentId = stripeString(metadata?.localPaymentId);
  const domain = stripeString(metadata?.domain);
  const recoveryUrl = stripeString(
    stripeObject(stripeObject(object?.after_expiration)?.recovery)?.url
  );
  if (domain !== 'sailing_card_membership' || !paymentId || !recoveryUrl) {
    return null;
  }
  return {
    dateKey: nyEventPaymentNotificationDateKey(stripeEventCreatedAtDate(event)),
    paymentId,
  };
}

async function processedStripeWebhookEvent(event: Stripe.Event) {
  try {
    return await prisma.$transaction(async (tx) => {
      const processResult = await processStripeWebhookEvent({
        db: tx,
        event,
        handlers: [handleMembershipStripeWebhookEvent],
      });
      return processResult;
    });
  } catch (error) {
    logger.error('Failed to process Stripe webhook: {error}', { error });
    return null;
  }
}

async function markStripeWebhookEventProcessed(stripeWebhookEventId: string) {
  await prisma.stripeWebhookEvent.update({
    data: { processedAt: new Date(), processingError: null },
    where: { id: stripeWebhookEventId },
  });
}

async function persistReceiptJobEnqueueError(options: {
  readonly error: unknown;
  readonly stripeWebhookEventId: string;
}) {
  try {
    await prisma.stripeWebhookEvent.update({
      data: {
        processingError: stripeWebhookReceiptEnqueuePendingError(options.error),
      },
      where: { id: options.stripeWebhookEventId },
    });
  } catch (updateError) {
    logger.error(
      'Failed to persist Stripe webhook receipt enqueue error: {error}',
      { error: updateError }
    );
  }
}

async function enqueueReceiptJob(options: {
  readonly dateKey: string;
  readonly paymentId: string;
  readonly stripeWebhookEventId: string;
}) {
  try {
    await enqueueEventPaymentEmailJob(getDefaultQueue(), {
      dateKey: options.dateKey,
      kind: 'receipt',
      paymentId: options.paymentId,
    });
    await markStripeWebhookEventProcessed(options.stripeWebhookEventId);
    return true;
  } catch (error) {
    logger.error('Failed to enqueue Stripe webhook receipt job: {error}', {
      error,
    });
    await persistReceiptJobEnqueueError({
      error,
      stripeWebhookEventId: options.stripeWebhookEventId,
    });
    return false;
  }
}

async function enqueueMembershipReminderJob(event: Stripe.Event) {
  const membershipReminderJob = membershipPaymentReminderJobForEvent(event);
  if (!membershipReminderJob) {
    return true;
  }
  try {
    await enqueueMembershipPaymentReminderJob(
      getDefaultQueue(),
      membershipReminderJob
    );
    return true;
  } catch (error) {
    logger.error('Failed to enqueue membership payment reminder job: {error}', {
      error,
    });
    return false;
  }
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

  const result = await processedStripeWebhookEvent(event);
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
    const enqueued = await enqueueReceiptJob({
      dateKey: result.receiptJob.dateKey,
      paymentId: result.receiptJob.paymentId,
      stripeWebhookEventId: result.stripeWebhookEventId,
    });
    if (!enqueued) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }
  const reminderEnqueued = await enqueueMembershipReminderJob(event);
  if (!reminderEnqueued) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
