import 'server-only';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
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
import type {
  ProcessableStripeEvent,
  StripeWebhookDb,
  StripeWebhookDispatchHandlerResult,
} from '@/libs/stripe/stripeWebhookEvents';
import { stripeEventCreatedAtDate } from '@/libs/stripe/stripeWebhookEvents';
import {
  checkoutSessionPaymentIsSatisfied,
  stripeObjectCanSatisfyPaymentAmount,
  stripeWebhookExpandableId,
  stripeWebhookObjectValue,
  stripeWebhookStringValue,
} from '@/libs/stripe/stripeWebhookObjectHelpers';

type StripeObject = Record<string, unknown>;

type MembershipWebhookPayment = {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
  readonly currency: string;
  readonly id: string;
  readonly refundedAmountCents: number | null;
  readonly status: PaymentStatusType;
  readonly stripeDiscountMetadata?: unknown;
  readonly stripeRefundId?: string | null;
};

function objectValue(value: unknown): StripeObject | null {
  return stripeWebhookObjectValue(value);
}

function stringValue(value: unknown): string | null {
  return stripeWebhookStringValue(value);
}

function expandableId(value: unknown): string | null {
  return stripeWebhookExpandableId(value);
}

function eventObject(event: ProcessableStripeEvent): StripeObject {
  return objectValue(event.data.object) ?? {};
}

function metadataValue(object: StripeObject): StripeObject {
  return objectValue(object.metadata) ?? {};
}

function membershipPaymentId(object: StripeObject): string | null {
  return (
    stringValue(metadataValue(object).localPaymentId) ??
    stringValue(metadataValue(object).paymentId) ??
    stringValue(object.client_reference_id)
  );
}

function isMembershipStripeObject(object: StripeObject): boolean {
  const metadata = metadataValue(object);
  return (
    stringValue(metadata.domain) === 'sailing_card_membership' ||
    stringValue(metadata.purpose) === 'membership'
  );
}

function checkoutPaymentIsSatisfied(object: StripeObject): boolean {
  return checkoutSessionPaymentIsSatisfied(object);
}

