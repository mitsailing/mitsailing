import { describe, expect, it } from 'vitest';
import { catalogFieldErrorsFromSearchParam } from '@/libs/admin/catalog/catalogFieldErrors';

describe('catalogFieldErrorsFromSearchParam', () => {
  it('returns undefined for empty arrays', () => {
    expect(catalogFieldErrorsFromSearchParam([])).toBeUndefined();
  });

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

  it('parses json field error payloads', () => {
    expect(
      catalogFieldErrorsFromSearchParam([
        JSON.stringify({ f: 'name', m: 'Too short' }),
        JSON.stringify({ f: '__proto__', m: 'x' }),
      ])
    ).toEqual({
      name: 'Too short',
    });
  });

  it('prefers json payload message over legacy fallback', () => {
    expect(
      catalogFieldErrorsFromSearchParam(
        [JSON.stringify({ f: 'title', m: 'Required' })],
        { legacyFieldMessage: 'ignored' }
      )
    ).toEqual({
      title: 'Required',
    });
  });

  it('maps legacy bare field names when legacy message is provided', () => {
    expect(
      catalogFieldErrorsFromSearchParam(['name', '__proto__'], {
        legacyFieldMessage: 'Check this field.',
      })
    ).toEqual({
      name: 'Check this field.',
    });
  });

  it('keeps multiple legacy safe field names', () => {
    expect(
      catalogFieldErrorsFromSearchParam(['name', 'title'], {
        legacyFieldMessage: 'Invalid.',
      })
    ).toEqual({
      name: 'Invalid.',
      title: 'Invalid.',
    });
  });

  it('ignores legacy-shaped keys without fallback', () => {
    expect(catalogFieldErrorsFromSearchParam(['name'])).toBeUndefined();
  });
});
