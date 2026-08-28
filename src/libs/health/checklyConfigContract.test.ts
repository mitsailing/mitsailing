import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly health ready config', () => {
  const checklyConfig = readRepoFile('checkly.config.ts');
  const checklyHealthApi = readRepoFile('checkly/health-api.check.ts');

  it('does not configure browser e2e checks', () => {
    expect(checklyConfig).not.toContain('browserChecks');
    expect(checklyConfig).not.toContain('testMatch');
    expect(checklyConfig).not.toContain('playwrightConfig');
    expect(checklyConfig).not.toContain('.check.e2e.ts');
  });

  it('asserts media readiness dependencies', () => {
    expect(checklyHealthApi).toContain(
      "AssertionBuilder.jsonBody('$.checks.mediaUpload.status').equals('ok')"
    );
    expect(checklyHealthApi).toContain(
      "AssertionBuilder.jsonBody('$.checks.mediaPublic.status').equals('ok')"
    );
  });

  it('uses account-supported Checkly locations', () => {
    expect(checklyHealthApi).toContain("locations: ['us-east-1', 'eu-west-2']");
    expect(checklyHealthApi).not.toContain('eu-west-1');
  });
});
