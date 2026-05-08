import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { evaluateSailingRatingGrantEligibility } from '@/libs/mit-sailing/sailingRatingRules';
import type {
  SailingRatingGrantEligibility,
  SailingRatingRuleInput,
} from '@/libs/mit-sailing/sailingRatingRules';

export type SailingRatingBrief = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  isDeprecated: boolean;
};

export type PublicSailingRating = SailingRatingBrief & {
  description: string;
  category: string | null;
  level: string | null;
  windCondition: string | null;
  guideUrl: string | null;
  grantableClasses: { id: string; name: string; slug: string }[];
  unlockedBoats: { id: string; name: string; slug: string }[];
};

export type UserRatingAssignmentRow = PublicSailingRating & {
  issuedAt: Date | null;
  issuedByName: string | null;
  eligibility: SailingRatingGrantEligibility;
};

type RatingRuleWithRating = SailingRatingRuleInput & {
  sailingRating: SailingRatingBrief;
};

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export async function listRequiredRatingsForTarget(props: {
  targetType: 'boat' | 'class' | 'rating';
  targetId: string;
  ruleType: 'requires' | 'grants';
}): Promise<RatingRuleWithRating[]> {
  const rows = await prisma.sailingRatingRule.findMany({
    where: {
      targetType: props.targetType,
      targetId: props.targetId,
      ruleType: props.ruleType,
      sailingRating: { isVisible: true },
    },
    orderBy: [{ groupKey: 'asc' }, { displayOrder: 'asc' }],
    select: {
      groupKey: true,
      sailingRatingId: true,
      displayOrder: true,
      sailingRating: {
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          isDeprecated: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    groupKey: row.groupKey,
    sailingRatingId: row.sailingRatingId,
    displayOrder: row.displayOrder,
    sailingRating: row.sailingRating,
  }));
}

export const listPublicSailingRatings = cache(
  async (): Promise<PublicSailingRating[]> => {
    const [ratings, classRules, boatRules] = await Promise.all([
      prisma.sailingRating.findMany({
        where: { isVisible: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          description: true,
          category: true,
          level: true,
          windCondition: true,
          guideUrl: true,
          isDeprecated: true,
        },
      }),
      prisma.sailingRatingRule.findMany({
        where: { targetType: 'class', ruleType: 'grants' },
        orderBy: [{ displayOrder: 'asc' }],
        select: { targetId: true, sailingRatingId: true },
      }),
      prisma.sailingRatingRule.findMany({
        where: { targetType: 'boat', ruleType: 'requires' },
        orderBy: [{ displayOrder: 'asc' }],
        select: { targetId: true, sailingRatingId: true },
      }),
    ]);

    const classIds = [...new Set(classRules.map((rule) => rule.targetId))];
    const boatIds = [...new Set(boatRules.map((rule) => rule.targetId))];
    const [classes, boats] = await Promise.all([
      prisma.sailingClass.findMany({
        where: { id: { in: classIds }, isVisible: true },
        select: { id: true, name: true, slug: true },
      }),
      prisma.fleetBoat.findMany({
        where: { id: { in: boatIds } },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const classById = new Map(classes.map((row) => [row.id, row]));
    const boatById = new Map(boats.map((row) => [row.id, row]));

    return ratings.map((rating) => ({
      ...rating,
      grantableClasses: classRules
        .filter((rule) => rule.sailingRatingId === rating.id)
        .map((rule) => classById.get(rule.targetId))
        .filter(isPresent),
      unlockedBoats: boatRules
        .filter((rule) => rule.sailingRatingId === rating.id)
        .map((rule) => boatById.get(rule.targetId))
        .filter(isPresent),
    }));
  }
);

async function listActiveUserRatingIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.userSailingRating.findMany({
    where: { userId },
    select: { sailingRatingId: true },
  });
  return new Set(rows.map((row) => row.sailingRatingId));
}

export async function listUserRatingAssignmentRows(
  userId: string
): Promise<UserRatingAssignmentRow[]> {
  const [publicRatings, grants, activeIds, prerequisiteRules] =
    await Promise.all([
      listPublicSailingRatings(),
      prisma.userSailingRating.findMany({
        where: { userId },
        select: {
          sailingRatingId: true,
          issuedAt: true,
          issuedBy: { select: { name: true } },
        },
      }),
      listActiveUserRatingIds(userId),
      prisma.sailingRatingRule.findMany({
        where: { targetType: 'rating', ruleType: 'requires' },
        select: {
          targetId: true,
          groupKey: true,
          sailingRatingId: true,
          displayOrder: true,
        },
      }),
    ]);

  const grantByRatingId = new Map(
    grants.map((row) => [row.sailingRatingId, row])
  );
  return publicRatings.map((rating) => {
    const grant = grantByRatingId.get(rating.id);
    const rules = prerequisiteRules.filter(
      (rule) => rule.targetId === rating.id
    );
    return {
      ...rating,
      issuedAt: grant?.issuedAt ?? null,
      issuedByName: grant?.issuedBy.name ?? null,
      eligibility: evaluateSailingRatingGrantEligibility({
        rules,
        activeRatingIds: activeIds,
        alreadyGranted: Boolean(grant),
        isDeprecated: rating.isDeprecated,
      }),
    };
  });
}

export async function userCanGrantSailingRating(props: {
  userId: string;
  ratingId: string;
}): Promise<SailingRatingGrantEligibility | null> {
  const rows = await listUserRatingAssignmentRows(props.userId);
  return rows.find((row) => row.id === props.ratingId)?.eligibility ?? null;
}
