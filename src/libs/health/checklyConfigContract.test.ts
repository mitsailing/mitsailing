import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly health ready config', () => {
  const checklyConfig = readRepoFile('checkly.config.ts');

  it('asserts media readiness dependencies', () => {
    expect(checklyConfig).toContain(
      "AssertionBuilder.jsonBody('$.checks.mediaUpload.status').equals('ok')"
    );
    expect(checklyConfig).toContain(
      "AssertionBuilder.jsonBody('$.checks.mediaPublic.status').equals('ok')"
    );
  });
});
