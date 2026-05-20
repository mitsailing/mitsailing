import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Stripe } from 'stripe';
import {
  EventPaymentNotificationKind,
  EventPaymentStatus,
} from '@/generated/prisma/enums';
import type { EventPaymentStatus as EventPaymentStatusType } from '@/generated/prisma/enums';
import {
  applyEventPaymentPaidTransition,
  eventPaymentStatusCanTransitionTo,
  nyEventPaymentNotificationDateKey,
} from '@/libs/mit-sailing/eventPayments';

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

type StripeWebhookDbPayment = {
  amountCents: number;
  currency: string;
  id: string;
  status: EventPaymentStatusType;
  stripeChargeId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeReceiptUrl?: string | null;
};

type StripeWebhookDb = {
  eventPayment: {
    findFirst: (args: {
      where: {
        OR: Record<string, unknown>[];
      };
    }) => Promise<StripeWebhookDbPayment | null>;
    updateMany: (args: {
      data: Record<string, unknown>;
      where: { id: string; status?: EventPaymentStatusType };
    }) => Promise<{ count: number }>;
  };
  eventPaymentNotification: {
    upsert: (args: {
      create: {
        kind: typeof EventPaymentNotificationKind.receipt;
        paymentId: string;
        sentDateKey: string;
      };
      update: Record<string, never>;
      where: {
        paymentId_kind_sentDateKey: {
          kind: typeof EventPaymentNotificationKind.receipt;
          paymentId: string;
          sentDateKey: string;
        };
      };
    }) => Promise<unknown>;
  };
  stripeWebhookEvent: {
    create: (args: {
      data: {
        eventType: string;
        stripeCreatedAt: Date;
        stripeEventId: string;
      };
    }) => Promise<{ id: string }>;
    findUnique: (args: {
      select: { id: true; processedAt: true };
      where: { stripeEventId: string };
    }) => Promise<{ id: string; processedAt: Date | null } | null>;
    update: (args: {
      data: {
        processedAt?: Date;
        processingError?: string | null;
      };
      where: { id: string };
    }) => Promise<unknown>;
    updateMany: (args: {
      data: {
        processingError: string | null;
      };
      where: {
        id: string;
        processedAt: null;
        OR: (
          | { processingError: null }
          | { processingError: { not: { startsWith: string } } }
        )[];
      };
    }) => Promise<{ count: number }>;
  };
};

type ProcessableStripeEvent = {
  created: number;
  data: { object: unknown };
  id: string;
  type: string;
};

type ProcessStripeWebhookEventResult =
  | { duplicate: true; ok: true; receiptPaymentId?: never }
  | { duplicate?: false; ok: false; receiptPaymentId?: never }
  | {
      duplicate?: false;
      ok: true;
      receiptJob?: { dateKey: string; paymentId: string };
      receiptPaymentId?: never;
    };

function objectValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function expandableId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  const object = objectValue(value);
  return object ? stringValue(object.id) : null;
}

function eventDataObject(
  event: ProcessableStripeEvent
): Record<string, unknown> {
  return objectValue(event.data.object) ?? {};
}

function eventMetadata(
  object: Record<string, unknown>
): Record<string, unknown> {
  return objectValue(object.metadata) ?? {};
}

function eventPaymentId(object: Record<string, unknown>): string | null {
  return (
    stringValue(eventMetadata(object).paymentId) ??
    stringValue(object.client_reference_id)
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return objectValue(error)?.code === 'P2002';
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unknown Stripe webhook error';
}

const webhookProcessingClaimPrefix = 'processing:';

async function claimExistingWebhookEvent(options: {
  db: StripeWebhookDb;
  eventId: string;
}): Promise<{ id: string } | null> {
  const claimId = `${webhookProcessingClaimPrefix}${randomUUID()}`;
  const claim = await options.db.stripeWebhookEvent.updateMany({
    data: { processingError: claimId },
    where: {
      id: options.eventId,
      processedAt: null,
      OR: [
        { processingError: null },
        {
          processingError: {
            not: { startsWith: webhookProcessingClaimPrefix },
          },
        },
      ],
    },
  });
  return claim.count === 1 ? { id: options.eventId } : null;
}

function stripeObjectMatchesPaymentAmount(
  object: Record<string, unknown>,
  payment: Pick<StripeWebhookDbPayment, 'amountCents' | 'currency'>
): boolean {
  const amount =
    numberValue(object.amount_total) ??
    numberValue(object.amount_received) ??
    numberValue(object.amount);
  const currency = stringValue(object.currency);
  return (
    amount === payment.amountCents &&
    currency?.toLowerCase() === payment.currency.toLowerCase()
  );
}

async function ensureReceiptNotification(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  paymentId: string;
}): Promise<{ dateKey: string; paymentId: string }> {
  const dateKey = nyEventPaymentNotificationDateKey(
    stripeEventCreatedAtDate(options.event)
  );
  await options.db.eventPaymentNotification.upsert({
    create: {
      kind: EventPaymentNotificationKind.receipt,
      paymentId: options.paymentId,
      sentDateKey: dateKey,
    },
    update: {},
    where: {
      paymentId_kind_sentDateKey: {
        kind: EventPaymentNotificationKind.receipt,
        paymentId: options.paymentId,
        sentDateKey: dateKey,
      },
    },
  });
  return { dateKey, paymentId: options.paymentId };
}

