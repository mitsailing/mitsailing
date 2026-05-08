import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
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
    <EmailLayout previewText="Your sign-in code">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Sign in with your code
        </Heading>
        <Text style={paragraph}>
          Your MIT Sailing sign-in code is {props.code}. Enter it on the sign-in
          screen to continue.
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={expiry}>
          This code expires in 5 minutes. If you did not try to sign in, you can
          ignore this email, or contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          if you have questions.
        </Text>
      </Section>
    </EmailLayout>
  );
}
