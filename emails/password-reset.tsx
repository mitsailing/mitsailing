import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import {
  codeBox,
  heading,
  paragraph,
  section,
  supportFooter,
} from './email-styles';

export type PasswordResetEmailProps = {
  code: string;
};

/**
 * Password reset request with a short-lived numeric code.
 * @param props - Template props.
 * @param props.code - Numeric reset code.
 * @returns Complete email element tree.
 */
export function PasswordResetEmailTemplate(props: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your password">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Reset your password
        </Heading>
        <Text style={paragraph}>
          We received a request to reset your password. Your MIT Sailing
          password reset code is {props.code}. Enter it on the reset screen to
          choose a new password.
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportFooter}>
          This code expires in 5 minutes. If you did not request this, you can
          ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}
