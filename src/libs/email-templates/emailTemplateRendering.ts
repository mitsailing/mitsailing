import * as Sentry from '@sentry/nextjs';
import type * as React from 'react';
import { render } from 'react-email';
import { EventPaymentAdminDigestTemplate } from '@/../emails/event-payment-admin-digest';
import { EventPaymentReceiptTemplate } from '@/../emails/event-payment-receipt';
import { EventPaymentReminderTemplate } from '@/../emails/event-payment-reminder';
import { EventPaymentRequestTemplate } from '@/../emails/event-payment-request';
import { MembershipPaymentReminderTemplate } from '@/../emails/membership-payment-reminder';
import { NewsletterBroadcastTemplate } from '@/../emails/newsletter-broadcast';
import { PavilionReservationEmailTemplate } from '@/../emails/pavilion-reservation';
import { sanitizeEmailTemplateBodyHtml } from '@/libs/email-templates/emailTemplateBodyHtml';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import { emailTemplateRegistryEntry } from '@/libs/email-templates/emailTemplateRegistry';
import {
  interpolateTemplateTokens,
  unknownTemplateTokens,
} from '@/libs/email-templates/emailTemplateTokens';
import enMessages from '@/locales/en.json';

type RevisionLike = Readonly<{
  editorBodyHtml: string;
  id: string;
  previewText: string;
  renderedText: string;
  subject: string;
  template: Readonly<{ key: EditableEmailTemplateKey }>;
}>;

type RenderParams = Readonly<{
  revision: RevisionLike;
  values: Readonly<Record<string, string | null | undefined>>;
}>;

export { sanitizeEmailTemplateBodyHtml };

export class EmailTemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailTemplateRenderError';
  }
}

function assertKnownTokens(params: {
  allowedTokens: readonly string[];
  key: string;
  revisionId: string;
  values: readonly string[];
}) {
  const unknown = params.values.flatMap((value) =>
    unknownTemplateTokens(value, params.allowedTokens)
  );
  if (unknown.length === 0) {
    return;
  }
  throw new EmailTemplateRenderError(
    `Email template ${params.key} revision ${params.revisionId} contains unknown token(s): ${[...new Set(unknown)].join(', ')}`
  );
}

function interpolated(
  value: string,
  replacements: RenderParams['values']
): string {
  return interpolateTemplateTokens(value, replacements).trim();
}

function valueFor(
  values: RenderParams['values'],
  key: string,
  fallback = ''
): string {
  return values[key] ?? fallback;
}

