import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { EventPaymentStatus } from '@/generated/prisma/enums';
import type { EventPaymentStatus as EventPaymentStatusValue } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type AdminPaymentLedgerFilters = {
  query?: string;
  status?: EventPaymentStatusValue | 'all';
};

export type AdminPaymentLedgerRow = {
  amountCents: number;
  createdAt: Date;
  event: {
    name: string;
    slug: string;
  };
  id: string;
  receiptUrl: string | null;
  status: EventPaymentStatusValue;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  user: {
    email: string;
    name: string;
  };
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
): EventPaymentStatusValue | 'all' {
  for (const candidate of Object.values(EventPaymentStatus)) {
    if (candidate === status) {
      return candidate;
    }
  }
  return 'all';
}

function ledgerWhereFromFilters(
  filters: AdminPaymentLedgerFilters
): Prisma.EventPaymentWhereInput {
  const query = filters.query?.trim();
  return {
    ...(filters.status && filters.status !== 'all'
      ? { status: filters.status }
      : {}),
    ...(query
      ? {
          OR: [
            { event: { name: { contains: query, mode: 'insensitive' } } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
            { user: { name: { contains: query, mode: 'insensitive' } } },
            { stripeCheckoutSessionId: { contains: query } },
            { stripePaymentIntentId: { contains: query } },
          ],
        }
      : {}),
  };
}

export async function listAdminPaymentLedgerData(
  filters: AdminPaymentLedgerFilters
): Promise<AdminPaymentLedgerData> {
  const [rows, latestWebhook] = await Promise.all([
    prisma.eventPayment.findMany({
      where: ledgerWhereFromFilters(filters),
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        amountCents: true,
        createdAt: true,
        event: { select: { name: true, slug: true } },
        id: true,
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
      receiptUrl: row.stripeReceiptUrl,
      status: row.status,
      stripeCheckoutSessionId: row.stripeCheckoutSessionId,
      stripePaymentIntentId: row.stripePaymentIntentId,
      user: row.user,
    })),
  };
}
