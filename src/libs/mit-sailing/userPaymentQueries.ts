import 'server-only';
import { PaymentPurpose } from '@/generated/prisma/enums';
import type {
  PaymentSource as PaymentSourceValue,
  PaymentStatus as PaymentStatusValue,
  SailingCardType,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type UserPaymentRow = {
  amountCents: number;
  cardType: SailingCardType | null;
  cardYear: number | null;
  createdAt: Date;
  event: {
    name: string;
    slug: string;
  } | null;
  id: string;
  legacyDescription: string | null;
  purpose: 'event' | 'membership';
  receiptUrl: string | null;
  source: PaymentSourceValue;
  status: PaymentStatusValue;
};

export async function listUserPayments(
  userId: string
): Promise<UserPaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      amountCents: true,
      cardType: true,
      cardYear: true,
      createdAt: true,
      event: { select: { name: true, slug: true } },
      id: true,
      legacyDescription: true,
      purpose: true,
      source: true,
      status: true,
      stripeReceiptUrl: true,
    },
  });
  const payments: UserPaymentRow[] = [];
  for (const row of rows) {
    if (row.purpose === PaymentPurpose.event_payment) {
      if (row.event || row.legacyDescription) {
        payments.push({
          amountCents: row.amountCents,
          cardType: null,
          cardYear: null,
          createdAt: row.createdAt,
          event: row.event,
          id: row.id,
          legacyDescription: row.legacyDescription,
          purpose: 'event',
          receiptUrl: row.stripeReceiptUrl,
          source: row.source,
          status: row.status,
        });
      }
      continue;
    }

    if (row.cardType && row.cardYear) {
      payments.push({
        amountCents: row.amountCents,
        cardType: row.cardType,
        cardYear: row.cardYear,
        createdAt: row.createdAt,
        event: null,
        id: row.id,
        legacyDescription: null,
        purpose: 'membership',
        receiptUrl: row.stripeReceiptUrl,
        source: row.source,
        status: row.status,
      });
    }
  }
  return payments;
}
