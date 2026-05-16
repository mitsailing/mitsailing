import 'server-only';
import { render } from 'react-email';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import { buildNewsletterManageToken } from '@/libs/newsletter/newsletterTokens';
import {
  newsletterManageUrl,
  newsletterOneClickUnsubscribeUrl,
} from '@/libs/newsletter/newsletterUrls';
import { getBaseUrl } from '@/utils/Helpers';
import { NewsletterBroadcastTemplate } from '../../../emails/newsletter-broadcast';

type NewsletterEmailParams = {
  body: string;
  broadcastId: string;
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

type NewsletterEmailRenderParams = {
  body: string;
  listName: string;
  manageUrl: string;
  postalAddress: string;
  previewText: string;
  subject: string;
  unsubscribeUrl: string;
};

type NewsletterTestEmailParams = {
  body: string;
  email: string;
  listName: string;
  previewText: string;
  subject: string;
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
 * Renders a newsletter broadcast email into HTML and plaintext.
 *
 * @param params - Broadcast content and preference-link context
 * @returns Rendered email payload
 */
export async function renderNewsletterBroadcastEmail(
  params: NewsletterEmailRenderParams
) {
  const html = await render(
    NewsletterBroadcastTemplate({
      body: params.body,
      listName: params.listName,
      manageUrl: params.manageUrl,
      postalAddress: params.postalAddress,
      previewText: params.previewText,
      subject: params.subject,
      unsubscribeUrl: params.unsubscribeUrl,
    })
  );
  const text = bodyToText(params);
  return { html, text };
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
  const rendered = await renderNewsletterBroadcastEmail({
    body: params.body,
    listName: params.listName,
    manageUrl,
    postalAddress: Env.NEWSLETTER_POSTAL_ADDRESS,
    subject: params.subject,
    unsubscribeUrl,
    previewText: params.previewText,
  });

  return sendTransactionalEmail({
    category: 'newsletter',
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    subject: params.subject,
    idempotencyKey: `newsletter-delivery/${params.deliveryId}`,
    metadata: { listId: params.listId },
    newsletterBroadcastId: params.broadcastId,
    newsletterDeliveryId: params.deliveryId,
    newsletterSubscriberId: params.subscriberId,
    tags: [
      { name: 'newsletter_delivery_id', value: params.deliveryId },
      { name: 'newsletter_subscriber_id', value: params.subscriberId },
    ],
    html: rendered.html,
    text: rendered.text,
    to: params.email,
    topicId: params.topicId ?? null,
  });
}

/**
 * Sends an admin test copy of a newsletter broadcast without creating delivery rows.
 *
 * @param params - Test recipient and broadcast content
 * @returns Provider message id when the transport exposes one
 */
export async function sendNewsletterBroadcastTestEmail(
  params: NewsletterTestEmailParams
) {
  const newsletterUrl = `${getBaseUrl().replace(/\/$/, '')}/newsletter`;
  const rendered = await renderNewsletterBroadcastEmail({
    body: params.body,
    listName: params.listName,
    manageUrl: newsletterUrl,
    postalAddress: Env.NEWSLETTER_POSTAL_ADDRESS,
    previewText: params.previewText,
    subject: params.subject,
    unsubscribeUrl: newsletterUrl,
  });

  return sendTransactionalEmail({
    category: 'newsletter_test',
    html: rendered.html,
    subject: `[TEST] ${params.subject}`,
    text: rendered.text,
    to: params.email,
  });
}
