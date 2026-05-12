import { describe, it, expect, beforeEach } from 'vitest';
import {
  classCategoryIdFromSeedKey,
  overrideClassCategorySeedId,
  resetClassCategorySeedKeyMap,
} from './classCategoriesSeed';

describe('classCategoriesSeed', () => {
  beforeEach(() => {
    resetClassCategorySeedKeyMap();
  });

  it('resolves introduction seed key to canonical category id', () => {
    expect(classCategoryIdFromSeedKey('introduction')).toBe('cc-introduction');
  });

  it('returns overridden id after slug collision remap', () => {
    overrideClassCategorySeedId('introduction', 'legacy-row-id');
    expect(classCategoryIdFromSeedKey('introduction')).toBe('legacy-row-id');
  });

  it('restores canonical ids after reset', () => {
    overrideClassCategorySeedId('introduction', 'legacy-row-id');
    resetClassCategorySeedKeyMap();
    expect(classCategoryIdFromSeedKey('introduction')).toBe('cc-introduction');
  });
});
