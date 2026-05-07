import type * as React from 'react';
import { Button, Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { emailLayoutCopy } from './email-layout-copy';
import { supportMessage } from './email-styles';

export type AccountUnlockEmailProps = {
  copy: AccountUnlockEmailCopy;
  supportEmail: string;
  unlockUrl: string;
};

export type AccountUnlockEmailCopy = {
  account_locked_body: string;
  account_locked_button: string;
  account_locked_expiry: string;
  account_locked_heading: string;
  account_locked_link_label: string;
  account_locked_subject: string;
  account_locked_unlock: string;
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
  margin: '0 0 16px',
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
 * Sent after repeated failed sign-ins; offers early unlock before time expires.
 * @param props - Template props.
 * @param props.unlockUrl - Absolute HTTPS URL that clears the credential lockout.
 * @param props.supportEmail - Contact address for accounts that were not locked by their owner.
 * @returns Complete email element tree.
 */
export function AccountUnlockEmailTemplate(props: AccountUnlockEmailProps) {
  return (
    <EmailLayout
      copy={emailLayoutCopy}
      previewText={props.copy.account_locked_subject}
    >
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.account_locked_heading}
        </Heading>
        <Text style={paragraph}>{props.copy.account_locked_body}</Text>
        <Text style={paragraph}>{props.copy.account_locked_unlock}</Text>
        <Section style={buttonWrap}>
          <Button href={props.unlockUrl} style={button}>
            {props.copy.account_locked_button}
          </Button>
        </Section>
        <Text style={expiry}>
          {supportMessage({
            message: props.copy.account_locked_expiry,
            supportEmail: props.supportEmail,
          })}
        </Text>
        <Text style={finePrint}>{props.copy.account_locked_link_label}</Text>
        <Text style={linkText}>{props.unlockUrl}</Text>
      </Section>
    </EmailLayout>
  );
}
