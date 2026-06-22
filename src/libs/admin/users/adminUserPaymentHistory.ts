import 'server-only';
import type {
  PaymentSource as PaymentSourceValue,
  PaymentStatus as PaymentStatusValue,
  SailingCardType as SailingCardTypeValue,
} from '@/generated/prisma/enums';
import { PaymentPurpose, SailingCardType } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export const ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE = 25;

type AdminUserPaymentHistoryDbRow = {
  amountCents: number;
  amountPaidCents: number | null;
  cardType: SailingCardTypeValue | null;
  cardYear: number | null;
  createdAt: Date;
  currency: string;
  event: { name: string; slug: string } | null;
  id: string;
  legacyDescription: string | null;
  manualHandledAt: Date | null;
  manualHandledBy: { name: string } | null;
  manualHandledNote: string | null;
  purpose: PaymentPurpose;
  source: PaymentSourceValue;
  status: PaymentStatusValue;
  stripeDiscountMetadata: unknown;
  stripeReceiptUrl: string | null;
};

export type AdminUserPaymentHistoryRow = {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
  readonly cardType: SailingCardTypeValue | null;
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
  readonly stripeDiscountMetadata: unknown;
  readonly title: string;
};

export type AdminUserPaymentHistoryPage = {
  readonly page: number;
  readonly pageSize: number;
  readonly rows: AdminUserPaymentHistoryRow[];
  readonly total: number;
};

const paymentHistorySelect = {
  amountCents: true,
  amountPaidCents: true,
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
  stripeDiscountMetadata: true,
  stripeReceiptUrl: true,
} as const;

const paymentHistoryWhere = {
  OR: [
    {
      purpose: PaymentPurpose.event_payment,
      OR: [{ eventId: { not: null } }, { legacyDescription: { not: null } }],
    },
    {
      cardType: { not: null },
      cardYear: { not: null },
      purpose: PaymentPurpose.membership,
    },
  ],
};

function paymentHistoryRowsFromDb(
  rows: readonly AdminUserPaymentHistoryDbRow[]
) {
  const historyRows: AdminUserPaymentHistoryRow[] = [];
  for (const row of rows) {
    if (row.purpose === PaymentPurpose.event_payment) {
      if (row.event || row.legacyDescription) {
        historyRows.push({
          amountCents: row.amountCents,
          amountPaidCents: row.amountPaidCents,
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
          stripeDiscountMetadata: row.stripeDiscountMetadata,
          title: row.event?.name ?? row.legacyDescription ?? '',
        });
      }
      continue;
    }

    if (row.cardType && row.cardYear) {
      historyRows.push({
        amountCents: row.amountCents,
        amountPaidCents: row.amountPaidCents,
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
        stripeDiscountMetadata: row.stripeDiscountMetadata,
        title: '',
      });
    }
  }
  return historyRows;
}

export async function listAdminUserPaymentHistory(
  userId: string
): Promise<AdminUserPaymentHistoryRow[]> {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    select: paymentHistorySelect,
    where: { userId },
  });

  return paymentHistoryRowsFromDb(rows);
}

export async function listAdminUserPaymentHistoryPage(options: {
  readonly page: number;
  readonly pageSize?: number;
  readonly userId: string;
}): Promise<AdminUserPaymentHistoryPage> {
  const pageSize = options.pageSize ?? ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE;
  const where = { ...paymentHistoryWhere, userId: options.userId };
  const total = await prisma.payment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(options.page, 1), totalPages);
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    select: paymentHistorySelect,
    skip: (page - 1) * pageSize,
    take: pageSize,
    where,
  });

  return {
    page,
    pageSize,
    rows: paymentHistoryRowsFromDb(rows),
    total,
  };
}

export async function listAdminUserCurrentMembershipPaymentAccessHistory(options: {
  readonly cardYear: number;
  readonly userId: string;
}): Promise<AdminUserPaymentHistoryRow[]> {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    select: paymentHistorySelect,
    take: 10,
    where: {
      cardType: {
        in: [SailingCardType.racing, SailingCardType.team_racing],
      },
      cardYear: options.cardYear,
      purpose: PaymentPurpose.membership,
      userId: options.userId,
    },
  });

  return paymentHistoryRowsFromDb(rows);
}
