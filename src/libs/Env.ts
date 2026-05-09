import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

const isStorybookNpmScript =
  process.env.npm_lifecycle_event === 'storybook' ||
  process.env.npm_lifecycle_event === 'build-storybook';

export const Env = createEnv({
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === 'true' || isStorybookNpmScript,
  server: {
    ARCJET_KEY: z.string().startsWith('ajkey_').optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),

    // BullMQ worker + optional API enqueue; Redis is internal to Compose in prod.
    REDIS_URL: z.url().optional(),

    // APP_ENV is orthogonal to NODE_ENV: it names the deployment target
    // (staging runs a production build but behaves like staging — Mailpit
    // instead of Resend, optional debug banners, etc.). `local` is the
    // default used when no deployment context applies (a dev laptop).
    APP_ENV: z
      .enum(['local', 'test', 'staging', 'production'])
      .default('local'),

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

    // Optional cleanup logging for e2e teardown helpers.
    DEBUG_CLEANUP: z.enum(['1', 'true']).optional(),

    // Support mailbox surfaced in transactional copy and on the sign-in page.
    // Overridable so different deployments can point at different teams.
    SUPPORT_EMAIL: z.email().default('support@mitsailing.com'),

    // Cloudflare Tunnel credential consumed by the cloudflared service in
    // compose.staging.yaml / compose.prod.yaml. Required in staging+prod,
    // unset locally.
    CLOUDFLARE_TUNNEL_TOKEN: z.string().min(1).optional(),
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
    NEXT_PUBLIC_IS_E2E: z.literal('1').optional(),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((env, ctx) => {
      if (
        env.NEXT_PUBLIC_IS_E2E !== '1' &&
        env.TEST_DATABASE_URL !== undefined &&
        env.TEST_DATABASE_URL === env.DATABASE_URL
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'TEST_DATABASE_URL must not equal DATABASE_URL.',
          path: ['TEST_DATABASE_URL'],
        });
      }
    }),
  runtimeEnv: {
    ARCJET_KEY: process.env.ARCJET_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    APP_ENV: process.env.APP_ENV,
    MAIL_TRANSPORT: process.env.MAIL_TRANSPORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SMTP_URL: process.env.SMTP_URL,
    MAILPIT_API_URL: process.env.MAILPIT_API_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DEBUG_CLEANUP: process.env.DEBUG_CLEANUP,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    CLOUDFLARE_TUNNEL_TOKEN: process.env.CLOUDFLARE_TUNNEL_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_LOGGING_LEVEL: process.env.NEXT_PUBLIC_LOGGING_LEVEL,
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_IS_E2E: process.env.NEXT_PUBLIC_IS_E2E,
    NODE_ENV: process.env.NODE_ENV,
  },
  // Treat "" like "unset" so `.optional()` vars in shared .env files can be
  // blank without failing validation. Without this flag, an empty
  // `RESEND_API_KEY=` line would be parsed as "" and violate `.min(1)`.
  emptyStringAsUndefined: true,
});
