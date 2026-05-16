export type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

type EmailDeliverabilityUser = {
  emailBouncedAt: Date | null;
  emailSuppressedAt: Date | null;
  emailSuppressionReason: string | null;
};

/**
 * Maps provider deliverability fields to the account warning state.
 *
 * @param user - User deliverability fields from Resend webhooks
 * @returns Suppressed before bounced because complaints/suppressions are terminal
 */
export function emailDeliverabilityStatus(
  user: EmailDeliverabilityUser
): EmailDeliverabilityStatus {
  if (user.emailSuppressedAt || user.emailSuppressionReason) {
    return 'suppressed';
  }
  if (user.emailBouncedAt) {
    return 'bounced';
  }
  return 'ok';
}
