import type { Job, Queue } from 'bullmq';
import { processNewsletterBroadcast } from '@/libs/newsletter/newsletterBroadcasts';
import type { NewsletterBroadcastJob } from '@/libs/newsletter/newsletterQueue';
import {
  CMS_MEDIA_PROCESSING_JOB_NAME,
  processCmsMediaProcessingJob,
} from '@/worker/cmsMediaProcessingJob';
import {
  EVENT_PAYMENT_DAILY_NOTIFICATIONS_JOB_NAME,
  EVENT_PAYMENT_EMAIL_JOB_NAME,
  processEventPaymentEmailJob,
} from '@/worker/eventPaymentEmailJob';
import {
  LEGACY_MYSQL_SYNC_JOB_NAME,
  processLegacyMysqlSyncJob,
} from '@/worker/legacyMysqlSyncJob';
import {
  MEMBERSHIP_PAYMENT_REMINDER_JOB_NAME,
  processMembershipPaymentReminderJob,
} from '@/worker/membershipPaymentReminderJob';
import {
  PAVILION_RESERVATION_ABANDON_EMAIL_JOB_NAME,
  processPavilionReservationAbandonEmailJob,
} from '@/worker/pavilionReservationAbandonEmailJob';
import {
  PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME,
  processPavilionReservationSubmittedEmailJob,
} from '@/worker/pavilionReservationSubmittedEmailJob';
import {
  SAILING_CARD_ANNUAL_CLEARING_JOB_NAME,
  processSailingCardAnnualClearingJob,
} from '@/worker/sailingCardAnnualClearingJob';

export async function processDefaultQueueJob(
  job: Pick<Job<unknown>, 'data' | 'name'>,
  queue: Pick<Queue, 'add'>
): Promise<void> {
  if (job.name === LEGACY_MYSQL_SYNC_JOB_NAME) {
    await processLegacyMysqlSyncJob();
    return;
  }
  if (job.name === PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME) {
    await processPavilionReservationSubmittedEmailJob(job.data);
    return;
  }
  if (job.name === PAVILION_RESERVATION_ABANDON_EMAIL_JOB_NAME) {
    await processPavilionReservationAbandonEmailJob(job.data);
    return;
  }
  if (job.name === CMS_MEDIA_PROCESSING_JOB_NAME) {
    await processCmsMediaProcessingJob(job.data);
    return;
  }
  if (
    job.name === EVENT_PAYMENT_EMAIL_JOB_NAME ||
    job.name === EVENT_PAYMENT_DAILY_NOTIFICATIONS_JOB_NAME
  ) {
    await processEventPaymentEmailJob(job.data, queue);
    return;
  }
  if (job.name === SAILING_CARD_ANNUAL_CLEARING_JOB_NAME) {
    await processSailingCardAnnualClearingJob();
    return;
  }
  if (job.name === MEMBERSHIP_PAYMENT_REMINDER_JOB_NAME) {
    await processMembershipPaymentReminderJob(job.data);
    return;
  }
  throw new Error(`Unknown worker job: ${job.name}`);
}

export async function processNewsletterQueueJob(
  job: Pick<Job<NewsletterBroadcastJob>, 'data'>
): Promise<void> {
  await processNewsletterBroadcast(job.data.broadcastId);
}

export { NEWSLETTER_QUEUE_NAME } from '@/libs/newsletter/newsletterConstants';