async function renderTemplateHtml(params: {
  bodyHtml: string;
  key: EditableEmailTemplateKey;
  previewText: string;
  subject: string;
  text: string;
  values: RenderParams['values'];
}) {
  const eventCopy = enMessages.EventPaymentEmails;
  const membershipCopy = enMessages.MembershipPaymentEmails;
  const pavilionCopy = enMessages.PavilionReservationEmails;
  let email: React.ReactElement;

  switch (params.key) {
    case 'event_payment_request': {
      email = EventPaymentRequestTemplate({
        actionLabel: eventCopy.action_pay,
        amount: valueFor(params.values, 'amount'),
        body: params.text,
        bodyHtml: params.bodyHtml,
        checkoutUrl: valueFor(params.values, 'checkoutUrl'),
        deadline: valueFor(params.values, 'deadline'),
        eventAddress: valueFor(params.values, 'eventAddress') || null,
        eventAddressUrl: valueFor(params.values, 'eventAddressUrl') || null,
        eventName: valueFor(params.values, 'eventName'),
        feeDescription: valueFor(params.values, 'selectedFeeDescription'),
        fieldAddress: eventCopy.field_address,
        fieldAmount: eventCopy.field_amount,
        fieldDeadline: eventCopy.field_deadline,
        fieldEvent: eventCopy.field_event,
        fieldFee: eventCopy.field_fee,
        previewText: params.previewText,
        title: params.subject,
      });
      break;
    }
    case 'event_payment_reminder': {
      email = EventPaymentReminderTemplate({
        actionLabel: eventCopy.action_pay,
        amount: valueFor(params.values, 'amount'),
        body: params.text,
        bodyHtml: params.bodyHtml,
        checkoutUrl: valueFor(params.values, 'checkoutUrl'),
        deadline: valueFor(params.values, 'deadline'),
        eventAddress: valueFor(params.values, 'eventAddress') || null,
        eventAddressUrl: valueFor(params.values, 'eventAddressUrl') || null,
        eventName: valueFor(params.values, 'eventName'),
        feeDescription: valueFor(params.values, 'selectedFeeDescription'),
        fieldAddress: eventCopy.field_address,
        fieldAmount: eventCopy.field_amount,
        fieldDeadline: eventCopy.field_deadline,
        fieldEvent: eventCopy.field_event,
        fieldFee: eventCopy.field_fee,
        previewText: params.previewText,
        title: params.subject,
      });
      break;
    }
    case 'event_payment_receipt': {
      email = EventPaymentReceiptTemplate({
        actionLabel: eventCopy.action_receipt,
        amount: valueFor(params.values, 'amount'),
        body: params.text,
        bodyHtml: params.bodyHtml,
        eventAddress: valueFor(params.values, 'eventAddress') || null,
        eventAddressUrl: valueFor(params.values, 'eventAddressUrl') || null,
        eventName: valueFor(params.values, 'eventName'),
        feeDescription: valueFor(params.values, 'selectedFeeDescription'),
        fieldAddress: eventCopy.field_address,
        fieldAmount: eventCopy.field_amount,
        fieldEvent: eventCopy.field_event,
        fieldFee: eventCopy.field_fee,
        previewText: params.previewText,
        receiptUrl: valueFor(params.values, 'receiptUrl') || null,
        title: params.subject,
      });
      break;
    }
    case 'event_payment_admin_digest': {
      email = EventPaymentAdminDigestTemplate({
        body: params.text,
        bodyHtml: params.bodyHtml,
        deadline: valueFor(params.values, 'deadline'),
        eventName: valueFor(params.values, 'eventName'),
        fieldDeadline: eventCopy.field_deadline,
        overduePayments: [],
        previewText: params.previewText,
        title: params.subject,
      });
      break;
    }
    case 'pavilion_reservation_submitted': {
      email = PavilionReservationEmailTemplate({
        body: params.text,
        bodyHtml: params.bodyHtml,
        copy: pavilionCopy,
        eventName: valueFor(params.values, 'eventName'),
        previewText: params.previewText,
        referenceCode: valueFor(params.values, 'referenceCode'),
        scheduleLines: [],
        title: params.subject,
      });
      break;
    }
    case 'pavilion_reservation_status': {
      email = PavilionReservationEmailTemplate({
        body: params.text,
        bodyHtml: params.bodyHtml,
        copy: pavilionCopy,
        eventName: valueFor(params.values, 'eventName'),
        previewText: params.previewText,
        referenceCode: valueFor(params.values, 'referenceCode'),
        scheduleLines: [],
        statusLabel: valueFor(params.values, 'status'),
        title: params.subject,
      });
      break;
    }
    case 'membership_payment_reminder': {
      email = MembershipPaymentReminderTemplate({
        actionLabel: membershipCopy.action_finish,
        amount: valueFor(params.values, 'amount'),
        body: params.text,
        bodyHtml: params.bodyHtml,
        cardType: valueFor(params.values, 'cardType'),
        cardYear: valueFor(params.values, 'cardYear'),
        fieldAmount: membershipCopy.field_amount,
        fieldCard: membershipCopy.field_card,
        fieldYear: membershipCopy.field_year,
        onboardingUrl: valueFor(params.values, 'onboardingUrl'),
        previewText: params.previewText,
        title: params.subject,
      });
      break;
    }
    case 'newsletter_broadcast': {
      email = NewsletterBroadcastTemplate({
        body: params.bodyHtml,
        listName: valueFor(params.values, 'listName', 'General'),
        manageUrl: valueFor(
          params.values,
          'manageUrl',
          'https://mitsailing.com/newsletter'
        ),
        postalAddress: valueFor(params.values, 'postalAddress'),
        previewText: params.previewText,
        subject: params.subject,
        unsubscribeUrl: valueFor(
          params.values,
          'unsubscribeUrl',
          'https://mitsailing.com/newsletter'
        ),
      });
      break;
    }
    default: {
      throw new EmailTemplateRenderError('Unhandled email template key');
    }
  }

  const html = await render(email);
  return html;
}

export async function renderEditableEmailTemplate(params: RenderParams) {
  const { key } = params.revision.template;
  const entry = emailTemplateRegistryEntry(key);
  if (!entry) {
    throw new EmailTemplateRenderError(`Unknown email template key: ${key}`);
  }

  try {
    assertKnownTokens({
      allowedTokens: entry.allowedTokens,
      key,
      revisionId: params.revision.id,
      values: [
        params.revision.editorBodyHtml,
        params.revision.previewText,
        params.revision.renderedText,
        params.revision.subject,
      ],
    });

    const subject = interpolated(params.revision.subject, params.values);
    const previewText = interpolated(
      params.revision.previewText,
      params.values
    );
    const bodyHtml = sanitizeEmailTemplateBodyHtml(
      interpolated(params.revision.editorBodyHtml, params.values)
    );
    const text = interpolated(params.revision.renderedText, params.values);
    if (!subject || !previewText || !bodyHtml || !text) {
      throw new EmailTemplateRenderError(
        `Email template ${key} revision ${params.revision.id} rendered empty content`
      );
    }

    const html = await renderTemplateHtml({
      bodyHtml,
      key,
      previewText,
      subject,
      text,
      values: params.values,
    });
    return { bodyHtml, html, previewText, subject, text };
  } catch (error) {
    const renderError =
      error instanceof EmailTemplateRenderError
        ? error
        : new EmailTemplateRenderError(String(error));
    Sentry.captureException(renderError, {
      tags: {
        emailTemplateKey: key,
        emailTemplateRevisionId: params.revision.id,
      },
    });
    throw renderError;
  }
}
