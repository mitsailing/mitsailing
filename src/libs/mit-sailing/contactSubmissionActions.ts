'use server';

import { fixedWindow, request } from '@arcjet/next';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import arcjet from '@/libs/Arcjet';
import { requireAdmin, getCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import {
  createContactSubmission,
  getContactSubmissionForAdmin,
  isContactSubmissionStatus,
  notifyContactSubmission,
} from '@/libs/mit-sailing/contactSubmissions';
import type { ContactSubmissionStatus } from '@/libs/mit-sailing/contactSubmissions';
import { validateContactSubmissionFormData } from '@/libs/mit-sailing/contactSubmissionValidation';
import type {
  ContactSubmissionField,
  ContactSubmissionFieldError,
} from '@/libs/mit-sailing/contactSubmissionValidation';
import { getI18nPath } from '@/utils/Helpers';

export type ContactSubmissionFormError = 'rate_limited' | 'unknown';

export type ContactSubmissionFormState =
  | {
      ok: true;
      fieldErrors?: never;
      formError?: never;
    }
  | {
      ok: false;
      fieldErrors?: Partial<
        Record<ContactSubmissionField, ContactSubmissionFieldError>
      >;
      formError?: ContactSubmissionFormError;
    };

const contactFormRateLimit = arcjet.withRule(
  fixedWindow({
    max: 5,
    mode: 'LIVE',
    window: '10m',
  })
);

const CONTACT_ADMIN_PATH = '/admin/contact_submissions/';
const REQUEST_METADATA_MAX_LENGTH = 500;

function firstForwardedIp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const [first] = value.split(',');
  const trimmed = first?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed.slice(0, REQUEST_METADATA_MAX_LENGTH)
    : null;
}

function truncateMetadata(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0
    ? trimmed.slice(0, REQUEST_METADATA_MAX_LENGTH)
    : null;
}

function contactAdminRedirect(
  locale: string,
  path = CONTACT_ADMIN_PATH
): never {
  redirect(getI18nPath(path, locale));
}

function contactDetailPath(id: string): string {
  return `${CONTACT_ADMIN_PATH}${encodeURIComponent(id)}/`;
}

/**
 * Stores and notifies a public contact form submission.
 *
 * @param locale - Active locale
 * @param _previousState - Previous action state from `useActionState`
 * @param formData - Submitted contact form data
 * @returns New form state
 */
export async function submitContactSubmissionAction(
  locale: string,
  _previousState: ContactSubmissionFormState,
  formData: FormData
): Promise<ContactSubmissionFormState> {
  if (Env.ARCJET_KEY) {
    const req = await request();
    const decision = await contactFormRateLimit.protect(req);
    if (decision.isDenied()) {
      return { ok: false, formError: 'rate_limited' };
    }
  }

  const parsed = validateContactSubmissionFormData(formData);

  if (parsed.spam) {
    return { ok: true };
  }

  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors };
  }

  const headerList = await headers();
  const ipAddress =
    firstForwardedIp(headerList.get('x-forwarded-for')) ??
    truncateMetadata(headerList.get('x-real-ip'));
  const userAgent = truncateMetadata(headerList.get('user-agent'));
  const currentUser = await getCurrentUser();

  try {
    await createContactSubmission({
      email: parsed.data.email,
      ipAddress,
      locale,
      message: parsed.data.message,
      name: parsed.data.name,
      submittedByUserId: currentUser?.id ?? null,
      userAgent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save contact submission: ${message}`);
    return { ok: false, formError: 'unknown' };
  }

  revalidatePath(getI18nPath(CONTACT_ADMIN_PATH, locale));
  return { ok: true };
}

/**
 * Changes a stored contact submission workflow status.
 *
 * @param locale - Active locale
 * @param id - Submission id
 * @param status - Target status
 */
export async function updateContactSubmissionStatusAction(
  locale: string,
  id: string,
  status: ContactSubmissionStatus
): Promise<void> {
  await requireAdmin(locale);
  if (!isContactSubmissionStatus(status)) {
    contactAdminRedirect(locale);
  }
  const update = await prisma.contactSubmission.updateMany({
    data: { status },
    where: { id },
  });
  if (update.count === 0) {
    contactAdminRedirect(locale);
  }
  revalidatePath(getI18nPath(CONTACT_ADMIN_PATH, locale));
  revalidatePath(getI18nPath(contactDetailPath(id), locale));
  contactAdminRedirect(
    locale,
    `${contactDetailPath(id)}?result=updated&workflow=${status}`
  );
}

/**
 * Retries support notification for a stored contact submission.
 *
 * @param locale - Active locale
 * @param id - Submission id
 */
export async function retryContactSubmissionNotificationAction(
  locale: string,
  id: string
): Promise<void> {
  await requireAdmin(locale);
  const submission = await getContactSubmissionForAdmin(id);
  if (!submission) {
    contactAdminRedirect(locale);
  }
  let result = 'notification';
  try {
    await notifyContactSubmission(locale, submission);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to retry contact notification ${id}: ${message}`);
    result = 'notification_failed';
  }
  revalidatePath(getI18nPath(CONTACT_ADMIN_PATH, locale));
  revalidatePath(getI18nPath(contactDetailPath(id), locale));
  contactAdminRedirect(locale, `${contactDetailPath(id)}?result=${result}`);
}

/**
 * Deletes a contact submission after explicit confirmation.
 *
 * @param locale - Active locale
 * @param id - Submission id
 * @param formData - Confirmation form data
 */
export async function deleteContactSubmissionAction(
  locale: string,
  id: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const confirmed = formData.get('confirm') === 'delete-contact-submission';
  if (!confirmed) {
    contactAdminRedirect(locale, `${contactDetailPath(id)}?result=confirm`);
  }
  await prisma.contactSubmission.deleteMany({ where: { id } });
  revalidatePath(getI18nPath(CONTACT_ADMIN_PATH, locale));
  contactAdminRedirect(locale, `${CONTACT_ADMIN_PATH}?status=deleted`);
}
