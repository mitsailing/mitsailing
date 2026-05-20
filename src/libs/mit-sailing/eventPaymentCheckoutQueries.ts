import 'server-only';
import { cache } from 'react';
import { EventPaymentStatus } from '@/generated/prisma/enums';
import type { EventPaymentStatus as EventPaymentStatusValue } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type EventPaymentCheckoutPagePayment = {
  id: string;
  amountCents: number;
  receiptUrl: string | null;
  status: EventPaymentStatusValue;
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
    const payment = await prisma.eventPayment.findFirst({
      where: {
        eventId: event.id,
        registration: { status: 'approved' },
        userId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        id: true,
        status: true,
        stripeReceiptUrl: true,
      },
    });

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
  status: EventPaymentStatusValue
): boolean {
  return (
    status === EventPaymentStatus.checkout_created ||
    status === EventPaymentStatus.past_due ||
    status === EventPaymentStatus.pending
  );
}
