import { render } from 'react-email';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import type { SendEmailResult } from '@/libs/email/sendTransactional';
import enMessages from '@/locales/en.json';
import { EventPaymentAdminDigestTemplate } from '../../../emails/event-payment-admin-digest';
import { EventPaymentReceiptTemplate } from '../../../emails/event-payment-receipt';
import { EventPaymentReminderTemplate } from '../../../emails/event-payment-reminder';
import { EventPaymentRequestTemplate } from '../../../emails/event-payment-request';

type EventPaymentEmailCopy = typeof enMessages.EventPaymentEmails;

type EventPaymentEmailParams = {
  amount: string;
  checkoutUrl: string;
  deadline: string;
  emailDedupeKey: string;
  eventAddress: string | null;
  eventAddressUrl: string | null;
  eventName: string;
  receiptUrl?: string | null;
  recipientEmail: string;
  recipientName: string;
  selectedFeeDescription: string;
};

type AdminDigestEmailParams = {
  adminEmail: string;
  deadline: string;
  emailDedupeKey: string;
  eventName: string;
  overduePayments: readonly {
    amount: string;
    recipientEmail: string;
    recipientName: string;
    selectedFeeDescription: string;
  }[];
};

function replacePaymentValues(
  message: string,
  values: { eventName: string }
): string {
  return message.replaceAll('{eventName}', values.eventName);
}

function paymentLines(
  params: EventPaymentEmailParams,
  copy: EventPaymentEmailCopy
): string[] {
  return [
    `${copy.field_event}: ${params.eventName}`,
    ...(params.eventAddress
      ? [`${copy.field_address}: ${params.eventAddress}`]
      : []),
    `${copy.field_fee}: ${params.selectedFeeDescription}`,
    `${copy.field_amount}: ${params.amount}`,
    `${copy.field_deadline}: ${params.deadline}`,
  ];
}

function requestText(
  params: EventPaymentEmailParams,
  copy: EventPaymentEmailCopy
): string {
  return [
    copy.request_heading,
    replacePaymentValues(copy.request_body, params),
    ...paymentLines(params, copy),
    `${copy.action_pay}: ${params.checkoutUrl}`,
  ].join('\n\n');
}

function reminderText(
  params: EventPaymentEmailParams,
  copy: EventPaymentEmailCopy
): string {
  return [
    copy.reminder_heading,
    replacePaymentValues(copy.reminder_body, params),
    ...paymentLines(params, copy),
    `${copy.action_pay}: ${params.checkoutUrl}`,
  ].join('\n\n');
}

