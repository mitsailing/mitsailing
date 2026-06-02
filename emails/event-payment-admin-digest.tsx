import { Heading, Section, Text } from 'react-email';
import { SafeEmailTemplateBodyHtml } from '@/libs/email-templates/emailTemplateBodyHtml';
import { EmailLayout } from './email-layout';
import { heading, paragraph, section } from './email-styles';

export type EventPaymentAdminDigestTemplateProps = {
  body: string;
  bodyHtml?: string;
  deadline: string;
  eventName: string;
  fieldDeadline: string;
  overduePayments: readonly {
    amount: string;
    id: string;
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

const detailLabel = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  margin: '16px 0 4px',
  textTransform: 'uppercase' as const,
};

const detailValue = {
  color: '#0f172a',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 16px',
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
        {props.bodyHtml ? (
          <SafeEmailTemplateBodyHtml html={props.bodyHtml} />
        ) : (
          <Text style={paragraph}>{props.body}</Text>
        )}
        <Section>
          <Text style={detailLabel}>{props.fieldDeadline}</Text>
          <Text style={detailValue}>{props.deadline}</Text>
        </Section>
        {props.overduePayments.map((payment) => (
          <Text key={payment.id} style={rowText}>
            {payment.recipientName} ({payment.recipientEmail}) -{' '}
            {payment.selectedFeeDescription}, {payment.amount}
          </Text>
        ))}
      </Section>
    </EmailLayout>
  );
}
