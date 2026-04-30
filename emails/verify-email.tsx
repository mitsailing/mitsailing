import type * as React from 'react';
import { Button, Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';

export type VerifyEmailProps = {
  verifyUrl: string;
  supportEmail: string;
};

const section: React.CSSProperties = {
  padding: '28px 24px',
};

const heading: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 600,
  margin: '0 0 16px',
};

const paragraph: React.CSSProperties = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 20px',
};

const buttonWrap: React.CSSProperties = {
  margin: '24px 0',
  textAlign: 'center' as const,
};

const button: React.CSSProperties = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
};

const expiry: React.CSSProperties = {
  color: '#334155',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0',
};

const supportLink: React.CSSProperties = {
  color: '#2563eb',
};

const finePrint: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  margin: '24px 0 8px',
};

const linkText: React.CSSProperties = {
  color: '#2563eb',
  fontSize: '12px',
  wordBreak: 'break-all' as const,
};

/**
 * Sign-up email confirmation with CTA to verify address. Includes the
 * agreed expiry/resend/support blurb so the recipient has a clear path
 * forward when the link has expired or never arrived.
 *
 * @param props - Template props.
 * @param props.verifyUrl - Absolute HTTPS URL that completes verification.
 * @param props.supportEmail - Mailto address to surface for stuck recipients.
 * @returns Complete email element tree.
 */
export function VerifyEmailTemplate(props: VerifyEmailProps) {
  return (
    <EmailLayout previewText="Confirm your email address">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Confirm your email
        </Heading>
        <Text style={paragraph}>
          Thanks for signing up. Click the button below to verify your email
          address and activate your account.
        </Text>
        <Section style={buttonWrap}>
          <Button href={props.verifyUrl} style={button}>
            Verify email
          </Button>
        </Section>
        <Text style={expiry}>
          This link expires in 1 hour. If it stops working, sign in to request a
          new confirmation email, or contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          if you do not receive it.
        </Text>
        <Text style={finePrint}>
          If the button does not work, paste this link into your browser:
        </Text>
        <Text style={linkText}>{props.verifyUrl}</Text>
      </Section>
    </EmailLayout>
  );
}
