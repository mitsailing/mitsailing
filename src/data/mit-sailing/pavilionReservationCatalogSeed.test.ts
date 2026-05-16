import { describe, expect, it } from 'vitest';
import { PAVILION_RESERVABLE_ITEM_SEED_ROWS } from '@/data/mit-sailing/pavilionReservationCatalogSeed';

const visibleSpaces = PAVILION_RESERVABLE_ITEM_SEED_ROWS.filter(
  (row) => row.isVisible && row.kind === 'space'
).toSorted((first, second) => first.displayOrder - second.displayOrder);

function rowBySlug(slug: string) {
  const row = PAVILION_RESERVABLE_ITEM_SEED_ROWS.find(
    (candidate) => candidate.slug === slug
  );
  if (!row) {
    throw new Error(`Missing Pavilion reservation seed row: ${slug}`);
  }
  return row;
}

const expectedPricesBySlug = {
  after_10: {
    mit_academic: null,
    mit_community: 41_000,
    mit_student: 32_500,
    non_mit: 57_500,
  },
  after_midnight: {
    mit_academic: null,
    mit_community: 65_000,
    mit_student: 58_500,
    non_mit: 77_500,
  },
  casual_dock: {
    mit_academic: 32_000,
    mit_community: 32_000,
    mit_student: 20_000,
    non_mit: 58_000,
  },
  grill: {
    mit_academic: 3000,
    mit_community: 3000,
    mit_student: 3000,
    non_mit: 3000,
  },
  group_sailing: {
    mit_academic: 350_000,
    mit_community: 350_000,
    mit_student: 350_000,
    non_mit: 450_000,
  },
  lab_access: {
    mit_academic: 0,
    mit_community: 0,
    mit_student: 0,
    non_mit: 0,
  },
  party_boat: {
    mit_academic: 13_000,
    mit_community: 13_000,
    mit_student: 13_000,
    non_mit: 13_000,
  },
  roof_deck: {
    mit_academic: 32_000,
    mit_community: 32_000,
    mit_student: 20_000,
    non_mit: 61_000,
  },
  wedding_space: {
    mit_academic: null,
    mit_community: 65_000,
    mit_student: 65_000,
    non_mit: 82_500,
  },
} as const;

describe('PAVILION_RESERVABLE_ITEM_SEED_ROWS', () => {
  it('matches live rental rows for visible reservation options', () => {
    expect(visibleSpaces.map((row) => row.slug)).toEqual([
      'grill',
      'casual_dock',
      'roof_deck',
      'party_boat',
      'wedding_space',
      'after_10',
      'after_midnight',
      'lab_access',
      'group_sailing',
    ]);
    expect(visibleSpaces).toHaveLength(9);
  });

  it('sets live rental prices by persona', () => {
    for (const [slug, prices] of Object.entries(expectedPricesBySlug)) {
      expect(rowBySlug(slug).prices).toMatchObject(prices);
    }
  });

  it('hides duplicate wedding service row', () => {
    expect(rowBySlug('wedding_service')).toMatchObject({
      isVisible: false,
      kind: 'service',
    });
  });
});
