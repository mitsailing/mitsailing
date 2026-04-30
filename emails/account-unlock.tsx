import type * as React from 'react';
import { Button, Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';

export type AccountUnlockEmailProps = {
  unlockUrl: string;
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
 * Sent after repeated failed sign-ins; offers early unlock before time expires.
 * @param props - Template props.
 * @param props.unlockUrl - Absolute HTTPS URL that clears the credential lockout.
 * @param props.supportEmail - Contact address for accounts that were not locked by their owner.
 * @returns Complete email element tree.
 */
export function AccountUnlockEmailTemplate(props: AccountUnlockEmailProps) {
  return (
    <EmailLayout previewText="Your account was temporarily locked">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Account temporarily locked
        </Heading>
        <Text style={paragraph}>
          Your account was locked after multiple failed sign-in attempts. For
          your security, access will also restore automatically after the
          lockout window passes.
        </Text>
        <Text style={paragraph}>
          You can unlock immediately using the button below if this was you.
        </Text>
        <Section style={buttonWrap}>
          <Button href={props.unlockUrl} style={button}>
            Unlock account
          </Button>
        </Section>
        <Text style={expiry}>
          This link expires in 1 hour. If it stops working, try again from the
          sign-in page, or contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          if you did not lock this account.
        </Text>
        <Text style={finePrint}>Link:</Text>
        <Text style={linkText}>{props.unlockUrl}</Text>
      </Section>
    </EmailLayout>
  );
}
