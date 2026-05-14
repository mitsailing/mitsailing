import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import type { WebhookEventPayload } from 'resend';
import { Resend } from 'resend';
import { handleResendAccountEmailWebhook } from '@/libs/email/accountEmailWebhooks';
import { handleResendEmailMessageWebhook } from '@/libs/email/emailMessages';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { handleResendNewsletterWebhook } from '@/libs/newsletter/newsletterWebhooks';

function svixHeaders(request: Request) {
  return {
    id: request.headers.get('svix-id') ?? '',
    signature: request.headers.get('svix-signature') ?? '',
    timestamp: request.headers.get('svix-timestamp') ?? '',
  };
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

  const resend = new Resend(Env.RESEND_API_KEY);
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

  const context = { providerEventId: request.headers.get('svix-id') };
  try {
    const shouldHandleState = await handleResendEmailMessageWebhook(
      event,
      context
    );
    if (shouldHandleState) {
      await handleResendNewsletterWebhook(event, {
        ...context,
        skipDedupe: true,
      });
      await handleResendAccountEmailWebhook(event, context);
    }
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
