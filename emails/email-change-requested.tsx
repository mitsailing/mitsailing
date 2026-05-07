import type * as React from 'react';
import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { emailLayoutCopy } from './email-layout-copy';
import { replaceAuthEmailValues, supportMessage } from './email-styles';

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
  if (!props.message.includes('{email}')) {
    return props.message;
  }
  const parts = props.message.split('{email}');
  const nodes: React.ReactNode[] = [];
  for (const [index, part] of parts.entries()) {
    nodes.push(part);
    if (index < parts.length - 1) {
      nodes.push(<strong key={`email-${index}`}>{props.newEmail}</strong>);
    }
  }
  return nodes;
}

/**
 * Plaintext security notice sent when a login email change is requested.
 *
 * @param props - Template props.
 * @returns Plaintext email body.
 */
export function EmailChangeRequestedNoticePlaintext(
  props: EmailChangeRequestedNoticeTemplateProps
): string {
  return [
    props.heading,
    replaceAuthEmailValues(props.bodyMessage, { email: props.newEmail }),
    replaceAuthEmailValues(
      props.contactMessage
        .replaceAll('<support>', '')
        .replaceAll('</support>', ''),
      { email: props.supportEmail }
    ),
  ].join('\n\n');
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
    <EmailLayout copy={emailLayoutCopy} previewText={props.previewText}>
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
