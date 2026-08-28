import { NextResponse } from 'next/server';
import type { WebhookEventPayload } from 'resend';
import { Resend } from 'resend';
import { prisma } from '@/libs/DB';
import { handleResendAccountEmailWebhook } from '@/libs/email/accountEmailWebhooks';
import { handleResendEmailMessageWebhook } from '@/libs/email/emailMessages';
import { resendProviderEventIdForWebhook } from '@/libs/email/resendWebhookEvents';
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

function nonEmptyHeader(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized;
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
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const context = {
    providerEventId: resendProviderEventIdForWebhook({
      event,
      providerEventId: nonEmptyHeader(request.headers.get('svix-id')),
    }),
  };
  try {
    await prisma.$transaction(async (client) => {
      const isNewEvent = await handleResendEmailMessageWebhook(event, {
        ...context,
        client,
      });
      if (!isNewEvent) {
        return;
      }
      await handleResendNewsletterWebhook(event, {
        ...context,
        client,
        skipDedupe: true,
      });
      await handleResendAccountEmailWebhook(event, { ...context, client });
    });
  } catch (error) {
    logger.error('Failed to process Resend webhook: {error}', {
      error,
      providerEventId: context.providerEventId,
      type: event.type,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
