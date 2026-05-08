import 'server-only';
import { i18n } from '@better-auth/i18n';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { Options } from '@node-rs/argon2';
import { hash, verify } from '@node-rs/argon2';
import { betterAuth } from 'better-auth';
import { auditLog } from 'better-auth-audit-logs';
import { nextCookies } from 'better-auth/next-js';
import { admin, emailOTP, haveIBeenPwned } from 'better-auth/plugins';
import { signInEmailHooks } from '@/libs/auth/hooks';
import { prisma } from '@/libs/DB';
import {
  markPendingEmailChange,
  sendDeleteAccountVerificationEmail,
  sendEmailChangeRequestedNotice,
  sendEmailOtpCode,
  sendPasswordChangedNotice,
} from '@/libs/email/account-emails';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';

/**
 * Argon2id parameters. Mirrors the previous standalone password helper so the
 * upgrade does not invalidate any hashes that already exist in the database.
 */
const argonOpts: Options = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2,
};

const isProd = Env.NODE_ENV === 'production';
const isTest = Env.NODE_ENV === 'test';
// Playwright runs `next start` with NODE_ENV=production (so `isProd` is true
// during e2e), but tests intentionally pound sign-up/sign-in from the same
// localhost IP across parallel workers — the account-lockout test alone does
// 6 sign-ins, which exceeds the 5/60s cap. Disable Better Auth's IP rate
// limiter under the e2e flag so lockout + "email already exists" tests can
// reach the logic they care about. The flag is set by `e2e-build.cjs` at
// build time and by playwright.config.ts at runtime.
const isE2E = Env.NEXT_PUBLIC_IS_E2E === '1';

export const auth = betterAuth({
  baseURL: Env.NEXT_PUBLIC_APP_URL,
  secret: Env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: {
    ipAddress: {
      ipAddressHeaders: [
        'cf-connecting-ip',
        'true-client-ip',
        'x-vercel-forwarded-for',
        'x-forwarded-for',
        'x-real-ip',
      ],
    },
  },
  session: {
    expiresIn: 30 * 60,
    updateAge: 30 * 60,
    cookieCache: { enabled: true, maxAge: 60 },
    freshAge: 60 * 5,
  },
  rateLimit: {
    enabled: isProd && !isE2E,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/delete-user': { window: 60 * 60, max: 3 },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: 8,
    password: {
      hash: async (password) => {
        const digest = await hash(password, argonOpts);
        return digest;
      },
      verify: async ({ password, hash: h }) => {
        const ok = await verify(h, password, argonOpts);
        return ok;
      },
    },
    onPasswordReset: async ({ user }) => {
      await sendPasswordChangedNotice(user.email);
    },
  },
  emailVerification: {
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user) => {
      // Devise-parity: once the verification flow completes (sign-up or
      // change-email), make sure no stale pending address lingers on the
      // profile. `updateMany` with a predicate makes this idempotent so the
      // sign-up path (where `unconfirmedEmail` is already null) is a no-op.
      await prisma.user.updateMany({
        where: { id: user.id, unconfirmedEmail: { not: null } },
        data: { unconfirmedEmail: null },
      });
    },
  },
  user: {
    additionalFields: {
      // Devise-style pending-email column. `input: false` keeps it out of the
      // sign-up/update payload surface — it is only written via the
      // change-email flow below and the verification hook above.
      unconfirmedEmail: {
        type: 'string',
        required: false,
        input: false,
        fieldName: 'unconfirmed_email',
      },
    },
    changeEmail: {
      enabled: false,
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendDeleteAccountVerificationEmail(user.email, url);
      },
    },
  },
  hooks: {
    before: signInEmailHooks.before,
    after: signInEmailHooks.after,
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
      bannedUserMessage: enMessages.AuthErrors.BANNED_USER_MESSAGE,
    }),
    haveIBeenPwned({
      enabled: !isTest && !isE2E,
      customPasswordCompromisedMessage:
        enMessages.AuthErrors.PASSWORD_COMPROMISED,
      paths: [
        '/sign-up/email',
        '/change-password',
        '/email-otp/reset-password',
      ],
    }),
    emailOTP({
      allowedAttempts: 3,
      changeEmail: { enabled: true },
      expiresIn: 5 * 60,
      otpLength: 6,
      overrideDefaultEmailVerification: true,
      rateLimit: { window: 60, max: 3 },
      storeOTP: 'hashed',
      async sendVerificationOTP({ email, otp, type }, ctx) {
        await sendEmailOtpCode({ email, otp, type });

        if (type === 'change-email') {
          const sessionUser = ctx?.context.session?.user;
          if (sessionUser?.id) {
            const pendingEmailChanged = await markPendingEmailChange({
              userId: sessionUser.id,
              newEmail: email,
            });
            if (
              pendingEmailChanged &&
              sessionUser.email &&
              sessionUser.email !== email
            ) {
              await sendEmailChangeRequestedNotice({
                currentEmail: sessionUser.email,
                newEmail: email,
              });
            }
          }
        }
      },
    }),
    auditLog({
      nonBlocking: true,
      piiRedaction: { enabled: true, strategy: 'hash' },
      retention: { enabled: true, days: 90 },
    }),
    i18n({
      translations: {
        en: {
          EMAIL_EXISTS: enMessages.AuthErrors.EMAIL_EXISTS,
          ACCOUNT_LOCKED: enMessages.AuthErrors.ACCOUNT_LOCKED,
          INVALID_EMAIL_OR_PASSWORD:
            enMessages.AuthErrors.INVALID_EMAIL_OR_PASSWORD,
          EMAIL_NOT_VERIFIED: enMessages.AuthErrors.EMAIL_NOT_VERIFIED,
          PASSWORD_COMPROMISED: enMessages.AuthErrors.PASSWORD_COMPROMISED,
        },
      },
    }),
    nextCookies(),
  ],
});
