import { EventPaymentEmailTemplate } from './event-payment-shared';

export type EventPaymentReceiptTemplateProps = {
  actionLabel: string;
  amount: string;
  body: string;
  eventName: string;
  eventAddress?: string | null;
  eventAddressUrl?: string | null;
  fieldAmount: string;
  fieldAddress: string;
  fieldEvent: string;
  fieldFee: string;
  feeDescription: string;
  previewText: string;
  receiptUrl?: string | null;
  title: string;
};

export function EventPaymentReceiptTemplate(
  props: EventPaymentReceiptTemplateProps
) {
  return (
    <EventPaymentEmailTemplate
      actionHref={props.receiptUrl ?? undefined}
      actionLabel={props.receiptUrl ? props.actionLabel : undefined}
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
      ]}
      previewText={props.previewText}
      title={props.title}
    />
  );
}
