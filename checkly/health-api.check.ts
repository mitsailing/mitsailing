import { ApiCheck, AssertionBuilder, Frequency } from 'checkly/constructs';
import { emailChannel } from './alertChannels';
import { checklyEnvironmentUrl, checklyHealthcheckSecret } from './env';

// Checkly loads this file outside the app runtime; importing Env would require
// the full production app environment during monitor registration.
const environmentUrl = checklyEnvironmentUrl(process.env);
const healthcheckSecret = checklyHealthcheckSecret(process.env);

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

export const healthReadyApi = healthcheckSecret
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
          value: healthcheckSecret,
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
