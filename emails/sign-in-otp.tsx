import { Heading, Link, Section, Text } from 'react-email';
import enMessages from '@/locales/en.json';
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
  supportEmail: string;
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
        <Text style={supportFooter}>
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
