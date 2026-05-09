import { render } from 'react-email';
import { describe, expect, it } from 'vitest';
import enMessages from '@/locales/en.json';
import { AccountUnlockEmailTemplate } from './account-unlock';
import { ConfirmEmailChangeTemplate } from './confirm-email-change';
import { DeleteAccountEmailTemplate } from './delete-account';
import { EmailChangeRequestedNoticeTemplate } from './email-change-requested';
import { EmailLayout } from './email-layout';
import { PasswordChangedNoticeTemplate } from './password-changed';
import { PasswordResetEmailTemplate } from './password-reset';
import { SignInOtpEmailTemplate } from './sign-in-otp';
import { VerifyEmailTemplate } from './verify-email';

const SUPPORT_EMAIL = 'support@example.com';

describe('email templates', () => {
  it('renders shared layout chrome with preview text', async () => {
    const html = await render(
      <EmailLayout previewText="Inbox preview">
        <p>Inner account notice</p>
      </EmailLayout>
    );

    expect(html).toContain('Inbox preview');
    expect(html).toContain('Your app');
    expect(html).toContain('Inner account notice');
    expect(html).toContain(
      'You received this email because of an action on your account.'
    );
  });

  it('renders verification code content for new sailors', async () => {
    const html = await render(
      <VerifyEmailTemplate
        code="123456"
        copy={enMessages.AuthEmails}
        supportEmail={SUPPORT_EMAIL}
      />
    );

    expect(html).toContain('Confirm your email');
    expect(html).toContain('123456');
    expect(html).toContain('This code expires in 5 minutes');
    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
    expect(html).toContain('Thanks for signing up');
  });

  it('rejects malformed verification codes', () => {
    expect(() =>
      VerifyEmailTemplate({
        code: '12345',
        copy: enMessages.AuthEmails,
        supportEmail: SUPPORT_EMAIL,
      })
    ).toThrow('VerifyEmailTemplate requires a six-digit code.');
  });

  it('renders sign-in OTP content without sign-up wording', async () => {
    const html = await render(
      <SignInOtpEmailTemplate
        code="111222"
        copy={enMessages.AuthEmails}
        supportEmail={SUPPORT_EMAIL}
      />
    );

    expect(html).toContain('Sign in with your code');
    expect(html).toContain('111222');
    expect(html).toContain('sign-in screen');
    expect(html).not.toContain('Thanks for signing up');
    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('rejects malformed sign-in OTP codes', () => {
    expect(() =>
      SignInOtpEmailTemplate({
        code: 'abc123',
        copy: enMessages.AuthEmails,
        supportEmail: SUPPORT_EMAIL,
      })
    ).toThrow('SignInOtpEmailTemplate requires a six-digit code.');
  });

  it('renders every sign-in OTP code token', async () => {
    const html = await render(
      <SignInOtpEmailTemplate
        code="111222"
        copy={{
          ...enMessages.AuthEmails,
          sign_in_otp_body: 'Use {code}, then enter {code}.',
        }}
        supportEmail={SUPPORT_EMAIL}
      />
    );

    expect(html).toContain('Use 111222, then enter 111222.');
    expect(html).not.toContain('{code}');
  });

  it('renders sign-in OTP fallback support copy', async () => {
    const html = await render(
      <SignInOtpEmailTemplate
        code="111222"
        copy={{
          ...enMessages.AuthEmails,
          sign_in_otp_expiry: 'Contact {email} if this was not you.',
        }}
        supportEmail={SUPPORT_EMAIL}
      />
    );

    expect(html).toContain(`Contact ${SUPPORT_EMAIL}`);
    expect(html).not.toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('renders sign-in OTP support copy without unsafe mailto links', async () => {
    const html = await render(
      <SignInOtpEmailTemplate
        code="111222"
        copy={enMessages.AuthEmails}
        supportEmail="not-an-email"
      />
    );

    expect(html).not.toContain('mailto:not-an-email');
    expect(html).toContain('not-an-email');
  });

  it('renders password reset code content', async () => {
    const html = await render(
      <PasswordResetEmailTemplate code="654321" copy={enMessages.AuthEmails} />
    );

    expect(html).toContain('Reset your password');
    expect(html).toContain('654321');
    expect(html).toContain('choose a new password');
    expect(html).toContain('If you did not request this');
  });

  it('rejects malformed password reset codes', () => {
    expect(() =>
      PasswordResetEmailTemplate({
        code: '65432',
        copy: enMessages.AuthEmails,
      })
    ).toThrow('PasswordResetEmailTemplate requires a six-digit code.');
  });

  it('renders email change confirmation content for the new address', async () => {
    const html = await render(
      <ConfirmEmailChangeTemplate code="987654" supportEmail={SUPPORT_EMAIL} />
    );

    expect(html).toContain('Confirm your new email');
    expect(html).toContain('987654');
    expect(html).toContain('new login email');
    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('rejects malformed email change confirmation codes', () => {
    expect(() =>
      ConfirmEmailChangeTemplate({
        code: '98765a',
        supportEmail: SUPPORT_EMAIL,
      })
    ).toThrow('ConfirmEmailChangeTemplate requires a six-digit code.');
  });

  it('renders email change requested notice for the current address', async () => {
    const authEmails = enMessages.AuthEmails;
    const html = await render(
      <EmailChangeRequestedNoticeTemplate
        newEmail="next@example.com"
        supportEmail={SUPPORT_EMAIL}
        previewText={authEmails.change_email_notice_preview}
        heading={authEmails.change_email_notice_subject}
        bodyMessage={authEmails.change_email_notice_body}
        contactMessage={authEmails.change_email_notice_contact}
      />
    );

    expect(html).toContain(authEmails.change_email_notice_subject);
    expect(html).toContain('next@example.com');
    expect(html).toContain('will not take effect');
    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('renders email change requested fallback support copy', async () => {
    const authEmails = enMessages.AuthEmails;
    const html = await render(
      <EmailChangeRequestedNoticeTemplate
        newEmail="next@example.com"
        supportEmail={SUPPORT_EMAIL}
        previewText={authEmails.change_email_notice_preview}
        heading={authEmails.change_email_notice_subject}
        bodyMessage={authEmails.change_email_notice_body}
        contactMessage="Contact {email} right away."
      />
    );

    expect(html).toContain(`Contact ${SUPPORT_EMAIL}`);
    expect(html).not.toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('renders email change requested fallback body copy', async () => {
    const authEmails = enMessages.AuthEmails;
    const html = await render(
      <EmailChangeRequestedNoticeTemplate
        newEmail="next@example.com"
        supportEmail={SUPPORT_EMAIL}
        previewText={authEmails.change_email_notice_preview}
        heading={authEmails.change_email_notice_subject}
        bodyMessage="A login email change was requested."
        contactMessage={authEmails.change_email_notice_contact}
      />
    );

    expect(html).toContain('A login email change was requested.');
    expect(html).not.toContain('undefined');
  });

  it('renders delete account confirmation with the signed link', async () => {
    const confirmUrl =
      'https://mitsailing.example.com/delete-account?token=signed-token';
    const html = await render(
      <DeleteAccountEmailTemplate confirmUrl={confirmUrl} />
    );

    expect(html).toContain('Confirm account deletion');
    expect(html).toContain('Delete my account');
    expect(html).toContain('This cannot be undone');
    expect(html).toContain(confirmUrl);
  });

  it('renders account unlock content with the absolute unlock url', async () => {
    const unlockUrl =
      'https://mitsailing.example.com/api/unlock-account?token=signed-token';
    const html = await render(
      <AccountUnlockEmailTemplate
        supportEmail={SUPPORT_EMAIL}
        unlockUrl={unlockUrl}
      />
    );

    expect(html).toContain('Account temporarily locked');
    expect(html).toContain('Unlock account');
    expect(html).toContain('This link expires in 1 hour');
    expect(html).toContain(unlockUrl);
    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
  });

  it('renders password changed notice with support contact', async () => {
    const html = await render(
      <PasswordChangedNoticeTemplate supportEmail={SUPPORT_EMAIL} />
    );

    expect(html).toContain('Your password was changed');
    expect(html).toContain('No action is needed if this was you');
    expect(html).toContain('someone else may have access to your account');
    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
  });
});
