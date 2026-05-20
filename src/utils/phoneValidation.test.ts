import { describe, expect, it } from 'vitest';
import {
  formatPhoneForDisplay,
  normalizeInternationalPhone,
  normalizeUsPhone,
} from '@/utils/phoneValidation';

describe('phoneValidation', () => {
  it('normalizes US phone numbers to E.164', () => {
    expect(normalizeUsPhone('(617) 555-0100')).toEqual({
      ok: true,
      phone: '+16175550100',
    });
  });

  it('rejects non-US phone numbers for primary phone', () => {
    expect(normalizeUsPhone('+44 20 7946 0958')).toEqual({ ok: false });
  });

  it('normalizes international emergency phone numbers', () => {
    expect(normalizeInternationalPhone('+44 20 7946 0958')).toEqual({
      ok: true,
      phone: '+442079460958',
    });
  });

  it('rejects phone extensions to avoid lossy storage', () => {
    expect(normalizeUsPhone('(617) 555-0100 ext. 9')).toEqual({ ok: false });
  });

  it('formats E.164 phone numbers for display', () => {
    expect(formatPhoneForDisplay('+16175550100')).toBe('(617) 555-0100');
  });

  it('keeps country code when formatting international phones', () => {
    expect(formatPhoneForDisplay('+442079460958')).toBe('+44 20 7946 0958');
  });
});
