import { describe, expect, it } from 'vitest';
import {
  normalizeImportedPersonName,
  normalizeManualPersonName,
  normalizeVerifiedMitDataWarehousePersonName,
} from '@/libs/mit-sailing/personName';

describe('personName', () => {
  it('name-cases verified warehouse names and only normalizes manual names', () => {
    expect(
      normalizeVerifiedMitDataWarehousePersonName({
        firstName: '  ADA   MARIE ',
        lastName: " o'NEIL-smith ",
      })
    ).toEqual({
      firstName: 'Ada Marie',
      lastName: "O'Neil-Smith",
      name: "Ada Marie O'Neil-Smith",
    });

    expect(
      normalizeManualPersonName({
        firstName: '  ADA   MARIE ',
        lastName: " o'NEIL-smith ",
      })
    ).toEqual({
      firstName: 'ADA MARIE',
      lastName: "o'NEIL-smith",
      name: "ADA MARIE o'NEIL-smith",
    });

    expect(
      normalizeImportedPersonName({
        firstName: '  YOONSEO ',
        lastName: " o'NEIL-CHA ",
      })
    ).toEqual({
      firstName: 'Yoonseo',
      lastName: "O'Neil-Cha",
      name: "Yoonseo O'Neil-Cha",
    });
  });
});
