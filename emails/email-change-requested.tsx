import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { supportLink } from './email-styles';

const section: React.CSSProperties = {
  padding: '32px 28px',
};

const heading: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '22px',
  lineHeight: '30px',
  margin: '0 0 16px',
};

const paragraph: React.CSSProperties = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 20px',
};

/**
 * Security notice sent to the current login email when a change is requested.
 *
 * @param props - Template props.
 * @param props.newEmail - Proposed replacement login email.
 * @param props.supportEmail - Mailbox to surface if the change was not theirs.
 * @returns Complete email element tree.
 */
export function EmailChangeRequestedNoticeTemplate(props: {
  newEmail: string;
  supportEmail: string;
}) {
  return (
    <EmailLayout previewText="A change to your login email was requested.">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Email change requested
        </Heading>
        <Text style={paragraph}>
          A request was made to change your login email to{' '}
          <strong>{props.newEmail}</strong>. The change will not take effect
          until that address is confirmed with its code.
        </Text>
        <Text style={paragraph}>
          If you did not request this, contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          right away.
        </Text>
      </Section>
    </EmailLayout>
  );
}
