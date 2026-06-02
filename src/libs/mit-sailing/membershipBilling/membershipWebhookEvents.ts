import {
  MembershipPaymentIssueKind,
  MembershipPaymentKind,
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardSubscriptionStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import type {
  MembershipPaymentIssueKind as MembershipPaymentIssueKindType,
  PaymentStatus as PaymentStatusType,
  SailingCardSubscriptionStatus as SailingCardSubscriptionStatusType,
  SailingCardType as SailingCardTypeType,
} from '@/generated/prisma/enums';
import { logger } from '@/libs/Logger';
import type {
  ProcessableStripeEvent,
  StripeWebhookDb,
  StripeWebhookDispatchHandlerResult,
} from '@/libs/stripe/stripeWebhookEvents';
import { stripeEventCreatedAtDate } from '@/libs/stripe/stripeWebhookEvents';

type MembershipWebhookPaymentCreate = (args: {
  readonly data: Record<string, unknown>;
}) => Promise<unknown>;

type MembershipWebhookSubscriptionRecord = {
  readonly cardType?: SailingCardTypeType | null;
  readonly id: string;
  readonly lastStripeSubscriptionEventCreatedAt?: Date | null;
  readonly stripeCustomerId?: string | null;
  readonly userId: string;
};

type MembershipWebhookSubscriptionClient = {
  findFirst(args: {
    readonly orderBy?: Record<string, unknown>;
    readonly where: Record<string, unknown>;
  }): Promise<MembershipWebhookSubscriptionRecord | null>;
  upsert(args: {
    readonly create: Record<string, unknown>;
    readonly update: Record<string, unknown>;
    readonly where: { readonly stripeSubscriptionId: string };
  }): Promise<MembershipWebhookSubscriptionRecord>;
};

type MembershipWebhookDbWithWrites = StripeWebhookDb & {
  readonly payment: StripeWebhookDb['payment'] & {
    create: MembershipWebhookPaymentCreate;
  };
  readonly sailingCardSubscription: MembershipWebhookSubscriptionClient;
};

type StripeSubscriptionShape = {
  readonly cancel_at_period_end?: boolean;
  readonly canceled_at?: number | null;
  readonly current_period_end?: number | null;
  readonly current_period_start?: number | null;
  readonly customer?: string | { id: string } | null;
  readonly ended_at?: number | null;
  readonly id?: string;
  readonly items?: {
    readonly data?: readonly {
      readonly id?: string;
      readonly price?: {
        readonly id?: string;
        readonly product?: string | { id: string } | null;
      };
    }[];
  };
  readonly metadata?: Record<string, unknown> | null;
  readonly status?: string;
  readonly trial_end?: number | null;
};

const membershipDomain = 'sailing_card_membership';
const activeCanonicalSubscriptionStatuses: readonly SailingCardSubscriptionStatusType[] =
  [
    SailingCardSubscriptionStatus.active,
    SailingCardSubscriptionStatus.trialing,
    SailingCardSubscriptionStatus.past_due,
  ];
const terminalMembershipPaymentStatuses: ReadonlySet<PaymentStatusType> =
  new Set([
    PaymentStatus.disputed,
    PaymentStatus.handled,
    PaymentStatus.refunded,
  ]);

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stripeExpandableId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return stringValue(objectValue(value)?.id);
}

function stripeDate(value: unknown): Date | null {
  const timestamp = numberValue(value);
  return timestamp === null ? null : new Date(timestamp * 1000);
}

function eventObject(event: ProcessableStripeEvent) {
  return objectValue(event.data.object) ?? {};
}

function metadataValue(value: unknown) {
  return objectValue(value) ?? {};
}

function objectMetadata(object: Record<string, unknown>) {
  return metadataValue(object.metadata);
}

function subscriptionMetadata(object: Record<string, unknown>) {
  return metadataValue(objectMetadata(object).subscription_details);
}

function parentSubscriptionMetadata(object: Record<string, unknown>) {
  const parent = objectValue(object.parent);
  return parent
    ? metadataValue(objectValue(parent.subscription_details)?.metadata)
    : {};
}