async function findPaymentForStripeObject(options: {
  chargeId?: string | null;
  checkoutSessionId?: string | null;
  db: StripeWebhookDb;
  paymentId?: string | null;
  paymentIntentId?: string | null;
}): Promise<StripeWebhookDbPayment | null> {
  const or: Record<string, unknown>[] = [];
  if (options.paymentId) {
    or.push({ id: options.paymentId });
  }
  if (options.checkoutSessionId) {
    or.push({ stripeCheckoutSessionId: options.checkoutSessionId });
  }
  if (options.paymentIntentId) {
    or.push({ stripePaymentIntentId: options.paymentIntentId });
  }
  if (options.chargeId) {
    or.push({ stripeChargeId: options.chargeId });
  }
  if (or.length === 0) {
    return null;
  }
  const payment = await options.db.eventPayment.findFirst({
    where: { OR: or },
  });
  return payment;
}

async function markPaymentPaid(options: {
  chargeId?: string | null;
  checkoutSessionId?: string | null;
  customerId?: string | null;
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
  payment: StripeWebhookDbPayment;
  paymentIntentId?: string | null;
  receiptUrl?: string | null;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  if (
    options.payment.status !== EventPaymentStatus.paid &&
    !eventPaymentStatusCanTransitionTo({
      from: options.payment.status,
      to: EventPaymentStatus.paid,
    })
  ) {
    return null;
  }
  if (!stripeObjectMatchesPaymentAmount(options.object, options.payment)) {
    throw new TypeError('Stripe webhook amount does not match event payment.');
  }
  const transition = applyEventPaymentPaidTransition({
    current: options.payment,
    stripeChargeId: options.chargeId,
    stripeCheckoutSessionId: options.checkoutSessionId,
    stripeCustomerId: options.customerId,
    stripePaymentIntentId: options.paymentIntentId,
    stripeReceiptUrl: options.receiptUrl,
  });
  const result = await options.db.eventPayment.updateMany({
    data: transition.update,
    where: { id: options.payment.id, status: options.payment.status },
  });
  if (result.count === 0 || !transition.shouldCreateReceiptNotification) {
    return null;
  }
  return ensureReceiptNotification({
    db: options.db,
    event: options.event,
    paymentId: options.payment.id,
  });
}

async function handleCheckoutCompleted(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  if (stringValue(options.object.payment_status) !== 'paid') {
    return null;
  }
  const checkoutSessionId = stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findPaymentForStripeObject({
    checkoutSessionId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return null;
  }
  return markPaymentPaid({
    checkoutSessionId,
    customerId: expandableId(options.object.customer),
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
  });
}

async function handlePaymentIntentSucceeded(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  const paymentIntentId = stringValue(options.object.id);
  const chargeId = expandableId(options.object.latest_charge);
  const payment = await findPaymentForStripeObject({
    chargeId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return null;
  }
  return markPaymentPaid({
    chargeId,
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
  });
}

async function handleChargeSucceeded(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  const chargeId = stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findPaymentForStripeObject({
    chargeId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return null;
  }
  return markPaymentPaid({
    chargeId,
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
    receiptUrl: stringValue(options.object.receipt_url),
  });
}

async function markPaymentTerminal(options: {
  chargeId?: string | null;
  db: StripeWebhookDb;
  object: Record<string, unknown>;
  status:
    | typeof EventPaymentStatus.disputed
    | typeof EventPaymentStatus.refunded;
}): Promise<void> {
  const chargeId =
    options.chargeId ??
    stringValue(options.object.charge) ??
    stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findPaymentForStripeObject({
    chargeId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return;
  }
  await options.db.eventPayment.updateMany({
    data: {
      status: options.status,
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    where: { id: payment.id, status: payment.status },
  });
}

async function duplicateReceiptJobForPaidEvent(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  const object = eventDataObject(options.event);
  if (
    (options.event.type === 'checkout.session.completed' ||
      options.event.type === 'checkout.session.async_payment_succeeded') &&
    stringValue(object.payment_status) !== 'paid'
  ) {
    return null;
  }
  if (
    options.event.type !== 'checkout.session.completed' &&
    options.event.type !== 'checkout.session.async_payment_succeeded' &&
    options.event.type !== 'payment_intent.succeeded' &&
    options.event.type !== 'charge.succeeded'
  ) {
    return null;
  }
  const payment = await findPaymentForStripeObject({
    chargeId: stringValue(object.id),
    checkoutSessionId: stringValue(object.id),
    db: options.db,
    paymentId: eventPaymentId(object),
    paymentIntentId:
      stringValue(object.id) ?? expandableId(object.payment_intent),
  });
  if (
    !payment ||
    payment.status !== EventPaymentStatus.paid ||
    !stripeObjectMatchesPaymentAmount(object, payment)
  ) {
    return null;
  }
  return ensureReceiptNotification({
    db: options.db,
    event: options.event,
    paymentId: payment.id,
  });
}

async function applyStripeEventToPayment(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  const object = eventDataObject(options.event);
  if (
    options.event.type === 'checkout.session.completed' ||
    options.event.type === 'checkout.session.async_payment_succeeded'
  ) {
    return handleCheckoutCompleted({
      db: options.db,
      event: options.event,
      object,
    });
  }
  if (options.event.type === 'payment_intent.succeeded') {
    return handlePaymentIntentSucceeded({
      db: options.db,
      event: options.event,
      object,
    });
  }
  if (options.event.type === 'charge.succeeded') {
    return handleChargeSucceeded({
      db: options.db,
      event: options.event,
      object,
    });
  }
  if (
    options.event.type === 'charge.refunded' ||
    options.event.type === 'refund.created' ||
    options.event.type === 'refund.updated'
  ) {
    await markPaymentTerminal({
      db: options.db,
      object,
      status: EventPaymentStatus.refunded,
    });
    return null;
  }
  if (
    options.event.type === 'charge.dispute.created' ||
    options.event.type === 'charge.dispute.updated'
  ) {
    await markPaymentTerminal({
      chargeId: stringValue(object.charge),
      db: options.db,
      object,
      status: EventPaymentStatus.disputed,
    });
    return null;
  }
  return null;
}

export async function processStripeWebhookEvent(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
}): Promise<ProcessStripeWebhookEventResult> {
  let storedEvent: { id: string };
  try {
    storedEvent = await options.db.stripeWebhookEvent.create({
      data: {
        eventType: options.event.type,
        stripeCreatedAt: stripeEventCreatedAtDate(options.event),
        stripeEventId: options.event.id,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existingEvent = await options.db.stripeWebhookEvent.findUnique({
        select: { id: true, processedAt: true },
        where: { stripeEventId: options.event.id },
      });
      if (existingEvent?.processedAt) {
        const receiptJob = await duplicateReceiptJobForPaidEvent(options);
        if (receiptJob) {
          return { ok: true, receiptJob };
        }
        return { duplicate: true, ok: true };
      }
      if (existingEvent) {
        const claimedEvent = await claimExistingWebhookEvent({
          db: options.db,
          eventId: existingEvent.id,
        });
        if (!claimedEvent) {
          return { ok: false };
        }
        storedEvent = claimedEvent;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  try {
    const receiptJob = await applyStripeEventToPayment(options);
    await options.db.stripeWebhookEvent.update({
      data: { processedAt: new Date(), processingError: null },
      where: { id: storedEvent.id },
    });
    return receiptJob ? { ok: true, receiptJob } : { ok: true };
  } catch (error) {
    await options.db.stripeWebhookEvent.update({
      data: { processingError: errorMessage(error) },
      where: { id: storedEvent.id },
    });
    return { ok: false };
  }
}
