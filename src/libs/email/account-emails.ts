import { render } from 'react-email';
import { createUnlockAccountToken } from '@/libs/auth/unlock-token';
import { prisma } from '@/libs/DB';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';
import { getBaseUrl } from '@/utils/Helpers';
import { AccountUnlockEmailTemplate } from '../../../emails/account-unlock';
import { ConfirmEmailChangeTemplate } from '../../../emails/confirm-email-change';
import { DeleteAccountEmailTemplate } from '../../../emails/delete-account';
import { EmailChangeRequestedNoticeTemplate } from '../../../emails/email-change-requested';
import { PasswordChangedNoticeTemplate } from '../../../emails/password-changed';
import { PasswordResetEmailTemplate } from '../../../emails/password-reset';
import { SignInOtpEmailTemplate } from '../../../emails/sign-in-otp';
import { VerifyEmailTemplate } from '../../../emails/verify-email';

const subjects = enMessages.AuthEmails;

/** Support mailbox surfaced in transactional copy (env-configurable). */
const { SUPPORT_EMAIL } = Env;

function verificationCodeText(params: {
  code: string;
  purpose: 'verify-email' | 'reset-password' | 'change-email' | 'sign-in';
}): string {
  if (params.purpose === 'reset-password') {
    return `Your MIT Sailing password reset code is ${params.code}.\n\nThis code expires in 5 minutes.`;
  }

  if (params.purpose === 'change-email') {
    return `Your MIT Sailing email change confirmation code is ${params.code}.\n\nThis code expires in 5 minutes.`;
  }

  if (params.purpose === 'sign-in') {
    return `Your MIT Sailing sign-in code is ${params.code}.\n\nThis code expires in 5 minutes.`;
  }

  return `Your MIT Sailing verification code is ${params.code}.\n\nThis code expires in 5 minutes.`;
}

/**
 * Sends an email OTP for verification, password reset, or email change.
 *
 * @param params - OTP email parameters.
 * @param params.email - Recipient address.
 * @param params.otp - Numeric one-time code.
 * @param params.type - Better Auth OTP purpose.
 */
export async function sendEmailOtpCode(params: {
  email: string;
  otp: string;
  type: 'email-verification' | 'forget-password' | 'change-email' | 'sign-in';
}) {
  switch (params.type) {
    case 'forget-password': {
      const html = await render(
        PasswordResetEmailTemplate({ code: params.otp })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: subjects.reset_password_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          purpose: 'reset-password',
        }),
      });
      return;
    }
    case 'change-email': {
      const html = await render(
        ConfirmEmailChangeTemplate({
          code: params.otp,
          supportEmail: SUPPORT_EMAIL,
        })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: subjects.change_email_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          purpose: 'change-email',
        }),
      });
      return;
    }
    case 'sign-in': {
      const html = await render(
        SignInOtpEmailTemplate({
          code: params.otp,
          supportEmail: SUPPORT_EMAIL,
        })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: subjects.sign_in_otp_subject,
        html,
        text: verificationCodeText({ code: params.otp, purpose: 'sign-in' }),
      });
      return;
    }
    case 'email-verification': {
      const html = await render(
        VerifyEmailTemplate({ code: params.otp, supportEmail: SUPPORT_EMAIL })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: subjects.verify_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          purpose: 'verify-email',
        }),
      });
      return;
    }
    default: {
      const exhaustive: never = params.type;
      throw new Error(`Unsupported email OTP type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Records the proposed email address while the OTP is pending.
 *
 * @param params - Pending email details.
 * @param params.userId - Current user ID.
 * @param params.newEmail - Proposed login email.
 * @returns True when the pending address changed.
 */
export async function markPendingEmailChange(params: {
  userId: string;
  newEmail: string;
}): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { unconfirmedEmail: true },
  });
  await prisma.user.update({
    where: { id: params.userId },
    data: { unconfirmedEmail: params.newEmail },
  });
  return existing?.unconfirmedEmail !== params.newEmail;
}

/**
 * Notifies the current login email that a change was requested.
 *
 * @param params - Notice details.
 * @param params.currentEmail - Current verified login email.
 * @param params.newEmail - Proposed replacement login email.
 */
export async function sendEmailChangeRequestedNotice(params: {
  currentEmail: string;
  newEmail: string;
}) {
  const html = await render(
    EmailChangeRequestedNoticeTemplate({
      newEmail: params.newEmail,
      supportEmail: SUPPORT_EMAIL,
    })
  );
  await sendTransactionalEmail({
    to: params.currentEmail,
    subject: subjects.change_email_notice_subject,
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
