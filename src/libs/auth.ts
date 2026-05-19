import 'server-only';
import { i18n } from '@better-auth/i18n';
import { hash, verify } from '@node-rs/argon2';
import type { BetterAuthPlugin } from 'better-auth';
import { betterAuth } from 'better-auth';
import { auditLog } from 'better-auth-audit-logs';
import { createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import {
  admin,
  customSession,
  emailOTP,
  haveIBeenPwned,
} from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { signInEmailHooks } from '@/libs/auth/hooks';
import { passwordCompromiseCheckEnabled } from '@/libs/auth/password-compromise';
import { selectPasswordHashingOptions } from '@/libs/auth/passwordHashing';
import { Role, ROLE_VALUES } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import {
  markPendingEmailChange,
  sendDeleteAccountVerificationEmail,
  sendEmailChangeRequestedNotice,
  sendEmailOtpCode,
  sendPasswordChangedNotice,
} from '@/libs/email/account-emails';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { ensureNewsletterSubscriberForUser } from '@/libs/newsletter/newsletterSubscriptions';
import { getBetterAuthZenStackAdapter } from '@/libs/zenstack/auth';
import {
  appSessionDataForBetterAuth,
  withAppRoleBetterAuthAdapter,
} from '@/libs/zenstack/authContext';
import enMessages from '@/locales/en.json';

const isProd = Env.NODE_ENV === 'production';
// Playwright runs the production Next server (standalone `webServer` in
// playwright.config.ts) with NODE_ENV=production (so `isProd` is true
// during e2e), but tests intentionally pound sign-up/sign-in from the same
// localhost IP across parallel workers — the account-lockout test alone does
// 6 sign-ins, which exceeds the 5/60s cap. Disable Better Auth's IP rate
// limiter under the e2e flag so lockout + "email already exists" tests can
// reach the logic they care about. Use server-only `IS_E2E` (not
// `NEXT_PUBLIC_*`) so CI `.next` cache is not build-tainted for other jobs.
const isE2E = Env.IS_E2E === '1';
const argonOpts = selectPasswordHashingOptions({ isE2E });
const authAdminStatements = {
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'delete',
    'set-password',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
} as const;
const authAdminAccessControl = createAccessControl(authAdminStatements);
const authAdminRole = authAdminAccessControl.newRole(authAdminStatements);
const authNonAdminRole = authAdminAccessControl.newRole({
  user: [],
  session: [],
});
const appRoleAdminAuthorizationPlugin = {
  id: 'app-role-admin-authorization',
  hooks: {
    before: [
      {
        matcher: (ctx) => (ctx.path ?? '').startsWith('/admin/'),
        handler: createAuthMiddleware(async (ctx) => {
          await Promise.resolve();
          return {
            context: {
              query: {
                ...ctx.query,
                disableCookieCache: true,
              },
            },
          };
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

export const auth = betterAuth({
  baseURL: Env.NEXT_PUBLIC_APP_URL,
  secret: Env.BETTER_AUTH_SECRET,
  database: withAppRoleBetterAuthAdapter(getBetterAuthZenStackAdapter()),
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
      try {
        await ensureNewsletterSubscriberForUser(user.id);
      } catch (error) {
        logger.error(
          'Failed to create default newsletter preference: {error}',
          {
            email: user.email,
            error,
            operation: 'ensureNewsletterSubscriberForUser',
            userId: user.id,
          }
        );
      }
    },
  },
  user: {
    additionalFields: {
      appRole: {
        type: [...ROLE_VALUES],
        required: false,
        defaultValue: Role.USER,
        input: false,
        fieldName: 'app_role',
      },
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
    appRoleAdminAuthorizationPlugin,
    customSession(async (session) => {
      await Promise.resolve();
      return appSessionDataForBetterAuth(session);
    }),
    admin({
      defaultRole: Role.USER,
      adminRoles: [Role.ADMIN],
      ac: authAdminAccessControl,
      roles: {
        [Role.USER]: authNonAdminRole,
        [Role.VOLUNTEER]: authNonAdminRole,
        [Role.VOLUNTEER_INSTRUCTOR]: authNonAdminRole,
        [Role.DOCK_STAFF]: authNonAdminRole,
        [Role.DOCK_MASTER]: authNonAdminRole,
        [Role.ADMIN]: authAdminRole,
      },
      bannedUserMessage: enMessages.AuthErrors.BANNED_USER_MESSAGE,
    }),
    haveIBeenPwned({
      enabled: passwordCompromiseCheckEnabled,
      customPasswordCompromisedMessage:
        enMessages.AuthErrors.PASSWORD_COMPROMISED,
      paths: ['/sign-up/email', '/change-password'],
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
            let pendingEmailChanged = false;
            try {
              pendingEmailChanged = await markPendingEmailChange({
                userId: sessionUser.id,
                newEmail: email,
              });
            } catch (error) {
              logger.error('Failed to mark pending email change: {error}', {
                currentEmail: sessionUser.email,
                error,
                newEmail: email,
                operation: 'markPendingEmailChange',
                userId: sessionUser.id,
              });
            }
            if (
              pendingEmailChanged &&
              sessionUser.email &&
              sessionUser.email !== email
            ) {
              try {
                await sendEmailChangeRequestedNotice({
                  currentEmail: sessionUser.email,
                  newEmail: email,
                });
              } catch (error) {
                logger.error(
                  'Failed to send email change requested notice: {error}',
                  {
                    currentEmail: sessionUser.email,
                    error,
                    newEmail: email,
                    operation: 'sendEmailChangeRequestedNotice',
                    userId: sessionUser.id,
                  }
                );
              }
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
