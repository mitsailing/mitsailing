import { describe, expect, it } from 'vitest';
import {
  evaluateSailingRatingGrantEligibility,
  groupSailingRatingRules,
  listMissingRequiredRatingIds,
} from '@/libs/mit-sailing/sailingRatingRules';

const rules = [
  {
    groupKey: 'default',
    sailingRatingId: 'rating-tech',
    displayOrder: 0,
  },
  {
    groupKey: 'advanced',
    sailingRatingId: 'rating-tech-advanced',
    displayOrder: 0,
  },
  {
    groupKey: 'advanced',
    sailingRatingId: 'rating-keelboat',
    displayOrder: 1,
  },
];

describe('sailingRatingRules', () => {
  it('groups rules by AND groups with OR choices', () => {
    expect(groupSailingRatingRules(rules)).toEqual([
      {
        groupKey: 'default',
        ratings: [{ id: 'rating-tech', displayOrder: 0 }],
      },
      {
        groupKey: 'advanced',
        ratings: [
          { id: 'rating-tech-advanced', displayOrder: 0 },
          { id: 'rating-keelboat', displayOrder: 1 },
        ],
      },
    ]);
  });

  it.each([
    {
      owned: ['rating-tech', 'rating-tech-advanced'],
      missing: [],
    },
    {
      owned: ['rating-tech', 'rating-keelboat'],
      missing: [],
    },
    {
      owned: ['rating-tech'],
      missing: ['rating-tech-advanced', 'rating-keelboat'],
    },
    {
      owned: ['rating-tech-advanced'],
      missing: ['rating-tech'],
    },
  ])('lists missing prerequisite choices for grouped rules', (row) => {
    expect(listMissingRequiredRatingIds(rules, new Set(row.owned))).toEqual(
      row.missing
    );
  });

  it('permits grants when every required group is satisfied', () => {
    expect(
      evaluateSailingRatingGrantEligibility({
        rules,
        activeRatingIds: new Set(['rating-tech', 'rating-keelboat']),
        alreadyGranted: false,
        isDeprecated: false,
      })
    ).toEqual({ eligible: true });
  });

  it('blocks grants for duplicates, deprecated ratings, and unmet prerequisites', () => {
    expect(
      evaluateSailingRatingGrantEligibility({
        rules: [],
        activeRatingIds: new Set(['rating-tech']),
        alreadyGranted: true,
        isDeprecated: false,
      })
    ).toEqual({ eligible: false, reason: 'already_granted' });

    expect(
      evaluateSailingRatingGrantEligibility({
        rules: [],
        activeRatingIds: new Set(),
        alreadyGranted: false,
        isDeprecated: true,
      })
    ).toEqual({ eligible: false, reason: 'deprecated' });

    expect(
      evaluateSailingRatingGrantEligibility({
        rules,
        activeRatingIds: new Set(['rating-tech']),
        alreadyGranted: false,
        isDeprecated: false,
      })
    ).toEqual({
      eligible: false,
      reason: 'missing_prerequisites',
      missingRatingIds: ['rating-tech-advanced', 'rating-keelboat'],
    });
  });
});
