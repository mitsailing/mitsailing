import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import {
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

function signInOtpBody(props: {
  code: string;
  copy: SignInOtpEmailCopy;
}): string {
  return replaceAuthEmailValues(props.copy.sign_in_otp_body, {
    code: props.code,
  });
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
