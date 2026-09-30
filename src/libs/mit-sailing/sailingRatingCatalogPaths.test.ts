import { describe, expect, it } from 'vitest';
import {
  groupPublicRatingsByPath,
  requiredCatalogRatings,
  sailingRatingPathId,
} from '@/libs/mit-sailing/sailingRatingCatalogPaths';

describe('sailingRatingPathId', () => {
  it.each([
    ['rating-swim', 'charles-river'],
    ['rating-tech', 'charles-river'],
    ['rating-provisional', 'charles-river'],
    ['rating-crew', 'charles-river'],
    ['rating-helmsman', 'charles-river'],
    ['rating-lynx-catboat', 'lynx'],
    ['rating-laser-basic', 'racing'],
    ['rating-laser-advanced', 'racing'],
    ['rating-firefly-basic', 'racing'],
    ['rating-420-basic', 'racing'],
    ['rating-moth-advanced', 'racing'],
    ['rating-board-sailing-class', 'windsurfing'],
    ['rating-board-sailing-advanced', 'windsurfing'],
    ['rating-bluewater-crew', 'mashnee'],
    ['rating-bluewater-skipper', 'mashnee'],
    ['rating-sailing-team', 'team'],
  ] as const)('maps %s to %s', (ratingId, pathId) => {
    expect(sailingRatingPathId(ratingId)).toBe(pathId);
  });

  it('falls back to other for unknown catalog ids', () => {
    expect(sailingRatingPathId('rating-bosun')).toBe('other');
  });
});

describe('groupPublicRatingsByPath', () => {
  it('groups ratings into sailor paths and keeps catalog order within a path', () => {
    const sections = groupPublicRatingsByPath([
      { id: 'rating-sailing-team', name: 'Sailing Team' },
      { id: 'rating-swim', name: 'Swim Rating' },
      { id: 'rating-provisional', name: 'Provisional Rating' },
      { id: 'rating-laser-basic', name: 'Laser: Basic' },
      { id: 'rating-lynx-catboat', name: 'Lynx Catboat Rating' },
    ]);

    expect(sections.map((section) => section.pathId)).toEqual([
      'charles-river',
      'lynx',
      'racing',
      'team',
    ]);
    expect(sections[0]?.ratings.map((rating) => rating.id)).toEqual([
      'rating-swim',
      'rating-provisional',
    ]);
  });

  it('omits empty paths', () => {
    const sections = groupPublicRatingsByPath([
      { id: 'rating-bluewater-crew', name: 'Bluewater Crew' },
    ]);

    expect(sections).toEqual([
      {
        pathId: 'mashnee',
        ratings: [{ id: 'rating-bluewater-crew', name: 'Bluewater Crew' }],
      },
    ]);
  });
});

describe('requiredCatalogRatings', () => {
  const catalog = [
    { id: 'rating-tech', name: 'Tech Rating', slug: 'tech-rating' },
    {
      id: 'rating-provisional',
      name: 'Provisional Rating',
      slug: 'provisional-rating',
    },
  ];

  it('returns prerequisite ratings in display order', () => {
    expect(
      requiredCatalogRatings({
        catalog,
        ratingId: 'rating-provisional',
        rules: [
          {
            displayOrder: 0,
            ratingId: 'rating-provisional',
            sailingRatingId: 'rating-tech',
          },
        ],
      })
    ).toEqual([
      { id: 'rating-tech', name: 'Tech Rating', slug: 'tech-rating' },
    ]);
  });

  it('ignores rules for other ratings and missing catalog ids', () => {
    expect(
      requiredCatalogRatings({
        catalog,
        ratingId: 'rating-tech',
        rules: [
          {
            displayOrder: 0,
            ratingId: 'rating-provisional',
            sailingRatingId: 'rating-tech',
          },
          {
            displayOrder: 1,
            ratingId: 'rating-tech',
            sailingRatingId: 'rating-missing',
          },
        ],
      })
    ).toEqual([]);
  });
});
