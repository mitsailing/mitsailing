import 'server-only';
import { getTranslations } from 'next-intl/server';
import { render } from 'react-email';
import { prisma } from '@/libs/DB';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';
import { ContactSubmissionNotificationTemplate } from '../../../emails/contact-submission';

export const CONTACT_SUBMISSION_STATUSES = [
  'unread',
  'resolved',
  'archived',
] as const;

export type ContactSubmissionStatus =
  (typeof CONTACT_SUBMISSION_STATUSES)[number];

export type ContactSubmissionAdminFilter = ContactSubmissionStatus | 'all';

export type ContactSubmissionListRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: ContactSubmissionStatus;
  notificationStatus: 'pending' | 'sending' | 'sent' | 'failed';
  notificationAttemptCount: number;
  notifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactSubmissionDetail = ContactSubmissionListRow & {
  ipAddress: string | null;
  userAgent: string | null;
  notificationError: string | null;
  submittedBy: {
    email: string;
    name: string;
  } | null;
};

type CreateContactSubmissionParams = {
  email: string;
  ipAddress: string | null;
  locale: string;
  message: string;
  name: string;
  submittedByUserId: string | null;
  userAgent: string | null;
};

type ContactSubmissionNotificationPayload = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
};

const CONTACT_SUBMISSION_PAGE_SIZE = 50;
const NOTIFICATION_ERROR_MAX_LENGTH = 1000;

function notificationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, NOTIFICATION_ERROR_MAX_LENGTH);
}

function adminDetailUrl(locale: string, submissionId: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  const path = getI18nPath(
    `/admin/contact_submissions/${encodeURIComponent(submissionId)}/`,
    locale
  );
  return `${base}${path}`;
}

function contactSubmissionSelect() {
  return {
    createdAt: true,
    email: true,
    id: true,
    message: true,
    name: true,
    notificationAttemptCount: true,
    notificationStatus: true,
    notifiedAt: true,
    status: true,
    updatedAt: true,
  } as const;
}

function contactSubmissionDetailSelect() {
  return {
    ...contactSubmissionSelect(),
    ipAddress: true,
    notificationError: true,
    submittedBy: {
      select: {
        email: true,
        name: true,
      },
    },
    userAgent: true,
  } as const;
}

/**
 * Checks whether a raw route/query value is a supported contact submission status.
 *
 * @param value - Candidate value
 * @returns True when the value is a contact submission status
 */
export function isContactSubmissionStatus(
  value: unknown
): value is ContactSubmissionStatus {
  return value === 'unread' || value === 'resolved' || value === 'archived';
}

/**
 * Normalizes admin list filter query values.
 *
 * @param value - Raw `status` query parameter
 * @returns Supported filter, defaulting to `all`
 */
export function contactSubmissionAdminFilter(
  value: string | undefined
): ContactSubmissionAdminFilter {
  if (isContactSubmissionStatus(value)) {
    return value;
  }
  return 'all';
}

/**
 * Lists recent contact submissions for the admin inbox.
 *
 * @param filter - Status filter
 * @returns Newest submissions up to the inbox page size
 */
export async function listContactSubmissionsForAdmin(
  filter: ContactSubmissionAdminFilter
): Promise<ContactSubmissionListRow[]> {
  const rows = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    select: contactSubmissionSelect(),
    take: CONTACT_SUBMISSION_PAGE_SIZE,
    where: filter === 'all' ? undefined : { status: filter },
  });
  return rows;
}

/**
 * Fetches one contact submission for the admin detail page.
 *
 * @param id - Submission id
 * @returns Detail row or null
 */
export async function getContactSubmissionForAdmin(
  id: string
): Promise<ContactSubmissionDetail | null> {
  const submission = await prisma.contactSubmission.findUnique({
    select: contactSubmissionDetailSelect(),
    where: { id },
  });
  return submission;
}

/**
 * Sends or retries the support notification for a stored submission.
 *
 * @param locale - Active locale for the admin detail URL
 * @param submission - Stored submission payload
 */
export async function notifyContactSubmission(
  locale: string,
  submission: ContactSubmissionNotificationPayload
): Promise<void> {
  const claim = await prisma.contactSubmission.updateMany({
    data: {
      notificationAttemptCount: { increment: 1 },
      notificationError: null,
      notificationStatus: 'sending',
    },
    where: {
      id: submission.id,
      notificationStatus: { in: ['pending', 'failed'] },
    },
  });
  if (claim.count === 0) {
    return;
  }

  try {
    const t = await getTranslations({
      locale,
      namespace: 'ContactSubmissionEmail',
    });
    const html = await render(
      ContactSubmissionNotificationTemplate({
        adminUrl: adminDetailUrl(locale, submission.id),
        copy: {
          label_email: t('label_email'),
          label_message: t('label_message'),
          label_name: t('label_name'),
          label_received: t('label_received'),
          link_open_admin: t('link_open_admin'),
          preview_text: t('preview_text'),
          subject: t('subject'),
          title: t('title'),
        },
        createdAt: submission.createdAt.toISOString(),
        email: submission.email,
        message: submission.message,
        name: submission.name,
      })
    );

    await sendTransactionalEmail({
      html,
      replyTo: submission.email,
      subject: t('subject'),
      to: Env.SUPPORT_EMAIL,
    });

    await prisma.contactSubmission.update({
      data: {
        notificationError: null,
        notificationStatus: 'sent',
        notifiedAt: new Date(),
      },
      where: { id: submission.id },
    });
  } catch (error) {
    const message = notificationErrorMessage(error);
    logger.error(
      `Failed to notify support for contact ${submission.id}: ${message}`
    );
    try {
      await prisma.contactSubmission.update({
        data: {
          notificationError: message,
          notificationStatus: 'failed',
        },
        where: { id: submission.id },
      });
    } catch (updateError) {
      const updateMessage = notificationErrorMessage(updateError);
      logger.error(
        `Failed to mark contact ${submission.id} notification failed: ${updateMessage}`
      );
    }
  }
}

/**
 * Stores a public contact submission and attempts support notification.
 *
 * @param params - Normalized visitor data and request metadata
 * @returns Stored submission id
 */
export async function createContactSubmission(
  params: CreateContactSubmissionParams
): Promise<{ id: string }> {
  const submission = await prisma.contactSubmission.create({
    data: {
      email: params.email,
      ipAddress: params.ipAddress,
      message: params.message,
      name: params.name,
      submittedByUserId: params.submittedByUserId,
      userAgent: params.userAgent,
    },
    select: {
      createdAt: true,
      email: true,
      id: true,
      message: true,
      name: true,
    },
  });

  await notifyContactSubmission(params.locale, submission);

  return { id: submission.id };
}