function receiptText(
  params: EventPaymentEmailParams,
  copy: EventPaymentEmailCopy
): string {
  let addressLine: string | null = null;
  if (params.eventAddress && params.eventAddressUrl) {
    addressLine = `${copy.field_address}: ${params.eventAddress} (${params.eventAddressUrl})`;
  } else if (params.eventAddress) {
    addressLine = `${copy.field_address}: ${params.eventAddress}`;
  }
  return [
    copy.receipt_heading,
    replacePaymentValues(copy.receipt_body, params),
    `${copy.field_event}: ${params.eventName}`,
    addressLine,
    `${copy.field_fee}: ${params.selectedFeeDescription}`,
    `${copy.field_amount}: ${params.amount}`,
    params.receiptUrl ? `${copy.action_receipt}: ${params.receiptUrl}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n\n');
}

function adminDigestText(
  params: AdminDigestEmailParams,
  copy: EventPaymentEmailCopy
): string {
  return [
    copy.admin_digest_heading,
    replacePaymentValues(copy.admin_digest_body, params),
    `${copy.field_deadline}: ${params.deadline}`,
    ...params.overduePayments.map(
      (payment) =>
        `${payment.recipientName} <${payment.recipientEmail}>: ${payment.selectedFeeDescription}, ${payment.amount}`
    ),
  ].join('\n\n');
}

function paymentIdempotencyKey(
  kind: 'receipt' | 'reminder' | 'request',
  params: EventPaymentEmailParams
): string {
  return [`event-payment-${kind}`, params.emailDedupeKey].join(':');
}

export async function sendEventPaymentRequestEmail(
  params: EventPaymentEmailParams
): Promise<SendEmailResult> {
  const copy = enMessages.EventPaymentEmails;
  const html = await render(
    EventPaymentRequestTemplate({
      actionLabel: copy.action_pay,
      amount: params.amount,
      body: replacePaymentValues(copy.request_body, params),
      checkoutUrl: params.checkoutUrl,
      deadline: params.deadline,
      eventAddress: params.eventAddress,
      eventAddressUrl: params.eventAddressUrl,
      eventName: params.eventName,
      fieldAmount: copy.field_amount,
      fieldAddress: copy.field_address,
      fieldDeadline: copy.field_deadline,
      fieldEvent: copy.field_event,
      fieldFee: copy.field_fee,
      feeDescription: params.selectedFeeDescription,
      previewText: replacePaymentValues(copy.request_preview, params),
      title: copy.request_heading,
    })
  );
  return sendTransactionalEmail({
    category: 'event_payment_request',
    html,
    idempotencyKey: paymentIdempotencyKey('request', params),
    subject: replacePaymentValues(copy.request_subject, params),
    text: requestText(params, copy),
    to: params.recipientEmail,
  });
}

export async function sendEventPaymentReceiptEmail(
  params: EventPaymentEmailParams
): Promise<SendEmailResult> {
  const copy = enMessages.EventPaymentEmails;
  const html = await render(
    EventPaymentReceiptTemplate({
      actionLabel: copy.action_receipt,
      amount: params.amount,
      body: replacePaymentValues(copy.receipt_body, params),
      eventAddress: params.eventAddress,
      eventAddressUrl: params.eventAddressUrl,
      eventName: params.eventName,
      fieldAmount: copy.field_amount,
      fieldAddress: copy.field_address,
      fieldEvent: copy.field_event,
      fieldFee: copy.field_fee,
      feeDescription: params.selectedFeeDescription,
      previewText: replacePaymentValues(copy.receipt_preview, params),
      receiptUrl: params.receiptUrl,
      title: copy.receipt_heading,
    })
  );
  return sendTransactionalEmail({
    category: 'event_payment_receipt',
    html,
    idempotencyKey: paymentIdempotencyKey('receipt', params),
    subject: replacePaymentValues(copy.receipt_subject, params),
    text: receiptText(params, copy),
    to: params.recipientEmail,
  });
}

export async function sendEventPaymentReminderEmail(
  params: EventPaymentEmailParams
): Promise<SendEmailResult> {
  const copy = enMessages.EventPaymentEmails;
  const html = await render(
    EventPaymentReminderTemplate({
      actionLabel: copy.action_pay,
      amount: params.amount,
      body: replacePaymentValues(copy.reminder_body, params),
      checkoutUrl: params.checkoutUrl,
      deadline: params.deadline,
      eventAddress: params.eventAddress,
      eventAddressUrl: params.eventAddressUrl,
      eventName: params.eventName,
      fieldAmount: copy.field_amount,
      fieldAddress: copy.field_address,
      fieldDeadline: copy.field_deadline,
      fieldEvent: copy.field_event,
      fieldFee: copy.field_fee,
      feeDescription: params.selectedFeeDescription,
      previewText: replacePaymentValues(copy.reminder_preview, params),
      title: copy.reminder_heading,
    })
  );
  return sendTransactionalEmail({
    category: 'event_payment_reminder',
    html,
    idempotencyKey: paymentIdempotencyKey('reminder', params),
    subject: replacePaymentValues(copy.reminder_subject, params),
    text: reminderText(params, copy),
    to: params.recipientEmail,
  });
}

export async function sendEventPaymentAdminDigestEmail(
  params: AdminDigestEmailParams
): Promise<SendEmailResult> {
  const copy = enMessages.EventPaymentEmails;
  const html = await render(
    EventPaymentAdminDigestTemplate({
      body: replacePaymentValues(copy.admin_digest_body, params),
      deadline: params.deadline,
      eventName: params.eventName,
      overduePayments: params.overduePayments,
      previewText: replacePaymentValues(copy.admin_digest_preview, params),
      title: copy.admin_digest_heading,
    })
  );
  return sendTransactionalEmail({
    category: 'event_payment_admin_digest',
    html,
    idempotencyKey: `event-payment-admin-digest:${params.emailDedupeKey}`,
    subject: replacePaymentValues(copy.admin_digest_subject, params),
    text: adminDigestText(params, copy),
    to: params.adminEmail,
  });
}
