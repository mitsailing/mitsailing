import { render } from 'react-email';
import { PavilionReservationEmailTemplate } from '@/../emails/pavilion-reservation';
import {
  emailTemplateMetadata,
  renderPublishedEmailTemplateForSend,
} from '@/libs/email-templates/emailTemplateRendering';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import enMessages from '@/locales/en.json';

type PavilionReservationEmailCopy = typeof enMessages.PavilionReservationEmails;

type PavilionReservationEmailStatus =
  | 'approved'
  | 'cancelled'
  | 'declined'
  | 'needs_info'
  | 'pending';

type PavilionReservationEmailParams = {
  eventName: string;
  referenceCode: string;
  requesterEmail: string;
  scheduleLines: readonly string[];
};

function replaceReservationEmailValues(
  message: string,
  values: { eventName: string; referenceCode: string; status?: string }
): string {
  return message
    .replaceAll('{eventName}', values.eventName)
    .replaceAll('{referenceCode}', values.referenceCode)
    .replaceAll('{status}', values.status ?? '');
}

function submittedText(
  params: PavilionReservationEmailParams,
  copy: PavilionReservationEmailCopy
): string {
  return [
    copy.submitted_heading,
    replaceReservationEmailValues(copy.submitted_body, {
      eventName: params.eventName,
      referenceCode: params.referenceCode,
    }),
    `${copy.field_reference}: ${params.referenceCode}`,
    `${copy.field_event}: ${params.eventName}`,
    ...params.scheduleLines.map((line) => `${copy.field_schedule}: ${line}`),
    copy.footer_contact,
  ].join('\n\n');
}

function statusText(
  params: PavilionReservationEmailParams & {
    status: PavilionReservationEmailStatus;
    statusLabel: string;
  },
  copy: PavilionReservationEmailCopy
): string {
  return [
    copy.status_heading,
    replaceReservationEmailValues(copy.status_body, {
      eventName: params.eventName,
      referenceCode: params.referenceCode,
      status: params.statusLabel,
    }),
    `${copy.field_reference}: ${params.referenceCode}`,
    `${copy.field_event}: ${params.eventName}`,
    `${copy.field_status}: ${params.statusLabel}`,
    ...params.scheduleLines.map((line) => `${copy.field_schedule}: ${line}`),
    copy.footer_contact,
  ].join('\n\n');
}

/**
 * Sends the public submission receipt for a Pavilion reservation request.
 *
 * @param params - Submitted reservation email details
 */
export async function sendPavilionReservationSubmittedEmail(
  params: PavilionReservationEmailParams
): Promise<void> {
  const copy = enMessages.PavilionReservationEmails;
  const publishedTemplate = await renderPublishedEmailTemplateForSend({
    context: {
      pavilionReservation: { scheduleLines: params.scheduleLines },
    },
    key: 'pavilion_reservation_submitted',
    values: {
      eventName: params.eventName,
      referenceCode: params.referenceCode,
    },
  });
  if (publishedTemplate) {
    await sendTransactionalEmail({
      html: publishedTemplate.html,
      metadata: emailTemplateMetadata(publishedTemplate),
      subject: publishedTemplate.subject,
      text: publishedTemplate.text,
      to: params.requesterEmail,
    });
    return;
  }

  const body = replaceReservationEmailValues(copy.submitted_body, {
    eventName: params.eventName,
    referenceCode: params.referenceCode,
  });
  const html = await render(
    PavilionReservationEmailTemplate({
      body,
      copy,
      eventName: params.eventName,
      previewText: copy.submitted_preview,
      referenceCode: params.referenceCode,
      scheduleLines: params.scheduleLines,
      title: copy.submitted_heading,
    })
  );
  await sendTransactionalEmail({
    to: params.requesterEmail,
    subject: replaceReservationEmailValues(copy.submitted_subject, {
      eventName: params.eventName,
      referenceCode: params.referenceCode,
    }),
    html,
    text: submittedText(params, copy),
  });
}

/**
 * Sends a guest notification after admin workflow or schedule changes.
 *
 * @param params - Status notification details
 */
export async function sendPavilionReservationStatusEmail(
  params: PavilionReservationEmailParams & {
    status: PavilionReservationEmailStatus;
    statusLabel: string;
  }
): Promise<void> {
  const copy = enMessages.PavilionReservationEmails;
  const publishedTemplate = await renderPublishedEmailTemplateForSend({
    context: {
      pavilionReservation: { scheduleLines: params.scheduleLines },
    },
    key: 'pavilion_reservation_status',
    values: {
      eventName: params.eventName,
      referenceCode: params.referenceCode,
      status: params.statusLabel,
    },
  });
  if (publishedTemplate) {
    await sendTransactionalEmail({
      html: publishedTemplate.html,
      metadata: emailTemplateMetadata(publishedTemplate),
      subject: publishedTemplate.subject,
      text: publishedTemplate.text,
      to: params.requesterEmail,
    });
    return;
  }

  const body = replaceReservationEmailValues(copy.status_body, {
    eventName: params.eventName,
    referenceCode: params.referenceCode,
    status: params.statusLabel,
  });
  const html = await render(
    PavilionReservationEmailTemplate({
      body,
      copy,
      eventName: params.eventName,
      previewText: copy.status_preview,
      referenceCode: params.referenceCode,
      scheduleLines: params.scheduleLines,
      statusLabel: params.statusLabel,
      title: copy.status_heading,
    })
  );
  await sendTransactionalEmail({
    to: params.requesterEmail,
    subject: replaceReservationEmailValues(copy.status_subject, {
      eventName: params.eventName,
      referenceCode: params.referenceCode,
      status: params.statusLabel,
    }),
    html,
    text: statusText(params, copy),
  });
}