function eventMembershipMetadata(object: Record<string, unknown>) {
  const candidates = [
    objectMetadata(object),
    subscriptionMetadata(object),
    parentSubscriptionMetadata(object),
  ];
  return (
    candidates.find(
      (metadata) =>
        stringValue(metadata.domain) === membershipDomain ||
        stringValue(metadata.purpose) === 'membership'
    ) ?? {}
  );
}

function isMembershipStripeObject(object: Record<string, unknown>) {
  return Object.keys(eventMembershipMetadata(object)).length > 0;
}

function localPaymentId(object: Record<string, unknown>) {
  const metadata = eventMembershipMetadata(object);
  return (
    stringValue(metadata.localPaymentId) ??
    stringValue(metadata.paymentId) ??
    stringValue(object.client_reference_id)
  );
}

function membershipCardType(value: unknown): SailingCardTypeType | null {
  if (
    value === SailingCardType.racing ||
    value === SailingCardType.team_racing
  ) {
    return value;
  }
  return null;
}

function subscriptionStatus(value: unknown): SailingCardSubscriptionStatusType {
  if (typeof value !== 'string') {
    return SailingCardSubscriptionStatus.incomplete;
  }
  if (value === 'active') {
    return SailingCardSubscriptionStatus.active;
  }
  if (value === 'canceled') {
    return SailingCardSubscriptionStatus.canceled;
  }
  if (value === 'incomplete') {
    return SailingCardSubscriptionStatus.incomplete;
  }
  if (value === 'incomplete_expired') {
    return SailingCardSubscriptionStatus.incomplete_expired;
  }
  if (value === 'past_due') {
    return SailingCardSubscriptionStatus.past_due;
  }
  if (value === 'trialing') {
    return SailingCardSubscriptionStatus.trialing;
  }
  if (value === 'paused') {
    return SailingCardSubscriptionStatus.paused;
  }
  if (value === 'unpaid') {
    return SailingCardSubscriptionStatus.unpaid;
  }
  return SailingCardSubscriptionStatus.incomplete;
}

function subscriptionEventStatus(options: {
  readonly eventType: string;
  readonly value: unknown;
}) {
  if (options.eventType === 'customer.subscription.deleted') {
    return SailingCardSubscriptionStatus.canceled;
  }
  if (
    options.eventType === 'checkout.session.completed' &&
    options.value === undefined
  ) {
    return SailingCardSubscriptionStatus.active;
  }
  return subscriptionStatus(options.value);
}

function subscriptionFromValue(value: unknown): StripeSubscriptionShape | null {
  const object = objectValue(value);
  if (!object) {
    return null;
  }
  return object;
}

function subscriptionItem(subscription: StripeSubscriptionShape | null) {
  return subscription?.items?.data?.[0] ?? null;
}

function subscriptionProductId(subscription: StripeSubscriptionShape | null) {
  return stripeExpandableId(subscriptionItem(subscription)?.price?.product);
}

function subscriptionItemId(subscription: StripeSubscriptionShape | null) {
  return stringValue(subscriptionItem(subscription)?.id);
}

function subscriptionPriceId(subscription: StripeSubscriptionShape | null) {
  return stringValue(subscriptionItem(subscription)?.price?.id);
}

function hasMembershipSubscriptionClient(
  value: unknown
): value is MembershipWebhookSubscriptionClient {
  const subscriptionClient = objectValue(value);
  return (
    typeof subscriptionClient?.findFirst === 'function' &&
    typeof subscriptionClient.upsert === 'function'
  );
}

function hasMembershipWebhookDbWrites(
  db: StripeWebhookDb
): db is MembershipWebhookDbWithWrites {
  return (
    typeof db.payment.create === 'function' &&
    hasMembershipSubscriptionClient(db.sailingCardSubscription)
  );
}

function canApplyPaidPaymentTransition(payment: {
  readonly status: PaymentStatusType;
}) {
  return !terminalMembershipPaymentStatuses.has(payment.status);
}

