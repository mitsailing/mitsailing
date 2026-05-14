import 'server-only';
import { randomUUID } from 'node:crypto';
import type { WebhookEventPayload } from 'resend';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { normalizeMarketingEmail } from '@/utils/emailValidation';

export type EmailMessageCategory =
  | 'account_locked'
  | 'contact'
  | 'delete_account'
  | 'email_change'
  | 'newsletter'
  | 'newsletter_test'
  | 'other'
  | 'password_changed'
  | 'password_reset'
  | 'sign_in_otp'
  | 'verify_email';

type EmailProvider = 'log' | 'resend' | 'smtp';

type RecordSentEmailMessageParams = {
  category: EmailMessageCategory;
  metadata?: Record<string, unknown> | null;
  newsletterBroadcastId?: string | null;
  newsletterDeliveryId?: string | null;
  newsletterSubscriberId?: string | null;
  provider: EmailProvider;
  providerMessageId: string | null;
  subject: string;
  toEmail: string;
  userId?: string | null;
};

type EmailEventPayload = Extract<
  WebhookEventPayload,
  {
    data: {
      email_id: string;
    };
  }
>;

export type AdminUserEmailMessageRow = {
  bouncedAt: Date | null;
  category: string;
  complainedAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
  failedAt: Date | null;
  id: string;
  lastError: string | null;
  lastEventAt: Date | null;
  lastEventType: string | null;
  newsletterBroadcastId: string | null;
  sentAt: Date | null;
  subject: string;
  suppressedAt: Date | null;
  toEmail: string;
};

function jsonb(value: Record<string, unknown> | WebhookEventPayload | null) {
  return value
    ? Prisma.sql`CAST(${JSON.stringify(value)} AS JSONB)`
    : Prisma.sql`NULL`;
}

function isEmailEvent(event: WebhookEventPayload): event is EmailEventPayload {
  return event.type.startsWith('email.');
}

function eventId(event: WebhookEventPayload): string | null {
  return 'id' in event && typeof event.id === 'string' ? event.id : null;
}

function eventOccurredAt(event: WebhookEventPayload): Date {
  if ('created_at' in event && typeof event.created_at === 'string') {
    return new Date(event.created_at);
  }
  return new Date();
}

function eventErrorMessage(event: EmailEventPayload): string | null {
  const { data } = event;
  if ('error' in data && typeof data.error === 'string') {
    return data.error;
  }
  if ('reason' in data && typeof data.reason === 'string') {
    return data.reason;
  }
  return null;
}

async function userIdForEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    select: { id: true },
    where: { email },
  });
  return user?.id ?? null;
}

/**
 * Records one outbound email after the active transport accepts it.
 *
 * @param params - Message metadata and provider ids
 * @returns Stored email message id
 */
export async function recordSentEmailMessage(
  params: RecordSentEmailMessageParams
): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const toEmail = normalizeMarketingEmail(params.toEmail);
  const userId = params.userId ?? (await userIdForEmail(toEmail));
  const metadata = jsonb(params.metadata ?? null);

  await prisma.$executeRaw`
    INSERT INTO "email_messages" (
      "id",
      "provider",
      "provider_message_id",
      "user_id",
      "newsletter_subscriber_id",
      "newsletter_broadcast_id",
      "newsletter_delivery_id",
      "to_email",
      "subject",
      "category",
      "last_event_type",
      "sent_at",
      "last_event_at",
      "metadata",
      "updated_at"
    )
    VALUES (
      ${id},
      ${params.provider},
      ${params.providerMessageId},
      ${userId},
      ${params.newsletterSubscriberId ?? null},
      ${params.newsletterBroadcastId ?? null},
      ${params.newsletterDeliveryId ?? null},
      ${toEmail},
      ${params.subject},
      ${params.category},
      ${'email.sent'},
      ${now},
      ${now},
      ${metadata},
      ${now}
    )
    ON CONFLICT ("provider_message_id") DO UPDATE SET
      "last_event_type" = 'email.sent',
      "sent_at" = COALESCE("email_messages"."sent_at", EXCLUDED."sent_at"),
      "last_event_at" = EXCLUDED."last_event_at",
      "user_id" = COALESCE("email_messages"."user_id", EXCLUDED."user_id"),
      "newsletter_subscriber_id" = COALESCE("email_messages"."newsletter_subscriber_id", EXCLUDED."newsletter_subscriber_id"),
      "newsletter_broadcast_id" = COALESCE("email_messages"."newsletter_broadcast_id", EXCLUDED."newsletter_broadcast_id"),
      "newsletter_delivery_id" = COALESCE("email_messages"."newsletter_delivery_id", EXCLUDED."newsletter_delivery_id"),
      "updated_at" = EXCLUDED."updated_at"
  `;

  return id;
}

