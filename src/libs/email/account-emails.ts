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
import { replaceAuthEmailValues } from '../../../emails/email-styles';
import { PasswordChangedNoticeTemplate } from '../../../emails/password-changed';
import { PasswordResetEmailTemplate } from '../../../emails/password-reset';
import { SignInOtpEmailTemplate } from '../../../emails/sign-in-otp';
import { VerifyEmailTemplate } from '../../../emails/verify-email';

/** Support mailbox surfaced in transactional copy (env-configurable). */
const { SUPPORT_EMAIL } = Env;

type AuthEmailMessages = typeof enMessages.AuthEmails;

const authEmailMessages = enMessages.AuthEmails;

function verificationCodeText(params: {
  code: string;
  copy: AuthEmailMessages;
  purpose: 'verify-email' | 'reset-password' | 'change-email' | 'sign-in';
}): string {
  if (params.purpose === 'reset-password') {
    return replaceAuthEmailValues(params.copy.reset_password_text, {
      code: params.code,
    });
  }

  if (params.purpose === 'change-email') {
    return replaceAuthEmailValues(params.copy.change_email_text, {
      code: params.code,
    });
  }

  if (params.purpose === 'sign-in') {
    return replaceAuthEmailValues(params.copy.sign_in_otp_text, {
      code: params.code,
    });
  }

  return replaceAuthEmailValues(params.copy.verify_text, { code: params.code });
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
  const copy = authEmailMessages;

  switch (params.type) {
    case 'forget-password': {
      const html = await render(
        PasswordResetEmailTemplate({ code: params.otp })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: copy.reset_password_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          copy,
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
        subject: copy.change_email_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          copy,
          purpose: 'change-email',
        }),
      });
      return;
    }
    case 'sign-in': {
      const html = await render(
        SignInOtpEmailTemplate({
          code: params.otp,
          copy,
          supportEmail: SUPPORT_EMAIL,
        })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: copy.sign_in_otp_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          copy,
          purpose: 'sign-in',
        }),
      });
      return;
    }
    case 'email-verification': {
      const html = await render(
        VerifyEmailTemplate({ code: params.otp, supportEmail: SUPPORT_EMAIL })
      );
      await sendTransactionalEmail({
        to: params.email,
        subject: copy.verify_subject,
        html,
        text: verificationCodeText({
          code: params.otp,
          copy,
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
  const result = await prisma.user.updateMany({
    where: {
      id: params.userId,
      OR: [
        { unconfirmedEmail: null },
        { unconfirmedEmail: { not: params.newEmail } },
      ],
    },
    data: { unconfirmedEmail: params.newEmail },
  });
  return result.count > 0;
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
  const copy = authEmailMessages;
  const html = await render(
    EmailChangeRequestedNoticeTemplate({
      newEmail: params.newEmail,
      supportEmail: SUPPORT_EMAIL,
      previewText: copy.change_email_notice_preview,
      heading: copy.change_email_notice_subject,
      bodyMessage: copy.change_email_notice_body,
      contactMessage: copy.change_email_notice_contact,
    })
  );
  await sendTransactionalEmail({
    to: params.currentEmail,
    subject: copy.change_email_notice_subject,
    html,
    text: [
      copy.change_email_notice_subject,
      replaceAuthEmailValues(copy.change_email_notice_body, {
        email: params.newEmail,
      }),
      replaceAuthEmailValues(copy.change_email_notice_contact, {
        email: SUPPORT_EMAIL,
      }),
    ].join('\n\n'),
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
  const html = await render(DeleteAccountEmailTemplate({ confirmUrl: url }));
  await sendTransactionalEmail({
    to: email,
    subject: copy.delete_account_subject,
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
  const copy = authEmailMessages;
  const token = await createUnlockAccountToken(email);
  const unlockUrl = `${getBaseUrl()}/api/unlock-account?token=${encodeURIComponent(token)}`;
  const html = await render(
    AccountUnlockEmailTemplate({ unlockUrl, supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    to: email,
    subject: copy.account_locked_subject,
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
  const copy = authEmailMessages;
  const html = await render(
    PasswordChangedNoticeTemplate({ supportEmail: SUPPORT_EMAIL })
  );
  await sendTransactionalEmail({
    to: email,
    subject: copy.password_changed_subject,
    html,
  });
}
