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

describe('formatEasternEventCalendarLine', () => {
  it('uses until line only for multi-end segment', async () => {
    process.env.TZ = 'Pacific/Kiritimati';
    vi.resetModules();

    const { formatEasternEventCalendarLine } =
      await import('@/libs/mit-sailing/easternTimeFormat');

    const end = new Date('2026-01-15T21:00:00.000Z');
    expect(
      formatEasternEventCalendarLine({
        start: new Date('2026-01-14T14:00:00.000Z'),
        end,
        segment: 'multi-end',
      })
    ).toBe('Until 4:00 PM ET');
  });

  it('formats ongoing segment with start time and end date', async () => {
    process.env.TZ = 'Pacific/Kiritimati';
    vi.resetModules();

    const { formatEasternEventCalendarLine } =
      await import('@/libs/mit-sailing/easternTimeFormat');

    expect(
      formatEasternEventCalendarLine({
        start: new Date('2026-02-27T14:00:00.000Z'),
        end: new Date('2026-04-02T20:00:00.000Z'),
        segment: 'ongoing',
      })
    ).toBe('9:00 AM – Thu, Apr 2, 4:00 PM ET');
  });
});

describe('formatEasternEventRange', () => {
  it('formats ranges in New York time without a visible timezone label', async () => {
    process.env.TZ = 'Pacific/Kiritimati';
    vi.resetModules();

    const { formatEasternEventRange } =
      await import('@/libs/mit-sailing/easternTimeFormat');

    expect(
      formatEasternEventRange(
        new Date('2026-01-15T19:30:00.000Z'),
        new Date('2026-01-15T21:00:00.000Z')
      )
    ).toBe('Thu, Jan 15, 2026 · 2:30 PM – 4:00 PM');
  });
});
