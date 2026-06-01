import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message) =>
      message.startsWith('chore: bump') || message.startsWith('Updating'),
    (message) =>
      message.startsWith('fix: address CodeRabbit PR findings') ||
      message.startsWith('fix: harden AI discovery and staging signals'),
  ], // Ignore dependabot commits
};

export default Configuration;
