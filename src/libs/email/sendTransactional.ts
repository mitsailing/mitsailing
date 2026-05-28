import 'server-only';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';
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
};

let cachedSmtpTransport: Transporter | null = null;

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

async function sendViaSmtp(params: Params): Promise<void> {
  if (!Env.EMAIL_FROM) {
    throw new Error('MAIL_TRANSPORT=smtp but EMAIL_FROM is not set.');
  }
  const transport = getSmtpTransport();
  await transport.sendMail({
    from: Env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

async function sendViaResend(params: Params): Promise<void> {
  if (!Env.RESEND_API_KEY || !Env.EMAIL_FROM) {
    throw new Error(
      'MAIL_TRANSPORT=resend requires both RESEND_API_KEY and EMAIL_FROM.'
    );
  }
  const resend = new Resend(Env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: Env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (result.error) {
    logger.error(`Resend error: ${result.error.message}`);
    throw new Error(result.error.message);
  }
}

function logOnly(params: Params): void {
  logger.info(`[mail:log] → ${params.to} — ${params.subject}`);
}

/**
 * Sends a transactional email through the active transport.
 * @param params - Outbound message payload.
 */
export async function sendTransactionalEmail(params: Params): Promise<void> {
  switch (Env.MAIL_TRANSPORT) {
    case 'smtp': {
      await sendViaSmtp(params);
      return;
    }
    case 'resend': {
      await sendViaResend(params);
      return;
    }
    case 'log': {
      logOnly(params);
      return;
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
