import { describe, expect, it } from 'vitest';
import {
  e2eArgonOptions,
  productionArgonOptions,
  selectPasswordHashingOptions,
} from './passwordHashing';

describe('selectPasswordHashingOptions', () => {
  it('uses cheaper hashing settings during e2e runs', () => {
    expect(selectPasswordHashingOptions({ isE2E: true })).toEqual(
      e2eArgonOptions
    );
    expect(e2eArgonOptions.memoryCost).toBeLessThan(
      productionArgonOptions.memoryCost
    );
    expect(e2eArgonOptions.timeCost).toBeLessThan(
      productionArgonOptions.timeCost
    );
  });

  it('keeps production hashing settings outside e2e runs', () => {
    expect(selectPasswordHashingOptions({ isE2E: false })).toEqual(
      productionArgonOptions
    );
  });
});
