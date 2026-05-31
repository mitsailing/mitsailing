import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusValue } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type AdminPaymentLedgerFilters = {
  query?: string;
  status?: PaymentStatusValue | 'all';
};

export type AdminPaymentLedgerRow = {
  amountCents: number;
  createdAt: Date;
  event: {
    name: string;
    slug: string;
  } | null;
  legacyCategory: string | null;
  id: string;
  legacyDescription: string | null;
  legacySourceId: string | null;
  legacySourceTable: string | null;
  payerEmail: string | null;
  payerName: string | null;
  receiptUrl: string | null;
  status: PaymentStatusValue;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  user: {
    email: string;
    name: string;
  } | null;
};

export type AdminPaymentLedgerData = {
  rows: AdminPaymentLedgerRow[];
  latestWebhook: {
    eventType: string;
    processedAt: Date | null;
    stripeCreatedAt: Date;
  } | null;
};

export function adminPaymentStatusFromParam(
  status: string | undefined
): PaymentStatusValue | 'all' {
  for (const candidate of Object.values(PaymentStatus)) {
    if (candidate === status) {
      return candidate;
    }
  }
  return 'all';
}

function ledgerWhereFromFilters(
  filters: AdminPaymentLedgerFilters
): Prisma.PaymentWhereInput {
  const query = filters.query?.trim();
  const conditions: Prisma.PaymentWhereInput[] = [
    {
      OR: [
        { purpose: PaymentPurpose.event_payment },
        { purpose: PaymentPurpose.membership },
      ],
    },
  ];

  if (filters.status && filters.status !== 'all') {
    conditions.push({ status: filters.status });
  }

  if (query) {
    conditions.push({
      OR: [
        { event: { name: { contains: query, mode: 'insensitive' } } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
        { user: { name: { contains: query, mode: 'insensitive' } } },
        { legacyDescription: { contains: query, mode: 'insensitive' } },
        { legacySourceId: { contains: query } },
        { payerEmail: { contains: query, mode: 'insensitive' } },
        { payerName: { contains: query, mode: 'insensitive' } },
        { stripeCheckoutSessionId: { contains: query } },
        { stripePaymentIntentId: { contains: query } },
      ],
    });
  }

  return {
    AND: conditions,
  };
}

export async function listAdminPaymentLedgerData(
  filters: AdminPaymentLedgerFilters
): Promise<AdminPaymentLedgerData> {
  const [rows, latestWebhook] = await Promise.all([
    prisma.payment.findMany({
      where: ledgerWhereFromFilters(filters),
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        amountCents: true,
        createdAt: true,
        event: { select: { name: true, slug: true } },
        id: true,
        legacyCategory: true,
        legacyDescription: true,
        legacySourceId: true,
        legacySourceTable: true,
        payerEmail: true,
        payerName: true,
        status: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        stripeReceiptUrl: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.stripeWebhookEvent.findFirst({
      orderBy: { stripeCreatedAt: 'desc' },
      select: {
        eventType: true,
        processedAt: true,
        stripeCreatedAt: true,
      },
    }),
  ]);

  return {
    latestWebhook,
    rows: rows.map((row) => ({
      amountCents: row.amountCents,
      createdAt: row.createdAt,
      event: row.event,
      id: row.id,
      legacyCategory: row.legacyCategory,
      legacyDescription: row.legacyDescription,
      legacySourceId: row.legacySourceId,
      legacySourceTable: row.legacySourceTable,
      payerEmail: row.payerEmail,
      payerName: row.payerName,
      receiptUrl: row.stripeReceiptUrl,
      status: row.status,
      stripeCheckoutSessionId: row.stripeCheckoutSessionId,
      stripePaymentIntentId: row.stripePaymentIntentId,
      user: row.user,
    })),
  };
}
