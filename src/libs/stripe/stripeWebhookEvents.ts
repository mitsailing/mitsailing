import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Stripe } from 'stripe';
import {
  EventRegistrationStatus,
  EventPaymentNotificationKind,
  PaymentPurpose,
  PaymentStatus,
} from '@/generated/prisma/enums';
import type {
  PaymentPurpose as PaymentPurposeType,
  SailingCardType,
  PaymentStatus as PaymentStatusType,
} from '@/generated/prisma/enums';
import {
  applyEventPaymentPaidTransition,
  eventPaymentStatusCanTransitionTo,
  nyEventPaymentNotificationDateKey,
} from '@/libs/mit-sailing/eventPayments';
import {
  stripeObjectPaidAmountCents,
  stripePaymentDiscountMetadataFromObject,
} from '@/libs/stripe/stripePaymentDiscountMetadata';
import {
  paymentDisputeUpdateFromStripe,
  parseStripeRefundLedger,
  paymentRefundUpdateFromStripe,
  stripeDisputeIdFromObject,
} from '@/libs/stripe/stripeRefundMetadata';
import {
  checkoutSessionPaymentIsSatisfied,
  stripeObjectCanSatisfyPaymentAmount,
  stripeWebhookExpandableId as expandableId,
  stripeWebhookObjectValue as objectValue,
  stripeWebhookStringValue as stringValue,
} from '@/libs/stripe/stripeWebhookObjectHelpers';

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
  amountPaidCents?: number | null;
  cardType?: SailingCardType | null;
  cardYear?: number | null;
  currency: string;
  eventId?: string | null;
  id: string;
  membershipInitialPriceId?: string | null;
  purpose?: PaymentPurposeType;
  refundedAmountCents?: number | null;
  registrationId?: string | null;
  status: PaymentStatusType;
  lastStripePaymentEventCreatedAt?: Date | null;
  lastStripePaymentEventId?: string | null;
  stripeChargeId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeDiscountMetadata?: unknown;
  stripePaymentIntentId?: string | null;
  stripeReceiptUrl?: string | null;
  stripeRefundId?: string | null;
  userId?: string | null;
};

export type StripeWebhookDb = {
  payment: {
    create?: unknown;
    findFirst: (args: {
      orderBy?: Record<string, unknown>;
      where: {
        purpose?: PaymentPurposeType;
        OR: Record<string, unknown>[];
      };
    }) => Promise<StripeWebhookDbPayment | null>;
    updateMany: (args: {
      data: Record<string, unknown>;
      where: { id: string; status?: PaymentStatusType };
    }) => Promise<{ count: number }>;
  };
  eventRegistration?: {
    updateMany: (args: {
      data: { status: typeof EventRegistrationStatus.approved };
      where: {
        event: { requiresApproval: false };
        eventId: string;
        id: string;
        status: typeof EventRegistrationStatus.pending;
        userId: string;
      };
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
    createMany: (args: {
      data: {
        eventType: string;
        processingError?: string | null;
        stripeCreatedAt: Date;
        stripeEventId: string;
      };
      skipDuplicates: true;
    }) => Promise<{ count: number }>;
    findUnique: (args: {
      select: { id: true; processedAt: true; processingError: true };
      where: { stripeEventId: string };
    }) => Promise<{
      id: string;
      processedAt: Date | null;
      processingError: string | null;
    } | null>;
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
          | { processingError: { lt: string; startsWith: string } }
        )[];
      };
    }) => Promise<{ count: number }>;
  };
};

export type ProcessableStripeEvent = {
  created: number;
  data: { object: unknown };
  id: string;
  type: string;
};

type StripeWebhookReceiptJob = { dateKey: string; paymentId: string };

export type StripeWebhookDispatchHandlerResult = {
  readonly handled: boolean;
  readonly receiptJob?: StripeWebhookReceiptJob;
};

export type StripeWebhookDispatchHandler = (options: {
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
  readonly persistReceiptJob: () => Promise<void>;
  readonly retryingReceiptEnqueue: boolean;
  readonly retryingUnprocessedEvent: boolean;
}) => Promise<StripeWebhookDispatchHandlerResult>;

type ProcessStripeWebhookEventResult =
  | { duplicate: true; ok: true; receiptPaymentId?: never }
  | { duplicate?: false; ok: false; receiptPaymentId?: never }
  | {
      duplicate?: false;
      ok: true;
      receiptJob: StripeWebhookReceiptJob;
      stripeWebhookEventId: string;
      receiptPaymentId?: never;
    }
  | {
      duplicate?: false;
      ok: true;
      receiptJob?: never;
      stripeWebhookEventId?: never;
      receiptPaymentId?: never;
    };

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

