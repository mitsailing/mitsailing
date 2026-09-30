import { describe, expect, it } from 'vitest';
import {
  legacyRatingCatalogId,
  LEGACY_RATING_TYPE_TO_CATALOG_ID,
} from '@/libs/legacy-sync/legacyRatingCatalogMap';

describe('legacyRatingCatalogMap', () => {
  it('maps swim and provisional legacy types to seeded catalog ids', () => {
    expect(legacyRatingCatalogId('1')).toBe('rating-swim');
    expect(legacyRatingCatalogId('6')).toBe('rating-provisional');
    expect(legacyRatingCatalogId('7')).toBe('rating-provisional');
  });

  it('returns null for legacy-only rating types without a catalog match', () => {
    expect(legacyRatingCatalogId('9')).toBeNull();
    expect(legacyRatingCatalogId('11')).toBeNull();
  });

  it('keeps every mapped legacy type on a seeded catalog id', () => {
    for (const catalogId of Object.values(LEGACY_RATING_TYPE_TO_CATALOG_ID)) {
      expect(catalogId.startsWith('rating-')).toBe(true);
    }
  });
});
