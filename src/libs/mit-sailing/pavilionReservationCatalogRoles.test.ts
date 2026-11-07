import { describe, expect, it } from 'vitest';
import {
  isPavilionWeddingCatalogItem,
  partitionPavilionCatalogForRequestBuilder,
  pavilionReservableItemCatalogRole,
} from '@/libs/mit-sailing/pavilionReservationCatalogRoles';
import type { PavilionReservableItemDto } from '@/libs/mit-sailing/pavilionReservationTypes';

function item(
  props: Pick<PavilionReservableItemDto, 'id' | 'pricingType' | 'slug'> &
    Partial<Pick<PavilionReservableItemDto, 'kind'>>
): PavilionReservableItemDto {
  return {
    id: props.id,
    slug: props.slug,
    kind: props.kind ?? 'space',
    name: props.slug,
    description: '',
    imageUrl: null,
    pricingType: props.pricingType,
    minDurationHours: null,
    publicGroup: null,
    displayOrder: 0,
    media: [],
    prices: {
      mit_academic: 0,
      mit_student: 0,
      mit_community: 0,
      non_mit: 0,
    },
  };
}

describe('pavilionReservableItemCatalogRole', () => {
  it('classifies hourly venues, add-ons, programs, and after-hours', () => {
    expect(
      pavilionReservableItemCatalogRole(
        item({ id: '1', slug: 'casual_dock', pricingType: 'hourly' })
      )
    ).toBe('hourly_venue');
    expect(
      pavilionReservableItemCatalogRole(
        item({ id: '2', slug: 'grill', pricingType: 'flat' })
      )
    ).toBe('addon');
    expect(
      pavilionReservableItemCatalogRole(
        item({ id: '3', slug: 'lab_access', pricingType: 'flat' })
      )
    ).toBe('program');
    expect(
      pavilionReservableItemCatalogRole(
        item({ id: '4', slug: 'after_10', pricingType: 'flat' })
      )
    ).toBe('after_hours');
  });

  it('recognizes wedding add-ons', () => {
    expect(isPavilionWeddingCatalogItem({ slug: 'wedding_space' })).toBe(true);
  });

  it('partitions the public catalog for the request builder', () => {
    const partitioned = partitionPavilionCatalogForRequestBuilder([
      item({ id: 'dock', slug: 'casual_dock', pricingType: 'hourly' }),
      item({ id: 'grill', slug: 'grill', pricingType: 'flat' }),
      item({ id: 'lab', slug: 'lab_access', pricingType: 'flat' }),
      item({ id: 'ah', slug: 'after_10', pricingType: 'flat' }),
      item({
        id: 'svc',
        slug: 'extra_tables',
        pricingType: 'flat',
        kind: 'service',
      }),
    ]);

    expect(partitioned.hourlyVenues.map((row) => row.id)).toEqual(['dock']);
    expect(partitioned.addons.map((row) => row.id)).toEqual(['grill']);
    expect(partitioned.programs.map((row) => row.id)).toEqual(['lab']);
    expect(partitioned.afterHours.map((row) => row.id)).toEqual(['ah']);
  });
});
