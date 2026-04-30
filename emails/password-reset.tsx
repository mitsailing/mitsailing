import type * as React from 'react';
import { Button, Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';

export type PasswordResetEmailProps = {
  resetUrl: string;
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
 * Password reset request with expiring link.
 * @param props - Template props.
 * @param props.resetUrl - Absolute HTTPS URL for choosing a new password.
 * @returns Complete email element tree.
 */
export function PasswordResetEmailTemplate(props: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your password">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Reset your password
        </Heading>
        <Text style={paragraph}>
          We received a request to reset your password. Use the button below to
          choose a new password. This link expires soon for your security.
        </Text>
        <Section style={buttonWrap}>
          <Button href={props.resetUrl} style={button}>
            Reset password
          </Button>
        </Section>
        <Text style={finePrint}>
          If you did not request this, you can ignore this email.
        </Text>
        <Text style={linkText}>{props.resetUrl}</Text>
      </Section>
    </EmailLayout>
  );
}