function isSailingCardMembershipStripeObject(
  object: Record<string, unknown>
): boolean {
  const metadata = eventMetadata(object);
  return (
    stringValue(metadata.domain) === 'sailing_card_membership' ||
    stringValue(metadata.purpose) === 'membership'
  );
}

function stripeEventNeedsFutureHandler(event: ProcessableStripeEvent): boolean {
  return isSailingCardMembershipStripeObject(eventDataObject(event));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unknown Stripe webhook error';
}

const webhookProcessingClaimPrefix = 'processing:';
const webhookProcessingClaimTtlMs = 15 * 60 * 1000;
const receiptEnqueuePendingProcessingError = 'receipt_enqueue_pending';

export function stripeWebhookReceiptEnqueuePendingError(error: unknown) {
  return `${receiptEnqueuePendingProcessingError}:${errorMessage(error)}`;
}

function stripeWebhookProcessingClaim(now = new Date()) {
  return `${webhookProcessingClaimPrefix}${now.toISOString()}:${randomUUID()}`;
}

function staleWebhookProcessingClaimCutoff(now = new Date()) {
  return `${webhookProcessingClaimPrefix}${new Date(
    now.getTime() - webhookProcessingClaimTtlMs
  ).toISOString()}`;
}

async function claimExistingWebhookEvent(options: {
  db: StripeWebhookDb;
  eventId: string;
}): Promise<{ id: string } | null> {
  const claimId = stripeWebhookProcessingClaim();
  const staleClaimCutoff = staleWebhookProcessingClaimCutoff();
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
        {
          processingError: {
            lt: staleClaimCutoff,
            startsWith: webhookProcessingClaimPrefix,
          },
        },
      ],
    },
  });
  return claim.count === 1 ? { id: options.eventId } : null;
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

function receiptJobForPaidEventPayment(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  payment: StripeWebhookDbPayment;
  object: Record<string, unknown>;
}): Promise<StripeWebhookReceiptJob> | null {
  if (
    options.payment.status !== PaymentStatus.paid ||
    !stripeObjectCanSatisfyPaymentAmount(options.object, options.payment)
  ) {
    return null;
  }
  return ensureReceiptNotification({
    db: options.db,
    event: options.event,
    paymentId: options.payment.id,
  });
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
  const payment = await options.db.payment.findFirst({
    where: { OR: or, purpose: PaymentPurpose.event_payment },
  });
  return payment;
}

function paidStripeReferenceMergeData(update: Record<string, unknown>) {
  const data: Record<string, unknown> = { status: PaymentStatus.paid };
  for (const key of [
    'stripeChargeId',
    'stripeCheckoutSessionId',
    'stripeCustomerId',
    'stripePaymentIntentId',
    'stripeReceiptUrl',
  ]) {
    const value = update[key];
    if (typeof value === 'string' && value.length > 0) {
      data[key] = value;
    }
  }
  for (const key of [
    'amountPaidCents',
    'lastStripePaymentEventCreatedAt',
    'lastStripePaymentEventId',
    'stripeDiscountMetadata',
  ]) {
    const value = update[key];
    if (value !== undefined) {
      data[key] = value;
    }
  }
  return data;
}

async function duplicateReceiptJobForPaidEvent(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
}): Promise<{ dateKey: string; paymentId: string } | null> {
  const object = eventDataObject(options.event);
  const objectId = stringValue(object.id);
  if (
    (options.event.type === 'checkout.session.completed' ||
      options.event.type === 'checkout.session.async_payment_succeeded') &&
    !checkoutSessionPaymentIsSatisfied(object)
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
    chargeId: options.event.type === 'charge.succeeded' ? objectId : null,
    checkoutSessionId:
      options.event.type === 'checkout.session.completed' ||
      options.event.type === 'checkout.session.async_payment_succeeded'
        ? objectId
        : null,
    db: options.db,
    paymentId: eventPaymentId(object),
    paymentIntentId:
      options.event.type === 'payment_intent.succeeded'
        ? objectId
        : expandableId(object.payment_intent),
  });
  if (!payment) {
    return null;
  }
  return receiptJobForPaidEventPayment({
    db: options.db,
    event: options.event,
    object,
    payment,
  });
}

