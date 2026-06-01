import { EventPaymentEmailTemplate } from './event-payment-shared';

export type MembershipPaymentReminderTemplateProps = {
  actionLabel: string;
  amount: string;
  body: string;
  cardType: string;
  cardYear: string;
  fieldAmount: string;
  fieldCard: string;
  fieldYear: string;
  onboardingUrl: string;
  previewText: string;
  title: string;
};

export function MembershipPaymentReminderTemplate(
  props: MembershipPaymentReminderTemplateProps
) {
  return (
    <EventPaymentEmailTemplate
      actionHref={props.onboardingUrl}
      actionLabel={props.actionLabel}
      body={props.body}
      details={[
        { label: props.fieldCard, value: props.cardType },
        { label: props.fieldYear, value: props.cardYear },
        { label: props.fieldAmount, value: props.amount },
      ]}
      previewText={props.previewText}
      title={props.title}
    />
  );
}
