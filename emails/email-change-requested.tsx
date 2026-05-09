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

export type EmailChangeRequestedNoticeTemplateProps = {
  newEmail: string;
  supportEmail: string;
  previewText: string;
  heading: string;
  bodyLead: string;
  bodyTail: string;
  contactBefore: string;
  contactAfter: string;
};

/**
 * Security notice sent to the current login email when a change is requested.
 *
 * @param props - Template props.
 * @param props.newEmail - Proposed replacement login email.
 * @param props.supportEmail - Mailbox to surface if the change was not theirs.
 * @param props.previewText - Localized inbox preview line.
 * @param props.heading - Localized title.
 * @param props.bodyLead - Localized sentence start before the proposed email.
 * @param props.bodyTail - Localized sentence after the proposed email.
 * @param props.contactBefore - Localized text before the support mailto link.
 * @param props.contactAfter - Localized text after the support mailto link.
 * @returns Complete email element tree.
 */
export function EmailChangeRequestedNoticeTemplate(
  props: EmailChangeRequestedNoticeTemplateProps
) {
  return (
    <EmailLayout previewText={props.previewText}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.heading}
        </Heading>
        <Text style={paragraph}>
          {props.bodyLead} <strong>{props.newEmail}</strong>. {props.bodyTail}
        </Text>
        <Text style={paragraph}>
          {props.contactBefore}{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          {props.contactAfter}
        </Text>
      </Section>
    </EmailLayout>
  );
}
