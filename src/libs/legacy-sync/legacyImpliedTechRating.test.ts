import { describe, expect, it } from 'vitest';
import { appendImpliedTechRatingRows } from '@/libs/legacy-sync/legacyImpliedTechRating';
import type { LegacyUserRatingGrantRow } from '@/libs/legacy-sync/legacyImpliedTechRating';
import {
  catalogRatingIdsImplyingTech,
  legacyRatingCatalogId,
  TECH_CATALOG_RATING_ID,
} from '@/libs/legacy-sync/legacyRatingCatalogMap';

function grantRow(
  props: Partial<LegacyUserRatingGrantRow> &
    Pick<LegacyUserRatingGrantRow, 'userId'>
): LegacyUserRatingGrantRow {
  return {
    id: props.id ?? 'grant-1',
    issuedAt: props.issuedAt ?? new Date('2026-01-01T12:00:00.000Z'),
    issuedByUserId: props.issuedByUserId ?? 'instructor-1',
    sailingRatingId: props.sailingRatingId ?? 'rating-provisional',
    userId: props.userId,
  };
}

describe('appendImpliedTechRatingRows', () => {
  it('adds tech rating when a provisional grant is imported', () => {
    const rows = appendImpliedTechRatingRows([
      grantRow({ userId: 'user-1', sailingRatingId: 'rating-provisional' }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.sailingRatingId).toSorted()).toEqual([
      'rating-provisional',
      TECH_CATALOG_RATING_ID,
    ]);
  });

  it('does not duplicate tech when learn-to-sail already maps to tech', () => {
    const rows = appendImpliedTechRatingRows([
      grantRow({ userId: 'user-1', sailingRatingId: TECH_CATALOG_RATING_ID }),
    ]);

    expect(rows).toHaveLength(1);
  });

  it('does not add tech for swim-only grants', () => {
    const rows = appendImpliedTechRatingRows([
      grantRow({ userId: 'user-1', sailingRatingId: 'rating-swim' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.sailingRatingId).toBe('rating-swim');
  });
});

describe('legacyRatingCatalogMap tech mapping', () => {
  it('maps learn-to-sail legacy types to tech rating', () => {
    expect(legacyRatingCatalogId('2')).toBe(TECH_CATALOG_RATING_ID);
    expect(legacyRatingCatalogId('5')).toBe(TECH_CATALOG_RATING_ID);
  });

  it('lists catalog ratings that imply tech besides swim', () => {
    expect(catalogRatingIdsImplyingTech()).toContain(TECH_CATALOG_RATING_ID);
    expect(catalogRatingIdsImplyingTech()).not.toContain('rating-swim');
  });
});
