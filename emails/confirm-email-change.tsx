import { Heading, Link, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import {
  assertSixDigitCode,
  codeBox,
  domainBoundCode,
  domainBoundOtpCodeLine,
  heading,
  paragraph,
  section,
  supportFooter,
  supportLink,
} from './email-styles';

export type ConfirmEmailChangeProps = {
  code: string;
  supportEmail: string;
};

/**
 * Email sent to the proposed new address when an account holder asks to
 * change their login email.
 *
 * @param props - Template props.
 * @param props.code - Numeric confirmation code.
 * @param props.supportEmail - Mailbox to surface if the change was not theirs.
 * @returns Complete email element tree.
 */
export function ConfirmEmailChangeTemplate(props: ConfirmEmailChangeProps) {
  assertSixDigitCode(props.code, 'ConfirmEmailChangeTemplate');

  return (
    <EmailLayout previewText="Confirm your new email address">
      <Section style={section}>
        <Heading as="h1" style={heading}>
          Confirm your new email
        </Heading>
        <Text style={paragraph}>
          Your MIT Sailing email change confirmation code is {props.code}. Enter
          it in account settings to confirm this address as your new login
          email.
        </Text>
        <Text style={codeBox}>{props.code}</Text>
        <Text style={domainBoundCode}>
          {domainBoundOtpCodeLine(props.code)}
        </Text>
        <Text style={supportFooter}>
          This code expires in 5 minutes. If you did not request this change,
          contact{' '}
          <Link href={`mailto:${props.supportEmail}`} style={supportLink}>
            {props.supportEmail}
          </Link>{' '}
          right away.
        </Text>
      </Section>
    </EmailLayout>
  );
}
