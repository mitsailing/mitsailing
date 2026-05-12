import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { cacheDbListOrEmpty } from '@/libs/mit-sailing/cacheDbListOrEmpty';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
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
  imagePath: string | null;
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

/**
 * Loads fleet rows; `description` is converted to plain excerpts for list cards
 * (`catalogFieldUsesRichText('fleet','description')` is true, but `/fleet` cards
 * stay text-only for layout and nested-link UX).
 *
 * @returns Fleet rows with plain-text description excerpts and required ratings
 */
async function loadFleetBoatsForPublicUnchecked(): Promise<FleetBoatListRow[]> {
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
        imagePath: true,
        requiredClass: { select: { name: true, slug: true } },
      },
    }),
    prisma.sailingRatingRule.findMany({
      where: {
        boatId: { not: null },
        ruleType: 'requires',
        sailingRating: { isVisible: true },
      },
      orderBy: [{ displayOrder: 'asc' }],
      select: {
        boatId: true,
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
    description: plainTextFromCmsRichTextHtml(boat.description),
    requiredRatings: rules
      .filter((rule) => rule.boatId === boat.id)
      .filter((rule) => !rule.sailingRating.isDeprecated)
      .filter((rule) => rule.groupKey !== 'advanced')
      .toSorted((a, b) => a.displayOrder - b.displayOrder)
      .map((rule) => rule.sailingRating),
  }));
}

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
  imagePath: string | null;
  requiredClass: { id: string; name: string; slug: string };
  requiredRatings: SailingRatingBrief[];
  advancedRatings: SailingRatingBrief[];
};

export const getFleetBoatForPublicBySlug = cache(
  async (slug: string): Promise<FleetBoatDetail | null> => {
    const boat = await prisma.fleetBoat.findFirst({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capacity: true,
        description: true,
        imagePath: true,
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
