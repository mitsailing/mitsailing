import { render } from 'react-email';
import { createUnlockAccountToken } from '@/libs/auth/unlock-token';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';
import { getBaseUrl } from '@/utils/Helpers';
import { AccountUnlockEmailTemplate } from '../../../emails/account-unlock';
import { DeleteAccountEmailTemplate } from '../../../emails/delete-account';
import { replaceAuthEmailValues } from '../../../emails/email-styles';
import { PasswordChangedNoticeTemplate } from '../../../emails/password-changed';
import { PasswordResetEmailTemplate } from '../../../emails/password-reset';
import { VerifyEmailTemplate } from '../../../emails/verify-email';

/** Support mailbox surfaced in transactional copy (env-configurable). */
const { SUPPORT_EMAIL } = Env;

type AuthEmailMessages = typeof enMessages.AuthEmails;

const authEmailMessages = enMessages.AuthEmails;

function normalizeAuthEmail(value: string): string {
  const email = normalizeEmailAddress(value);
  if (!isValidEmailAddress(email)) {
    throw new Error('Expected a valid email address.');
  }
  return email;
}

function assertNonEmptyValue(value: string, message: string): void {
  if (value.trim().length === 0) {
    throw new Error(message);
  }
}

type VerificationLinkCopy = {
  verify_body: string;
  verify_button: string;
  verify_expiry: string;
  verify_paste: string;
  verify_subject: string;
  verify_text: string;
};

function verificationLinkCopy(
  copy: AuthEmailMessages,
  purpose: 'verify-email' | 'change-email'
): VerificationLinkCopy {
  if (purpose === 'change-email') {
    return {
      verify_body: copy.change_email_body,
      verify_button: copy.change_email_button,
      verify_expiry: copy.change_email_expiry,
      verify_paste: copy.change_email_paste,
      verify_subject: copy.change_email_subject,
      verify_text: copy.change_email_text,
    };
  }

  return {
    verify_body: copy.verify_body,
    verify_button: copy.verify_button,
    verify_expiry: copy.verify_expiry,
    verify_paste: copy.verify_paste,
    verify_subject: copy.verify_subject,
    verify_text: copy.verify_text,
  };
}

/**
 * Sends the Better Auth email verification / change-email link.
 *
 * @param params - Link email parameters.
 * @param params.email - Recipient address (new address for email change).
 * @param params.purpose - Sign-up verification vs login-email change.
 * @param params.url - Absolute HTTPS verification URL with token.
 */
export async function sendEmailVerificationLink(params: {
  email: string;
  purpose: 'verify-email' | 'change-email';
  url: string;
}) {
  const email = normalizeAuthEmail(params.email);
  assertNonEmptyValue(params.url, 'Expected a verification URL.');
  const linkCopy = verificationLinkCopy(authEmailMessages, params.purpose);
  const html = await render(
    VerifyEmailTemplate({
      copy: linkCopy,
      verifyUrl: params.url,
    })
  );
  await sendTransactionalEmail({
    category:
      params.purpose === 'change-email' ? 'email_change' : 'verify_email',
    to: email,
    subject: linkCopy.verify_subject,
    html,
    text: replaceAuthEmailValues(linkCopy.verify_text, { url: params.url }),
  });
}

/**
 * Sends the current-address approval link for an email change.
 * Better Auth emails the new address only after this link is opened.
 *
 * @param params - Approval email parameters.
 * @param params.email - Current login address that must approve the change.
 * @param params.newEmail - Requested login address.
 * @param params.url - Absolute HTTPS approval URL with token.
 */
