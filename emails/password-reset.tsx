import { Heading, Section, Text } from 'react-email';
import enMessages from '@/locales/en.json';
import { EmailLayout } from './email-layout';
import {
  codeBox,
  heading,
  paragraph,
  replaceAuthEmailValues,
  section,
  supportFooter,
} from './email-styles';

export type PasswordResetEmailProps = {
  code: string;
};

const copy = enMessages.AuthEmails;

/**
 * Password reset request with a short-lived numeric code.
 * @param props - Template props.
 * @param props.code - Numeric reset code.
 * @returns Complete email element tree.
 */
export function PasswordResetEmailTemplate(props: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText={copy.reset_password_subject}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {copy.reset_password_subject}
        </Heading>
        <Text style={paragraph}>
          {replaceAuthEmailValues(copy.reset_password_body, {
            code: props.code,
          })}
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportFooter}>{copy.reset_password_expiry}</Text>
      </Section>
    </EmailLayout>
  );
}