async function findMembershipPayment(options: {
  readonly chargeId?: string | null;
  readonly db: MembershipWebhookDbWithWrites;
  readonly invoiceId?: string | null;
  readonly paymentId?: string | null;
  readonly paymentIntentId?: string | null;
  readonly sessionId?: string | null;
  readonly subscriptionId?: string | null;
}) {
  const OR: Record<string, unknown>[] = [];
  if (options.chargeId) {
    OR.push({ stripeChargeId: options.chargeId });
  }
  if (options.paymentId) {
    OR.push({ id: options.paymentId });
  }
  if (options.paymentIntentId) {
    OR.push({ stripePaymentIntentId: options.paymentIntentId });
  }
  if (options.sessionId) {
    OR.push({ stripeCheckoutSessionId: options.sessionId });
  }
  if (options.invoiceId) {
    OR.push({ stripeInvoiceId: options.invoiceId });
  }
  if (options.subscriptionId) {
    OR.push({
      membershipPaymentKind: MembershipPaymentKind.initial,
      stripeSubscriptionId: options.subscriptionId,
    });
  }
  if (OR.length === 0) {
    return null;
  }
  const payment = await options.db.payment.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { OR, purpose: PaymentPurpose.membership },
  });
  return payment;
}

async function existingCanonicalSubscription(options: {
  readonly cardType: SailingCardTypeType;
  readonly db: MembershipWebhookDbWithWrites;
  readonly stripeSubscriptionId: string;
  readonly userId: string;
}) {
  const subscription = await options.db.sailingCardSubscription.findFirst({
    orderBy: { createdAt: 'asc' },
    where: {
      canonicalSubscriptionId: null,
      cardType: options.cardType,
      status: { in: activeCanonicalSubscriptionStatuses },
      stripeSubscriptionId: { not: options.stripeSubscriptionId },
      userId: options.userId,
    },
  });
  return subscription;
}

async function upsertMembershipSubscription(options: {
  readonly cardType: SailingCardTypeType;
  readonly customerId: string;
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly localRenewalPriceId: string | null;
  readonly subscription: StripeSubscriptionShape | null;
  readonly subscriptionId: string;
  readonly userId: string;
}) {
  const eventCreatedAt = stripeEventCreatedAtDate(options.event);
  const existingSubscription =
    await options.db.sailingCardSubscription.findFirst({
      where: { stripeSubscriptionId: options.subscriptionId },
    });
  if (
    existingSubscription?.lastStripeSubscriptionEventCreatedAt &&
    existingSubscription.lastStripeSubscriptionEventCreatedAt > eventCreatedAt
  ) {
    return existingSubscription;
  }
  const canonicalSubscription = await existingCanonicalSubscription({
    cardType: options.cardType,
    db: options.db,
    stripeSubscriptionId: options.subscriptionId,
    userId: options.userId,
  });
  const status = canonicalSubscription
    ? SailingCardSubscriptionStatus.duplicate
    : subscriptionEventStatus({
        eventType: options.event.type,
        value: options.subscription?.status,
      });
  const update = {
    autoRenew: !options.subscription?.cancel_at_period_end,
    cancelAtPeriodEnd: Boolean(options.subscription?.cancel_at_period_end),
    canceledAt: stripeDate(options.subscription?.canceled_at),
    canonicalSubscriptionId: canonicalSubscription?.id ?? null,
    currentPeriodEnd: stripeDate(options.subscription?.current_period_end),
    currentPeriodStart: stripeDate(options.subscription?.current_period_start),
    currentRenewalPriceId: options.localRenewalPriceId,
    currentRenewalStripePriceId: subscriptionPriceId(options.subscription),
    duplicateStripeSubscriptionId: canonicalSubscription
      ? options.subscriptionId
      : null,
    endedAt: stripeDate(options.subscription?.ended_at),
    lastStripeSubscriptionEventCreatedAt: eventCreatedAt,
    lastStripeSubscriptionEventId: options.event.id,
    status,
    stripeProductId: subscriptionProductId(options.subscription),
    stripeSubscriptionItemId: subscriptionItemId(options.subscription),
    trialEnd: stripeDate(options.subscription?.trial_end),
  };
  return options.db.sailingCardSubscription.upsert({
    create: {
      ...update,
      cardType: options.cardType,
      stripeCustomerId: options.customerId,
      stripeSubscriptionId: options.subscriptionId,
      userId: options.userId,
    },
    update,
    where: { stripeSubscriptionId: options.subscriptionId },
  });
}

