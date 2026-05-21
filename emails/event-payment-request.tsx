import { EventPaymentEmailTemplate } from './event-payment-shared';

export type EventPaymentRequestTemplateProps = {
  actionLabel: string;
  amount: string;
  body: string;
  checkoutUrl: string;
  deadline: string;
  eventName: string;
  eventAddress?: string | null;
  eventAddressUrl?: string | null;
  fieldAmount: string;
  fieldAddress: string;
  fieldDeadline: string;
  fieldEvent: string;
  fieldFee: string;
  feeDescription: string;
  previewText: string;
  title: string;
};

export function EventPaymentRequestTemplate(
  props: EventPaymentRequestTemplateProps
) {
  return (
    <EventPaymentEmailTemplate
      actionHref={props.checkoutUrl}
      actionLabel={props.actionLabel}
      body={props.body}
      details={[
        { label: props.fieldEvent, value: props.eventName },
        ...(props.eventAddress
          ? [
              {
                href: props.eventAddressUrl ?? undefined,
                label: props.fieldAddress,
                value: props.eventAddress,
              },
            ]
          : []),
        { label: props.fieldFee, value: props.feeDescription },
        { label: props.fieldAmount, value: props.amount },
        { label: props.fieldDeadline, value: props.deadline },
      ]}
      previewText={props.previewText}
      title={props.title}
    />
  );
}
