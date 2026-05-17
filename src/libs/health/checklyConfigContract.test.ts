import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

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