async function emailMessageIdForProviderMessage(
  providerMessageId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "email_messages"
    WHERE "provider_message_id" = ${providerMessageId}
    LIMIT 1
  `;
  return rows.at(0)?.id ?? null;
}

async function recordEmailMessageEvent(params: {
  emailMessageId: string | null;
  event: EmailEventPayload;
  occurredAt: Date;
  providerEventId: string | null;
  providerMessageId: string;
}): Promise<void> {
  const id = randomUUID();
  const payload = jsonb(params.event);

  await prisma.$executeRaw`
    INSERT INTO "email_message_events" (
      "id",
      "email_message_id",
      "provider",
      "provider_event_id",
      "provider_event_type",
      "provider_message_id",
      "occurred_at",
      "payload"
    )
    VALUES (
      ${id},
      ${params.emailMessageId},
      ${'resend'},
      ${params.providerEventId},
      ${params.event.type},
      ${params.providerMessageId},
      ${params.occurredAt},
      ${payload}
    )
    ON CONFLICT ("provider_event_id") DO NOTHING
  `;
}

async function updateEmailMessageFromEvent(params: {
  emailMessageId: string | null;
  event: EmailEventPayload;
  lastError: string | null;
  occurredAt: Date;
}): Promise<void> {
  if (!params.emailMessageId) {
    return;
  }

  await prisma.$executeRaw`
    UPDATE "email_messages"
    SET
      "last_event_type" = ${params.event.type},
      "last_event_at" = ${params.occurredAt},
      "sent_at" = CASE WHEN ${params.event.type} = 'email.sent' THEN COALESCE("sent_at", ${params.occurredAt}) ELSE "sent_at" END,
      "delivered_at" = CASE WHEN ${params.event.type} = 'email.delivered' THEN ${params.occurredAt} ELSE "delivered_at" END,
      "bounced_at" = CASE WHEN ${params.event.type} = 'email.bounced' THEN ${params.occurredAt} ELSE "bounced_at" END,
      "complained_at" = CASE WHEN ${params.event.type} = 'email.complained' THEN ${params.occurredAt} ELSE "complained_at" END,
      "failed_at" = CASE WHEN ${params.event.type} = 'email.failed' THEN ${params.occurredAt} ELSE "failed_at" END,
      "suppressed_at" = CASE WHEN ${params.event.type} = 'email.suppressed' THEN ${params.occurredAt} ELSE "suppressed_at" END,
      "last_error" = COALESCE(${params.lastError}, "last_error"),
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${params.emailMessageId}
  `;
}

/**
 * Copies Resend email webhooks into the outbound email ledger.
 *
 * @param event - Verified Resend webhook payload
 */
export async function handleResendEmailMessageWebhook(
  event: WebhookEventPayload
): Promise<void> {
  if (!isEmailEvent(event)) {
    return;
  }

  const providerMessageId = event.data.email_id;
  const emailMessageId =
    await emailMessageIdForProviderMessage(providerMessageId);
  const occurredAt = eventOccurredAt(event);
  await recordEmailMessageEvent({
    emailMessageId,
    event,
    occurredAt,
    providerEventId: eventId(event),
    providerMessageId,
  });
  await updateEmailMessageFromEvent({
    emailMessageId,
    event,
    lastError: eventErrorMessage(event),
    occurredAt,
  });
}

/**
 * Lists recent outbound email rows for a user support view.
 *
 * @param params - Admin user id and current email
 * @returns Recent email messages newest first
 */
export async function getAdminUserEmailMessages(params: {
  email: string;
  userId: string;
}): Promise<AdminUserEmailMessageRow[]> {
  const email = normalizeMarketingEmail(params.email);
  const rows = await prisma.$queryRaw<AdminUserEmailMessageRow[]>`
    SELECT
      "id",
      "to_email" AS "toEmail",
      "subject",
      "category",
      "last_event_type" AS "lastEventType",
      "sent_at" AS "sentAt",
      "delivered_at" AS "deliveredAt",
      "bounced_at" AS "bouncedAt",
      "complained_at" AS "complainedAt",
      "failed_at" AS "failedAt",
      "suppressed_at" AS "suppressedAt",
      "last_event_at" AS "lastEventAt",
      "last_error" AS "lastError",
      "newsletter_broadcast_id" AS "newsletterBroadcastId",
      "created_at" AS "createdAt"
    FROM "email_messages"
    WHERE "user_id" = ${params.userId} OR "to_email" = ${email}
    ORDER BY "created_at" DESC
    LIMIT 50
  `;
  return rows;
}
