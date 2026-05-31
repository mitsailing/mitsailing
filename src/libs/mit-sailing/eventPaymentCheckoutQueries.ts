import 'server-only';
import { cache } from 'react';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

type EventPaymentCheckoutPageStatus = PaymentStatusType;

type EventPaymentCheckoutPagePayment = {
  id: string;
  amountCents: number;
  receiptUrl: string | null;
  status: EventPaymentCheckoutPageStatus;
};

type EventPaymentCheckoutPageData = {
  event: {
    id: string;
    name: string;
    slug: string;
  };
  payment: EventPaymentCheckoutPagePayment | null;
};

export const getEventPaymentCheckoutPageData = cache(
  async (
    slug: string,
    userId: string
  ): Promise<EventPaymentCheckoutPageData | null> => {
    const event = await prisma.event.findFirst({
      where: { isPublished: true, slug },
      select: { id: true, name: true, slug: true },
    });
    if (!event) {
      return null;
    }
    const registration = await prisma.eventRegistration.findFirst({
      where: {
        eventId: event.id,
        status: 'approved',
        userId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        payment: {
          select: {
            amountCents: true,
            id: true,
            purpose: true,
            status: true,
            stripeReceiptUrl: true,
          },
        },
      },
    });
    const payment =
      registration?.payment?.purpose === PaymentPurpose.event_payment
        ? registration.payment
        : null;

    return {
      event,
      payment: payment
        ? {
            amountCents: payment.amountCents,
            id: payment.id,
            receiptUrl: payment.stripeReceiptUrl,
            status: payment.status,
          }
        : null,
    };
  }
);

export function eventPaymentCheckoutIsPayable(
  status: EventPaymentCheckoutPageStatus
): boolean {
  return (
    status === PaymentStatus.checkout_created ||
    status === PaymentStatus.past_due ||
    status === PaymentStatus.pending
  );
}
