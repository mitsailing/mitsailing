const NEWSLETTER_BROADCAST_STATUS_KEYS = {
  cancelled: 'status_cancelled',
  draft: 'status_draft',
  failed: 'status_failed',
  paused: 'status_paused',
  queued: 'status_queued',
  sending: 'status_sending',
  sent: 'status_sent',
} as const;

function isNewsletterBroadcastStatus(
  status: string
): status is keyof typeof NEWSLETTER_BROADCAST_STATUS_KEYS {
  return Object.hasOwn(NEWSLETTER_BROADCAST_STATUS_KEYS, status);
}

export function newsletterBroadcastStatusKey(status: string) {
  return isNewsletterBroadcastStatus(status)
    ? NEWSLETTER_BROADCAST_STATUS_KEYS[status]
    : 'status_unknown';
}
