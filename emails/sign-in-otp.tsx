import type * as React from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import {
  codeBox,
  heading,
  paragraph,
  section,
  supportFooter,
  supportLink,
} from './email-styles';

export type SignInOtpEmailProps = {
  code: string;
  copy: SignInOtpEmailCopy;
  supportEmail: string;
};

export type SignInOtpEmailCopy = {
  sign_in_otp_body: string;
  sign_in_otp_expiry: string;
  sign_in_otp_heading: string;
  sign_in_otp_subject: string;
};

function replaceAuthEmailValues(
  message: string,
  values: { code?: string; email?: string }
): string {
  return message
    .replaceAll('{code}', values.code ?? '')
    .replaceAll('{email}', values.email ?? '');
}

function signInOtpBody(props: {
  code: string;
  copy: SignInOtpEmailCopy;
}): string {
  return replaceAuthEmailValues(props.copy.sign_in_otp_body, {
    code: props.code,
  });
}

function supportMessage(props: {
  message: string;
  supportEmail: string;
}): React.ReactNode {
  const [beforeSupport = '', rest] = props.message.split('<support>');
  if (!rest) {
    return replaceAuthEmailValues(props.message, { email: props.supportEmail });
  }
  const [supportText = '', afterSupport = ''] = rest.split('</support>');
  return (
    <>
      {replaceAuthEmailValues(beforeSupport, { email: props.supportEmail })}
      <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
        {replaceAuthEmailValues(supportText, { email: props.supportEmail })}
      </Link>
      {replaceAuthEmailValues(afterSupport, { email: props.supportEmail })}
    </>
  );
}

/**
 * Email OTP for passwordless sign-in (existing accounts).
 *
 * @param props - Template props.
 * @param props.code - Numeric sign-in code.
 * @param props.copy - Localized email copy.
 * @param props.supportEmail - Mailto address for recipients who need help.
 * @returns Complete email element tree.
 */
export function SignInOtpEmailTemplate(props: SignInOtpEmailProps) {
  return (
    <EmailLayout previewText={props.copy.sign_in_otp_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.sign_in_otp_heading}
        </Heading>
        <Text style={paragraph}>
          {signInOtpBody({ code: props.code, copy: props.copy })}
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportFooter}>
          {supportMessage({
            message: props.copy.sign_in_otp_expiry,
            supportEmail: props.supportEmail,
          })}
        </Text>
      </Section>
    </EmailLayout>
  );
}
