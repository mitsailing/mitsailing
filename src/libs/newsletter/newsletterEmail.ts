import 'server-only';
import { render } from 'react-email';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import { buildNewsletterManageToken } from '@/libs/newsletter/newsletterTokens';
import {
  newsletterManageUrl,
  newsletterOneClickUnsubscribeUrl,
} from '@/libs/newsletter/newsletterUrls';
import { NewsletterBroadcastTemplate } from '../../../emails/newsletter-broadcast';

type NewsletterEmailParams = {
  body: string;
  deliveryId: string;
  email: string;
  listId: string;
  listName: string;
  manageTokenHash: string;
  previewText: string;
  subject: string;
  subscriberId: string;
  topicId?: string | null;
};

function bodyToText(params: {
  body: string;
  listName: string;
  manageUrl: string;
  postalAddress: string;
  subject: string;
  unsubscribeUrl: string;
}): string {
  return [
    params.subject,
    '',
    params.body,
    '',
    `Unsubscribe from ${params.listName}: ${params.unsubscribeUrl}`,
    `Manage email newsletters: ${params.manageUrl}`,
    params.postalAddress,
  ].join('\n');
}

/**
 * Sends one newsletter broadcast delivery through the active mail transport.
 *
 * @param params - Recipient, broadcast content, and preference-link context
 * @returns Provider message id when the transport exposes one
 */
export async function sendNewsletterBroadcastEmail(
  params: NewsletterEmailParams
) {
  const token = buildNewsletterManageToken(
    params.subscriberId,
    params.manageTokenHash
  );
  const manageUrl = newsletterManageUrl(token);
  const unsubscribeUrl = newsletterOneClickUnsubscribeUrl({
    listId: params.listId,
    token,
  });
  const html = await render(
    NewsletterBroadcastTemplate({
      body: params.body,
      listName: params.listName,
      manageUrl,
      postalAddress: Env.NEWSLETTER_POSTAL_ADDRESS,
      previewText: params.previewText,
      subject: params.subject,
      unsubscribeUrl,
    })
  );
  const text = bodyToText({
    body: params.body,
    listName: params.listName,
    manageUrl,
    postalAddress: Env.NEWSLETTER_POSTAL_ADDRESS,
    subject: params.subject,
    unsubscribeUrl,
  });

  return sendTransactionalEmail({
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    html,
    subject: params.subject,
    tags: [
      { name: 'newsletter_delivery_id', value: params.deliveryId },
      { name: 'newsletter_subscriber_id', value: params.subscriberId },
    ],
    text,
    to: params.email,
    topicId: params.topicId ?? null,
  });
}
