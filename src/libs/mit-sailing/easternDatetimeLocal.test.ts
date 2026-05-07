import { describe, expect, it } from 'vitest';
import {
  easternDatetimeLocalToUtc,
  utcToEasternDatetimeLocal,
} from '@/libs/mit-sailing/easternDatetimeLocal';

describe('easternDatetimeLocal', () => {
  it('round-trips a winter Eastern instant', () => {
    const local = '2026-01-15T14:30';
    const utc = easternDatetimeLocalToUtc(local);
    expect(utc).not.toBeNull();
    if (utc) {
      expect(utcToEasternDatetimeLocal(utc)).toBe(local);
    }
  });

  it('round-trips a summer Eastern instant (DST)', () => {
    const local = '2026-07-04T09:15';
    const utc = easternDatetimeLocalToUtc(local);
    expect(utc).not.toBeNull();
    if (utc) {
      expect(utcToEasternDatetimeLocal(utc)).toBe(local);
    }
  });

  it('returns null for invalid strings', () => {
    expect(easternDatetimeLocalToUtc('')).toBeNull();
    expect(easternDatetimeLocalToUtc('not-a-date')).toBeNull();
    expect(easternDatetimeLocalToUtc('2026-13-40T99:99')).toBeNull();
  });
});
