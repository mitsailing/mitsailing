import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';
import {
  isLegacyMysqlSyncCronPattern,
  LEGACY_MYSQL_SYNC_DEFAULT_CRON,
} from './legacy-sync/legacyMysqlSyncConstants';

const isStorybookNpmScript =
  process.env.npm_lifecycle_event === 'storybook' ||
  process.env.npm_lifecycle_event === 'build-storybook';

type FinalEnv = {
  APP_ENV: 'local' | 'production' | 'staging' | 'test';
  DATABASE_URL: string;
  HEALTHCHECK_SECRET?: string;
  IS_E2E?: '1';
  LEGACY_MYSQL_PASSWORD?: string;
  LEGACY_MYSQL_HOST?: string;
  LEGACY_MYSQL_PORT?: number;
  LEGACY_MYSQL_SYNC_ENABLED: 'false' | 'true';
  MEDIA_PUBLIC_BASE_URL?: string;
  MEDIA_STORAGE_ROOT: string;
  MEDIA_UPLOAD_BASE_URL?: string;
  MEDIA_UPLOAD_SHARED_SECRET?: string;
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  REDIS_URL?: string;
  STAGING_BANNER: 'no' | 'yes';
  STRIPE_SECRET_KEY?: string;
  STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TEST_DATABASE_URL?: string;
  HOST_TRAFFIC_STATE_FILE?: string;
};

function isStagingOrProduction(env: FinalEnv): boolean {
  return env.APP_ENV === 'staging' || env.APP_ENV === 'production';
}

function addEnvIssue(
  ctx: z.RefinementCtx,
  path: keyof FinalEnv,
  message: string
): void {
  ctx.addIssue({
    code: 'custom',
    message,
    path: [path],
  });
}

function validateTestDatabaseEnv(env: FinalEnv, ctx: z.RefinementCtx): void {
  if (
    env.IS_E2E !== '1' &&
    env.TEST_DATABASE_URL !== undefined &&
    env.TEST_DATABASE_URL === env.DATABASE_URL
  ) {
    addEnvIssue(
      ctx,
      'TEST_DATABASE_URL',
      'TEST_DATABASE_URL must not equal DATABASE_URL.'
    );
  }
}

function validateLegacyMysqlSyncEnv(env: FinalEnv, ctx: z.RefinementCtx): void {
  if (env.LEGACY_MYSQL_SYNC_ENABLED !== 'true') {
    return;
  }
  if (!env.LEGACY_MYSQL_PASSWORD) {
    addEnvIssue(
      ctx,
      'LEGACY_MYSQL_PASSWORD',
      'LEGACY_MYSQL_PASSWORD is required when LEGACY_MYSQL_SYNC_ENABLED=true.'
    );
  }
  if (env.APP_ENV !== 'production') {
    addEnvIssue(
      ctx,
      'LEGACY_MYSQL_SYNC_ENABLED',
      'Legacy MySQL sync can only be enabled in production.'
    );
  }
}

function validateDeploymentEnv(env: FinalEnv, ctx: z.RefinementCtx): void {
  if (!isStagingOrProduction(env)) {
    return;
  }
  if (!env.MEDIA_STORAGE_ROOT.startsWith('/')) {
    addEnvIssue(
      ctx,
      'MEDIA_STORAGE_ROOT',
      'MEDIA_STORAGE_ROOT must be an absolute path in staging and production.'
    );
  }
  if (!env.HEALTHCHECK_SECRET) {
    addEnvIssue(
      ctx,
      'HEALTHCHECK_SECRET',
      'HEALTHCHECK_SECRET is required in staging and production.'
    );
  }
  if (!env.REDIS_URL) {
    addEnvIssue(
      ctx,
      'REDIS_URL',
      'REDIS_URL is required in staging and production.'
    );
  }
  if (!env.MEDIA_UPLOAD_BASE_URL) {
    addEnvIssue(
      ctx,
      'MEDIA_UPLOAD_BASE_URL',
      'MEDIA_UPLOAD_BASE_URL is required in staging and production.'
    );
  }
  if (!env.MEDIA_PUBLIC_BASE_URL) {
    addEnvIssue(
      ctx,
      'MEDIA_PUBLIC_BASE_URL',
      'MEDIA_PUBLIC_BASE_URL is required in staging and production.'
    );
  }
  if (!env.MEDIA_UPLOAD_SHARED_SECRET) {
    addEnvIssue(
      ctx,
      'MEDIA_UPLOAD_SHARED_SECRET',
      'MEDIA_UPLOAD_SHARED_SECRET is required in staging and production.'
    );
  }
  if (!env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
    addEnvIssue(
      ctx,
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required in staging and production.'
    );
  }
  if (!env.STRIPE_SECRET_KEY) {
    addEnvIssue(
      ctx,
      'STRIPE_SECRET_KEY',
      'STRIPE_SECRET_KEY is required in staging and production.'
    );
  }
  if (!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    addEnvIssue(
      ctx,
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required in staging and production.'
    );
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    addEnvIssue(
      ctx,
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_WEBHOOK_SECRET is required in staging and production.'
    );
  }
}