function membershipFindOrForObject(options: {
  readonly chargeId?: string | null;
  readonly checkoutSessionId?: string | null;
  readonly object: StripeObject;
  readonly paymentIntentId?: string | null;
}) {
  const or: Record<string, unknown>[] = [];
  const paymentId = membershipPaymentId(options.object);
  if (paymentId) {
    or.push({ id: paymentId });
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
  return or;
}

async function findMembershipPayment(options: {
  readonly chargeId?: string | null;
  readonly checkoutSessionId?: string | null;
  readonly db: StripeWebhookDb;
  readonly object: StripeObject;
  readonly paymentIntentId?: string | null;
}): Promise<MembershipWebhookPayment | null> {
  const or = membershipFindOrForObject(options);
  if (or.length === 0) {
    return null;
  }
  const payment = await options.db.payment.findFirst({
    where: {
      OR: or,
      purpose: PaymentPurpose.membership,
    },
  });
  if (!payment) {
    return null;
  }
  return {
    amountCents: payment.amountCents,
    amountPaidCents: payment.amountPaidCents ?? null,
    currency: payment.currency,
    id: payment.id,
    refundedAmountCents: payment.refundedAmountCents ?? null,
    status: payment.status,
    stripeDiscountMetadata: payment.stripeDiscountMetadata,
    stripeRefundId: payment.stripeRefundId ?? null,
  };
}

function paidUpdateData(options: {
  readonly chargeId?: string | null;
  readonly checkoutSessionId?: string | null;
  readonly customerId?: string | null;
  readonly event: ProcessableStripeEvent;
  readonly object: StripeObject;
  readonly payment: MembershipWebhookPayment;
  readonly paymentIntentId?: string | null;
  readonly receiptUrl?: string | null;
}) {
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
  return {
    amountPaidCents: stripeObjectPaidAmountCents(options.object),
    lastStripePaymentEventCreatedAt: stripeEventCreatedAtDate(options.event),
    lastStripePaymentEventId: options.event.id,
    status: PaymentStatus.paid,
    stripeDiscountMetadata,
    ...(options.chargeId ? { stripeChargeId: options.chargeId } : {}),
    ...(options.checkoutSessionId
      ? { stripeCheckoutSessionId: options.checkoutSessionId }
      : {}),
    ...(options.customerId ? { stripeCustomerId: options.customerId } : {}),
    ...(options.paymentIntentId
      ? { stripePaymentIntentId: options.paymentIntentId }
      : {}),
    ...(options.receiptUrl ? { stripeReceiptUrl: options.receiptUrl } : {}),
  };
}

async function markMembershipPaymentPaid(options: {
  readonly chargeId?: string | null;
  readonly checkoutSessionId?: string | null;
  readonly customerId?: string | null;
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
  readonly object: StripeObject;
  readonly payment: MembershipWebhookPayment;
  readonly paymentIntentId?: string | null;
  readonly receiptUrl?: string | null;
}): Promise<StripeWebhookDispatchHandlerResult> {
  if (
    options.payment.status !== PaymentStatus.paid &&
    options.payment.status !== PaymentStatus.pending &&
    options.payment.status !== PaymentStatus.checkout_created &&
    options.payment.status !== PaymentStatus.past_due
  ) {
    return { handled: true };
  }
  if (!stripeObjectCanSatisfyPaymentAmount(options.object, options.payment)) {
    throw new TypeError(
      'Stripe webhook amount does not match membership payment.'
    );
  }
  const update = paidUpdateData(options);
  const result = await options.db.payment.updateMany({
    data: update,
    where: { id: options.payment.id, status: options.payment.status },
  });
  if (result.count === 0) {
    await options.db.payment.updateMany({
      data: update,
      where: { id: options.payment.id, status: PaymentStatus.paid },
    });
  }
  return { handled: true };
}

async function handleCheckoutCompleted(options: {
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
  readonly object: StripeObject;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const checkoutSessionId = stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findMembershipPayment({
    checkoutSessionId,
    db: options.db,
    object: options.object,
    paymentIntentId,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  if (!checkoutPaymentIsSatisfied(options.object)) {
    return { handled: true };
  }
  return markMembershipPaymentPaid({
    checkoutSessionId,
    customerId: expandableId(options.object.customer),
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
  });
}

async function handleCheckoutExpired(options: {
  readonly db: StripeWebhookDb;
  readonly object: StripeObject;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const checkoutSessionId = stringValue(options.object.id);
  const payment = await findMembershipPayment({
    checkoutSessionId,
    db: options.db,
    object: options.object,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  if (
    payment.status !== PaymentStatus.checkout_created &&
    payment.status !== PaymentStatus.pending
  ) {
    return { handled: true };
  }
  await options.db.payment.updateMany({
    data: {
      activeCheckoutKey: null,
      status: PaymentStatus.past_due,
    },
    where: { id: payment.id, status: payment.status },
  });
  return { handled: true };
}

async function handlePaymentIntentSucceeded(options: {
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
  readonly object: StripeObject;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const paymentIntentId = stringValue(options.object.id);
  const chargeId = expandableId(options.object.latest_charge);
  const payment = await findMembershipPayment({
    chargeId,
    db: options.db,
    object: options.object,
    paymentIntentId,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  return markMembershipPaymentPaid({
    chargeId,
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
  });
}

async function handleChargeSucceeded(options: {
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
  readonly object: StripeObject;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const chargeId = stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findMembershipPayment({
    chargeId,
    db: options.db,
    object: options.object,
    paymentIntentId,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  return markMembershipPaymentPaid({
    chargeId,
    db: options.db,
    event: options.event,
    object: options.object,
    payment,
    paymentIntentId,
    receiptUrl: stringValue(options.object.receipt_url),
  });
}

async function applyMembershipRefundFromStripe(options: {
  readonly db: StripeWebhookDb;
  readonly object: StripeObject;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const chargeId =
    stringValue(options.object.charge) ?? stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findMembershipPayment({
    chargeId,
    db: options.db,
    object: options.object,
    paymentIntentId,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  const refundUpdate = paymentRefundUpdateFromStripe({
    clearActiveCheckoutKeyOnFullRefund: true,
    existingRefundedAmountCents: payment.refundedAmountCents,
    existingRefundLedger: parseStripeRefundLedger(payment.stripeRefundId),
    object: options.object,
    payment,
  });
  await options.db.payment.updateMany({
    data: {
      ...refundUpdate,
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    where: { id: payment.id, status: payment.status },
  });
  return { handled: true };
}

async function applyMembershipDisputeFromStripe(options: {
  readonly db: StripeWebhookDb;
  readonly object: StripeObject;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const chargeId =
    stringValue(options.object.charge) ?? stringValue(options.object.id);
  const paymentIntentId = expandableId(options.object.payment_intent);
  const payment = await findMembershipPayment({
    chargeId,
    db: options.db,
    object: options.object,
    paymentIntentId,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  await options.db.payment.updateMany({
    data: {
      ...paymentDisputeUpdateFromStripe({
        clearActiveCheckoutKey: true,
        disputeId: stripeDisputeIdFromObject(options.object),
      }),
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    where: { id: payment.id, status: payment.status },
  });
  return { handled: true };
}

export async function handleMembershipStripeWebhookEvent(options: {
  readonly db: StripeWebhookDb;
  readonly event: ProcessableStripeEvent;
}): Promise<StripeWebhookDispatchHandlerResult> {
  const object = eventObject(options.event);
  if (
    options.event.type === 'checkout.session.completed' ||
    options.event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const result = await handleCheckoutCompleted({
      db: options.db,
      event: options.event,
      object,
    });
    return result;
  }
  if (options.event.type === 'checkout.session.expired') {
    const result = await handleCheckoutExpired({ db: options.db, object });
    return result;
  }
  if (options.event.type === 'payment_intent.succeeded') {
    const result = await handlePaymentIntentSucceeded({
      db: options.db,
      event: options.event,
      object,
    });
    return result;
  }
  if (options.event.type === 'charge.succeeded') {
    const result = await handleChargeSucceeded({
      db: options.db,
      event: options.event,
      object,
    });
    return result;
  }
  if (
    options.event.type === 'charge.refunded' ||
    options.event.type === 'refund.created' ||
    options.event.type === 'refund.updated'
  ) {
    const result = await applyMembershipRefundFromStripe({
      db: options.db,
      object,
    });
    return result;
  }
  if (
    options.event.type === 'charge.dispute.created' ||
    options.event.type === 'charge.dispute.updated'
  ) {
    const result = await applyMembershipDisputeFromStripe({
      db: options.db,
      object,
    });
    return result;
  }
  return { handled: false };
}
