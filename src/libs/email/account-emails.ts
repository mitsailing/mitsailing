import { render } from '@react-email/render';
import { createUnlockAccountToken } from '@/libs/auth/unlock-token';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';
import { getBaseUrl } from '@/utils/Helpers';
import { AccountUnlockEmailTemplate } from '../../../emails/account-unlock';
import { ConfirmEmailChangeTemplate } from '../../../emails/confirm-email-change';
import { DeleteAccountEmailTemplate } from '../../../emails/delete-account';
import { PasswordChangedNoticeTemplate } from '../../../emails/password-changed';
import { PasswordResetEmailTemplate } from '../../../emails/password-reset';
import { VerifyEmailTemplate } from '../../../emails/verify-email';

const subjects = enMessages.AuthEmails;

/** Support mailbox surfaced in transactional copy (env-configurable). */
const { SUPPORT_EMAIL } = Env;

/**
 * Sends sign-up verification email via React Email + Resend. The body now
 * states the 1-hour expiry and points users at resend/support, matching the
 * `sendOnSignIn` + unverified-error copy on the sign-in page.
 *
 * @param email - Recipient address.
 * @param url - Absolute HTTPS URL that completes verification.
 */
export async function sendVerificationEmail(email: string, url: string) {
  const html = await render(
    VerifyEmailTemplate({ verifyUrl: url, supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    to: email,
    subject: subjects.verify_subject,
    html,
  });
}

/**
 * Sends password reset email.
 * @param email - Recipient address.
 * @param url - Absolute HTTPS URL carrying the reset token.
 */
export async function sendPasswordResetEmail(email: string, url: string) {
  const html = await render(PasswordResetEmailTemplate({ resetUrl: url }));
  await sendTransactionalEmail({
    to: email,
    subject: subjects.reset_password_subject,
    html,
  });
}

/**
 * Sends the confirmation link that finalizes an email change. Better Auth
 * delivers to the CURRENT (verified) email first, so this message doubles as
 * the secure_rails "notify the old address on email change" notice: the body
 * names the proposed new address and directs the owner to support if they
 * did not initiate the change.
 *
 * @param currentEmail - Recipient (the current, verified email on file).
 * @param newEmail - Proposed replacement login email (confirmation body copy).
 * @param url - Absolute HTTPS URL that completes the swap.
 */
export async function sendChangeEmailConfirmationEmail(
  currentEmail: string,
  newEmail: string,
  url: string
) {
  const html = await render(
    ConfirmEmailChangeTemplate({
      confirmUrl: url,
      newEmail,
      supportEmail: SUPPORT_EMAIL,
    })
  );
  await sendTransactionalEmail({
    to: currentEmail,
    subject: subjects.change_email_subject,
    html,
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
  const html = await render(DeleteAccountEmailTemplate({ confirmUrl: url }));
  await sendTransactionalEmail({
    to: email,
    subject: subjects.delete_account_subject,
    html,
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
  const token = await createUnlockAccountToken(email);
  const unlockUrl = `${getBaseUrl()}/api/unlock-account?token=${encodeURIComponent(token)}`;
  const html = await render(
    AccountUnlockEmailTemplate({ unlockUrl, supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    to: email,
    subject: subjects.account_locked_subject,
    html,
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
  const html = await render(
    PasswordChangedNoticeTemplate({ supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    to: email,
    subject: subjects.password_changed_subject,
    html,
  });
}
