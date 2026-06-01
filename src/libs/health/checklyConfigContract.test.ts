import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly health ready config', () => {
  const checklyConfig = readRepoFile('checkly.config.ts');

  it('does not configure browser e2e checks', () => {
    expect(checklyConfig).not.toContain('browserChecks');
    expect(checklyConfig).not.toContain('testMatch');
    expect(checklyConfig).not.toContain('.check.e2e.ts');
  });

  it('asserts media readiness dependencies', () => {
    expect(checklyConfig).toContain(
      "AssertionBuilder.jsonBody('$.checks.mediaUpload.status').equals('ok')"
    );
    expect(checklyConfig).toContain(
      "AssertionBuilder.jsonBody('$.checks.mediaPublic.status').equals('ok')"
    );
  });
});
