import 'server-only';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { assertPasswordNotCompromised } from '@/libs/auth/password-compromise';
import { prisma } from '@/libs/DB';
import {
  sendAccountLockedEmail,
  sendPasswordChangedNotice,
} from '@/libs/email/account-emails';
import { logger } from '@/libs/Logger';
import { normalizeEmailAddress } from '@/utils/emailValidation';

/** Maximum failed password attempts inside the rolling window before lockout. */
const MAX_FAILED_ATTEMPTS = 5;
/** Rolling window (15 minutes, Devise Lockable parity). */
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const RESET_PASSWORD_PATH = '/reset-password';
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? normalizeEmailAddress(value) : '';
}

async function countRecentFailures(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const count = await prisma.failedLoginAttempt.count({
    where: { email, createdAt: { gt: since } },
  });
  return count;
}

/**
 * Validates link reset-password input before Better Auth updates password.
 * Enforces MIN_PASSWORD_LENGTH and MAX_PASSWORD_LENGTH and maps failures to
 * stable BAD_REQUEST APIError codes.
 *
 * @param password - Candidate password from the request body.
 * @returns Resolves when password preflight passes.
 * @throws APIError for missing, short, long, or compromised passwords.
 */
async function preflightResetPassword(password: unknown) {
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
    logger.error('Failed to send password-changed notice: {error}', { error });
  });
}

/**
 * True when this email belongs to a user who has never set a credential
 * password on this site (legacy imports have a User row only).
 *
 * @param email - Normalized account email
 * @returns Whether sign-in should require Forgot password first
 */
async function userNeedsNewSitePassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      accounts: {
        select: { id: true },
        take: 1,
        where: { password: { not: null }, providerId: 'credential' },
      },
    },
  });
  return Boolean(user && user.accounts.length === 0);
}

/**
 * Lockout + explicit-EMAIL_EXISTS hook pair registered on Better Auth.
 *
 * Devise Lockable parity: five failures inside 15 minutes locks the account
 * for the remainder of the window. Better Auth 1.7 hides duplicate emails when
 * `requireEmailVerification` is on; we still throw EMAIL_EXISTS on purpose so
 * sign-up can show "that email is already in the system." Known users without
 * a credential password get MUST_SET_PASSWORD before the password check runs.
 */
export const signInEmailHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path === RESET_PASSWORD_PATH) {
      await preflightResetPassword(ctx.body?.newPassword);
    }

    if (ctx.path === '/sign-in/email') {
      const email = normalizeEmail(ctx.body?.email);
      if (email && (await countRecentFailures(email)) >= MAX_FAILED_ATTEMPTS) {
        throw new APIError('FORBIDDEN', { message: 'ACCOUNT_LOCKED' });
      }
      if (email && (await userNeedsNewSitePassword(email))) {
        throw new APIError('FORBIDDEN', { message: 'MUST_SET_PASSWORD' });
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
        logger.error('Failed to send account-locked email: {error}', { error });
      });
    }
  }),
};
