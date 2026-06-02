import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly health ready config', () => {
  const checklyHealthApi = readRepoFile('checkly/health-api.check.ts');

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
