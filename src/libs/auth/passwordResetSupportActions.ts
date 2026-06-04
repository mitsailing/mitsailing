'use server';

import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

const RESET_SUPPORT_RECIPIENT_EMAIL = 'ak@callred.com';

export type PasswordResetIssueResult =
  | { ok: true }
  | { error: 'invalid_email' | 'send_failed'; ok: false };

function escapeHtmlText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function reportPasswordResetIssueAction(input: {
  email: string;
}): Promise<PasswordResetIssueResult> {
  const email = normalizeEmailAddress(input.email);
  if (!isValidEmailAddress(email)) {
    return { error: 'invalid_email', ok: false };
  }

  try {
    await sendTransactionalEmail({
      category: 'other',
      to: RESET_SUPPORT_RECIPIENT_EMAIL,
      subject: 'Password reset help requested',
      html: `<p>A user reported trouble receiving a password reset or create-password email.</p><p>Email: ${escapeHtmlText(email)}</p>`,
      text: `A user reported trouble receiving a password reset or create-password email.\n\nEmail: ${email}`,
    });
  } catch {
    return { error: 'send_failed', ok: false };
  }

  return { ok: true };
}
