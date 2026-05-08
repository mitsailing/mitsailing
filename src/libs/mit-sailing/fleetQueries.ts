import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { cacheDbListOrEmpty } from '@/libs/mit-sailing/cacheDbListOrEmpty';
import {
  hrefFleetBoatFromSlug,
  mapNameSlugRowsToNavLinks,
} from '@/libs/mit-sailing/mapNavLinksFromNameSlug';
import { prismaOrderByDisplayOrderAscNameAsc } from '@/libs/mit-sailing/prismaOrderPublicNav';
import { listRequiredRatingsForTarget } from '@/libs/mit-sailing/sailingRatingQueries';
import type { SailingRatingBrief } from '@/libs/mit-sailing/sailingRatingQueries';

export type FleetBoatListRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  description: string;
  requiredClass: { name: string; slug: string };
  requiredRatings: SailingRatingBrief[];
};

/**
 * Maps fleet rows (already ordered) to header dropdown items.
 *
 * @param boats - Fleet rows from Prisma
 * @returns Dropdown items for the Fleet nav (order preserved)
 */
export function mapFleetBoatsToNavDropdownItems(
  boats: readonly Pick<FleetBoatListRow, 'name' | 'slug'>[]
): { label: string; href: string }[] {
  return mapNameSlugRowsToNavLinks(boats, hrefFleetBoatFromSlug);
}

const loadFleetBoatsForPublicUnchecked = async (): Promise<
  FleetBoatListRow[]
> => {
  const [boats, rules] = await Promise.all([
    prisma.fleetBoat.findMany({
      orderBy: prismaOrderByDisplayOrderAscNameAsc,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capacity: true,
        description: true,
        requiredClass: { select: { name: true, slug: true } },
      },
    }),
    prisma.sailingRatingRule.findMany({
      where: { targetType: 'boat', ruleType: 'requires' },
      orderBy: [{ displayOrder: 'asc' }],
      select: {
        targetId: true,
        groupKey: true,
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
    }),
  ]);
  return boats.map((boat) => ({
    ...boat,
    requiredRatings: rules
      .filter((rule) => rule.targetId === boat.id)
      .filter((rule) => rule.groupKey !== 'advanced')
      .toSorted((a, b) => a.displayOrder - b.displayOrder)
      .map((rule) => rule.sailingRating),
  }));
};

/**
 * All fleet boats for public list (single query). Request-cached; returns an
 * empty list when the database read fails so the shell can still render.
 * Ordered by `displayOrder`, then `name` (aligned with class category ordering).
 *
 * @returns Fleet rows with required class label
 */
export const listFleetBoatsForPublic = cacheDbListOrEmpty(
  'fleet boats for public list',
  loadFleetBoatsForPublicUnchecked
);

export type FleetBoatDetail = {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  description: string;
  imagePaths: string[];
  requiredClass: { id: string; name: string; slug: string };
  requiredRatings: SailingRatingBrief[];
  advancedRatings: SailingRatingBrief[];
};

export const getFleetBoatForPublicBySlug = cache(
  async (slug: string): Promise<FleetBoatDetail | null> => {
    const decoded = decodeURIComponent(slug);
    const boat = await prisma.fleetBoat.findFirst({
      where: { slug: decoded },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capacity: true,
        description: true,
        imagePaths: true,
        requiredClass: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!boat) {
      return null;
    }
    const ratingRules = await listRequiredRatingsForTarget({
      targetType: 'boat',
      targetId: boat.id,
      ruleType: 'requires',
    });
    const sortedRatingRules = ratingRules.toSorted(
      (a, b) => a.displayOrder - b.displayOrder
    );
    return {
      ...boat,
      requiredRatings: sortedRatingRules
        .filter((rule) => rule.groupKey !== 'advanced')
        .map((rule) => rule.sailingRating),
      advancedRatings: sortedRatingRules
        .filter((rule) => rule.groupKey === 'advanced')
        .map((rule) => rule.sailingRating),
    };
  }
);
