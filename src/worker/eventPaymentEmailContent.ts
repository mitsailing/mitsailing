import { PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { Env } from '@/libs/Env';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import enMessages from '@/locales/en.json';

export const EVENT_PAYMENT_REMINDER_STATUSES: PaymentStatusType[] = [
  PaymentStatus.checkout_created,
  PaymentStatus.past_due,
  PaymentStatus.pending,
];

export type PaymentEmailRow = {
  amountCents: number;
  event: {
    addressCity: string | null;
    addressCountry: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    addressName: string | null;
    addressPostalCode: string | null;
    addressState: string | null;
    dates?: readonly { startDateTime: Date }[];
    name: string;
    paymentDeadlineAt: Date | null;
    slug: string;
  };
  id: string;
  selectedFeeDescription: string;
  status: PaymentStatusType;
  stripeReceiptUrl: string | null;
  user: {
    email: string;
    name: string | null;
  };
};

function baseUrl(): string {
  return Env.NEXT_PUBLIC_APP_URL.endsWith('/')
    ? Env.NEXT_PUBLIC_APP_URL.slice(0, -1)
    : Env.NEXT_PUBLIC_APP_URL;
}

function checkoutUrl(payment: PaymentEmailRow): string {
  return `${baseUrl()}/events/${encodeURIComponent(payment.event.slug)}/checkout`;
}

function eventAddressLines(event: PaymentEmailRow['event']): string[] {
  return [
    event.addressName,
    event.addressLine1,
    event.addressLine2,
    [event.addressCity, event.addressState, event.addressPostalCode]
      .filter(Boolean)
      .join(' '),
    event.addressCountry,
  ].filter(
    (part): part is string => typeof part === 'string' && part.length > 0
  );
}

function eventAddressMapHref(lines: readonly string[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    lines.join(', ')
  )}`;
}

function formatEventPaymentDate(date: Date): string {
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: EVENTS_TIME_ZONE,
  }).format(date)} ET`;
}

export function eventPaymentDeadlineLabel(date: Date | null): string {
  return date
    ? formatEventPaymentDate(date)
    : enMessages.EventPaymentEmails.no_deadline;
}

export function paymentEmailParams(options: {
  dateKey: string;
  kind: 'receipt' | 'reminder' | 'request';
  payment: PaymentEmailRow;
}) {
  const addressLines = eventAddressLines(options.payment.event);
  return {
    amount: formatUsdMinorUnitsAsCurrency(options.payment.amountCents, 'en-US'),
    checkoutUrl: checkoutUrl(options.payment),
    deadline: eventPaymentDeadlineLabel(
      options.payment.event.paymentDeadlineAt
    ),
    emailDedupeKey: `${options.payment.id}:${options.kind}:${options.dateKey}`,
    eventAddress: addressLines.length > 0 ? addressLines.join(', ') : null,
    eventAddressUrl:
      addressLines.length > 0 ? eventAddressMapHref(addressLines) : null,
    eventName: options.payment.event.name,
    receiptUrl: options.payment.stripeReceiptUrl,
    recipientEmail: options.payment.user.email,
    recipientName: options.payment.user.name ?? options.payment.user.email,
    selectedFeeDescription: options.payment.selectedFeeDescription,
  };
}

function isPaymentPastEventDate(payment: PaymentEmailRow, now: Date): boolean {
  const dates = payment.event.dates ?? [];
  return dates.length > 0 && !dates.some((date) => date.startDateTime > now);
}

export function paymentCanReceiveNotification(options: {
  kind: 'receipt' | 'reminder' | 'request';
  now: Date;
  payment: PaymentEmailRow;
}): boolean {
  if (options.kind === 'receipt') {
    return options.payment.status === PaymentStatus.paid;
  }
  return (
    EVENT_PAYMENT_REMINDER_STATUSES.includes(options.payment.status) &&
    !isPaymentPastEventDate(options.payment, options.now)
  );
}
