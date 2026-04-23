import { Button, Heading, Link, Section, Text } from '@react-email/components';
import type * as React from 'react';
import { EmailLayout } from './email-layout';

export type ConfirmEmailChangeProps = {
  confirmUrl: string;
  newEmail: string;
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

const supportNote: React.CSSProperties = {
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
 * Email sent to the CURRENT (verified) address when an account holder asks
 * to change their login email. The body makes the proposed target address
 * visible so the true owner can react if it was not them, mirroring the
 * secure_rails "notify the old address on email change" guidance.
 *
 * @param props - Template props.
 * @param props.confirmUrl - Absolute HTTPS URL that completes the swap.
 * @param props.newEmail - Proposed new login address (for confirmation text).
 * @param props.supportEmail - Mailbox to surface if the change was not theirs.
 * @returns Complete email element tree.
 */
export function ConfirmEmailChangeTemplate(props: ConfirmEmailChangeProps) {
  return (
    <EmailLayout previewText="Confirm your new email address">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Confirm your new email
        </Heading>
        <Text style={paragraph}>
          A request was made to change the login email on your account to{' '}
          <strong>{props.newEmail}</strong>. Click the button below to confirm
          the change. Your login email stays the same until the new address is
          verified from its own inbox.
        </Text>
        <Section style={buttonWrap}>
          <Button href={props.confirmUrl} style={button}>
            Confirm new email
          </Button>
        </Section>
        <Text style={supportNote}>
          If you did not request this change, contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          right away — someone else may have access to your account.
        </Text>
        <Text style={finePrint}>
          If the button does not work, paste this link into your browser:
        </Text>
        <Text style={linkText}>{props.confirmUrl}</Text>
      </Section>
    </EmailLayout>
  );
}