async function handleCheckoutCompleted(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly object: Record<string, unknown>;
}) {
  const checkoutSessionId = stringValue(options.object.id);
  const payment = await findMembershipPayment({
    db: options.db,
    paymentId: localPaymentId(options.object),
    sessionId: checkoutSessionId,
  });
  if (!payment?.userId) {
    throw new Error('Membership checkout payment not found.');
  }
  const subscription = subscriptionFromValue(options.object.subscription);
  const subscriptionId = stripeExpandableId(options.object.subscription);
  const customerId =
    stripeExpandableId(options.object.customer) ?? payment.stripeCustomerId;
  const cardType =
    payment.cardType ??
    membershipCardType(eventMembershipMetadata(options.object).cardType);
  if (!subscriptionId || !customerId || !cardType) {
    throw new Error(
      'Membership checkout session is missing subscription data.'
    );
  }
  const localSubscription = await upsertMembershipSubscription({
    cardType,
    customerId,
    db: options.db,
    event: options.event,
    localRenewalPriceId: payment.membershipRenewalPriceId ?? null,
    subscription,
    subscriptionId,
    userId: payment.userId,
  });
  await options.db.payment.updateMany({
    data: {
      activeCheckoutKey: null,
      membershipSubscriptionId: localSubscription.id,
      ...(stringValue(options.object.payment_status) === 'paid' &&
      canApplyPaidPaymentTransition(payment)
        ? { status: PaymentStatus.paid }
        : {}),
      stripeCheckoutSessionId: checkoutSessionId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
    where: { id: payment.id, status: payment.status },
  });
  return { handled: true };
}

async function handleCheckoutExpired(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly object: Record<string, unknown>;
}) {
  const checkoutSessionId = stringValue(options.object.id);
  const recoveryUrl = stringValue(
    objectValue(objectValue(options.object.after_expiration)?.recovery)?.url
  );
  const payment = await findMembershipPayment({
    db: options.db,
    paymentId: localPaymentId(options.object),
    sessionId: checkoutSessionId,
  });
  if (!payment) {
    return { handled: true };
  }
  await options.db.payment.updateMany({
    data: {
      activeCheckoutKey: null,
      status: recoveryUrl ? PaymentStatus.pending : PaymentStatus.cancelled,
      stripeCheckoutSessionExpiresAt: null,
      stripeCheckoutSessionId: checkoutSessionId,
      stripeCheckoutSessionUrl: recoveryUrl,
    },
    where: { id: payment.id, status: payment.status },
  });
  return { handled: true };
}

