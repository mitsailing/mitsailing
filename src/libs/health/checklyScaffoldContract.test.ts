import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readRepoFile } from '@/libs/test/readRepoFile';

describe('checkly dormant scaffold', () => {
  const checklyConfig = readRepoFile('checkly.config.ts');

  it('defines optional playwright browser check discovery', () => {
    expect(checklyConfig).toContain('browserChecks');
    expect(checklyConfig).toContain('playwrightConfig');
    expect(checklyConfig).toContain('**/tests/e2e/**/*.check.e2e.ts');
    expect(checklyConfig).not.toContain('checkly/**/*.check.ts');
  });

  it('does not ship an active github actions checkly workflow', () => {
    expect(existsSync('.github/workflows/checkly.yml')).toBe(false);
  });

  it('does not ship api health monitor constructs', () => {
    expect(existsSync('checkly/health-api.check.ts')).toBe(false);
  });
});
