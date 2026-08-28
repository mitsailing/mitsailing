import { describe, expect, it } from 'vitest';
import { ariaInvalidWhenShown } from '@/utils/ariaInvalidWhenShown';

describe('ariaInvalidWhenShown', () => {
  it('returns true when errors are shown and the field is invalid', () => {
    expect(ariaInvalidWhenShown({ shown: true, invalid: true })).toBe(true);
  });

  it('returns undefined when errors are not shown', () => {
    expect(
      ariaInvalidWhenShown({ shown: false, invalid: true })
    ).toBeUndefined();
  });

  it('returns undefined when the field is valid', () => {
    expect(
      ariaInvalidWhenShown({ shown: true, invalid: false })
    ).toBeUndefined();
  });

  it('returns undefined when errors are hidden and the field is valid', () => {
    expect(
      ariaInvalidWhenShown({ shown: false, invalid: false })
    ).toBeUndefined();
  });
});