async function approveAutoApprovedEventRegistrationAfterPayment(options: {
  db: StripeWebhookDb;
  payment: StripeWebhookDbPayment;
}) {
  if (
    options.payment.purpose !== PaymentPurpose.event_payment ||
    !options.db.eventRegistration ||
    !options.payment.eventId ||
    !options.payment.registrationId ||
    !options.payment.userId
  ) {
    return;
  }
  await options.db.eventRegistration.updateMany({
    data: { status: EventRegistrationStatus.approved },
    where: {
      event: { requiresApproval: false },
      eventId: options.payment.eventId,
      id: options.payment.registrationId,
      status: EventRegistrationStatus.pending,
      userId: options.payment.userId,
    },
  });
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
  persistReceiptJob: () => Promise<void>;
  receiptUrl?: string | null;
  retryingReceiptEnqueue: boolean;
}): Promise<StripeWebhookDispatchHandlerResult> {
  if (
    options.payment.status !== PaymentStatus.paid &&
    !eventPaymentStatusCanTransitionTo({
      from: options.payment.status,
      to: PaymentStatus.paid,
    })
  ) {
    return { handled: true };
  }
  if (!stripeObjectCanSatisfyPaymentAmount(options.object, options.payment)) {
    throw new TypeError('Stripe webhook amount does not match event payment.');
  }
  const extractedDiscountMetadata = stripePaymentDiscountMetadataFromObject({
    object: options.object,
    paymentAmountCents: options.payment.amountCents,
  });
  const stripeDiscountMetadata =
    options.payment.stripeDiscountMetadata !== undefined &&
    options.payment.stripeDiscountMetadata !== null &&
    (extractedDiscountMetadata === null ||
      extractedDiscountMetadata.discounts.length === 0)
      ? options.payment.stripeDiscountMetadata
      : (extractedDiscountMetadata ??
        options.payment.stripeDiscountMetadata ??
        null);
  const accountingData = {
    amountPaidCents: stripeObjectPaidAmountCents(options.object),
    lastStripePaymentEventCreatedAt: stripeEventCreatedAtDate(options.event),
    lastStripePaymentEventId: options.event.id,
    stripeDiscountMetadata,
  };
  const transition = applyEventPaymentPaidTransition({
    current: options.payment,
    stripeChargeId: options.chargeId,
    stripeCheckoutSessionId: options.checkoutSessionId,
    stripeCustomerId: options.customerId,
    stripePaymentIntentId: options.paymentIntentId,
    stripeReceiptUrl: options.receiptUrl,
  });
  const update = {
    ...transition.update,
    ...accountingData,
  };
  const result = await options.db.payment.updateMany({
    data: update,
    where: { id: options.payment.id, status: options.payment.status },
  });
  if (result.count === 0) {
    const paidMergeResult = await options.db.payment.updateMany({
      data: paidStripeReferenceMergeData(update),
      where: { id: options.payment.id, status: PaymentStatus.paid },
    });
    if (paidMergeResult.count > 0) {
      await approveAutoApprovedEventRegistrationAfterPayment({
        db: options.db,
        payment: options.payment,
      });
    }
    return { handled: true };
  }
  await approveAutoApprovedEventRegistrationAfterPayment({
    db: options.db,
    payment: options.payment,
  });
  if (!transition.shouldCreateReceiptNotification) {
    if (!options.retryingReceiptEnqueue) {
      return { handled: true };
    }
    const receiptJob = await duplicateReceiptJobForPaidEvent({
      db: options.db,
      event: options.event,
    });
    return receiptJob ? { handled: true, receiptJob } : { handled: true };
  }
  await options.persistReceiptJob();
  const receiptJob = await ensureReceiptNotification({
    db: options.db,
    event: options.event,
    paymentId: options.payment.id,
  });
  return { handled: true, receiptJob };
}

