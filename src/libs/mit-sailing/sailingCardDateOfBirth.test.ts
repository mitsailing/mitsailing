import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatSailingCardDateOfBirthInput,
  normalizeSailingCardDateOfBirthInput,
  parseSailingCardDateOfBirth,
} from '@/libs/mit-sailing/sailingCardDateOfBirth';

const now = new Date('2026-05-31T12:00:00.000Z');

describe('sailingCardDateOfBirth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expands short numeric birth years on blur', () => {
    expect(normalizeSailingCardDateOfBirthInput({ now, value: '032488' })).toBe(
      '03/24/1988'
    );
  });

  it('formats browser iso birthdays as us dates', () => {
    expect(formatSailingCardDateOfBirthInput('1988-03-24')).toBe('03/24/1988');
  });

  it('formats slash autofill birthdays without breaking typed short years', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatSailingCardDateOfBirthInput('3/4/1988')).toBe('03/04/1988');
    expect(formatSailingCardDateOfBirthInput('3/4/88')).toBe('03/04/1988');
    expect(formatSailingCardDateOfBirthInput('03/24/88')).toBe('03/24/88');
    expect(
      normalizeSailingCardDateOfBirthInput({ now, value: '03/24/88' })
    ).toBe('03/24/1988');
  });

  it('keeps invalid structured birthdays unchanged', () => {
    expect(formatSailingCardDateOfBirthInput('2026-99-99')).toBe('2026-99-99');
    expect(normalizeSailingCardDateOfBirthInput({ value: '2026-99-99' })).toBe(
      '2026-99-99'
    );
  });

  it('expands short birth years against the New York calendar year', () => {
    const newYearsEveInNewYork = new Date('2027-01-01T04:30:00.000Z');

    expect(
      parseSailingCardDateOfBirth({
        now: newYearsEveInNewYork,
        value: '01/01/27',
      })
    ).toStrictEqual(new Date('1927-01-01T00:00:00.000Z'));
  });

  it('parses short birth years for submit', () => {
    expect(
      parseSailingCardDateOfBirth({ now, value: '03/24/88' })
    ).toStrictEqual(new Date('1988-03-24T00:00:00.000Z'));
    expect(parseSailingCardDateOfBirth({ now, value: '032488' })).toStrictEqual(
      new Date('1988-03-24T00:00:00.000Z')
    );
  });
});
