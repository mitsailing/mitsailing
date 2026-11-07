const SAILING_RATING_PATH_IDS = [
  'charles-river',
  'lynx',
  'racing',
  'windsurfing',
  'mashnee',
  'team',
  'other',
] as const;

export type SailingRatingPathId = (typeof SAILING_RATING_PATH_IDS)[number];

const PATH_BY_RATING_ID: Readonly<Record<string, SailingRatingPathId>> = {
  'rating-swim': 'charles-river',
  'rating-tech': 'charles-river',
  'rating-provisional': 'charles-river',
  'rating-crew': 'charles-river',
  'rating-helmsman': 'charles-river',
  'rating-lynx-catboat': 'lynx',
  'rating-laser-basic': 'racing',
  'rating-laser-advanced': 'racing',
  'rating-firefly-basic': 'racing',
  'rating-firefly-advanced': 'racing',
  'rating-420-basic': 'racing',
  'rating-420-advanced': 'racing',
  'rating-moth-basic': 'racing',
  'rating-moth-advanced': 'racing',
  'rating-board-sailing-class': 'windsurfing',
  'rating-board-sailing-basic': 'windsurfing',
  'rating-board-sailing-advanced': 'windsurfing',
  'rating-bluewater-crew': 'mashnee',
  'rating-bluewater-skipper': 'mashnee',
  'rating-sailing-team': 'team',
};

/**
 * Returns the public catalog path for a sailing rating id.
 *
 * @param ratingId - Catalog sailing rating id
 * @returns Path id used for grouping and jump links
 */
export function sailingRatingPathId(ratingId: string): SailingRatingPathId {
  return PATH_BY_RATING_ID[ratingId] ?? 'other';
}

/**
 * Returns the in-page hash id for a ratings path section.
 *
 * @param pathId - Public catalog path id
 * @returns Hash id without #
 */
export function sailingRatingPathSectionId(pathId: SailingRatingPathId) {
  return `path-${pathId}`;
}

export type RatingPathSection<T extends { id: string }> = {
  pathId: SailingRatingPathId;
  ratings: T[];
};

/**
 * Groups catalog ratings into sailor paths, preserving input order within each path.
 *
 * @param ratings - Ratings already ordered for public display
 * @returns Path sections that contain at least one rating
 */
export function groupPublicRatingsByPath<T extends { id: string }>(
  ratings: readonly T[]
): RatingPathSection<T>[] {
  const grouped = new Map<SailingRatingPathId, T[]>();

  for (const rating of ratings) {
    const pathId = sailingRatingPathId(rating.id);
    const bucket = grouped.get(pathId);
    if (bucket) {
      bucket.push(rating);
    } else {
      grouped.set(pathId, [rating]);
    }
  }

  return SAILING_RATING_PATH_IDS.flatMap((pathId) => {
    const pathRatings = grouped.get(pathId);
    if (!pathRatings || pathRatings.length === 0) {
      return [];
    }
    return [{ pathId, ratings: pathRatings }];
  });
}

export type CatalogRatingLink = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Resolves prerequisite ratings for one catalog rating from rating-to-rating rules.
 *
 * @param props - Target rating, catalog rows, and requires rules
 * @returns Prerequisite ratings in display order
 */
export function requiredCatalogRatings(props: {
  catalog: readonly CatalogRatingLink[];
  ratingId: string;
  rules: readonly {
    displayOrder: number;
    ratingId: string | null;
    sailingRatingId: string;
  }[];
}): CatalogRatingLink[] {
  const catalogById = new Map(
    props.catalog.map((rating) => [rating.id, rating])
  );

  return props.rules
    .filter((rule) => rule.ratingId === props.ratingId)
    .toSorted((left, right) => left.displayOrder - right.displayOrder)
    .map((rule) => catalogById.get(rule.sailingRatingId))
    .filter((rating): rating is CatalogRatingLink => rating !== undefined);
}
