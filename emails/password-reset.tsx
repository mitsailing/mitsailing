import type * as React from 'react';
import { Button, Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { heading, paragraph, section, supportFooter } from './email-styles';

export type PasswordResetEmailProps = {
  copy: PasswordResetEmailCopy;
  resetUrl: string;
};

export type PasswordResetEmailCopy = {
  reset_password_body: string;
  reset_password_button: string;
  reset_password_expiry: string;
  reset_password_paste: string;
  reset_password_subject: string;
};

const buttonWrap: React.CSSProperties = {
  margin: '24px 0',
  textAlign: 'center' as const,
};

const button: React.CSSProperties = {
  backgroundColor: '#b91c1c',
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
 * Password reset request with a one-hour Better Auth reset link.
 * @param props - Template props.
 * @param props.copy - Localized email copy.
 * @param props.resetUrl - Absolute HTTPS URL that opens the reset form with a token.
 * @returns Complete email element tree.
 */
export function PasswordResetEmailTemplate(props: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText={props.copy.reset_password_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.reset_password_subject}
        </Heading>
        <Text style={paragraph}>{props.copy.reset_password_body}</Text>
        <Section style={buttonWrap}>
          <Button href={props.resetUrl} style={button}>
            {props.copy.reset_password_button}
          </Button>
        </Section>
        <Text style={finePrint}>{props.copy.reset_password_paste}</Text>
        <Text style={linkText}>{props.resetUrl}</Text>
        <Text style={supportFooter}>{props.copy.reset_password_expiry}</Text>
      </Section>
    </EmailLayout>
  );
}
