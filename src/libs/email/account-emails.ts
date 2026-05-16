import { render } from 'react-email';
import { createUnlockAccountToken } from '@/libs/auth/unlock-token';
import { prisma } from '@/libs/DB';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';
import { getBaseUrl } from '@/utils/Helpers';
import { AccountUnlockEmailTemplate } from '../../../emails/account-unlock';
import { ConfirmEmailChangeTemplate } from '../../../emails/confirm-email-change';
import { DeleteAccountEmailTemplate } from '../../../emails/delete-account';
import {
  EmailChangeRequestedNoticePlaintext,
  EmailChangeRequestedNoticeTemplate,
} from '../../../emails/email-change-requested';
import { replaceAuthEmailValues } from '../../../emails/email-styles';
import { PasswordChangedNoticeTemplate } from '../../../emails/password-changed';
import { PasswordResetEmailTemplate } from '../../../emails/password-reset';
import {
  SignInOtpEmailPlaintext,
  SignInOtpEmailTemplate,
} from '../../../emails/sign-in-otp';
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

function assertEmailOtpCode(otp: string): void {
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('Expected a six-digit email OTP code.');
  }
}

function assertNonEmptyValue(value: string, message: string): void {
  if (value.trim().length === 0) {
    throw new Error(message);
  }
}

function verificationCodeText(params: {
  code: string;
  copy: AuthEmailMessages;
  purpose: 'verify-email' | 'reset-password' | 'change-email';
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
  const email = normalizeAuthEmail(params.email);
  assertEmailOtpCode(params.otp);
  const copy = authEmailMessages;

  switch (params.type) {
    case 'forget-password': {
      const html = await render(
        PasswordResetEmailTemplate({ code: params.otp, copy })
      );
      await sendTransactionalEmail({
        category: 'password_reset',
        to: email,
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
        category: 'email_change',
        to: email,
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
        category: 'sign_in_otp',
        to: email,
        subject: copy.sign_in_otp_subject,
        html,
        text: SignInOtpEmailPlaintext({
          code: params.otp,
          copy,
          supportEmail: SUPPORT_EMAIL,
        }),
      });
      return;
    }
    case 'email-verification': {
      const html = await render(
        VerifyEmailTemplate({
          code: params.otp,
          copy,
          supportEmail: SUPPORT_EMAIL,
        })
      );
      await sendTransactionalEmail({
        category: 'verify_email',
        to: email,
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
  const newEmail = normalizeAuthEmail(params.newEmail);
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });

  if (!user || normalizeEmailAddress(user.email) === newEmail) {
    return false;
  }

  const result = await prisma.user.updateMany({
    where: {
      id: params.userId,
      OR: [{ unconfirmedEmail: null }, { unconfirmedEmail: { not: newEmail } }],
    },
    data: { unconfirmedEmail: newEmail },
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
  const currentEmail = normalizeAuthEmail(params.currentEmail);
  const newEmail = normalizeAuthEmail(params.newEmail);
  const html = await render(
    EmailChangeRequestedNoticeTemplate({
      newEmail,
      supportEmail: SUPPORT_EMAIL,
      previewText: copy.change_email_notice_preview,
      heading: copy.change_email_notice_subject,
      bodyMessage: copy.change_email_notice_body,
      contactMessage: copy.change_email_notice_contact,
    })
  );
  await sendTransactionalEmail({
    category: 'email_change',
    to: currentEmail,
    subject: copy.change_email_notice_subject,
    html,
    text: EmailChangeRequestedNoticePlaintext({
      newEmail,
      supportEmail: SUPPORT_EMAIL,
      previewText: copy.change_email_notice_preview,
      heading: copy.change_email_notice_subject,
      bodyMessage: copy.change_email_notice_body,
      contactMessage: copy.change_email_notice_contact,
    }),
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
