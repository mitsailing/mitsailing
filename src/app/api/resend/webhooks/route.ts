import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { handleResendAccountEmailWebhook } from '@/libs/email/accountEmailWebhooks';
import { handleResendEmailMessageWebhook } from '@/libs/email/emailMessages';
import { Env } from '@/libs/Env';
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
  const event = resend.webhooks.verify({
    headers: svixHeaders(request),
    payload,
    webhookSecret: Env.RESEND_WEBHOOK_SECRET,
  });
  await handleResendEmailMessageWebhook(event);
  await handleResendNewsletterWebhook(event);
  await handleResendAccountEmailWebhook(event);
  return NextResponse.json({ ok: true });
}
