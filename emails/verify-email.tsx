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

export type VerifyEmailProps = {
  code: string;
  supportEmail: string;
};

/**
 * Sign-up email confirmation with a short-lived numeric code.
 *
 * @param props - Template props.
 * @param props.code - Numeric verification code.
 * @param props.supportEmail - Mailto address to surface for stuck recipients.
 * @returns Complete email element tree.
 */
export function VerifyEmailTemplate(props: VerifyEmailProps) {
  return (
    <EmailLayout previewText="Confirm your email address">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Confirm your email
        </Heading>
        <Text style={paragraph}>
          Thanks for signing up. Your MIT Sailing verification code is{' '}
          {props.code}. Enter it in the verification screen to activate your
          account.
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={supportFooter}>
          This code expires in 5 minutes. If it stops working, request a new
          code, or contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          if you do not receive it.
        </Text>
      </Section>
    </EmailLayout>
  );
}
