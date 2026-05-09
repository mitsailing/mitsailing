import 'server-only';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { assertPasswordNotCompromised } from '@/libs/auth/password-compromise';
import { prisma } from '@/libs/DB';
import {
  sendAccountLockedEmail,
  sendPasswordChangedNotice,
} from '@/libs/email/account-emails';

/** Maximum failed password attempts inside the rolling window before lockout. */
const MAX_FAILED_ATTEMPTS = 5;
/** Rolling window (15 minutes, Devise Lockable parity). */
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const RESET_PASSWORD_EMAIL_OTP_PATH = '/email-otp/reset-password';
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function countRecentFailures(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const count = await prisma.failedLoginAttempt.count({
    where: { email, createdAt: { gt: since } },
  });
  return count;
}

async function preflightEmailOtpResetPassword(password: unknown) {
  if (typeof password !== 'string') {
    throw APIError.from('BAD_REQUEST', {
      code: 'PASSWORD_REQUIRED',
      message: 'PASSWORD_REQUIRED',
    });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw APIError.from('BAD_REQUEST', {
      code: 'PASSWORD_TOO_SHORT',
      message: 'PASSWORD_TOO_SHORT',
    });
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw APIError.from('BAD_REQUEST', {
      code: 'PASSWORD_TOO_LONG',
      message: 'PASSWORD_TOO_LONG',
    });
  }

  await assertPasswordNotCompromised(password);
}

// Secure Rails "notify on password change": Better Auth does not ship a
// dedicated post-change-password hook, so we piggy-back on the generic
// after-middleware and read the (now-updated) session user's email. The
// notice is advisory, so delivery failures must never mask the underlying
// password-change success.
async function notifyPasswordChange(ctx: {
  context: { session?: { user?: { email?: string | null } } | null };
}) {
  const email = ctx.context.session?.user?.email;
  if (typeof email !== 'string' || email.length === 0) {
    return;
  }
  await sendPasswordChangedNotice(email).catch((error: unknown) => {
    console.warn('Failed to send password-changed notice:', error);
  });
}

/**
 * Lockout + explicit-EMAIL_EXISTS hook pair registered on Better Auth.
 *
 * Devise Lockable parity: five failures inside 15 minutes locks the account
 * for the remainder of the window. The `/sign-up/email` override restores the
 * explicit "that email is already in the system" message that BA suppresses
 * by default for user-enumeration reasons.
 */
export const signInEmailHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path === RESET_PASSWORD_EMAIL_OTP_PATH) {
      await preflightEmailOtpResetPassword(ctx.body?.password);
    }

    if (ctx.path === '/sign-in/email') {
      const email = normalizeEmail(ctx.body?.email);
      if (email && (await countRecentFailures(email)) >= MAX_FAILED_ATTEMPTS) {
        throw new APIError('FORBIDDEN', { message: 'ACCOUNT_LOCKED' });
      }
    }

    if (ctx.path === '/sign-up/email') {
      const email = normalizeEmail(ctx.body?.email);
      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          throw new APIError('CONFLICT', { message: 'EMAIL_EXISTS' });
        }
      }
    }
  }),

  after: createAuthMiddleware(async (ctx) => {
    if (ctx.path === '/change-password') {
      await notifyPasswordChange(ctx);
      return;
    }

    if (ctx.path !== '/sign-in/email') {
      return;
    }

    const email = normalizeEmail(ctx.body?.email);
    if (!email) {
      return;
    }

    const success = Boolean(ctx.context.newSession);
    if (success) {
      await prisma.failedLoginAttempt.deleteMany({ where: { email } });
      return;
    }

    const ip = ctx.request?.headers.get('cf-connecting-ip') ?? null;
    await prisma.failedLoginAttempt.create({ data: { email, ipAddress: ip } });
    const failures = await countRecentFailures(email);
    if (failures === MAX_FAILED_ATTEMPTS) {
      // Email delivery must never undo the lock, hence the swallow.
      await sendAccountLockedEmail(email).catch((error: unknown) => {
        console.warn('Failed to send account-locked email:', error);
      });
    }
  }),
};
