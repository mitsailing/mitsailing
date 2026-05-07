import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { emailLayoutCopy } from './email-layout-copy';

export type ContactSubmissionNotificationTemplateProps = {
  adminUrl: string;
  createdAt: string;
  copy: ContactSubmissionNotificationCopy;
  email: string;
  message: string;
  name: string;
};

export type ContactSubmissionNotificationCopy = {
  link_open_admin: string;
  label_email: string;
  label_message: string;
  label_name: string;
  label_received: string;
  preview_text: string;
  subject: string;
  title: string;
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

const label: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  margin: '20px 0 4px',
  textTransform: 'uppercase' as const,
};

const value: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0',
};

const messageBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  color: '#0f172a',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '8px 0 20px',
  padding: '14px',
  whiteSpace: 'pre-wrap' as const,
};

const link: React.CSSProperties = {
  color: '#2563eb',
  fontSize: '15px',
  fontWeight: 600,
};

/**
 * Internal support notification for public contact submissions.
 *
 * @param props - Submitted contact data and admin URL
 * @returns Complete email element tree
 */
export function ContactSubmissionNotificationTemplate(
  props: ContactSubmissionNotificationTemplateProps
) {
  return (
    <EmailLayout copy={emailLayoutCopy} previewText={props.copy.preview_text}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.title}
        </Heading>
        <Text style={label}>{props.copy.label_name}</Text>
        <Text style={value}>{props.name}</Text>
        <Text style={label}>{props.copy.label_email}</Text>
        <Text style={value}>{props.email}</Text>
        <Text style={label}>{props.copy.label_received}</Text>
        <Text style={value}>{props.createdAt}</Text>
        <Text style={label}>{props.copy.label_message}</Text>
        <Text style={messageBox}>{props.message}</Text>
        <Link href={props.adminUrl} style={link}>
          {props.copy.link_open_admin}
        </Link>
      </Section>
    </EmailLayout>
  );
}
