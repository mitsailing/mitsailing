import { render } from 'react-email';
import { MembershipPaymentReminderTemplate } from '@/../emails/membership-payment-reminder';
import { renderPublishedEmailTemplateForSend } from '@/libs/email-templates/emailTemplateRendering';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import type { SendEmailResult } from '@/libs/email/sendTransactional';
import enMessages from '@/locales/en.json';

type MembershipPaymentReminderParams = {
  amount: string;
  cardType: 'racing' | 'team_racing';
  cardYear: number;
  emailDedupeKey: string;
  onboardingUrl: string;
  paymentId: string;
  recipientEmail: string;
  userId: string;
};

const cardTypeLabels = {
  racing: 'card_type_racing',
  team_racing: 'card_type_team_racing',
} as const;

function reminderText(
  params: MembershipPaymentReminderParams,
  copy: typeof enMessages.MembershipPaymentEmails
): string {
  return [
    copy.reminder_heading,
    copy.reminder_body,
    `${copy.field_card}: ${copy[cardTypeLabels[params.cardType]]}`,
    `${copy.field_year}: ${params.cardYear}`,
    `${copy.field_amount}: ${params.amount}`,
    `${copy.action_finish}: ${params.onboardingUrl}`,
  ].join('\n\n');
}

type PublishedEmailTemplateRender = NonNullable<
  Awaited<ReturnType<typeof renderPublishedEmailTemplateForSend>>
>;

function emailTemplateMetadata(rendered: PublishedEmailTemplateRender) {
  return {
    emailTemplateKey: rendered.emailTemplateKey,
    emailTemplateRevisionId: rendered.emailTemplateRevisionId,
  };
}

export async function sendMembershipPaymentReminderEmail(
  params: MembershipPaymentReminderParams
): Promise<SendEmailResult> {
  const copy = enMessages.MembershipPaymentEmails;
  const metadata = {
    cardType: params.cardType,
    cardYear: params.cardYear,
    paymentId: params.paymentId,
  };
  const publishedTemplate = await renderPublishedEmailTemplateForSend({
    key: 'membership_payment_reminder',
    values: {
      amount: params.amount,
      cardType: copy[cardTypeLabels[params.cardType]],
      cardYear: String(params.cardYear),
      onboardingUrl: params.onboardingUrl,
    },
  });
  if (publishedTemplate) {
    return sendTransactionalEmail({
      category: 'membership_payment_reminder',
      html: publishedTemplate.html,
      idempotencyKey: `membership-payment-reminder:${params.emailDedupeKey}`,
      metadata: {
        ...metadata,
        ...emailTemplateMetadata(publishedTemplate),
      },
      subject: publishedTemplate.subject,
      text: publishedTemplate.text,
      to: params.recipientEmail,
      userId: params.userId,
    });
  }

  const html = await render(
    MembershipPaymentReminderTemplate({
      actionLabel: copy.action_finish,
      amount: params.amount,
      body: copy.reminder_body,
      cardType: copy[cardTypeLabels[params.cardType]],
      cardYear: String(params.cardYear),
      fieldAmount: copy.field_amount,
      fieldCard: copy.field_card,
      fieldYear: copy.field_year,
      onboardingUrl: params.onboardingUrl,
      previewText: copy.reminder_preview,
      title: copy.reminder_heading,
    })
  );
  return sendTransactionalEmail({
    category: 'membership_payment_reminder',
    html,
    idempotencyKey: `membership-payment-reminder:${params.emailDedupeKey}`,
    metadata,
    subject: copy.reminder_subject,
    text: reminderText(params, copy),
    to: params.recipientEmail,
    userId: params.userId,
  });
}
