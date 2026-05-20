import 'server-only';
import type { EventPaymentStatus as EventPaymentStatusValue } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type UserEventPaymentRow = {
  amountCents: number;
  createdAt: Date;
  event: {
    name: string;
    slug: string;
  };
  id: string;
  receiptUrl: string | null;
  status: EventPaymentStatusValue;
};

export async function listUserEventPayments(
  userId: string
): Promise<UserEventPaymentRow[]> {
  const rows = await prisma.eventPayment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      amountCents: true,
      createdAt: true,
      event: { select: { name: true, slug: true } },
      id: true,
      status: true,
      stripeReceiptUrl: true,
    },
  });
  return rows.map((row) => ({
    amountCents: row.amountCents,
    createdAt: row.createdAt,
    event: row.event,
    id: row.id,
    receiptUrl: row.stripeReceiptUrl,
    status: row.status,
  }));
}
