import { ApiCheck, AssertionBuilder, Frequency } from 'checkly/constructs';
import { emailChannel } from './alertChannels';

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

export const healthReadyApi = process.env.HEALTHCHECK_SECRET
  ? new ApiCheck('health-ready-api', {
      name: 'Health ready API',
      frequency: Frequency.EVERY_5M,
      locations: ['us-east-1', 'eu-west-1'],
      tags: ['website', 'health', 'api'],
      alertChannels: [emailChannel],
      maxResponseTime: 5000,
      degradedResponseTime: 2000,
      environmentVariables: [
        {
          key: 'HEALTHCHECK_SECRET',
          value: process.env.HEALTHCHECK_SECRET,
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
    })
  : null;