async function handleCheckoutCompleted(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
  persistReceiptJob: () => Promise<void>;
  retryingReceiptEnqueue: boolean;
  retryingUnprocessedEvent: boolean;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const checkoutSessionId = stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findPaymentForStripeObject({
    checkoutSessionId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return { handled: !isSailingCardMembershipStripeObject(options.object) };
  }
  if (!checkoutSessionPaymentIsSatisfied(options.object)) {
    return { handled: true };
  }
  return markPaymentPaid({
    checkoutSessionId,
    customerId: expandableId(options.object.customer),
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
    persistReceiptJob: options.persistReceiptJob,
    retryingReceiptEnqueue: options.retryingReceiptEnqueue,
  });
}

async function handlePaymentIntentSucceeded(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
  persistReceiptJob: () => Promise<void>;
  retryingReceiptEnqueue: boolean;
  retryingUnprocessedEvent: boolean;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const paymentIntentId = stringValue(options.object.id);
  const chargeId = expandableId(options.object.latest_charge);
  const payment = await findPaymentForStripeObject({
    chargeId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return { handled: !isSailingCardMembershipStripeObject(options.object) };
  }
  return markPaymentPaid({
    chargeId,
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
    persistReceiptJob: options.persistReceiptJob,
    retryingReceiptEnqueue: options.retryingReceiptEnqueue,
  });
}

async function handleChargeSucceeded(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  object: Record<string, unknown>;
  persistReceiptJob: () => Promise<void>;
  retryingReceiptEnqueue: boolean;
  retryingUnprocessedEvent: boolean;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const chargeId = stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findPaymentForStripeObject({
    chargeId,
    db: options.db,
    paymentId: eventPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return { handled: !isSailingCardMembershipStripeObject(options.object) };
  }
  return markPaymentPaid({
    chargeId,
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
    persistReceiptJob: options.persistReceiptJob,
    receiptUrl: stringValue(options.object.receipt_url),
    retryingReceiptEnqueue: options.retryingReceiptEnqueue,
  });
}

async function applyPaymentRefundFromStripe(options: {
  chargeId?: string | null;
  db: StripeWebhookDb;
  object: Record<string, unknown>;
}): Promise<boolean> {
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
    return !isSailingCardMembershipStripeObject(options.object);
  }
  const refundUpdate = paymentRefundUpdateFromStripe({
    existingRefundedAmountCents: payment.refundedAmountCents ?? null,
    existingRefundLedger: parseStripeRefundLedger(payment.stripeRefundId),
    object: options.object,
    payment: {
      amountCents: payment.amountCents,
      amountPaidCents: payment.amountPaidCents ?? null,
    },
  });
  await options.db.payment.updateMany({
    data: {
      ...refundUpdate,
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    where: { id: payment.id, status: payment.status },
  });
  return true;
}

async function applyPaymentDisputeFromStripe(options: {
  chargeId?: string | null;
  db: StripeWebhookDb;
  object: Record<string, unknown>;
}): Promise<boolean> {
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
    return !isSailingCardMembershipStripeObject(options.object);
  }
  await options.db.payment.updateMany({
    data: {
      ...paymentDisputeUpdateFromStripe({
        disputeId: stripeDisputeIdFromObject(options.object),
      }),
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    where: { id: payment.id, status: payment.status },
  });
  return true;
}

async function handleEventPaymentStripeWebhookEvent(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  persistReceiptJob: () => Promise<void>;
  retryingReceiptEnqueue: boolean;
  retryingUnprocessedEvent: boolean;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const object = eventDataObject(options.event);
  if (
    options.event.type === 'checkout.session.completed' ||
    options.event.type === 'checkout.session.async_payment_succeeded'
  ) {
    return handleCheckoutCompleted({
      db: options.db,
      event: options.event,
      object,
      persistReceiptJob: options.persistReceiptJob,
      retryingReceiptEnqueue: options.retryingReceiptEnqueue,
      retryingUnprocessedEvent: options.retryingUnprocessedEvent,
    });
  }
  if (options.event.type === 'payment_intent.succeeded') {
    return handlePaymentIntentSucceeded({
      db: options.db,
      event: options.event,
      object,
      persistReceiptJob: options.persistReceiptJob,
      retryingReceiptEnqueue: options.retryingReceiptEnqueue,
      retryingUnprocessedEvent: options.retryingUnprocessedEvent,
    });
  }
  if (options.event.type === 'charge.succeeded') {
    return handleChargeSucceeded({
      db: options.db,
      event: options.event,
      object,
      persistReceiptJob: options.persistReceiptJob,
      retryingReceiptEnqueue: options.retryingReceiptEnqueue,
      retryingUnprocessedEvent: options.retryingUnprocessedEvent,
    });
  }
  if (
    options.event.type === 'charge.refunded' ||
    options.event.type === 'refund.created' ||
    options.event.type === 'refund.updated'
  ) {
    const handled = await applyPaymentRefundFromStripe({
      db: options.db,
      object,
    });
    return { handled };
  }
  if (
    options.event.type === 'charge.dispute.created' ||
    options.event.type === 'charge.dispute.updated'
  ) {
    const handled = await applyPaymentDisputeFromStripe({
      chargeId: stringValue(object.charge),
      db: options.db,
      object,
    });
    return { handled };
  }
  return { handled: false };
}

async function dispatchStripeWebhookEvent(options: {
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
  readonly handlers: readonly StripeWebhookDispatchHandler[];
  readonly persistReceiptJob: () => Promise<void>;
  readonly retryingReceiptEnqueue: boolean;
  readonly retryingUnprocessedEvent: boolean;
}): Promise<StripeWebhookDispatchHandlerResult> {
  let handled = false;
  let receiptJob: StripeWebhookReceiptJob | undefined;

  for (const handler of [
    handleEventPaymentStripeWebhookEvent,
    ...options.handlers,
  ]) {
    const result = await handler({
      db: options.db,
      event: options.event,
      persistReceiptJob: options.persistReceiptJob,
      retryingReceiptEnqueue: options.retryingReceiptEnqueue,
      retryingUnprocessedEvent: options.retryingUnprocessedEvent,
    });
    handled = handled || result.handled;
    const { receiptJob: nextReceiptJob } = result;
    if (nextReceiptJob && !receiptJob) {
      receiptJob = nextReceiptJob;
      await options.persistReceiptJob();
    }
  }

  return receiptJob ? { handled, receiptJob } : { handled };
}

export async function processStripeWebhookEvent(options: {
  db: StripeWebhookDb;
  event: ProcessableStripeEvent;
  handlers?: readonly StripeWebhookDispatchHandler[];
}): Promise<ProcessStripeWebhookEventResult> {
  let storedEvent: { id: string };
  let receiptRecoveryPending = false;
  let receiptPendingMarkerPersisted = false;
  let retryingReceiptEnqueue = false;
  let retryingUnprocessedEvent = false;
  const createResult = await options.db.stripeWebhookEvent.createMany({
    data: {
      eventType: options.event.type,
      processingError: stripeWebhookProcessingClaim(),
      stripeCreatedAt: stripeEventCreatedAtDate(options.event),
      stripeEventId: options.event.id,
    },
    skipDuplicates: true,
  });
  const existingEvent = await options.db.stripeWebhookEvent.findUnique({
    select: { id: true, processedAt: true, processingError: true },
    where: { stripeEventId: options.event.id },
  });
  if (!existingEvent) {
    throw new TypeError('Stripe webhook event reservation missing.');
  }
  if (createResult.count === 1) {
    storedEvent = { id: existingEvent.id };
  } else if (existingEvent.processedAt) {
    return { duplicate: true, ok: true };
  } else {
    retryingReceiptEnqueue = Boolean(
      existingEvent.processingError?.startsWith(
        receiptEnqueuePendingProcessingError
      )
    );
    receiptRecoveryPending = retryingReceiptEnqueue;
    const claimedEvent = await claimExistingWebhookEvent({
      db: options.db,
      eventId: existingEvent.id,
    });
    if (!claimedEvent) {
      return { ok: false };
    }
    storedEvent = claimedEvent;
    retryingUnprocessedEvent = true;
  }

  try {
    const dispatchResult = await dispatchStripeWebhookEvent({
      db: options.db,
      event: options.event,
      handlers: options.handlers ?? [],
      persistReceiptJob: async () => {
        receiptRecoveryPending = true;
        if (receiptPendingMarkerPersisted) {
          return;
        }
        await options.db.stripeWebhookEvent.update({
          data: { processingError: receiptEnqueuePendingProcessingError },
          where: { id: storedEvent.id },
        });
        receiptPendingMarkerPersisted = true;
      },
      retryingReceiptEnqueue,
      retryingUnprocessedEvent,
    });
    if (!dispatchResult.handled) {
      if (!stripeEventNeedsFutureHandler(options.event)) {
        await options.db.stripeWebhookEvent.update({
          data: { processedAt: new Date(), processingError: null },
          where: { id: storedEvent.id },
        });
        return { ok: true };
      }
      await options.db.stripeWebhookEvent.update({
        data: {
          processingError: `Unhandled Stripe webhook event: ${options.event.type}`,
        },
        where: { id: storedEvent.id },
      });
      return { ok: true };
    }
    if (dispatchResult.receiptJob) {
      return {
        ok: true,
        receiptJob: dispatchResult.receiptJob,
        stripeWebhookEventId: storedEvent.id,
      };
    }
    await options.db.stripeWebhookEvent.update({
      data: { processedAt: new Date(), processingError: null },
      where: { id: storedEvent.id },
    });
    return { ok: true };
  } catch (error) {
    const message = receiptRecoveryPending
      ? stripeWebhookReceiptEnqueuePendingError(error)
      : errorMessage(error);
    await options.db.stripeWebhookEvent.update({
      data: { processingError: message },
      where: { id: storedEvent.id },
    });
    return { ok: false };
  }
}
