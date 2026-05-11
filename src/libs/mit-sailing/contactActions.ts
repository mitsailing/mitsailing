'use server';

import { redirect } from 'next/navigation';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { logger } from '@/libs/Logger';
import {
  buildContactEmail,
  parseContactSubmission,
  parseContactTopicParam,
} from '@/libs/mit-sailing/contactForm';
import type { ContactTopic } from '@/libs/mit-sailing/contactForm';
import { getI18nPath } from '@/utils/Helpers';

type ContactFormStatus = 'error' | 'invalid' | 'sent';

function formDataTopicRaw(formData: FormData): string {
  const value = formData.get('topic');
  return typeof value === 'string' ? value : '';
}

function contactFormRedirect(
  locale: string,
  status: ContactFormStatus,
  topic?: ContactTopic
): never {
  const query = new URLSearchParams({ status });
  if (topic) {
    query.set('topic', topic);
  }
  redirect(
    `${getI18nPath('/contact', locale)}?${query.toString()}#contact-form`
  );
}

/**
 * Sends a public Contact page form submission to the routed MIT Sailing inbox.
 *
 * @param locale - Active locale for the post-submit redirect
 * @param formData - Submitted form body
 */
export async function submitContactFormAction(
  locale: string,
  formData: FormData
): Promise<void> {
  const submission = parseContactSubmission(formData, new Date());
  if (!submission.success) {
    const topicGuess = parseContactTopicParam(formDataTopicRaw(formData));
    contactFormRedirect(locale, 'invalid', topicGuess);
  }

  try {
    await sendTransactionalEmail(buildContactEmail(submission.data));
  } catch (error: unknown) {
    logger.error('Failed to send contact form email: {error}', { error });
    contactFormRedirect(locale, 'error', submission.data.topic);
  }
  contactFormRedirect(locale, 'sent', submission.data.topic);
}
