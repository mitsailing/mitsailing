import { SAILING_RATINGS } from '@/data/mit-sailing/sailingRatingsSeed';

const SWIM_CATALOG_RATING_ID = 'rating-swim';
const TECH_CATALOG_RATING_ID = 'rating-tech';

/**
 * Maps legacy Pavilion `rating_types.type` values to canonical seeded catalog ids.
 * Multiple legacy types may resolve to one catalog rating (for example both
 * provisional variants map to `rating-provisional`).
 *
 * Learn-to-Sail legacy types (`2`–`5`) map to {@link TECH_CATALOG_RATING_ID}; the
 * Pavilion database rarely stores those rows, so import also infers tech from
 * any other non-swim legacy grant.
 */
export const LEGACY_RATING_TYPE_TO_CATALOG_ID: Readonly<
  Record<string, string>
> = {
  '1': SWIM_CATALOG_RATING_ID,
  '2': TECH_CATALOG_RATING_ID,
  '3': TECH_CATALOG_RATING_ID,
  '4': TECH_CATALOG_RATING_ID,
  '5': TECH_CATALOG_RATING_ID,
  '6': 'rating-provisional',
  '7': 'rating-provisional',
  '8': 'rating-crew',
  '10': 'rating-helmsman',
  '12': 'rating-laser-basic',
  '14': 'rating-board-sailing-basic',
  '15': 'rating-sailing-team',
  '16': 'rating-lynx-catboat',
  '18': 'rating-firefly-basic',
  '20': 'rating-board-sailing-class',
  '21': 'rating-420-basic',
  '22': 'rating-moth-basic',
  '115': 'rating-bluewater-skipper',
  '116': 'rating-bluewater-crew',
};

const catalogRatingIds = new Set(SAILING_RATINGS.map((rating) => rating.id));

/**
 * Catalog rating ids (except swim) whose legacy grants imply a tech rating too.
 *
 * @returns Catalog rating ids that trigger implied tech grants
 */
export function catalogRatingIdsImplyingTech(): readonly string[] {
  return [
    ...new Set(
      Object.values(LEGACY_RATING_TYPE_TO_CATALOG_ID).filter(
        (catalogId) => catalogId !== SWIM_CATALOG_RATING_ID
      )
    ),
  ];
}

export { SWIM_CATALOG_RATING_ID, TECH_CATALOG_RATING_ID };

/**
 * Returns the seeded catalog rating id for a legacy type, if one exists.
 *
 * @param legacyRatingType - Legacy Pavilion rating type id
 * @returns Seeded catalog rating id or null when unmapped
 */
export function legacyRatingCatalogId(legacyRatingType: string): string | null {
  const catalogId = LEGACY_RATING_TYPE_TO_CATALOG_ID[legacyRatingType];
  if (!catalogId || !catalogRatingIds.has(catalogId)) {
    return null;
  }
  return catalogId;
}

/**
 * Legacy rating types that should attach grants to the seeded catalog.
 *
 * @returns Legacy rating type ids with catalog mappings
 */
export function mappedLegacyRatingTypes(): string[] {
  return Object.keys(LEGACY_RATING_TYPE_TO_CATALOG_ID);
}