async function handleSubscriptionChanged(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly object: Record<string, unknown>;
}) {
  const subscription = subscriptionFromValue(options.object);
  const subscriptionId = stringValue(options.object.id);
  const metadata = objectMetadata(options.object);
  const payment = await findMembershipPayment({
    db: options.db,
    paymentId: stringValue(metadata.localPaymentId),
    subscriptionId,
  });
  const userId = stringValue(metadata.userId) ?? payment?.userId;
  const cardType =
    membershipCardType(metadata.cardType) ?? payment?.cardType ?? null;
  const customerId =
    stripeExpandableId(options.object.customer) ?? payment?.stripeCustomerId;
  if (!subscriptionId || !userId || !cardType || !customerId) {
    return { handled: false };
  }
  const localSubscription = await upsertMembershipSubscription({
    cardType,
    customerId,
    db: options.db,
    event: options.event,
    localRenewalPriceId:
      stringValue(metadata.renewalMembershipPriceId) ??
      payment?.membershipRenewalPriceId ??
      null,
    subscription,
    subscriptionId,
    userId,
  });
  if (payment) {
    await options.db.payment.updateMany({
      data: {
        membershipSubscriptionId: localSubscription.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
      where: { id: payment.id, status: payment.status },
    });
  }
  return { handled: true };
}

function invoiceSubscriptionId(object: Record<string, unknown>) {
  return (
    stripeExpandableId(object.subscription) ??
    stringValue(parentSubscriptionMetadata(object).subscription)
  );
}

function invoiceAmountCents(object: Record<string, unknown>) {
  const amountPaid = numberValue(object.amount_paid);
  const amountDue = numberValue(object.amount_due);
  if (amountPaid !== null) {
    return amountPaid;
  }
  if (amountDue !== null) {
    return amountDue;
  }
  logger.warn(
    '[membership-webhook] missing_invoice_amount invoice_id={invoiceId}',
    {
      invoiceId: stringValue(object.id) ?? 'unknown',
    }
  );
  return 0;
}

function invoiceCurrency(object: Record<string, unknown>) {
  return stringValue(object.currency)?.toLowerCase() ?? 'usd';
}

function objectChargeId(object: Record<string, unknown>) {
  return (
    stripeExpandableId(object.charge) ??
    stripeExpandableId(object.latest_charge) ??
    null
  );
}

function refundObjectId(object: Record<string, unknown>) {
  const id = stringValue(object.id);
  return id?.startsWith('re_') ? id : null;
}

function refundedChargeId(object: Record<string, unknown>) {
  const chargeId = stripeExpandableId(object.charge);
  if (chargeId) {
    return chargeId;
  }
  const id = stringValue(object.id);
  return id?.startsWith('ch_') ? id : null;
}

function issueRefundedAmountCents(options: {
  readonly object: Record<string, unknown>;
  readonly status:
    | typeof PaymentStatus.disputed
    | typeof PaymentStatus.refunded;
}) {
  return options.status === PaymentStatus.refunded
    ? numberValue(options.object.amount_refunded)
    : numberValue(options.object.amount);
}

function canApplyRefundObjectTransition(options: {
  readonly eventType: string;
  readonly object: Record<string, unknown>;
}) {
  return (
    (options.eventType !== 'refund.created' &&
      options.eventType !== 'refund.updated') ||
    stringValue(options.object.status) === 'succeeded'
  );
}

function isStalePaymentIssueEvent(options: {
  readonly event: ProcessableStripeEvent;
  readonly payment: { readonly lastStripePaymentEventCreatedAt?: Date | null };
}) {
  const lastEventCreatedAt = options.payment.lastStripePaymentEventCreatedAt;
  return (
    lastEventCreatedAt instanceof Date &&
    lastEventCreatedAt > stripeEventCreatedAtDate(options.event)
  );
}

async function handleInvoicePaid(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly object: Record<string, unknown>;
}) {
  const invoiceId = stringValue(options.object.id);
  const subscriptionId = invoiceSubscriptionId(options.object);
  const subscription = subscriptionFromValue(options.object.subscription);
  const metadata = eventMembershipMetadata(options.object);
  const payment = await findMembershipPayment({
    db: options.db,
    invoiceId,
    paymentId: stringValue(metadata.localPaymentId),
    subscriptionId,
  });
  const userId = stringValue(metadata.userId) ?? payment?.userId;
  const cardType =
    membershipCardType(metadata.cardType) ?? payment?.cardType ?? null;
  const customerId =
    stripeExpandableId(options.object.customer) ?? payment?.stripeCustomerId;
  if (!invoiceId || !subscriptionId || !userId || !cardType || !customerId) {
    throw new Error('Membership invoice is missing local context.');
  }
  const localSubscription = await upsertMembershipSubscription({
    cardType,
    customerId,
    db: options.db,
    event: options.event,
    localRenewalPriceId:
      stringValue(metadata.renewalMembershipPriceId) ??
      payment?.membershipRenewalPriceId ??
      null,
    subscription,
    subscriptionId,
    userId,
  });
  const chargeId = objectChargeId(options.object);
  const invoiceData = {
    lastStripeInvoiceEventCreatedAt: stripeEventCreatedAtDate(options.event),
    lastStripeInvoiceEventId: options.event.id,
    membershipSubscriptionId: localSubscription.id,
    stripeCustomerId: customerId,
    stripeHostedInvoiceUrl: stringValue(options.object.hosted_invoice_url),
    stripeInvoiceId: invoiceId,
    stripeInvoicePdfUrl: stringValue(options.object.invoice_pdf),
    ...(chargeId ? { stripeChargeId: chargeId } : {}),
    stripePaymentIntentId: stripeExpandableId(options.object.payment_intent),
    stripeReceiptUrl: stringValue(options.object.hosted_invoice_url),
    stripeSubscriptionId: subscriptionId,
  };
  if (payment) {
    await options.db.payment.updateMany({
      data: {
        ...invoiceData,
        ...(canApplyPaidPaymentTransition(payment)
          ? { status: PaymentStatus.paid }
          : {}),
      },
      where: { id: payment.id, status: payment.status },
    });
    return { handled: true };
  }
  await options.db.payment.create({
    data: {
      ...invoiceData,
      amountCents: invoiceAmountCents(options.object),
      cardType,
      cardYear: null,
      currency: invoiceCurrency(options.object),
      membershipPaymentKind: MembershipPaymentKind.renewal,
      membershipRenewalPriceId: stringValue(metadata.renewalMembershipPriceId),
      purpose: PaymentPurpose.membership,
      source: PaymentSource.stripe,
      status: PaymentStatus.paid,
      userId,
    },
  });
  return { handled: true };
}

