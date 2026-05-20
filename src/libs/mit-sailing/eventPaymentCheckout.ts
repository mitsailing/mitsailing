import 'server-only';
import { EventPaymentStatus } from '@/generated/prisma/enums';
import type { EventPaymentStatus as EventPaymentStatusType } from '@/generated/prisma/enums';
import type { EventPaymentCheckoutSessionPayment } from '@/libs/stripe/stripeCheckoutSessions';
import { createEmbeddedEventPaymentCheckoutSession } from '@/libs/stripe/stripeCheckoutSessions';
import { getI18nPath } from '@/utils/Helpers';

type EventPaymentCheckoutDbPayment = EventPaymentCheckoutSessionPayment & {
  status: EventPaymentStatusType;
  stripeCheckoutSessionId: string | null;
};

type EventPaymentCheckoutDb = {
  eventPayment: {
    findFirst: (args: {
      where: {
        id: string;
        OR: (
          | { event: { admins: { some: { adminUserId: string } } } }
          | { userId: string }
        )[];
      };
    }) => Promise<EventPaymentCheckoutDbPayment | null>;
    updateMany: (args: {
      data: {
        status: typeof EventPaymentStatus.checkout_created;
        stripeCheckoutSessionId: string;
        stripeCustomerId?: string;
        stripePaymentIntentId?: string;
      };
      where: {
        id: string;
        status: EventPaymentStatusType;
        stripeCheckoutSessionId: string | null;
      };
    }) => Promise<{ count: number }>;
  };
};

type EventPaymentCheckoutStripe = Parameters<
  typeof createEmbeddedEventPaymentCheckoutSession
>[0]['stripe'];

const checkoutAllowedStatuses = new Set<EventPaymentStatusType>([
  EventPaymentStatus.checkout_created,
  EventPaymentStatus.past_due,
  EventPaymentStatus.pending,
]);

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
    status: EventPaymentStatus.checkout_created,
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
  const payment = await options.db.eventPayment.findFirst({
    where: {
      id: options.paymentId,
      OR: [
        { userId: options.userId },
        { event: { admins: { some: { adminUserId: options.userId } } } },
      ],
    },
  });

  if (!payment || !checkoutAllowedStatuses.has(payment.status)) {
    return null;
  }

  const checkoutSession = await createEmbeddedEventPaymentCheckoutSession({
    payment,
    returnUrl: options.returnUrl,
    stripe: options.stripe,
  });

  const updateResult = await options.db.eventPayment.updateMany({
    data: checkoutSessionUpdateData(checkoutSession),
    where: {
      id: payment.id,
      status: payment.status,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
    },
  });
  if (updateResult.count === 0) {
    return null;
  }

  return checkoutSession.clientSecret;
}
