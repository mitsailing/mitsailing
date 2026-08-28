import { defineConfig } from 'checkly';

const config = defineConfig({
  projectName: 'MIT Sailing',
  logicalId: 'mitsailing',
  repoUrl: 'https://github.com/mitsailing/mitsailing',
  checks: {
    checkMatch: 'checkly/**/*.check.ts',
    locations: ['us-east-1'],
    tags: ['website'],
    runtimeId: '2024.02',
  },
  cli: {
    runLocation: 'us-east-1',
    reporters: ['list'],
  },
});

export default config;
