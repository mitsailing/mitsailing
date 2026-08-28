import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';

// Optional external production monitoring via Checkly Playwright browser checks.
// PR merge gating stays on tests/e2e/*.e2e.ts; add tests/e2e/*.check.e2e.ts
// when ready and run `npx checkly test` locally or from a future workflow.
const config = defineConfig({
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
    },
    playwrightConfig: {
      use: {
        baseURL: process.env.ENVIRONMENT_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      },
    },
  },
  cli: {
    runLocation: 'us-east-1',
    reporters: ['list'],
  },
});

export default config;