async function handlePaymentReferenceSucceeded(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly object: Record<string, unknown>;
}) {
  const chargeId =
    options.event.type === 'charge.succeeded'
      ? stringValue(options.object.id)
      : objectChargeId(options.object);
  const paymentIntentId =
    options.event.type === 'payment_intent.succeeded'
      ? stringValue(options.object.id)
      : stripeExpandableId(options.object.payment_intent);
  const payment = await findMembershipPayment({
    chargeId,
    db: options.db,
    paymentId: localPaymentId(options.object),
    paymentIntentId,
  });
  if (!payment) {
    return { handled: true };
  }
  await options.db.payment.updateMany({
    data: {
      lastStripePaymentEventCreatedAt: stripeEventCreatedAtDate(options.event),
      lastStripePaymentEventId: options.event.id,
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    where: { id: payment.id, status: payment.status },
  });
  return { handled: true };
}

async function handleInvoicePaymentFailed(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly object: Record<string, unknown>;
}) {
  const invoiceId = stringValue(options.object.id);
  const subscriptionId = invoiceSubscriptionId(options.object);
  const subscription = subscriptionFromValue(options.object.subscription);
  const payment = await findMembershipPayment({
    db: options.db,
    invoiceId,
    subscriptionId,
  });
  const existingSubscription = subscriptionId
    ? await options.db.sailingCardSubscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      })
    : null;
  if (subscriptionId) {
    const userId = payment?.userId ?? existingSubscription?.userId;
    const cardType = payment?.cardType ?? existingSubscription?.cardType;
    const customerId =
      stripeExpandableId(options.object.customer) ??
      payment?.stripeCustomerId ??
      existingSubscription?.stripeCustomerId;
    if (userId && cardType && customerId) {
      await upsertMembershipSubscription({
        cardType,
        customerId,
        db: options.db,
        event: options.event,
        localRenewalPriceId: payment?.membershipRenewalPriceId ?? null,
        subscription,
        subscriptionId,
        userId,
      });
    }
  }
  if (payment) {
    await options.db.payment.updateMany({
      data: {
        issueKind: MembershipPaymentIssueKind.failed_payment,
        lastStripeInvoiceEventCreatedAt: stripeEventCreatedAtDate(
          options.event
        ),
        lastStripeInvoiceEventId: options.event.id,
        status: PaymentStatus.past_due,
        stripeHostedInvoiceUrl: stringValue(options.object.hosted_invoice_url),
        stripeInvoiceId: invoiceId,
        stripeInvoicePdfUrl: stringValue(options.object.invoice_pdf),
        stripeSubscriptionId: subscriptionId,
      },
      where: { id: payment.id, status: payment.status },
    });
  }
  return { handled: true };
}

