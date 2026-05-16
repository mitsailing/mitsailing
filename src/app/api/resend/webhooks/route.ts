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

const resend = new Resend(Env.RESEND_API_KEY);

function svixHeaders(request: Request) {
  return {
    id: request.headers.get('svix-id') ?? '',
    signature: request.headers.get('svix-signature') ?? '',
    timestamp: request.headers.get('svix-timestamp') ?? '',
  };
}

function eventId(event: WebhookEventPayload): string | null {
  return 'id' in event && typeof event.id === 'string' ? event.id : null;
}

function emailProviderEventId(event: WebhookEventPayload): string | null {
  const data =
    'data' in event && event.data && typeof event.data === 'object'
      ? event.data
      : null;
  if (
    !event.type.startsWith('email.') ||
    !data ||
    !('email_id' in data) ||
    typeof data.email_id !== 'string' ||
    !('created_at' in event) ||
    typeof event.created_at !== 'string'
  ) {
    return null;
  }

  const occurredAt = new Date(event.created_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return `${data.email_id}:${event.type}:${occurredAt.toISOString()}`;
}

function providerEventIdForWebhook(
  request: Request,
  event: WebhookEventPayload
): string | null {
  return (
    request.headers.get('svix-id') ??
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

  let event: WebhookEventPayload;
  try {
    event = resend.webhooks.verify({
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