export async function sendChangeEmailConfirmationEmail(params: {
  email: string;
  newEmail: string;
  url: string;
}) {
  const email = normalizeAuthEmail(params.email);
  const newEmail = normalizeAuthEmail(params.newEmail);
  assertNonEmptyValue(params.url, 'Expected a change-email confirmation URL.');
  const copy = authEmailMessages;
  const values = { newEmail, url: params.url };
  const linkCopy = {
    verify_body: replaceAuthEmailValues(copy.change_email_confirm_body, values),
    verify_button: copy.change_email_confirm_button,
    verify_expiry: copy.change_email_confirm_expiry,
    verify_paste: copy.change_email_confirm_paste,
    verify_subject: copy.change_email_confirm_subject,
    verify_text: copy.change_email_confirm_text,
  };
  const html = await render(
    VerifyEmailTemplate({
      copy: linkCopy,
      verifyUrl: params.url,
    })
  );
  await sendTransactionalEmail({
    category: 'email_change',
    to: email,
    subject: linkCopy.verify_subject,
    html,
    text: replaceAuthEmailValues(linkCopy.verify_text, values),
  });
}

/**
 * Sends the Better Auth password-reset link email.
 * @param email - Recipient (login email).
 * @param url - Absolute HTTPS URL that opens the reset form with a token.
 */
export async function sendPasswordResetLinkEmail(email: string, url: string) {
  const copy = authEmailMessages;
  const normalizedEmail = normalizeAuthEmail(email);
  assertNonEmptyValue(url, 'Expected a password-reset URL.');
  const html = await render(
    PasswordResetEmailTemplate({ copy, resetUrl: url })
  );
  await sendTransactionalEmail({
    category: 'password_reset',
    to: normalizedEmail,
    subject: copy.reset_password_subject,
    html,
    text: replaceAuthEmailValues(copy.reset_password_text, { url }),
  });
}

/**
 * Sends the confirmation link for a delete-account request.
 * @param email - Recipient (current login email).
 * @param url - Absolute HTTPS URL that finalizes deletion.
 */
export async function sendDeleteAccountVerificationEmail(
  email: string,
  url: string
) {
  const copy = authEmailMessages;
  const normalizedEmail = normalizeAuthEmail(email);
  assertNonEmptyValue(url, 'Expected a delete-account confirmation URL.');
  const html = await render(DeleteAccountEmailTemplate({ confirmUrl: url }));
  await sendTransactionalEmail({
    category: 'delete_account',
    to: normalizedEmail,
    subject: copy.delete_account_subject,
    html,
    text: replaceAuthEmailValues(copy.delete_account_text, { url }),
  });
}

/**
 * Sent after repeated failed sign-ins. Devise Lockable parity: the email
 * carries a signed unlock URL that, when clicked, clears the
 * `failedLoginAttempt` rows for this address so the user can sign in
 * immediately. The 15-minute rolling window also auto-restores access for
 * users who do not receive the email.
 *
 * @param email - Recipient address tied to the locked account.
 */
export async function sendAccountLockedEmail(email: string) {
  const copy = authEmailMessages;
  const normalizedEmail = normalizeAuthEmail(email);
  const token = await createUnlockAccountToken(normalizedEmail);
  const unlockUrl = `${getBaseUrl()}/api/unlock-account?token=${encodeURIComponent(token)}`;
  const html = await render(
    AccountUnlockEmailTemplate({ unlockUrl, supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    category: 'account_locked',
    to: normalizedEmail,
    subject: copy.account_locked_subject,
    html,
    text: replaceAuthEmailValues(copy.account_locked_text, {
      email: SUPPORT_EMAIL,
      url: unlockUrl,
    }),
  });
}

/**
 * Notice sent to the account holder after a successful password change or
 * password reset. Secure Rails alignment: "notify users of password changes"
 * so an attacker cannot silently rotate credentials without the owner seeing.
 *
 * @param email - Recipient (current login email).
 */
export async function sendPasswordChangedNotice(email: string) {
  const copy = authEmailMessages;
  const normalizedEmail = normalizeAuthEmail(email);
  const html = await render(
    PasswordChangedNoticeTemplate({ supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    category: 'password_changed',
    to: normalizedEmail,
    subject: copy.password_changed_subject,
    html,
    text: [
      copy.password_changed_subject,
      copy.password_changed_body,
      replaceAuthEmailValues(copy.password_changed_contact, {
        email: SUPPORT_EMAIL,
      }),
    ].join('\n\n'),
  });
}
