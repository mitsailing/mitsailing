export const NEWSLETTER_LIST_SLUGS = [
  'general',
  'racing',
  'bluewater',
  'windsurfing',
] as const;

export type NewsletterListSlug = (typeof NEWSLETTER_LIST_SLUGS)[number];

export const NEWSLETTER_FORM_SOURCE = {
  accountSignup: 'account_signup',
  admin: 'admin',
  profile: 'profile',
  publicSignup: 'public_signup',
  tokenManage: 'token_manage',
  oneClickUnsubscribe: 'one_click_unsubscribe',
} as const;

export const NEWSLETTER_QUEUE_NAME = 'newsletter-broadcasts';

export const NEWSLETTER_MANAGE_TOKEN_BYTES = 32;

export function isNewsletterListSlug(
  value: string
): value is NewsletterListSlug {
  return (NEWSLETTER_LIST_SLUGS as readonly string[]).includes(value);
}
