import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly deployment workflow', () => {
  const checklyWorkflow = readRepoFile('.github/workflows/checkly.yml');

  it('runs only on manual dispatch', () => {
    expect(checklyWorkflow).toContain('workflow_dispatch');
    expect(checklyWorkflow).not.toContain('deployment_status');
  });

  it('publishes health monitoring without an e2e check name', () => {
    expect(checklyWorkflow).toContain('Deploy Checkly health checks');
    expect(checklyWorkflow).not.toContain('Test E2E on Checkly');
    expect(checklyWorkflow).not.toContain('test-e2e');
  });

  it('runs checks against production URL', () => {
    expect(checklyWorkflow).toContain(
      'ENVIRONMENT_URL: https://mitsailing.com'
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
