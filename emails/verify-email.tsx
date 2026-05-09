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

export type VerifyEmailProps = {
  code: string;
  copy: VerifyEmailCopy;
  supportEmail: string;
};

export type VerifyEmailCopy = {
  verify_body: string;
  verify_expiry: string;
  verify_heading: string;
  verify_subject: string;
};

function assertSixDigitCode(code: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new Error('VerifyEmailTemplate requires a six-digit code.');
  }
}

/**
 * Sign-up email confirmation with a short-lived numeric code.
 *
 * @param props - Template props.
 * @param props.code - Numeric verification code.
 * @param props.copy - Localized email copy.
 * @param props.supportEmail - Mailto address to surface for stuck recipients.
 * @returns Complete email element tree.
 */
export function VerifyEmailTemplate(props: VerifyEmailProps) {
  assertSixDigitCode(props.code);

  return (
    <EmailLayout previewText={props.copy.verify_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.verify_heading}
        </Heading>
        <Text style={paragraph}>
          {replaceAuthEmailValues(props.copy.verify_body, { code: props.code })}
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportFooter}>
          {supportMessage({
            message: props.copy.verify_expiry,
            supportEmail: props.supportEmail,
          })}
        </Text>
      </Section>
    </EmailLayout>
  );
}
