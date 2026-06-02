import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import enMessages from '@/locales/en.json';

type DefaultEmailTemplateRevision = Readonly<{
  editorBodyHtml: string;
  family:
    | 'event_payment'
    | 'membership_payment'
    | 'newsletter'
    | 'pavilion_reservation';
  key: EditableEmailTemplateKey;
  name: string;
  previewText: string;
  renderedText: string;
  subject: string;
}>;

function escapedHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function paragraphHtml(value: string): string {
  return `<p>${escapedHtml(value)}</p>`;
}

const pavilionCopy = enMessages.PavilionReservationEmails;
const eventPaymentCopy = enMessages.EventPaymentEmails;
const membershipPaymentCopy = enMessages.MembershipPaymentEmails;

export const defaultEmailTemplateRevisions = [
  {
    editorBodyHtml: '<p>Write the newsletter body here.</p>',
    family: 'newsletter',
    key: 'newsletter_broadcast',
    name: 'Newsletter broadcast',
    previewText: 'Newsletter preview text',
    renderedText: 'Write the newsletter body here.',
    subject: 'Newsletter subject',
  },
  {
    editorBodyHtml: [
      paragraphHtml(pavilionCopy.submitted_body),
      paragraphHtml(pavilionCopy.footer_contact),
    ].join(''),
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_submitted',
    name: 'Pavilion reservation submitted',
    previewText: pavilionCopy.submitted_preview,
    renderedText: [
      pavilionCopy.submitted_body,
      pavilionCopy.footer_contact,
    ].join('\n\n'),
    subject: pavilionCopy.submitted_subject,
  },
  {
    editorBodyHtml: [
      paragraphHtml(pavilionCopy.status_body),
      paragraphHtml(pavilionCopy.footer_contact),
    ].join(''),
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_status',
    name: 'Pavilion reservation status',
    previewText: pavilionCopy.status_preview,
    renderedText: [pavilionCopy.status_body, pavilionCopy.footer_contact].join(
      '\n\n'
    ),
    subject: pavilionCopy.status_subject,
  },
  {
    editorBodyHtml: paragraphHtml(eventPaymentCopy.request_body),
    family: 'event_payment',
    key: 'event_payment_request',
    name: 'Event payment request',
    previewText: eventPaymentCopy.request_preview,
    renderedText: eventPaymentCopy.request_body,
    subject: eventPaymentCopy.request_subject,
  },
  {
    editorBodyHtml: paragraphHtml(eventPaymentCopy.reminder_body),
    family: 'event_payment',
    key: 'event_payment_reminder',
    name: 'Event payment reminder',
    previewText: eventPaymentCopy.reminder_preview,
    renderedText: eventPaymentCopy.reminder_body,
    subject: eventPaymentCopy.reminder_subject,
  },
  {
    editorBodyHtml: paragraphHtml(eventPaymentCopy.receipt_body),
    family: 'event_payment',
    key: 'event_payment_receipt',
    name: 'Event payment receipt',
    previewText: eventPaymentCopy.receipt_preview,
    renderedText: eventPaymentCopy.receipt_body,
    subject: eventPaymentCopy.receipt_subject,
  },
  {
    editorBodyHtml: paragraphHtml(eventPaymentCopy.admin_digest_body),
    family: 'event_payment',
    key: 'event_payment_admin_digest',
    name: 'Event payment admin digest',
    previewText: eventPaymentCopy.admin_digest_preview,
    renderedText: eventPaymentCopy.admin_digest_body,
    subject: eventPaymentCopy.admin_digest_subject,
  },
  {
    editorBodyHtml: paragraphHtml(membershipPaymentCopy.reminder_body),
    family: 'membership_payment',
    key: 'membership_payment_reminder',
    name: 'Membership payment reminder',
    previewText: membershipPaymentCopy.reminder_preview,
    renderedText: membershipPaymentCopy.reminder_body,
    subject: membershipPaymentCopy.reminder_subject,
  },
] as const satisfies readonly DefaultEmailTemplateRevision[];
