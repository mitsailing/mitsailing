import 'server-only';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import sanitizeHtml from 'sanitize-html';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

/**
 * Outbound transactional-email gateway. Drivers are selected by
 * `MAIL_TRANSPORT` so flipping staging from Mailpit capture to a real Resend
 * send is a single env change — no code path varies by environment.
 *
 *   smtp   → nodemailer over `SMTP_URL` (Mailpit in dev/staging; SMTP relay
 *            in any enterprise that prefers SMTP over REST)
 *   resend → Resend HTTP API (cloud prod)
 *   log    → log the subject + recipient and drop (unit tests, seed scripts,
 *            any environment that must not send real mail)
 *
 * Drivers fail closed: a missing `SMTP_URL`/`RESEND_API_KEY`/`EMAIL_FROM` is
 * treated as a configuration error rather than silently degrading to "log",
 * which would otherwise mask a production misconfig.
 */

type Params = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  topicId?: string | null;
};

export type SendEmailResult = {
  providerMessageId: string | null;
};

let cachedSmtpTransport: Transporter | null = null;

function htmlToPlainText(html: string): string {
  const withReadableLinks = html.replaceAll(
    /<a\b(?=[^>]*\bhref=(['"])(.*?)\1)[^>]*>([\s\S]*?)<\/a>/gi,
    (_full, _quote: string, href: string, label: string) => `${label} (${href})`
  );
  const withLineBreaks = withReadableLinks
    .replaceAll(/<br\s*\/?>/giu, '\n')
    .replaceAll(/<\/(p|div|h[1-6]|li|tr|section|article)>/giu, '\n')
    .replaceAll(/<(p|div|h[1-6]|li|tr|section|article)\b[^>]*>/giu, '\n');
  return sanitizeHtml(withLineBreaks, {
    allowedAttributes: {},
    allowedTags: [],
  })
    .replaceAll('\u00A0', ' ')
    .replaceAll(/[ \t\f\v]*\n[ \t\f\v]*/gu, '\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .replaceAll(/[ \t\f\v]{2,}/gu, ' ')
    .trim();
}

function withPlainTextFallback(params: Params): Params & { text: string } {
  return {
    ...params,
    text: params.text?.trim() ? params.text : htmlToPlainText(params.html),
  };
}

function getSmtpTransport(): Transporter {
  if (cachedSmtpTransport) {
    return cachedSmtpTransport;
  }
  if (!Env.SMTP_URL) {
    throw new Error(
      'MAIL_TRANSPORT=smtp but SMTP_URL is not set. Point at Mailpit locally (smtp://127.0.0.1:1025) or your SMTP relay.'
    );
  }
  cachedSmtpTransport = nodemailer.createTransport(Env.SMTP_URL);
  return cachedSmtpTransport;
}

async function sendViaSmtp(params: Params): Promise<SendEmailResult> {
  if (!Env.EMAIL_FROM) {
    throw new Error('MAIL_TRANSPORT=smtp but EMAIL_FROM is not set.');
  }
  const transport = getSmtpTransport();
  const info = await transport.sendMail({
    from: Env.EMAIL_FROM,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    headers: params.headers,
  });
  return { providerMessageId: info.messageId ?? null };
}

async function sendViaResend(params: Params): Promise<SendEmailResult> {
  if (!Env.RESEND_API_KEY || !Env.EMAIL_FROM) {
    throw new Error(
      'MAIL_TRANSPORT=resend requires both RESEND_API_KEY and EMAIL_FROM.'
    );
  }
  const resend = new Resend(Env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: Env.EMAIL_FROM,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    headers: params.headers,
    tags: params.tags,
    topicId: params.topicId,
  });
  if (result.error) {
    logger.error(`Resend error: ${result.error.message}`);
    throw new Error(result.error.message);
  }
  return { providerMessageId: result.data?.id ?? null };
}

function logOnly(params: Params): SendEmailResult {
  logger.info(`[mail:log] → ${params.to} — ${params.subject}`);
  return { providerMessageId: null };
}

/**
 * Sends a transactional email through the active transport.
 * @param params - Outbound message payload.
 * @returns Provider message id for transports that expose one.
 */
export async function sendTransactionalEmail(
  params: Params
): Promise<SendEmailResult> {
  const message = withPlainTextFallback(params);

  switch (Env.MAIL_TRANSPORT) {
    case 'smtp': {
      const result = await sendViaSmtp(message);
      return result;
    }
    case 'resend': {
      const result = await sendViaResend(message);
      return result;
    }
    case 'log': {
      return logOnly(message);
    }
    default: {
      // Exhaustiveness check — MAIL_TRANSPORT is a closed enum in Env.ts, so
      // reaching this branch means someone added a driver without extending
      // the switch.
      const _exhaustive: never = Env.MAIL_TRANSPORT;
      throw new Error(`Unknown MAIL_TRANSPORT: ${String(_exhaustive)}`);
    }
  }
}
