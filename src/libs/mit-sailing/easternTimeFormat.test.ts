import { afterEach, describe, expect, it, vi } from 'vitest';

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
  vi.resetModules();
});

describe('formatEasternShortDateFromIsoCalendar', () => {
  it('formats dates in Eastern when the process timezone is ahead', async () => {
    process.env.TZ = 'Pacific/Kiritimati';
    vi.resetModules();

    const { formatEasternShortDateFromIsoCalendar } =
      await import('@/libs/mit-sailing/easternTimeFormat');

    expect(formatEasternShortDateFromIsoCalendar('2025-01-01')).toBe(
      'Wed, Jan 1, 2025'
    );
  });

  it('returns invalid input unchanged', async () => {
    const { formatEasternShortDateFromIsoCalendar } =
      await import('@/libs/mit-sailing/easternTimeFormat');

    expect(formatEasternShortDateFromIsoCalendar('not-a-date')).toBe(
      'not-a-date'
    );
  });
});
