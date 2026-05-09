'use server';

import { redirect } from 'next/navigation';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import {
  buildContactEmail,
  parseContactSubmission,
} from '@/libs/mit-sailing/contactForm';
import { getI18nPath } from '@/utils/Helpers';

type ContactFormStatus = 'invalid' | 'sent';

function contactFormRedirect(locale: string, status: ContactFormStatus): never {
  redirect(`${getI18nPath('/contact/', locale)}?status=${status}#contact-form`);
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
    contactFormRedirect(locale, 'invalid');
  }

  await sendTransactionalEmail(buildContactEmail(submission.data));
  contactFormRedirect(locale, 'sent');
}
