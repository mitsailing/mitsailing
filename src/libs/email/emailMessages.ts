import 'server-only';
import { randomUUID } from 'node:crypto';
import type { WebhookEventPayload } from 'resend';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import {
  resendEmailProviderEventIdFromParts,
  resendProviderEventIdForWebhook,
  resendWebhookOccurredAt,
} from '@/libs/email/resendWebhookEvents';
import { logger } from '@/libs/Logger';
import { normalizeEmailAddress } from '@/utils/emailValidation';

export type EmailMessageCategory =
  | 'account_locked'
  | 'contact'
  | 'delete_account'
  | 'email_change'
  | 'event_payment_admin_digest'
  | 'event_payment_receipt'
  | 'event_payment_reminder'
  | 'event_payment_request'
  | 'membership_payment_reminder'
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

type UpsertEmailMessageParams = RecordSentEmailMessageParams & {
  client?: Pick<ResendWebhookClient, '$queryRaw'>;
  lastEventAt: Date | null;
  lastEventType: string | null;
  sentAt: Date | null;
};

export type ResendEmailEventPayload = Extract<
  WebhookEventPayload,
  {
    data: {
      email_id: string;
    };
  }
>;

export type ResendWebhookClient = {
  $executeRaw: typeof prisma.$executeRaw;
  $queryRaw: typeof prisma.$queryRaw;
  newsletterDelivery: Pick<
    typeof prisma.newsletterDelivery,
    'findFirst' | 'findUnique' | 'updateMany'
  >;
  newsletterEvent: Pick<typeof prisma.newsletterEvent, 'create' | 'findFirst'>;
  newsletterSubscriber: Pick<typeof prisma.newsletterSubscriber, 'updateMany'>;
  user: Pick<typeof prisma.user, 'updateMany'>;
};

export type ResendWebhookContext = {
  client?: ResendWebhookClient;
  providerEventId: string | null;
  skipDedupe?: boolean;
};

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

const ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE = 25;

export type AdminUserEmailMessagesPage = {
  readonly page: number;
  readonly pageSize: number;
  readonly rows: AdminUserEmailMessageRow[];
  readonly total: number;
};

function jsonb(value: Record<string, unknown> | WebhookEventPayload | null) {
  return value
    ? Prisma.sql`CAST(${JSON.stringify(value)} AS JSONB)`
    : Prisma.sql`NULL`;
}

function isEmailEvent(
  event: WebhookEventPayload
): event is ResendEmailEventPayload {
  const data =
    'data' in event && event.data && typeof event.data === 'object'
      ? event.data
      : null;
  return (
    event.type.startsWith('email.') &&
    data !== null &&
    'email_id' in data &&
    typeof data.email_id === 'string'
  );
}

