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
});
