import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import type { WebhookEventPayload } from 'resend';
import { Resend } from 'resend';
import { prisma } from '@/libs/DB';
import { handleResendAccountEmailWebhook } from '@/libs/email/accountEmailWebhooks';
import { handleResendEmailMessageWebhook } from '@/libs/email/emailMessages';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { handleResendNewsletterWebhook } from '@/libs/newsletter/newsletterWebhooks';

let resendClient: Resend | null = null;

function getResendClient(apiKey: string) {
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

function svixHeaders(request: Request) {
  return {
    id: request.headers.get('svix-id') ?? '',
    signature: request.headers.get('svix-signature') ?? '',
    timestamp: request.headers.get('svix-timestamp') ?? '',
  };
}

function eventId(event: WebhookEventPayload) {
  return 'id' in event && typeof event.id === 'string' ? event.id : null;
}

function eventCreatedAt(event: WebhookEventPayload) {
  if (!('created_at' in event) || typeof event.created_at !== 'string') {
    return null;
  }

  const occurredAt = new Date(event.created_at);
  return Number.isNaN(occurredAt.getTime()) ? null : occurredAt;
}

function emailIdFromEvent(event: WebhookEventPayload) {
  if (!('data' in event) || !event.data || typeof event.data !== 'object') {
    return null;
  }

  return 'email_id' in event.data && typeof event.data.email_id === 'string'
    ? event.data.email_id
    : null;
}

function emailProviderEventId(event: WebhookEventPayload) {
  if (!event.type.startsWith('email.')) {
    return null;
  }

  const emailId = emailIdFromEvent(event);
  const occurredAt = eventCreatedAt(event);
  if (!emailId || !occurredAt) {
    return null;
  }

  return `${emailId}:${event.type}:${occurredAt.toISOString()}`;
}

function nonEmptyHeader(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized;
}

function providerEventIdForWebhook(
  request: Request,
  event: WebhookEventPayload
): string | null {
  return (
    nonEmptyHeader(request.headers.get('svix-id')) ??
    eventId(event) ??
    emailProviderEventId(event)
  );
}

/**
 * Resend webhook endpoint for newsletter delivery, bounce, complaint, and suppression events.
 *
 * @param request - Incoming webhook request
 * @returns JSON status
 */
export async function POST(request: Request) {
  const payload = await request.text();
  if (!Env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!Env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let event: WebhookEventPayload;
  try {
    event = getResendClient(Env.RESEND_API_KEY).webhooks.verify({
      headers: svixHeaders(request),
      payload,
      webhookSecret: Env.RESEND_WEBHOOK_SECRET,
    });
  } catch (error) {
    logger.error('Failed to verify Resend webhook: {error}', { error });
    Sentry.captureException(error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const context = {
    providerEventId: providerEventIdForWebhook(request, event),
  };
  try {
    await prisma.$transaction(async (client) => {
      await handleResendNewsletterWebhook(event, {
        ...context,
        client,
        skipDedupe: true,
      });
      await handleResendAccountEmailWebhook(event, { ...context, client });
      await handleResendEmailMessageWebhook(event, { ...context, client });
    });
  } catch (error) {
    logger.error('Failed to process Resend webhook: {error}', {
      error,
      providerEventId: context.providerEventId,
      type: event.type,
    });
    Sentry.captureException(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
