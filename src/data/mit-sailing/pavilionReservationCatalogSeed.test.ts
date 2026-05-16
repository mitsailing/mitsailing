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

function dollarsToCents(dollars: number) {
  return dollars * 100;
}

const expectedPricesBySlug = {
  after_10: {
    mit_academic: null,
    mit_community: dollarsToCents(410),
    mit_student: dollarsToCents(325),
    non_mit: dollarsToCents(575),
  },
  after_midnight: {
    mit_academic: null,
    mit_community: dollarsToCents(650),
    mit_student: dollarsToCents(585),
    non_mit: dollarsToCents(775),
  },
  casual_dock: {
    mit_academic: dollarsToCents(320),
    mit_community: dollarsToCents(320),
    mit_student: dollarsToCents(200),
    non_mit: dollarsToCents(580),
  },
  grill: {
    mit_academic: dollarsToCents(30),
    mit_community: dollarsToCents(30),
    mit_student: dollarsToCents(30),
    non_mit: dollarsToCents(30),
  },
  group_sailing: {
    mit_academic: dollarsToCents(3500),
    mit_community: dollarsToCents(3500),
    mit_student: dollarsToCents(3500),
    non_mit: dollarsToCents(4500),
  },
  lab_access: {
    mit_academic: null,
    mit_community: null,
    mit_student: null,
    non_mit: null,
  },
  party_boat: {
    mit_academic: dollarsToCents(130),
    mit_community: dollarsToCents(130),
    mit_student: dollarsToCents(130),
    non_mit: dollarsToCents(130),
  },
  roof_deck: {
    mit_academic: dollarsToCents(320),
    mit_community: dollarsToCents(320),
    mit_student: dollarsToCents(200),
    non_mit: dollarsToCents(610),
  },
  wedding_space: {
    mit_academic: null,
    mit_community: dollarsToCents(650),
    mit_student: dollarsToCents(650),
    non_mit: dollarsToCents(825),
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

  it('stores whole-dollar amounts only', () => {
    for (const row of PAVILION_RESERVABLE_ITEM_SEED_ROWS) {
      for (const amountCents of Object.values(row.prices)) {
        if (amountCents !== null) {
          expect(amountCents % 100).toBe(0);
        }
      }
    }
  });
});
