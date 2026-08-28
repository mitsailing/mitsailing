import 'server-only';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
import { logger } from '@/libs/Logger';
import type { EventPaymentCheckoutSessionPayment } from '@/libs/stripe/stripeCheckoutSessions';
import { createEmbeddedEventPaymentCheckoutSession } from '@/libs/stripe/stripeCheckoutSessions';
import { getI18nPath } from '@/utils/Helpers';

type EventPaymentCheckoutDbPayment = {
  amountCents: number;
  currency: string;
  eventId: string | null;
  id: string;
  registrationId: string | null;
  selectedFeeDescription: string | null;
  status: PaymentStatusType;
  stripeCheckoutSessionId: string | null;
  userId: string | null;
};

type EventPaymentCheckoutDb = {
  payment: {
    findFirst: (args: {
      where: {
        id: string;
        purpose: typeof PaymentPurpose.event_payment;
        userId: string;
      };
    }) => Promise<EventPaymentCheckoutDbPayment | null>;
    updateMany: (args: {
      data: {
        status?: typeof PaymentStatus.checkout_created;
        stripeCheckoutSessionId?: string;
        stripeCustomerId?: string;
        stripePaymentIntentId?: string;
      };
      where: {
        id: string;
        status: PaymentStatusType;
        stripeCheckoutSessionId: string | null;
      };
    }) => Promise<{ count: number }>;
  };
};

type EventPaymentCheckoutStripe = Parameters<
  typeof createEmbeddedEventPaymentCheckoutSession
>[0]['stripe'];

const checkoutAllowedStatuses = new Set<PaymentStatusType>([
  PaymentStatus.checkout_created,
  PaymentStatus.past_due,
  PaymentStatus.pending,
]);

function eventCheckoutSessionPayment(
  payment: EventPaymentCheckoutDbPayment
): EventPaymentCheckoutSessionPayment | null {
  if (
    payment.eventId === null ||
    payment.registrationId === null ||
    payment.selectedFeeDescription === null ||
    payment.userId === null
  ) {
    return null;
  }
  return {
    amountCents: payment.amountCents,
    currency: payment.currency,
    eventId: payment.eventId,
    id: payment.id,
    registrationId: payment.registrationId,
    selectedFeeDescription: payment.selectedFeeDescription,
    userId: payment.userId,
  };
}

export function buildEventPaymentCheckoutReturnUrl(options: {
  appUrl: string;
  locale?: string;
  slug: string;
}): string {
  const baseUrl = options.appUrl.endsWith('/')
    ? options.appUrl.slice(0, -1)
    : options.appUrl;
  const checkoutPath = `/events/${encodeURIComponent(options.slug)}/checkout`;
  const localizedCheckoutPath = options.locale
    ? getI18nPath(checkoutPath, options.locale)
    : checkoutPath;
  return `${baseUrl}${localizedCheckoutPath}?session_id={CHECKOUT_SESSION_ID}`;
}

function checkoutSessionUpdateData(options: {
  checkoutSessionId: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
}) {
  return {
    status: PaymentStatus.checkout_created,
    stripeCheckoutSessionId: options.checkoutSessionId,
    ...(options.stripeCustomerId
      ? { stripeCustomerId: options.stripeCustomerId }
      : {}),
    ...(options.stripePaymentIntentId
      ? { stripePaymentIntentId: options.stripePaymentIntentId }
      : {}),
  };
}

export async function createEventPaymentCheckoutClientSecret(options: {
  db: EventPaymentCheckoutDb;
  paymentId: string;
  returnUrl: string;
  stripe?: EventPaymentCheckoutStripe;
  userId: string;
}): Promise<string | null> {
  const payment = await options.db.payment.findFirst({
    where: {
      id: options.paymentId,
      purpose: PaymentPurpose.event_payment,
      userId: options.userId,
    },
  });

  if (!payment || !checkoutAllowedStatuses.has(payment.status)) {
    return null;
  }
  const checkoutPayment = eventCheckoutSessionPayment(payment);
  if (!checkoutPayment) {
    logger.error(
      '[event-payment-checkout] payment_id={paymentId} reason=invalid_checkout_shape status={status}',
      {
        paymentId: payment.id,
        status: payment.status,
      }
    );
    return null;
  }
  if (
    payment.status === PaymentStatus.checkout_created &&
    payment.stripeCheckoutSessionId === null
  ) {
    return null;
  }

  if (payment.stripeCheckoutSessionId === null) {
    const claimResult = await options.db.payment.updateMany({
      data: { status: PaymentStatus.checkout_created },
      where: {
        id: payment.id,
        status: payment.status,
        stripeCheckoutSessionId: null,
      },
    });
    if (claimResult.count === 0) {
      logger.error(
        '[event-payment-checkout] payment_id={paymentId} reason=checkout_claim_lost status={status}',
        {
          paymentId: payment.id,
          status: payment.status,
        }
      );
      return null;
    }
  }

  const checkoutSession = await createEmbeddedEventPaymentCheckoutSession({
    payment: checkoutPayment,
    returnUrl: options.returnUrl,
    stripe: options.stripe,
  });

  const updateResult = await options.db.payment.updateMany({
    data: checkoutSessionUpdateData(checkoutSession),
    where: {
      id: payment.id,
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
    },
  });
  if (updateResult.count === 0) {
    logger.error(
      '[event-payment-checkout] payment_id={paymentId} reason=checkout_session_persist_lost checkout_session_id={checkoutSessionId}',
      {
        checkoutSessionId: checkoutSession.checkoutSessionId,
        paymentId: payment.id,
      }
    );
    return null;
  }

  return checkoutSession.clientSecret;
}
