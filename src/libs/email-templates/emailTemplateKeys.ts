export const editableEmailTemplateKeys = [
  'newsletter_broadcast',
  'pavilion_reservation_submitted',
  'pavilion_reservation_status',
  'event_payment_request',
  'event_payment_reminder',
  'event_payment_receipt',
  'event_payment_admin_digest',
  'membership_payment_reminder',
] as const;

export type EditableEmailTemplateKey =
  (typeof editableEmailTemplateKeys)[number];
