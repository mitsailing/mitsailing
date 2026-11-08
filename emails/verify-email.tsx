import type * as React from 'react';
import { Button, Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { heading, paragraph, section, supportFooter } from './email-styles';

export type VerifyEmailLinkProps = {
  copy: VerifyEmailLinkCopy;
  verifyUrl: string;
};

export type VerifyEmailLinkCopy = {
  verify_body: string;
  verify_button: string;
  verify_expiry: string;
  verify_paste: string;
  verify_subject: string;
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
 * Email confirmation with a one-hour Better Auth verification link.
 * Used for sign-up verification and login-email changes.
 *
 * @param props - Template props.
 * @param props.copy - Localized email copy.
 * @param props.verifyUrl - Absolute HTTPS URL that confirms the address.
 * @returns Complete email element tree.
 */
export function VerifyEmailTemplate(props: VerifyEmailLinkProps) {
  return (
    <EmailLayout previewText={props.copy.verify_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.verify_subject}
        </Heading>
        <Text style={paragraph}>{props.copy.verify_body}</Text>
        <Section style={buttonWrap}>
          <Button href={props.verifyUrl} style={button}>
            {props.copy.verify_button}
          </Button>
        </Section>
        <Text style={finePrint}>{props.copy.verify_paste}</Text>
        <Text style={linkText}>{props.verifyUrl}</Text>
        <Text style={supportFooter}>{props.copy.verify_expiry}</Text>
      </Section>
    </EmailLayout>
  );
}
