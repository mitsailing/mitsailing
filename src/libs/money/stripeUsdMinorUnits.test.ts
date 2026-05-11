import { describe, expect, it } from 'vitest';
import {
  formatUsdMinorUnitsAsCurrency,
  parseUsdDecimalStringToMinorUnits,
  usdMinorUnitsToDecimalInputString,
} from '@/libs/money/stripeUsdMinorUnits';

describe('stripeUsdMinorUnits', () => {
  it('parses decimal dollar strings to integer minor units', () => {
    expect(parseUsdDecimalStringToMinorUnits('19.99')).toBe(1999);
    expect(parseUsdDecimalStringToMinorUnits('150.50')).toBe(15_050);
    expect(parseUsdDecimalStringToMinorUnits('1,234.5')).toBe(123_450);
  });

  it('rejects invalid dollar inputs', () => {
    expect(parseUsdDecimalStringToMinorUnits('')).toBeNull();
    expect(parseUsdDecimalStringToMinorUnits('x')).toBeNull();
    expect(parseUsdDecimalStringToMinorUnits('-1')).toBeNull();
  });

  it('formats minor units for admin decimal inputs', () => {
    expect(usdMinorUnitsToDecimalInputString(15_000)).toBe('150.00');
  });

  it('formats minor units as currency for a locale', () => {
    expect(formatUsdMinorUnitsAsCurrency(1999, 'en-US')).toMatch(/\$19\.99/);
  });
});
