import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly deployment workflow', () => {
  const checklyWorkflow = readRepoFile('.github/workflows/checkly.yml');
  const githubExpressionStart = `${String.fromCodePoint(36)}{{`;

  it('publishes health monitoring without an e2e check name', () => {
    expect(checklyWorkflow).toContain('Deploy Checkly health checks');
    expect(checklyWorkflow).not.toContain('Test E2E on Checkly');
    expect(checklyWorkflow).not.toContain('test-e2e');
  });

  it('runs checks against the deployment URL', () => {
    expect(checklyWorkflow).toContain(
      `ENVIRONMENT_URL: ${githubExpressionStart} github.event.deployment_status.environment_url || 'https://mitsailing.com' }}`
    );
  });

  it('does not fail when protected readiness secret is absent', () => {
    expect(checklyWorkflow).toContain(
      'Checkly will run public checks and skip protected readiness checks.'
    );
    expect(checklyWorkflow).not.toContain(
      'HEALTHCHECK_SECRET is required for production readiness monitoring.'
    );
  });
});