function eventErrorMessage(event: ResendEmailEventPayload): string | null {
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

async function upsertEmailMessage(
  params: UpsertEmailMessageParams
): Promise<string> {
  const client = params.client ?? prisma;
  const id = randomUUID();
  const now = new Date();
  const toEmail = normalizeEmailAddress(params.toEmail);
  const metadata = jsonb(params.metadata ?? null);

  const rows = await client.$queryRaw<{ id: string }[]>`
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
      ${params.userId ?? null},
      ${params.newsletterSubscriberId ?? null},
      ${params.newsletterBroadcastId ?? null},
      ${params.newsletterDeliveryId ?? null},
      ${toEmail},
      ${params.subject},
      ${params.category},
      ${params.lastEventType},
      ${params.sentAt},
      ${params.lastEventAt},
      ${metadata},
      ${now}
    )
    ON CONFLICT ("provider", "provider_message_id") DO UPDATE SET
      "sent_at" = COALESCE("email_messages"."sent_at", EXCLUDED."sent_at"),
      "user_id" = COALESCE("email_messages"."user_id", EXCLUDED."user_id"),
      "newsletter_subscriber_id" = COALESCE("email_messages"."newsletter_subscriber_id", EXCLUDED."newsletter_subscriber_id"),
      "newsletter_broadcast_id" = COALESCE("email_messages"."newsletter_broadcast_id", EXCLUDED."newsletter_broadcast_id"),
      "newsletter_delivery_id" = COALESCE("email_messages"."newsletter_delivery_id", EXCLUDED."newsletter_delivery_id"),
      "to_email" = COALESCE(NULLIF("email_messages"."to_email", ''), EXCLUDED."to_email"),
      "subject" = COALESCE(NULLIF("email_messages"."subject", ''), EXCLUDED."subject"),
      "category" = CASE WHEN "email_messages"."category" = 'other' THEN EXCLUDED."category" ELSE "email_messages"."category" END,
      "metadata" = COALESCE("email_messages"."metadata", EXCLUDED."metadata"),
      "updated_at" = EXCLUDED."updated_at"
    RETURNING "id"
  `;

  return rows.at(0)?.id ?? id;
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
  const toEmail = normalizeEmailAddress(params.toEmail);
  const userId = params.userId ?? (await userIdForEmail(toEmail));
  const sentAt = new Date();

  return upsertEmailMessage({
    ...params,
    lastEventAt: sentAt,
    lastEventType: 'email.sent',
    sentAt,
    toEmail,
    userId,
  });
}

async function emailMessageIdForProviderMessage(
  provider: EmailProvider,
  providerMessageId: string,
  client: Pick<ResendWebhookClient, '$queryRaw'> = prisma
): Promise<string | null> {
  const rows = await client.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "email_messages"
    WHERE "provider" = ${provider}
      AND "provider_message_id" = ${providerMessageId}
    LIMIT 1
  `;
  return rows.at(0)?.id ?? null;
}

type EmailMessageEventClient = {
  $queryRaw: typeof prisma.$queryRaw;
};

export async function recordResendEmailMessageEvent(params: {
  client?: EmailMessageEventClient;
  emailMessageId: string;
  event: ResendEmailEventPayload;
  occurredAt: Date;
  providerEventId: string | null;
  providerMessageId: string;
}): Promise<boolean> {
  const client = params.client ?? prisma;
  const id = randomUUID();
  const payload = jsonb(params.event);
  const providerEventId =
    params.providerEventId ??
    resendEmailProviderEventIdFromParts({
      occurredAt: params.occurredAt,
      providerMessageId: params.providerMessageId,
      type: params.event.type,
    });

  const rows = await client.$queryRaw<{ id: string }[]>`
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
      ${providerEventId},
      ${params.event.type},
      ${params.providerMessageId},
      ${params.occurredAt},
      ${payload}
    )
    ON CONFLICT ("provider", "provider_event_id") DO NOTHING
    RETURNING "id"
  `;
  return rows.length > 0;
}

function firstResendRecipient(event: ResendEmailEventPayload): string {
  const recipients = 'to' in event.data ? event.data.to : null;
  if (Array.isArray(recipients)) {
    return recipients.find((recipient) => typeof recipient === 'string') ?? '';
  }
  return typeof recipients === 'string' ? recipients : '';
}

function resendEmailSubject(event: ResendEmailEventPayload): string {
  const subject = 'subject' in event.data ? event.data.subject : null;
  return typeof subject === 'string' ? subject : '';
}

export async function ensureEmailMessageIdForResendEvent(params: {
  client: Pick<ResendWebhookClient, '$queryRaw'>;
  event: ResendEmailEventPayload;
  providerMessageId: string;
}): Promise<string> {
  const existingId = await emailMessageIdForProviderMessage(
    'resend',
    params.providerMessageId,
    params.client
  );
  if (existingId) {
    return existingId;
  }

  return upsertEmailMessage({
    category: 'other',
    client: params.client,
    lastEventAt: null,
    lastEventType: null,
    provider: 'resend',
    providerMessageId: params.providerMessageId,
    sentAt: null,
    subject: resendEmailSubject(params.event),
    toEmail: firstResendRecipient(params.event),
  });
}

async function updateEmailMessageFromEvent(params: {
  client?: Pick<ResendWebhookClient, '$executeRaw'>;
  emailMessageId: string;
  event: ResendEmailEventPayload;
  lastError: string | null;
  occurredAt: Date;
}): Promise<void> {
  const client = params.client ?? prisma;
  await client.$executeRaw`
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
      AND ("last_event_at" IS NULL OR "last_event_at" <= ${params.occurredAt})
  `;
}

/**
 * Copies Resend email webhooks into the outbound email ledger.
 *
 * @param event - Verified Resend webhook payload
 * @param context - Verified webhook metadata from Svix headers
 * @returns Whether downstream state handlers should process the event
 */
export async function handleResendEmailMessageWebhook(
  event: WebhookEventPayload,
  context?: ResendWebhookContext
): Promise<boolean> {
  if (!isEmailEvent(event)) {
    return true;
  }

  // Resend send id (`email_id`), not the SMTP Message-ID header (`message_id`).
  const providerMessageId = event.data.email_id;
  const client = context?.client ?? prisma;
  const occurredAt = resendWebhookOccurredAt(event);
  if (!occurredAt) {
    logger.error('Skipping Resend email event with invalid timestamp', {
      providerMessageId,
      timestamp: event.created_at,
      type: event.type,
    });
    return false;
  }
  const emailMessageId = await ensureEmailMessageIdForResendEvent({
    client,
    event,
    providerMessageId,
  });
  const isNewEvent = await recordResendEmailMessageEvent({
    client,
    emailMessageId,
    event,
    occurredAt,
    providerEventId: resendProviderEventIdForWebhook({
      event,
      occurredAt,
      providerEventId: context?.providerEventId,
      providerMessageId,
    }),
    providerMessageId,
  });
  if (!isNewEvent) {
    logger.info('Skipping duplicate Resend email event', {
      providerMessageId,
      type: event.type,
    });
    return false;
  }
  await updateEmailMessageFromEvent({
    client,
    emailMessageId,
    event,
    lastError: eventErrorMessage(event),
    occurredAt,
  });
  return true;
}

/**
 * Converts a raw SQL count row to a number.
 *
 * @param row - Optional count row from a raw query
 * @returns Numeric count
 */
function countFromRawRow(row: { count: bigint | number | string } | undefined) {
  if (!row) {
    return 0;
  }
  if (typeof row.count === 'bigint') {
    return Number(row.count);
  }
  if (typeof row.count === 'number') {
    return row.count;
  }
  return Number.parseInt(row.count, 10) || 0;
}

export async function getAdminUserEmailMessagesPage(params: {
  email: string;
  page: number;
  pageSize?: number;
  userId: string;
}): Promise<AdminUserEmailMessagesPage> {
  const email = normalizeEmailAddress(params.email);
  const pageSize = params.pageSize ?? ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE;
  const countRows = await prisma.$queryRaw<
    { count: bigint | number | string }[]
  >`
    SELECT COUNT(*) AS "count"
    FROM "email_messages"
    WHERE "user_id" = ${params.userId} OR "to_email" = ${email}
  `;
  const total = countFromRawRow(countRows.at(0));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(params.page, 1), totalPages);
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
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `;
  return { page, pageSize, rows, total };
}
