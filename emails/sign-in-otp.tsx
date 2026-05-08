import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import enMessages from '@/locales/en.json';
import { EmailLayout } from './email-layout';

export type SignInOtpEmailProps = {
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

const expiry: React.CSSProperties = {
  color: '#334155',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0',
};

const supportLink: React.CSSProperties = {
  color: '#2563eb',
};

const copy = enMessages.AuthEmails;

function signInOtpBody(code: string): string {
  return copy.sign_in_otp_body.replace('{code}', code);
}

/**
 * Email OTP for passwordless sign-in (existing accounts).
 *
 * @param props - Template props.
 * @param props.code - Numeric sign-in code.
 * @param props.supportEmail - Mailto address for recipients who need help.
 * @returns Complete email element tree.
 */
export function SignInOtpEmailTemplate(props: SignInOtpEmailProps) {
  return (
    <EmailLayout previewText={copy.sign_in_otp_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {copy.sign_in_otp_heading}
        </Heading>
        <Text style={paragraph}>{signInOtpBody(props.code)}</Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={expiry}>
          {copy.sign_in_otp_expiry_prefix}{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          {copy.sign_in_otp_expiry_suffix}
        </Text>
      </Section>
    </EmailLayout>
  );
}
