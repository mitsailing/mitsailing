import { describe, expect, it } from 'vitest';
import {
  estimatedServiceAmountCents,
  estimatedSlotAmountCents,
  formatPavilionReservationMoney,
  priceLabel,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import type { PavilionReservableItemDto } from '@/libs/mit-sailing/pavilionReservationTypes';

function item(
  props: Pick<
    PavilionReservableItemDto,
    'minDurationHours' | 'prices' | 'pricingType'
  >
) {
  return {
    id: 'item',
    minDurationHours: props.minDurationHours,
    prices: props.prices,
    pricingType: props.pricingType,
  };
}

describe('estimatedSlotAmountCents', () => {
  it('returns null for pricing confirmed after review', () => {
    expect(
      estimatedSlotAmountCents({
        item: item({
          minDurationHours: null,
          pricingType: 'flat',
          prices: {
            mit_academic: null,
            mit_student: 65_000,
            mit_community: 65_000,
            non_mit: 82_500,
          },
        }),
        persona: 'mit_academic',
        slot: {
          itemId: 'item',
          date: '2026-07-01',
          startMinutes: 9 * 60,
          endMinutes: 10 * 60,
        },
        slotIndexForItem: 0,
      })
    ).toBeNull();
  });

  it('rounds hourly estimates to whole dollars', () => {
    expect(
      estimatedSlotAmountCents({
        item: item({
          minDurationHours: null,
          pricingType: 'hourly',
          prices: {
            mit_academic: 32_000,
            mit_student: 20_000,
            mit_community: 32_000,
            non_mit: 58_000,
          },
        }),
        persona: 'mit_academic',
        slot: {
          itemId: 'item',
          date: '2026-07-01',
          startMinutes: 9 * 60,
          endMinutes: 9 * 60 + 50,
        },
        slotIndexForItem: 0,
      })
    ).toBe(26_700);
  });

  it('skips zero-dollar flat prices', () => {
    expect(
      estimatedSlotAmountCents({
        item: item({
          minDurationHours: null,
          pricingType: 'flat',
          prices: {
            mit_academic: 0,
            mit_student: 0,
            mit_community: 0,
            non_mit: 0,
          },
        }),
        persona: 'mit_student',
        slot: {
          itemId: 'item',
          date: '2026-07-01',
          startMinutes: 9 * 60,
          endMinutes: 10 * 60,
        },
        slotIndexForItem: 0,
      })
    ).toBeNull();
  });
});

describe('formatPavilionReservationMoney', () => {
  it('formats whole dollars without cents', () => {
    expect(formatPavilionReservationMoney(32_000)).toBe('$320');
  });
});

describe('estimatedServiceAmountCents', () => {
  it('returns null for services priced after review', () => {
    expect(
      estimatedServiceAmountCents({
        item: {
          pricingType: 'tbd',
          prices: {
            mit_academic: null,
            mit_student: 10_000,
            mit_community: 10_000,
            non_mit: 10_000,
          },
        },
        persona: 'mit_academic',
      })
    ).toBeNull();
  });

  it('returns persona price for non-flat service pricing types', () => {
    expect(
      estimatedServiceAmountCents({
        item: {
          pricingType: 'hourly',
          prices: {
            mit_academic: 12_000,
            mit_student: 10_000,
            mit_community: 11_000,
            non_mit: 20_000,
          },
        },
        persona: 'mit_community',
      })
    ).toBe(11_000);
  });

  it('skips zero-dollar service prices', () => {
    expect(
      estimatedServiceAmountCents({
        item: {
          pricingType: 'flat',
          prices: {
            mit_academic: 0,
            mit_student: 0,
            mit_community: 0,
            non_mit: 0,
          },
        },
        persona: 'mit_academic',
      })
    ).toBeNull();
  });
});

describe('priceLabel', () => {
  it('uses review-pricing label for null prices', () => {
    expect(
      priceLabel({
        amountCents: null,
        pricingType: 'flat',
        tbdLabel: 'Pricing confirmed after review',
      })
    ).toBe('Pricing confirmed after review');
  });
});
