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
    expect(rowBySlug('grill').prices).toMatchObject({
      mit_academic: 3000,
      mit_student: 3000,
      mit_community: 3000,
      non_mit: 3000,
    });
    expect(rowBySlug('casual_dock').prices).toMatchObject({
      mit_academic: 32_000,
      mit_student: 20_000,
      mit_community: 32_000,
      non_mit: 58_000,
    });
    expect(rowBySlug('roof_deck').prices).toMatchObject({
      mit_academic: 32_000,
      mit_student: 20_000,
      mit_community: 32_000,
      non_mit: 61_000,
    });
    expect(rowBySlug('party_boat').prices).toMatchObject({
      mit_academic: 13_000,
      mit_student: 13_000,
      mit_community: 13_000,
      non_mit: 13_000,
    });
    expect(rowBySlug('wedding_space').prices).toMatchObject({
      mit_academic: null,
      mit_student: 65_000,
      mit_community: 65_000,
      non_mit: 82_500,
    });
    expect(rowBySlug('after_10').prices).toMatchObject({
      mit_academic: null,
      mit_student: 32_500,
      mit_community: 41_000,
      non_mit: 57_500,
    });
    expect(rowBySlug('after_midnight').prices).toMatchObject({
      mit_academic: null,
      mit_student: 58_500,
      mit_community: 65_000,
      non_mit: 77_500,
    });
    expect(rowBySlug('lab_access').prices).toMatchObject({
      mit_academic: 0,
      mit_student: 0,
      mit_community: 0,
      non_mit: 0,
    });
    expect(rowBySlug('group_sailing').prices).toMatchObject({
      mit_academic: 350_000,
      mit_student: 350_000,
      mit_community: 350_000,
      non_mit: 450_000,
    });
  });

  it('hides duplicate wedding service row', () => {
    expect(rowBySlug('wedding_service')).toMatchObject({
      isVisible: false,
      kind: 'service',
    });
  });
});
