import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';

export type ConfirmEmailChangeProps = {
  code: string;
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

const codeBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '6px',
  margin: '24px 0',
  padding: '16px 20px',
  textAlign: 'center' as const,
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

/**
 * Email sent to the proposed new address when an account holder asks to
 * change their login email.
 *
 * @param props - Template props.
 * @param props.code - Numeric confirmation code.
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
          Your MIT Sailing email change confirmation code is {props.code}. Enter
          it in account settings to confirm this address as your new login
          email.
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportNote}>
          This code expires in 5 minutes. If you did not request this change,
          contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          right away.
        </Text>
      </Section>
    </EmailLayout>
  );
}