function validateFinalEnv(env: FinalEnv, ctx: z.RefinementCtx): void {
  validateTestDatabaseEnv(env, ctx);
  validateLegacyMysqlSyncEnv(env, ctx);
  validateDeploymentEnv(env, ctx);
}

export const Env = createEnv({
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === 'true' || isStorybookNpmScript,
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),
    NEWSLETTER_REVALIDATE_SECRET: z.string().min(32).optional(),
    HEALTHCHECK_SECRET: z.string().min(32).optional(),

    // BullMQ worker + optional API enqueue; Redis is internal to Compose in prod.
    REDIS_URL: z.url().optional(),
    LEGACY_MYSQL_SYNC_ENABLED: z.enum(['true', 'false']).default('false'),
    LEGACY_MYSQL_SYNC_CRON: z
      .string()
      .min(1)
      .default(LEGACY_MYSQL_SYNC_DEFAULT_CRON)
      .refine(isLegacyMysqlSyncCronPattern, {
        message:
          'LEGACY_MYSQL_SYNC_CRON must be a six-field BullMQ cron (seconds first), e.g. 0 0 * * * *.',
      }),
    LEGACY_MYSQL_PASSWORD: z.string().min(1).optional(),
    LEGACY_MYSQL_HOST: z.string().min(1).optional(),
    LEGACY_MYSQL_PORT: z.coerce.number().int().positive().optional(),

    // APP_ENV is orthogonal to NODE_ENV: it names the deployment target
    // (staging runs a production build but behaves like staging — Mailpit
    // instead of Resend, optional debug banners, etc.). `local` is the
    // default used when no deployment context applies (a dev laptop).
    APP_ENV: z
      .enum(['local', 'test', 'staging', 'production'])
      .default('local'),

    STAGING_BANNER: z.enum(['yes', 'no']).default('no'),

    // Mail transport selector. Enum (not a boolean toggle) so adding drivers
    // later — SES, Postmark, SMTP relay — is a single case rather than a
    // cascade of if/else. Defaults to `log` so unconfigured environments
    // never try to send real mail.
    //   smtp   → nodemailer over SMTP_URL (Mailpit locally, SMTP relay in prod)
    //   resend → Resend HTTP API via RESEND_API_KEY
    //   log    → log subject + recipient and drop (tests, seeds)
    MAIL_TRANSPORT: z.enum(['smtp', 'resend', 'log']).default('log'),

    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),

    // SMTP endpoint used when MAIL_TRANSPORT=smtp. Example: Mailpit in
    // docker-compose is `smtp://mailpit:1025`; a staging SMTP relay might be
    // `smtps://user:pass@smtp.provider.tld:465`.
    SMTP_URL: z.url().optional(),

    // REST endpoint of the Mailpit instance used by Playwright e2e tests to
    // assert on outbound mail content (subject, links, etc.).
    MAILPIT_API_URL: z.url().optional(),

    // Dedicated test database for destructive Playwright cleanup helpers.
    TEST_DATABASE_URL: z.string().min(1).optional(),

    // Legacy local filesystem root for direct CMS image uploads. Local dev can
    // use the git-ignored `local/` tree. Production media uploads use the
    // Docker stack media settings below.
    CMS_MEDIA_ROOT: z.string().min(1).default('local/cms-media'),

    HOST_COLOR: z.enum(['blue', 'green']).optional(),
    HOST_TRAFFIC_ENABLED: z.enum(['true', 'false']).default('true'),
    HOST_TRAFFIC_STATE_FILE: z.string().min(1).optional(),
    MEDIA_PUBLIC_BASE_URL: z.url().optional(),
    MEDIA_STORAGE_ROOT: z.string().min(1).default('local/cms-media'),
    MEDIA_UPLOAD_BASE_URL: z.url().optional(),
    MEDIA_UPLOAD_SHARED_SECRET: z.string().min(32).optional(),

    // Optional cleanup logging for e2e teardown helpers.
    DEBUG_CLEANUP: z.enum(['1', 'true']).optional(),

    /**
     * Playwright / standalone e2e server only. Prefer this over `NEXT_PUBLIC_*`
     * so the same `.next` artifact is not build-tainted for deploys or other CI
     * consumers that restore the build cache.
     */
    IS_E2E: z.literal('1').optional(),

    // Support mailbox surfaced in transactional copy and on the sign-in page.
    // Overridable so different deployments can point at different teams.
    SUPPORT_EMAIL: z.email().default('support@mitsailing.com'),

    // Marketing footer and Resend webhook settings for newsletter broadcasts.
    NEWSLETTER_WORKER_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .default(2),
    RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^(rk|sk)_(test|live)_/, {
        message: 'STRIPE_SECRET_KEY must be a Stripe restricted or secret key.',
      })
      .optional(),
    STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID: z
      .string()
      .startsWith('bpc_')
      .optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

    // Cloudflare Tunnel credential consumed by the production Compose
    // cloudflared service. Required in staging+prod, unset locally.
    CLOUDFLARE_TUNNEL_TOKEN: z.string().min(1).optional(),
    DEPLOYMENT_VERSION: z.string().min(1).optional(),
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(32).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1),
    NEXT_PUBLIC_LOGGING_LEVEL: z
      .enum(['error', 'info', 'debug', 'warning', 'trace', 'fatal'])
      .default('info'),
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^pk_(test|live)_/, {
        message:
          'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a Stripe publishable key.',
      })
      .optional(),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((env, ctx) => {
      validateFinalEnv(env, ctx);
    }),
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NEWSLETTER_REVALIDATE_SECRET: process.env.NEWSLETTER_REVALIDATE_SECRET,
    HEALTHCHECK_SECRET: process.env.HEALTHCHECK_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    LEGACY_MYSQL_SYNC_ENABLED: process.env.LEGACY_MYSQL_SYNC_ENABLED,
    LEGACY_MYSQL_SYNC_CRON: process.env.LEGACY_MYSQL_SYNC_CRON,
    LEGACY_MYSQL_PASSWORD: process.env.LEGACY_MYSQL_PASSWORD,
    LEGACY_MYSQL_HOST: process.env.LEGACY_MYSQL_HOST,
    LEGACY_MYSQL_PORT: process.env.LEGACY_MYSQL_PORT,
    APP_ENV: process.env.APP_ENV,
    STAGING_BANNER: process.env.STAGING_BANNER,
    MAIL_TRANSPORT: process.env.MAIL_TRANSPORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SMTP_URL: process.env.SMTP_URL,
    MAILPIT_API_URL: process.env.MAILPIT_API_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    CMS_MEDIA_ROOT: process.env.CMS_MEDIA_ROOT,
    HOST_COLOR: process.env.HOST_COLOR,
    HOST_TRAFFIC_ENABLED: process.env.HOST_TRAFFIC_ENABLED,
    HOST_TRAFFIC_STATE_FILE: process.env.HOST_TRAFFIC_STATE_FILE,
    MEDIA_PUBLIC_BASE_URL: process.env.MEDIA_PUBLIC_BASE_URL,
    MEDIA_STORAGE_ROOT: process.env.MEDIA_STORAGE_ROOT,
    MEDIA_UPLOAD_BASE_URL: process.env.MEDIA_UPLOAD_BASE_URL,
    MEDIA_UPLOAD_SHARED_SECRET: process.env.MEDIA_UPLOAD_SHARED_SECRET,
    DEBUG_CLEANUP: process.env.DEBUG_CLEANUP,
    IS_E2E: process.env.IS_E2E,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    NEWSLETTER_WORKER_CONCURRENCY: process.env.NEWSLETTER_WORKER_CONCURRENCY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID:
      process.env.STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    CLOUDFLARE_TUNNEL_TOKEN: process.env.CLOUDFLARE_TUNNEL_TOKEN,
    DEPLOYMENT_VERSION: process.env.DEPLOYMENT_VERSION,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_LOGGING_LEVEL: process.env.NEXT_PUBLIC_LOGGING_LEVEL,
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  // Treat "" like "unset" so `.optional()` vars in shared .env files can be
  // blank without failing validation. Without this flag, an empty
  // `RESEND_API_KEY=` line would be parsed as "" and violate `.min(1)`.
  emptyStringAsUndefined: true,
});
