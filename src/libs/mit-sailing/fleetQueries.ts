import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { cacheDbListOrEmpty } from '@/libs/mit-sailing/cacheDbListOrEmpty';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
import {
  hrefFleetBoatFromSlug,
  mapNameSlugRowsToNavLinks,
} from '@/libs/mit-sailing/mapNavLinksFromNameSlug';
import { listRequiredRatingsForTarget } from '@/libs/mit-sailing/sailingRatingQueries';
import type { SailingRatingBrief } from '@/libs/mit-sailing/sailingRatingQueries';
import {
  SITE_NAV_CACHE_REVALIDATE_SECONDS,
  siteNavFleetCacheTag,
} from '@/libs/mit-sailing/siteNavCache';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { lexicalToHtml } from '@/libs/payload/lexicalHtml';
import { firstMediaUrl, payloadIdString } from '@/libs/payload/mediaUrls';

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

type FleetBoatNavRow = Pick<FleetBoatListRow, 'id' | 'name' | 'slug'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredClassBrief(
  requiredClass: unknown
): { name: string; slug: string } | null {
  if (!isRecord(requiredClass)) {
    return null;
  }
  const { name, slug } = requiredClass;
  if (typeof name !== 'string' || typeof slug !== 'string') {
    return null;
  }
  return { name, slug };
}

function requiredClassDetail(
  requiredClass: unknown
): { id: string; name: string; slug: string } | null {
  if (!isRecord(requiredClass)) {
    return null;
  }
  const { id, name, slug } = requiredClass;
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof name !== 'string' ||
    typeof slug !== 'string'
  ) {
    return null;
  }
  return {
    id: payloadIdString(id),
    name,
    slug,
  };
}

/**
 * Maps fleet rows (already ordered) to header dropdown items.
 *
 * @param boats - Fleet rows from Payload
 * @returns Dropdown items for the Fleet nav (order preserved)
 */
export function mapFleetBoatsToNavDropdownItems(
  boats: readonly Pick<FleetBoatListRow, 'name' | 'slug'>[]
): { label: string; href: string }[] {
  return mapNameSlugRowsToNavLinks(boats, hrefFleetBoatFromSlug);
}

async function loadFleetBoatsForNavUnchecked(): Promise<FleetBoatNavRow[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'boats',
    depth: 0,
    limit: 500,
    overrideAccess: false,
    sort: 'displayOrder,name',
    where: {
      isVisible: { equals: true },
    },
  });
  return result.docs.map((boat) => ({
    id: payloadIdString(boat.id),
    name: boat.name,
    slug: boat.slug,
  }));
}

export const listFleetBoatsForNav = cacheDbListOrEmpty(
  'fleet boats for site nav',
  loadFleetBoatsForNavUnchecked,
  {
    keyParts: [siteNavFleetCacheTag],
    revalidate: SITE_NAV_CACHE_REVALIDATE_SECONDS,
    tags: [siteNavFleetCacheTag],
  }
);

/**
 * Loads fleet rows; `description` is converted to plain excerpts for list cards.
 *
 * @returns Fleet rows with plain-text description excerpts and required ratings
 */
async function loadFleetBoatsForPublicUnchecked(): Promise<FleetBoatListRow[]> {
  const payload = await getPayloadClient();
  const [boatsResult, rules] = await Promise.all([
    payload.find({
      collection: 'boats',
      depth: 1,
      limit: 500,
      overrideAccess: false,
      sort: 'displayOrder,name',
      where: {
        isVisible: { equals: true },
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
          },
        },
      },
    }),
  ]);

  const rows: FleetBoatListRow[] = [];
  for (const boat of boatsResult.docs) {
    const requiredClass = requiredClassBrief(boat.requiredClass);
    if (!requiredClass) {
      continue;
    }
    const id = payloadIdString(boat.id);
    const descriptionHtml = lexicalToHtml(boat.description);
    rows.push({
      capacity: boat.capacity,
      description: plainTextFromCmsRichTextHtml(descriptionHtml),
      id,
      imagePath: firstMediaUrl(boat.images),
      name: boat.name,
      requiredClass,
      requiredRatings: rules
        .filter((rule) => rule.boatId === id)
        .filter((rule) => rule.groupKey !== 'advanced')
        .toSorted((a, b) => a.displayOrder - b.displayOrder)
        .map((rule) => rule.sailingRating),
      slug: boat.slug,
      type: boat.type,
    });
  }
  return rows;
}

/**
 * All fleet boats for public list (single query). Request-cached; returns an
 * empty list when the database read fails so the shell can still render.
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
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'boats',
      depth: 1,
      limit: 1,
      overrideAccess: false,
      where: {
        and: [{ slug: { equals: slug } }, { isVisible: { equals: true } }],
      },
    });
    const [boat] = result.docs;
    if (!boat) {
      return null;
    }
    const requiredClass = requiredClassDetail(boat.requiredClass);
    if (!requiredClass) {
      return null;
    }
    const id = payloadIdString(boat.id);
    const ratingRules = await listRequiredRatingsForTarget({
      targetType: 'boat',
      targetId: id,
      ruleType: 'requires',
    });
    const sortedRatingRules = ratingRules.toSorted(
      (a, b) => a.displayOrder - b.displayOrder
    );
    return {
      advancedRatings: sortedRatingRules
        .filter((rule) => rule.groupKey === 'advanced')
        .map((rule) => rule.sailingRating),
      capacity: boat.capacity,
      description: lexicalToHtml(boat.description),
      id,
      imagePath: firstMediaUrl(boat.images),
      name: boat.name,
      requiredClass,
      requiredRatings: sortedRatingRules
        .filter((rule) => rule.groupKey !== 'advanced')
        .map((rule) => rule.sailingRating),
      slug: boat.slug,
      type: boat.type,
    };
  }
);
