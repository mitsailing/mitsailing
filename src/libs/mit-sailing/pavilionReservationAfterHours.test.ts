import { describe, expect, it } from 'vitest';
import {
  pavilionAfterHoursBandForEnd,
  pavilionReservationSunsetMinutes,
  syncPavilionAfterHoursSlots,
} from '@/libs/mit-sailing/pavilionReservationAfterHours';
import type { PavilionReservableItemDto } from '@/libs/mit-sailing/pavilionReservationTypes';

const after10: PavilionReservableItemDto = {
  id: 'after-10',
  slug: 'after_10',
  kind: 'space',
  name: 'After 10',
  description: '',
  imageUrl: null,
  pricingType: 'flat',
  minDurationHours: null,
  publicGroup: 'event_options',
  displayOrder: 1,
  media: [],
  prices: {
    mit_academic: null,
    mit_student: 32_500,
    mit_community: 41_000,
    non_mit: 57_500,
  },
};

const afterMidnight: PavilionReservableItemDto = {
  ...after10,
  id: 'after-midnight',
  slug: 'after_midnight',
  name: 'After midnight',
  prices: {
    mit_academic: null,
    mit_student: 58_500,
    mit_community: 65_000,
    non_mit: 77_500,
  },
};

describe('pavilionReservationAfterHours', () => {
  it('uses a fixture sunset near 7:00 PM', () => {
    expect(pavilionReservationSunsetMinutes('2026-08-30')).toBe(19 * 60);
  });

  it('returns no after-hours for academic personas', () => {
    expect(
      pavilionAfterHoursBandForEnd({
        afterHoursItems: [after10, afterMidnight],
        endMinutes: 23 * 60,
        persona: 'mit_academic',
        sunsetMinutes: 19 * 60,
      })
    ).toBeNull();
  });

  it('picks the 10pm band between sunset and 10pm', () => {
    expect(
      pavilionAfterHoursBandForEnd({
        afterHoursItems: [after10, afterMidnight],
        endMinutes: 22 * 60,
        persona: 'mit_student',
        sunsetMinutes: 19 * 60,
      })
    ).toEqual({
      amountCents: 32_500,
      key: 'after_10',
      labelKey: 'after_hours_through_10pm',
    });
  });

  it('replaces with the 2am band after 10pm', () => {
    expect(
      pavilionAfterHoursBandForEnd({
        afterHoursItems: [after10, afterMidnight],
        endMinutes: 23 * 60,
        persona: 'mit_student',
        sunsetMinutes: 19 * 60,
      })
    ).toEqual({
      amountCents: 58_500,
      key: 'after_midnight',
      labelKey: 'after_hours_through_2am',
    });
  });

  it('derives one after-hours slot per hourly venue line', () => {
    let n = 0;
    const synced = syncPavilionAfterHoursSlots({
      afterHoursItems: [after10, afterMidnight],
      createSlotId: () => `ah-${(n += 1)}`,
      hourlyVenueIds: new Set(['dock', 'roof']),
      persona: 'mit_student',
      slots: [
        {
          id: 'v1',
          itemId: 'dock',
          date: '2026-08-30',
          startMinutes: 17 * 60,
          endMinutes: 22 * 60,
        },
        {
          id: 'v2',
          itemId: 'roof',
          date: '2026-08-30',
          startMinutes: 17 * 60,
          endMinutes: 23 * 60,
        },
        {
          id: 'stale',
          itemId: 'after-10',
          date: '2026-08-30',
          startMinutes: 19 * 60,
          endMinutes: 20 * 60,
        },
      ],
    });

    expect(synced.filter((slot) => slot.itemId === 'dock')).toHaveLength(1);
    expect(synced.filter((slot) => slot.itemId === 'roof')).toHaveLength(1);
    expect(synced.filter((slot) => slot.itemId === 'after-10')).toEqual([
      expect.objectContaining({
        date: '2026-08-30',
        endMinutes: 22 * 60,
        itemId: 'after-10',
      }),
    ]);
    expect(synced.filter((slot) => slot.itemId === 'after-midnight')).toEqual([
      expect.objectContaining({
        date: '2026-08-30',
        endMinutes: 23 * 60,
        itemId: 'after-midnight',
      }),
    ]);
  });
});
