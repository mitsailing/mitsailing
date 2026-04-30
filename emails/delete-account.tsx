import type * as React from 'react';
import { Button, Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';

export type DeleteAccountEmailProps = {
  confirmUrl: string;
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
  backgroundColor: '#b91c1c',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
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
 * Final-step confirmation before a signed-in user permanently deletes their
 * account. The deletion only happens once they click the link, giving the
 * true account owner a chance to cancel if the request was unauthorised.
 *
 * @param props - Template props.
 * @param props.confirmUrl - Absolute HTTPS URL that finalizes account deletion.
 * @returns Complete email element tree.
 */
export function DeleteAccountEmailTemplate(props: DeleteAccountEmailProps) {
  return (
    <EmailLayout previewText="Confirm account deletion">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Confirm account deletion
        </Heading>
        <Text style={paragraph}>
          We received a request to permanently delete your account. Click the
          button below to confirm. This cannot be undone. If you did not make
          this request, you can ignore this email and your account will stay
          active.
        </Text>
        <Section style={buttonWrap}>
          <Button href={props.confirmUrl} style={button}>
            Delete my account
          </Button>
        </Section>
        <Text style={finePrint}>
          If the button does not work, paste this link into your browser:
        </Text>
        <Text style={linkText}>{props.confirmUrl}</Text>
      </Section>
    </EmailLayout>
  );
}
