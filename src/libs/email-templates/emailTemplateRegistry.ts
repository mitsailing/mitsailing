import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';

type EmailTemplateFamily =
  | 'event_payment'
  | 'membership_payment'
  | 'newsletter'
  | 'pavilion_reservation';

type EmailTemplateRegistryEntry = Readonly<{
  allowedTokens: readonly string[];
  family: EmailTemplateFamily;
  key: EditableEmailTemplateKey;
  nameKey: string;
}>;

const eventPaymentTokens = [
  'amount',
  'checkoutUrl',
  'deadline',
  'eventAddress',
  'eventAddressUrl',
  'eventName',
  'receiptUrl',
  'recipientName',
  'selectedFeeDescription',
] as const;

const emailTemplateRegistry = [
  {
    allowedTokens: [
      'body',
      'listName',
      'manageUrl',
      'postalAddress',
      'subject',
      'unsubscribeUrl',
    ],
    family: 'newsletter',
    key: 'newsletter_broadcast',
    nameKey: 'template_newsletter_broadcast',
  },
  {
    allowedTokens: ['eventName', 'referenceCode'],
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_submitted',
    nameKey: 'template_pavilion_reservation_submitted',
  },
  {
    allowedTokens: ['eventName', 'referenceCode', 'status'],
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_status',
    nameKey: 'template_pavilion_reservation_status',
  },
  {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_request',
    nameKey: 'template_event_payment_request',
  },
  {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_reminder',
    nameKey: 'template_event_payment_reminder',
  },
  {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_receipt',
    nameKey: 'template_event_payment_receipt',
  },
  {
    allowedTokens: ['deadline', 'eventName'],
    family: 'event_payment',
    key: 'event_payment_admin_digest',
    nameKey: 'template_event_payment_admin_digest',
  },
  {
    allowedTokens: ['amount', 'cardType', 'cardYear', 'onboardingUrl'],
    family: 'membership_payment',
    key: 'membership_payment_reminder',
    nameKey: 'template_membership_payment_reminder',
  },
] as const satisfies readonly EmailTemplateRegistryEntry[];

export function emailTemplateRegistryEntry(key: EditableEmailTemplateKey) {
  return emailTemplateRegistry.find((entry) => entry.key === key) ?? null;
}
