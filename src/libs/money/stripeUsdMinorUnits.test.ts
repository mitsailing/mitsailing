import { describe, expect, it } from 'vitest';
import {
  formatUsdMinorUnitsAsCurrency,
  parseUsdDecimalStringToMinorUnits,
  usdMinorUnitsToDecimalInputString,
} from '@/libs/money/stripeUsdMinorUnits';

describe('stripeUsdMinorUnits', () => {
  it('parses decimal dollar strings to integer minor units', () => {
    expect(parseUsdDecimalStringToMinorUnits('0')).toBe(0);
    expect(parseUsdDecimalStringToMinorUnits('0.00')).toBe(0);
    expect(parseUsdDecimalStringToMinorUnits('19.99')).toBe(1999);
    expect(parseUsdDecimalStringToMinorUnits('19.9')).toBe(1990);
    expect(parseUsdDecimalStringToMinorUnits('150.50')).toBe(15_050);
    expect(parseUsdDecimalStringToMinorUnits('1,234.5')).toBe(123_450);
    expect(parseUsdDecimalStringToMinorUnits('1,234.56')).toBe(123_456);
  });

  it('rejects invalid dollar inputs', () => {
    expect(parseUsdDecimalStringToMinorUnits('')).toBeNull();
    expect(parseUsdDecimalStringToMinorUnits('x')).toBeNull();
    expect(parseUsdDecimalStringToMinorUnits('-1')).toBeNull();
    expect(parseUsdDecimalStringToMinorUnits('19.999')).toBeNull();
    expect(parseUsdDecimalStringToMinorUnits('1,000,000')).toBeNull();
  });

  it('formats minor units for admin decimal inputs', () => {
    expect(usdMinorUnitsToDecimalInputString(0)).toBe('0.00');
    expect(usdMinorUnitsToDecimalInputString(1)).toBe('0.01');
    expect(usdMinorUnitsToDecimalInputString(15_000)).toBe('150.00');
    expect(usdMinorUnitsToDecimalInputString(10_000)).toBe('100.00');
  });

  it('formats minor units as currency for a locale', () => {
    expect(formatUsdMinorUnitsAsCurrency(1999, 'en-US')).toMatch(/\$19\.99/);
    expect(formatUsdMinorUnitsAsCurrency(1999, 'de-DE')).toMatch(/19,99/);
    expect(formatUsdMinorUnitsAsCurrency(1999, 'de-DE')).toMatch(/\$/);
    expect(formatUsdMinorUnitsAsCurrency(1999, 'en-GB')).toMatch(/US\$19\.99/);
    expect(formatUsdMinorUnitsAsCurrency(0, 'en-US')).toMatch(/\$0\.00/);
    expect(formatUsdMinorUnitsAsCurrency(1_000_000, 'en-US')).toMatch(
      /\$10,000\.00/
    );
  });
});
