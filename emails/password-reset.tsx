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
} from './email-styles';

export type PasswordResetEmailProps = {
  code: string;
  copy: PasswordResetEmailCopy;
};

export type PasswordResetEmailCopy = {
  reset_password_body: string;
  reset_password_expiry: string;
  reset_password_subject: string;
};

/**
 * Password reset request with a short-lived numeric code.
 * @param props - Template props.
 * @param props.code - Numeric reset code string, such as "123456".
 * @param props.copy - Localized email copy.
 * @returns Complete email element tree.
 */
export function PasswordResetEmailTemplate(props: PasswordResetEmailProps) {
  assertSixDigitCode(props.code, 'PasswordResetEmailTemplate');

  return (
    <EmailLayout previewText={props.copy.reset_password_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.copy.reset_password_subject}
        </Heading>
        <Text style={paragraph}>
          {replaceAuthEmailValues(props.copy.reset_password_body, {
            code: props.code,
          })}
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportFooter}>{props.copy.reset_password_expiry}</Text>
      </Section>
    </EmailLayout>
  );
}
