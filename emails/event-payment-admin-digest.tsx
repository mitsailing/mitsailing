import { Heading, Section, Text } from 'react-email';
import { EmailLayout } from './email-layout';
import { heading, paragraph, section } from './email-styles';

export type EventPaymentAdminDigestTemplateProps = {
  body: string;
  deadline: string;
  eventName: string;
  overduePayments: readonly {
    amount: string;
    recipientEmail: string;
    recipientName: string;
    selectedFeeDescription: string;
  }[];
  previewText: string;
  title: string;
};

const rowText = {
  ...paragraph,
  margin: '8px 0',
};

export function EventPaymentAdminDigestTemplate(
  props: EventPaymentAdminDigestTemplateProps
) {
  return (
    <EmailLayout previewText={props.previewText}>
      <Section style={section}>
        <Heading as="h1" style={heading}>
          {props.title}
        </Heading>
        <Text style={paragraph}>{props.body}</Text>
        {props.overduePayments.map((payment) => (
          <Text
            key={`${payment.recipientEmail}:${payment.selectedFeeDescription}`}
            style={rowText}
          >
            {payment.recipientName} ({payment.recipientEmail}) -{' '}
            {payment.selectedFeeDescription}, {payment.amount}
          </Text>
        ))}
      </Section>
    </EmailLayout>
  );
}
