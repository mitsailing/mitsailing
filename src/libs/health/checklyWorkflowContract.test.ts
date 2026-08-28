import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

function readChecklyWorkflowTriggerSection() {
  const checklyWorkflow = readRepoFile('.github/workflows/checkly.yml');
  const triggerMatch = checklyWorkflow.match(
    /^on:\s*\n(?:[ \t].*\n)*?(?=^[a-zA-Z]|$)/m
  );

  return triggerMatch?.[0] ?? checklyWorkflow;
}

describe('checkly deployment workflow', () => {
  const checklyWorkflow = readRepoFile('.github/workflows/checkly.yml');
  const triggerSection = readChecklyWorkflowTriggerSection();

  it('runs only on manual dispatch', () => {
    expect(triggerSection).toContain('workflow_dispatch');
    expect(triggerSection).not.toMatch(
      /\b(deployment_status|pull_request|push|schedule|workflow_call)\b/
    );
  });

  it('restricts production deploys to main', () => {
    expect(checklyWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(checklyWorkflow).toContain('environment: production');
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

  it('does not persist checkout credentials', () => {
    expect(checklyWorkflow).toContain('persist-credentials: false');
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
