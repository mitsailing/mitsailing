import { describe, expect, it } from 'vitest';
import { catalogFieldErrorsFromSearchParam } from '@/libs/admin/catalog/catalogFieldErrors';

describe('catalogFieldErrorsFromSearchParam', () => {
  it('returns undefined for only filtered field names', () => {
    expect(
      catalogFieldErrorsFromSearchParam([
        '',
        '__proto__',
        'constructor',
        'prototype',
      ])
    ).toBeUndefined();
  });

  it('keeps safe field names', () => {
    expect(catalogFieldErrorsFromSearchParam(['name', '__proto__'])).toEqual({
      name: 'true',
    });
  });
});
