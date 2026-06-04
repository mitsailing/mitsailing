import * as Sentry from '@sentry/nextjs';
import type * as React from 'react';
import { render, toPlainText } from 'react-email';
import { EventPaymentAdminDigestTemplate } from '@/../emails/event-payment-admin-digest';
import { EventPaymentReceiptTemplate } from '@/../emails/event-payment-receipt';
import { EventPaymentReminderTemplate } from '@/../emails/event-payment-reminder';
import { EventPaymentRequestTemplate } from '@/../emails/event-payment-request';
import { MembershipPaymentReminderTemplate } from '@/../emails/membership-payment-reminder';
import { NewsletterBroadcastTemplate } from '@/../emails/newsletter-broadcast';
import { PavilionReservationEmailTemplate } from '@/../emails/pavilion-reservation';
import { sanitizeEmailTemplateBodyHtml } from '@/libs/email-templates/emailTemplateBodyHtml';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import { choosePublishedRevision } from '@/libs/email-templates/emailTemplatePublishing';
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

export type EmailTemplateRenderContext = Readonly<{
  eventPaymentAdminDigest?: Readonly<{
    overduePayments: readonly {
      amount: string;
      id: string;
      recipientEmail: string;
      recipientName: string;
      selectedFeeDescription: string;
    }[];
  }>;
  pavilionReservation?: Readonly<{
    scheduleLines: readonly string[];
  }>;
}>;

type RenderParams = Readonly<{
  context?: EmailTemplateRenderContext;
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

function valueFor(values: RenderParams['values'], key: string, fallback = '') {
  return values[key] ?? fallback;
}

type RenderTemplateParams = Readonly<{
  bodyHtml: string;
  context?: EmailTemplateRenderContext;
  key: EditableEmailTemplateKey;
  previewText: string;
  subject: string;
  text: string;
  values: RenderParams['values'];
}>;

type TemplateBuilder = (params: RenderTemplateParams) => React.ReactElement;

const eventCopy = enMessages.EventPaymentEmails;
const membershipCopy = enMessages.MembershipPaymentEmails;
const pavilionCopy = enMessages.PavilionReservationEmails;

function eventPaymentActionTemplateProps(params: RenderTemplateParams) {
  return {
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
  };
}

const templateBuilders = {
  event_payment_request: (params) =>
    EventPaymentRequestTemplate(eventPaymentActionTemplateProps(params)),
  event_payment_reminder: (params) =>
    EventPaymentReminderTemplate(eventPaymentActionTemplateProps(params)),
  event_payment_receipt: (params) =>
    EventPaymentReceiptTemplate({
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
    }),
  event_payment_admin_digest: (params) =>
    EventPaymentAdminDigestTemplate({
      body: params.text,
      bodyHtml: params.bodyHtml,
      deadline: valueFor(params.values, 'deadline'),
      eventName: valueFor(params.values, 'eventName'),
      fieldDeadline: eventCopy.field_deadline,
      overduePayments:
        params.context?.eventPaymentAdminDigest?.overduePayments ?? [],
      previewText: params.previewText,
      title: params.subject,
    }),
  membership_payment_reminder: (params) =>
    MembershipPaymentReminderTemplate({
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
    }),
  newsletter_broadcast: (params) =>
    NewsletterBroadcastTemplate({
      body: params.bodyHtml,
      listName: valueFor(params.values, 'listName', 'General'),
      managePreferencesLabel: valueFor(
        params.values,
        'managePreferencesLabel',
        'Manage all newsletter preferences'
      ),
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
    }),
  pavilion_reservation_status: (params) =>
    PavilionReservationEmailTemplate({
      body: params.text,
      bodyHtml: params.bodyHtml,
      copy: pavilionCopy,
      eventName: valueFor(params.values, 'eventName'),
      previewText: params.previewText,
      referenceCode: valueFor(params.values, 'referenceCode'),
      scheduleLines: params.context?.pavilionReservation?.scheduleLines ?? [],
      statusLabel: valueFor(params.values, 'status'),
      title: params.subject,
    }),
  pavilion_reservation_submitted: (params) =>
    PavilionReservationEmailTemplate({
      body: params.text,
      bodyHtml: params.bodyHtml,
      copy: pavilionCopy,
      eventName: valueFor(params.values, 'eventName'),
      previewText: params.previewText,
      referenceCode: valueFor(params.values, 'referenceCode'),
      scheduleLines: params.context?.pavilionReservation?.scheduleLines ?? [],
      title: params.subject,
    }),
} satisfies Record<EditableEmailTemplateKey, TemplateBuilder>;

async function renderTemplateHtml(params: RenderTemplateParams) {
  const html = await render(templateBuilders[params.key](params));
  return html;
}

export async function renderEditableEmailTemplate(params: RenderParams) {
  const { key } = params.revision.template;
  const entry = emailTemplateRegistryEntry(key);

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
    const bodyText = interpolated(params.revision.renderedText, params.values);
    if (!subject || !previewText || !bodyHtml || !bodyText) {
      throw new EmailTemplateRenderError(
        `Email template ${key} revision ${params.revision.id} rendered empty content`
      );
    }

    const html = await renderTemplateHtml({
      bodyHtml,
      context: params.context,
      key,
      previewText,
      subject,
      text: bodyText,
      values: params.values,
    });
    const text = toPlainText(html).trim();
    if (!text) {
      throw new EmailTemplateRenderError(
        `Email template ${key} revision ${params.revision.id} rendered empty text`
      );
    }
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

export async function renderPublishedEmailTemplateForSend(params: {
  context?: EmailTemplateRenderContext;
  key: EditableEmailTemplateKey;
  values: RenderParams['values'];
}) {
  const { prisma } = await import('@/libs/DB');
  const template = await prisma.emailTemplate.findUnique({
    include: { revisions: true },
    where: { key: params.key },
  });
  if (!template) {
    return null;
  }

  const revision = choosePublishedRevision(template.revisions);
  if (!revision) {
    return null;
  }

  const rendered = await renderEditableEmailTemplate({
    context: params.context,
    revision: {
      editorBodyHtml: revision.editorBodyHtml,
      id: revision.id,
      previewText: revision.previewText,
      renderedText: revision.renderedText,
      subject: revision.subject,
      template: { key: params.key },
    },
    values: params.values,
  });

  return {
    ...rendered,
    emailTemplateKey: params.key,
    emailTemplateRevisionId: revision.id,
  };
}

export type PublishedEmailTemplateRender = NonNullable<
  Awaited<ReturnType<typeof renderPublishedEmailTemplateForSend>>
>;

export function emailTemplateMetadata(rendered: PublishedEmailTemplateRender) {
  return {
    emailTemplateKey: rendered.emailTemplateKey,
    emailTemplateRevisionId: rendered.emailTemplateRevisionId,
  };
}
