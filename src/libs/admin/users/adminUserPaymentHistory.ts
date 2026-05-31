import 'server-only';
import { PaymentPurpose } from '@/generated/prisma/enums';
import type {
  PaymentSource as PaymentSourceValue,
  PaymentStatus as PaymentStatusValue,
  SailingCardType,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type AdminUserPaymentHistoryRow = {
  readonly amountCents: number;
  readonly cardType: SailingCardType | null;
  readonly cardYear: number | null;
  readonly createdAt: Date;
  readonly currency: string;
  readonly detailHref: string | null;
  readonly id: string;
  readonly manualHandledAt: Date | null;
  readonly manualHandledByName: string | null;
  readonly manualHandledNote: string | null;
  readonly purpose: 'event' | 'membership';
  readonly receiptHref: string | null;
  readonly source: PaymentSourceValue;
  readonly status: PaymentStatusValue;
  readonly title: string;
};

export async function listAdminUserPaymentHistory(
  userId: string
): Promise<AdminUserPaymentHistoryRow[]> {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      amountCents: true,
      cardType: true,
      cardYear: true,
      createdAt: true,
      currency: true,
      event: { select: { name: true, slug: true } },
      id: true,
      legacyDescription: true,
      manualHandledAt: true,
      manualHandledBy: { select: { name: true } },
      manualHandledNote: true,
      purpose: true,
      source: true,
      status: true,
      stripeReceiptUrl: true,
    },
    where: { userId },
  });

  const historyRows: AdminUserPaymentHistoryRow[] = [];
  for (const row of rows) {
    if (row.purpose === PaymentPurpose.event_payment) {
      if (row.event || row.legacyDescription) {
        historyRows.push({
          amountCents: row.amountCents,
          cardType: null,
          cardYear: null,
          createdAt: row.createdAt,
          currency: row.currency,
          detailHref: row.event ? `/events/${row.event.slug}` : null,
          id: row.id,
          manualHandledAt: row.manualHandledAt,
          manualHandledByName: row.manualHandledBy?.name ?? null,
          manualHandledNote: row.manualHandledNote,
          purpose: 'event',
          receiptHref: row.stripeReceiptUrl,
          source: row.source,
          status: row.status,
          title: row.event?.name ?? row.legacyDescription ?? '',
        });
      }
      continue;
    }

    if (row.cardType && row.cardYear) {
      historyRows.push({
        amountCents: row.amountCents,
        cardType: row.cardType,
        cardYear: row.cardYear,
        createdAt: row.createdAt,
        currency: row.currency,
        detailHref: null,
        id: row.id,
        manualHandledAt: row.manualHandledAt,
        manualHandledByName: row.manualHandledBy?.name ?? null,
        manualHandledNote: row.manualHandledNote,
        purpose: 'membership',
        receiptHref: row.stripeReceiptUrl,
        source: row.source,
        status: row.status,
        title: '',
      });
    }
  }
  return historyRows;
}
