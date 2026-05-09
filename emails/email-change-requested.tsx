import type * as React from 'react';
import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { supportMessage } from './email-styles';

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
  bodyMessage: string;
  contactMessage: string;
  heading: string;
  newEmail: string;
  previewText: string;
  supportEmail: string;
};

function strongEmailMessage(props: {
  message: string;
  newEmail: string;
}): React.ReactNode {
  const [beforeEmail, afterEmail] = props.message.split('{email}');
  return (
    <>
      {beforeEmail}
      <strong>{props.newEmail}</strong>
      {afterEmail}
    </>
  );
}

/**
 * Security notice sent to the current login email when a change is requested.
 *
 * @param props - Template props.
 * @param props.bodyMessage - Localized message containing the new email.
 * @param props.contactMessage - Localized message containing the support link.
 * @param props.heading - Localized title.
 * @param props.newEmail - Proposed replacement login email.
 * @param props.previewText - Localized inbox preview line.
 * @param props.supportEmail - Mailbox to surface if the change was not theirs.
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
          {strongEmailMessage({
            message: props.bodyMessage,
            newEmail: props.newEmail,
          })}
        </Text>
        <Text style={paragraph}>
          {supportMessage({
            message: props.contactMessage,
            supportEmail: props.supportEmail,
          })}
        </Text>
      </Section>
    </EmailLayout>
  );
}
