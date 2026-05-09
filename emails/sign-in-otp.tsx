import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import {
  assertSixDigitCode,
  codeBox,
  heading,
  paragraph,
  replaceAuthEmailValues,
  section,
  supportFooter,
  supportMessage,
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

/**
 * Plaintext email OTP for passwordless sign-in.
 *
 * @param props - Template props.
 * @returns Plaintext email body.
 */
export function SignInOtpEmailPlaintext(props: SignInOtpEmailProps): string {
  assertSixDigitCode(props.code, 'SignInOtpEmailTemplate');

  return [
    props.copy.sign_in_otp_heading,
    replaceAuthEmailValues(props.copy.sign_in_otp_body, { code: props.code }),
    `Code: ${props.code}`,
    replaceAuthEmailValues(
      props.copy.sign_in_otp_expiry
        .replaceAll('<support>', '')
        .replaceAll('</support>', ''),
      { email: props.supportEmail }
    ),
  ].join('\n\n');
}

/**
 * Email OTP for passwordless sign-in (existing accounts).
 *
 * @param props - Template props.
 * @param props.code - Numeric string sign-in code.
 * @param props.copy - Localized email copy.
 * @param props.supportEmail - Mailto address for recipients who need help.
 * @returns Complete email element tree.
 */
export function SignInOtpEmailTemplate(props: SignInOtpEmailProps) {
  assertSixDigitCode(props.code, 'SignInOtpEmailTemplate');

  return (
    <EmailLayout previewText={props.copy.sign_in_otp_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.sign_in_otp_heading}
        </Heading>
        <Text style={paragraph}>
          {replaceAuthEmailValues(props.copy.sign_in_otp_body, {
            code: props.code,
          })}
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
