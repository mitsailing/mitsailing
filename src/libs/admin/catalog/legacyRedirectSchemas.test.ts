import { describe, expect, it, vi } from 'vitest';
import {
  legacyRedirectFormSchema,
  rawLegacyRedirectFromFormData,
} from '@/libs/admin/catalog/legacyRedirectSchemas';

vi.mock('server-only', () => ({}));

describe('legacyRedirectFormSchema', () => {
  it('normalizes legacy source and target paths', () => {
    const parsed = legacyRedirectFormSchema.parse({
      source: 'manual',
      sourcePath: 'calendar.php?view=month',
      targetPath: '/calendar/',
    });

    expect(parsed).toEqual({
      source: 'manual',
      sourcePath: '/calendar.php',
      targetPath: '/calendar',
    });
  });

  it('rejects unsupported source and target paths', () => {
    expect(
      legacyRedirectFormSchema.safeParse({
        source: 'manual',
        sourcePath: '/calendar.asp',
        targetPath: '/calendar',
      }).success
    ).toBe(false);
    expect(
      legacyRedirectFormSchema.safeParse({
        source: 'manual',
        sourcePath: '/calendar.php',
        targetPath: '/api/private',
      }).success
    ).toBe(false);
  });
});

describe('rawLegacyRedirectFromFormData', () => {
  it('defaults missing source values to manual', () => {
    const formData = new FormData();
    formData.set('sourcePath', 'calendar.php');
    formData.set('targetPath', '/calendar');

    expect(rawLegacyRedirectFromFormData(formData)).toEqual({
      source: 'manual',
      sourcePath: 'calendar.php',
      targetPath: '/calendar',
    });
  });
});