async function markMembershipPaymentIssue(options: {
  readonly db: MembershipWebhookDbWithWrites;
  readonly event: ProcessableStripeEvent;
  readonly issueKind: MembershipPaymentIssueKindType;
  readonly object: Record<string, unknown>;
  readonly status:
    | typeof PaymentStatus.disputed
    | typeof PaymentStatus.refunded;
}) {
  const subscriptionId = stripeExpandableId(options.object.subscription);
  const chargeId =
    options.status === PaymentStatus.refunded
      ? refundedChargeId(options.object)
      : stripeExpandableId(options.object.charge);
  const refundedAmountCents = issueRefundedAmountCents({
    object: options.object,
    status: options.status,
  });
  const payment = await findMembershipPayment({
    chargeId,
    db: options.db,
    paymentId: stringValue(objectMetadata(options.object).localPaymentId),
    paymentIntentId: stripeExpandableId(options.object.payment_intent),
    subscriptionId,
  });
  if (!payment) {
    return { handled: isMembershipStripeObject(options.object) };
  }
  if (
    options.status === PaymentStatus.refunded &&
    !canApplyRefundObjectTransition({
      eventType: options.event.type,
      object: options.object,
    })
  ) {
    return { handled: true };
  }
  if (isStalePaymentIssueEvent({ event: options.event, payment })) {
    return { handled: true };
  }
  const refundId = refundObjectId(options.object);
  await options.db.payment.updateMany({
    data: {
      ...(options.status === PaymentStatus.disputed
        ? { disputeStatus: stringValue(options.object.status) }
        : {}),
      issueKind: options.issueKind,
      lastStripePaymentEventCreatedAt: stripeEventCreatedAtDate(options.event),
      lastStripePaymentEventId: options.event.id,
      ...(refundedAmountCents === null ? {} : { refundedAmountCents }),
      status: options.status,
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(options.status === PaymentStatus.disputed
        ? { stripeDisputeId: stringValue(options.object.id) }
        : {}),
      ...(refundId ? { stripeRefundId: refundId } : {}),
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
    options.event.type === 'charge.refunded' ||
    options.event.type === 'refund.created' ||
    options.event.type === 'refund.updated'
  ) {
    if (!hasMembershipWebhookDbWrites(options.db)) {
      throw new Error(
        'Membership Stripe webhooks require membership db access.'
      );
    }
    const result = await markMembershipPaymentIssue({
      db: options.db,
      event: options.event,
      issueKind: MembershipPaymentIssueKind.refunded_current_season,
      object,
      status: PaymentStatus.refunded,
    });
    return result;
  }
  if (
    options.event.type === 'charge.dispute.created' ||
    options.event.type === 'charge.dispute.updated'
  ) {
    if (!hasMembershipWebhookDbWrites(options.db)) {
      throw new Error(
        'Membership Stripe webhooks require membership db access.'
      );
    }
    const result = await markMembershipPaymentIssue({
      db: options.db,
      event: options.event,
      issueKind: MembershipPaymentIssueKind.disputed_current_season,
      object,
      status: PaymentStatus.disputed,
    });
    return result;
  }
  if (!isMembershipStripeObject(object)) {
    return { handled: false };
  }
  const { db } = options;
  if (!hasMembershipWebhookDbWrites(db)) {
    throw new Error('Membership Stripe webhooks require membership db access.');
  }

  if (options.event.type === 'checkout.session.completed') {
    const result = await handleCheckoutCompleted({
      db,
      event: options.event,
      object,
    });
    return result;
  }
  if (options.event.type === 'checkout.session.expired') {
    const result = await handleCheckoutExpired({ db, object });
    return result;
  }
  if (
    options.event.type === 'customer.subscription.created' ||
    options.event.type === 'customer.subscription.updated' ||
    options.event.type === 'customer.subscription.deleted'
  ) {
    const result = await handleSubscriptionChanged({
      db,
      event: options.event,
      object,
    });
    return result;
  }
  if (
    options.event.type === 'invoice.paid' ||
    options.event.type === 'invoice.payment_succeeded'
  ) {
    const result = await handleInvoicePaid({
      db,
      event: options.event,
      object,
    });
    return result;
  }
  if (options.event.type === 'invoice.payment_failed') {
    const result = await handleInvoicePaymentFailed({
      db,
      event: options.event,
      object,
    });
    return result;
  }
  if (
    options.event.type === 'payment_intent.succeeded' ||
    options.event.type === 'charge.succeeded'
  ) {
    const result = await handlePaymentReferenceSucceeded({
      db,
      event: options.event,
      object,
    });
    return result;
  }
  return { handled: false };
}
