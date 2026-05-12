import 'server-only';
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

type SailingRatingTargetType = 'boat' | 'class' | 'rating';

type SailingRatingReadClient = Pick<
  typeof prisma,
  | 'fleetBoat'
  | 'sailingClass'
  | 'sailingRating'
  | 'sailingRatingRule'
  | 'userSailingRating'
>;

type ListUserRatingAssignmentRowsOptions = {
  includeDeprecated?: boolean;
  client?: SailingRatingReadClient;
};

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function targetRuleWhere(props: {
  targetType: SailingRatingTargetType;
  targetId: string;
}) {
  if (props.targetType === 'boat') {
    return { boatId: props.targetId };
  }
  if (props.targetType === 'class') {
    return { classId: props.targetId };
  }
  return { ratingId: props.targetId };
}

export async function listRequiredRatingsForTarget(props: {
  targetType: SailingRatingTargetType;
  targetId: string;
  ruleType: 'requires' | 'grants';
}): Promise<RatingRuleWithRating[]> {
  const rows = await prisma.sailingRatingRule.findMany({
    where: {
      ...targetRuleWhere(props),
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

async function listPublicSailingRatingsForClient(
  client: SailingRatingReadClient,
  props: { includeDeprecated?: boolean } = {}
): Promise<PublicSailingRating[]> {
  const [ratings, classRules, boatRules] = await Promise.all([
    client.sailingRating.findMany({
      where: {
        isVisible: true,
        ...(props.includeDeprecated === false ? { isDeprecated: false } : {}),
      },
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
    client.sailingRatingRule.findMany({
      where: { classId: { not: null }, ruleType: 'grants' },
      orderBy: [{ displayOrder: 'asc' }],
      select: { classId: true, sailingRatingId: true },
    }),
    client.sailingRatingRule.findMany({
      where: { boatId: { not: null }, ruleType: 'requires' },
      orderBy: [{ displayOrder: 'asc' }],
      select: { boatId: true, sailingRatingId: true },
    }),
  ]);

  const classIds = [
    ...new Set(classRules.map((rule) => rule.classId).filter(isPresent)),
  ];
  const boatIds = [
    ...new Set(boatRules.map((rule) => rule.boatId).filter(isPresent)),
  ];
  const [classes, boats] = await Promise.all([
    client.sailingClass.findMany({
      where: { id: { in: classIds }, isVisible: true },
      select: { id: true, name: true, slug: true },
    }),
    client.fleetBoat.findMany({
      where: { id: { in: boatIds } },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const classById = new Map(classes.map((row) => [row.id, row]));
  const boatById = new Map(boats.map((row) => [row.id, row]));

  return ratings.map((rating) => ({
    ...rating,
    grantableClasses: dedupeById(
      classRules
        .filter((rule) => rule.sailingRatingId === rating.id)
        .map((rule) => (rule.classId ? classById.get(rule.classId) : undefined))
        .filter(isPresent)
    ),
    unlockedBoats: dedupeById(
      boatRules
        .filter((rule) => rule.sailingRatingId === rating.id)
        .map((rule) => (rule.boatId ? boatById.get(rule.boatId) : undefined))
        .filter(isPresent)
    ),
  }));
}

export const listPublicSailingRatings = cache(
  async (): Promise<PublicSailingRating[]> => {
    const rows = await listPublicSailingRatingsForClient(prisma);
    return rows;
  }
);

export async function listUserRatingAssignmentRows(
  userId: string,
  options: ListUserRatingAssignmentRowsOptions = {}
): Promise<UserRatingAssignmentRow[]> {
  const client = options.client ?? prisma;
  const publicRatingRows =
    options.client || options.includeDeprecated === false
      ? await listPublicSailingRatingsForClient(client, {
          includeDeprecated: options.includeDeprecated,
        })
      : await listPublicSailingRatings();
  const [grants, prerequisiteRules] = await Promise.all([
    client.userSailingRating.findMany({
      where: { userId },
      select: {
        sailingRatingId: true,
        issuedAt: true,
        issuedBy: { select: { name: true } },
      },
    }),
    client.sailingRatingRule.findMany({
      where: { ratingId: { not: null }, ruleType: 'requires' },
      select: {
        ratingId: true,
        groupKey: true,
        sailingRatingId: true,
        displayOrder: true,
      },
    }),
  ]);

  const activeIds = new Set(grants.map((row) => row.sailingRatingId));
  const grantByRatingId = new Map(
    grants.map((row) => [row.sailingRatingId, row])
  );
  return publicRatingRows.map((rating) => {
    const grant = grantByRatingId.get(rating.id);
    const rules = prerequisiteRules.filter(
      (rule) => rule.ratingId === rating.id
    );
    return {
      ...rating,
      issuedAt: grant?.issuedAt ?? null,
      issuedByName: grant?.issuedBy?.name ?? null,
      eligibility: evaluateSailingRatingGrantEligibility({
        rules,
        activeRatingIds: activeIds,
        alreadyGranted: Boolean(grant),
        isDeprecated: rating.isDeprecated,
      }),
    };
  });
}

export async function userCanGrantSailingRating(
  props: {
    userId: string;
    ratingId: string;
  },
  options: { client?: SailingRatingReadClient } = {}
): Promise<SailingRatingGrantEligibility | null> {
  const rows = await listUserRatingAssignmentRows(props.userId, {
    client: options.client,
  });
  return rows.find((row) => row.id === props.ratingId)?.eligibility ?? null;
}
