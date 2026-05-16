import { describe, expect, it } from 'vitest';
import {
  estimatedSlotAmountCents,
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

  it('preserves zero-dollar flat prices', () => {
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
    ).toBe(0);
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
