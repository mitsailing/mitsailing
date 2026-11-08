import { render } from 'react-email';
import { describe, expect, it } from 'vitest';
import enMessages from '@/locales/en.json';
import { AccountUnlockEmailTemplate } from './account-unlock';
import { DeleteAccountEmailTemplate } from './delete-account';
import { EmailLayout, MarketingEmailLayout } from './email-layout';
import { NewsletterBroadcastTemplate } from './newsletter-broadcast';
import { PasswordChangedNoticeTemplate } from './password-changed';
import { PasswordResetEmailTemplate } from './password-reset';
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
    expect(html).toContain('alt="MIT Sailing"');
    expect(html).toContain('/assets/images/logo-on-dark.png');
    expect(html).toContain('Inner account notice');
    expect(html).toContain(
      'You received this email because of an action on your MIT Sailing'
    );
    expect(html).toContain('Contact MIT Sailing support');
    expect(html).not.toContain('Auth.js');
  });

  it('renders marketing layout with unsubscribe and postal address', async () => {
    const html = await render(
      <MarketingEmailLayout
        listName="Regatta updates"
        managePreferencesLabel="Manage every newsletter"
        manageUrl="https://mitsailing.example.com/newsletter/manage?token=abc"
        postalAddress="MIT Sailing Pavilion, Cambridge, MA"
        previewText="Marketing preview"
        unsubscribeUrl="https://mitsailing.example.com/api/newsletter/unsubscribe?token=abc"
      >
        <p>Marketing body</p>
      </MarketingEmailLayout>
    );

    expect(html).toContain('Marketing preview');
    expect(html).toContain('Marketing body');
    expect(html).toContain('alt="MIT Sailing"');
    expect(html).toContain('/assets/images/logo-on-dark.png');
    expect(html).toContain('Unsubscribe from Regatta updates');
    expect(html).toContain('Manage every newsletter');
    expect(html).toContain('MIT Sailing Pavilion, Cambridge, MA');
  });

  it('renders newsletter broadcast with compliance footer', async () => {
    const html = await render(
      <NewsletterBroadcastTemplate
        body={'First paragraph.\n\nSecond paragraph.'}
        listName="General news"
        managePreferencesLabel="Manage all newsletter preferences"
        manageUrl="https://mitsailing.example.com/newsletter/manage?token=abc"
        postalAddress="MIT Sailing Pavilion, Cambridge, MA"
        previewText="A preview"
        subject="Spring launch"
        unsubscribeUrl="https://mitsailing.example.com/api/newsletter/unsubscribe?token=abc"
      />
    );

    expect(html).toContain('Spring launch');
    expect(html).toContain('First paragraph.');
    expect(html).toContain('Second paragraph.');
    expect(html).toContain('Unsubscribe from General news');
    expect(html).toContain('Manage all newsletter preferences');
    expect(html).toContain('MIT Sailing Pavilion, Cambridge, MA');
  });

  it('renders verification link content for new sailors', async () => {
    const html = await render(
      <VerifyEmailTemplate
        copy={enMessages.AuthEmails}
        verifyUrl="https://example.test/api/auth/verify-email?token=abc"
      />
    );

    expect(html).toContain('Confirm your email');
    expect(html).toContain(
      'https://example.test/api/auth/verify-email?token=abc'
    );
    expect(html).toContain('This link expires in 1 hour');
    expect(html).toContain('Thanks for signing up');
  });

  it('renders password reset link content', async () => {
    const html = await render(
      <PasswordResetEmailTemplate
        copy={enMessages.AuthEmails}
        resetUrl="https://example.test/reset-password?token=abc"
      />
    );

    expect(html).toContain('Reset your password');
    expect(html).toContain('https://example.test/reset-password?token=abc');
    expect(html).toContain('choose a new MIT Sailing password');
    expect(html).toContain('This link expires in 1 hour');
    expect(html).toContain('If you did not request this');
  });

  it('renders email change confirmation link for the new address', async () => {
    const html = await render(
      <VerifyEmailTemplate
        copy={{
          verify_body: enMessages.AuthEmails.change_email_body,
          verify_button: enMessages.AuthEmails.change_email_button,
          verify_expiry: enMessages.AuthEmails.change_email_expiry,
          verify_paste: enMessages.AuthEmails.change_email_paste,
          verify_subject: enMessages.AuthEmails.change_email_subject,
        }}
        verifyUrl="https://example.test/api/auth/verify-email?token=def"
      />
    );

    expect(html).toContain('Confirm your new email address');
    expect(html).toContain(
      'https://example.test/api/auth/verify-email?token=def'
    );
    expect(html).toContain('Confirm new email');
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
