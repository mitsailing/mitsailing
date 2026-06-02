import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';
import { emailChannel } from './checkly/alertChannels';

const config = defineConfig({
  projectName: 'MIT Sailing',
  logicalId: 'mitsailing',
  repoUrl: 'https://github.com/mitsailing/mitsailing',
  checks: {
    checkMatch: 'checkly/**/*.check.ts',
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
