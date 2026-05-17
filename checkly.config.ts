import { defineConfig } from 'checkly';
import {
  ApiCheck,
  AssertionBuilder,
  EmailAlertChannel,
  Frequency,
} from 'checkly/constructs';

const sendDefaults = {
  sendFailure: true,
  sendRecovery: true,
  sendDegraded: true,
};

const emailChannel = new EmailAlertChannel('email-channel-1', {
  address: 'support@mitsailing.com',
  ...sendDefaults,
});

const environmentUrl =
  process.env.ENVIRONMENT_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'http://localhost:3000';

export const healthLiveApi = new ApiCheck('health-live-api', {
  name: 'Health live API',
  frequency: Frequency.EVERY_1M,
  locations: ['us-east-1', 'eu-west-1'],
  tags: ['website', 'health', 'api'],
  alertChannels: [emailChannel],
  maxResponseTime: 5000,
  degradedResponseTime: 2000,
  request: {
    method: 'GET',
    url: `${environmentUrl}/api/health/live`,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.status').equals('ok'),
      AssertionBuilder.headers('cache-control').contains('no-store'),
    ],
  },
});

export const healthReadyApi = new ApiCheck('health-ready-api', {
  name: 'Health ready API',
  activated: Boolean(process.env.HEALTHCHECK_SECRET),
  frequency: Frequency.EVERY_5M,
  locations: ['us-east-1', 'eu-west-1'],
  tags: ['website', 'health', 'api'],
  alertChannels: [emailChannel],
  maxResponseTime: 5000,
  degradedResponseTime: 2000,
  environmentVariables: [
    {
      key: 'HEALTHCHECK_SECRET',
      value: process.env.HEALTHCHECK_SECRET ?? '',
      secret: true,
    },
  ],
  request: {
    method: 'GET',
    url: `${environmentUrl}/api/health/ready`,
    headers: [
      {
        key: 'Authorization',
        value: 'Bearer {{HEALTHCHECK_SECRET}}',
      },
    ],
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.status').equals('ok'),
      AssertionBuilder.jsonBody('$.checks.postgres.status').equals('ok'),
      AssertionBuilder.jsonBody('$.checks.redis.status').equals('ok'),
      AssertionBuilder.jsonBody('$.checks.mediaUpload.status').equals('ok'),
      AssertionBuilder.jsonBody('$.checks.mediaPublic.status').equals('ok'),
      AssertionBuilder.headers('cache-control').contains('no-store'),
    ],
  },
});

export const config = defineConfig({
  projectName: 'MIT Sailing',
  logicalId: 'mitsailing',
  repoUrl: 'https://github.com/mitsailing/mitsailing',
  checks: {
    locations: ['us-east-1'],
    tags: ['website'],
    runtimeId: '2024.02',
    browserChecks: {
      frequency: Frequency.EVERY_24H,
      testMatch: '**/tests/e2e/**/*.check.e2e.ts',
      alertChannels: [emailChannel],
    },
    playwrightConfig: {
      use: {
        baseURL: process.env.ENVIRONMENT_URL ?? process.env.NEXT_PUBLIC_APP_URL,
        extraHTTPHeaders: {
          'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_TOKEN,
        },
      },
    },
  },
  cli: {
    runLocation: 'us-east-1',
    reporters: ['list'],
  },
});

export default config;
