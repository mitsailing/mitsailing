import { Heading, Link, Section, Text } from '@react-email/components';
import type * as React from 'react';
import { EmailLayout } from './email-layout';

export type PasswordChangedNoticeProps = {
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

const supportLink: React.CSSProperties = {
  color: '#2563eb',
};

/**
 * Informational notice sent after a successful password change or reset.
 * Secure Rails alignment: keep the account owner aware so a silent takeover
 * via credential rotation is visible in the original inbox.
 *
 * @param props - Template props.
 * @param props.supportEmail - Mailbox to contact if the change was not theirs.
 * @returns Complete email element tree.
 */
export function PasswordChangedNoticeTemplate(
  props: PasswordChangedNoticeProps
) {
  return (
    <EmailLayout previewText="Your password was changed">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Your password was changed
        </Heading>
        <Text style={paragraph}>
          The password on your account was just updated. No action is needed if
          this was you.
        </Text>
        <Text style={paragraph}>
          If you did not change your password, contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          right away — someone else may have access to your account.
        </Text>
      </Section>
    </EmailLayout>
  );
}
