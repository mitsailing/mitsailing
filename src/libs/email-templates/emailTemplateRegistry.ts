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

type EmailTemplateRegistryByKey = Readonly<{
  [Key in EditableEmailTemplateKey]: EmailTemplateRegistryEntry & {
    key: Key;
  };
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

const emailTemplateRegistry = {
  newsletter_broadcast: {
    allowedTokens: [
      'body',
      'listName',
      'managePreferencesLabel',
      'manageUrl',
      'postalAddress',
      'subject',
      'unsubscribeUrl',
    ],
    family: 'newsletter',
    key: 'newsletter_broadcast',
    nameKey: 'template_newsletter_broadcast',
  },
  pavilion_reservation_submitted: {
    allowedTokens: ['eventName', 'referenceCode'],
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_submitted',
    nameKey: 'template_pavilion_reservation_submitted',
  },
  pavilion_reservation_status: {
    allowedTokens: ['eventName', 'referenceCode', 'status'],
    family: 'pavilion_reservation',
    key: 'pavilion_reservation_status',
    nameKey: 'template_pavilion_reservation_status',
  },
  event_payment_request: {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_request',
    nameKey: 'template_event_payment_request',
  },
  event_payment_reminder: {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_reminder',
    nameKey: 'template_event_payment_reminder',
  },
  event_payment_receipt: {
    allowedTokens: eventPaymentTokens,
    family: 'event_payment',
    key: 'event_payment_receipt',
    nameKey: 'template_event_payment_receipt',
  },
  event_payment_admin_digest: {
    allowedTokens: ['deadline', 'eventName'],
    family: 'event_payment',
    key: 'event_payment_admin_digest',
    nameKey: 'template_event_payment_admin_digest',
  },
  membership_payment_reminder: {
    allowedTokens: ['amount', 'cardType', 'cardYear', 'onboardingUrl'],
    family: 'membership_payment',
    key: 'membership_payment_reminder',
    nameKey: 'template_membership_payment_reminder',
  },
} as const satisfies EmailTemplateRegistryByKey;

export function emailTemplateRegistryEntry(key: EditableEmailTemplateKey) {
  return emailTemplateRegistry[key];
}
