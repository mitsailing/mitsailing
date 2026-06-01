import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', 100],
  },
  ignores: [
    (message) =>
      message.startsWith('chore: bump') || message.startsWith('Updating'),
  ], // Ignore dependabot commits
};

export default Configuration;
