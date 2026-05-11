import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { cacheDbListOrEmpty } from '@/libs/mit-sailing/cacheDbListOrEmpty';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
import {
  hrefFleetBoatFromSlug,
  mapNameSlugRowsToNavLinks,
} from '@/libs/mit-sailing/mapNavLinksFromNameSlug';
import { prismaOrderByDisplayOrderAscNameAsc } from '@/libs/mit-sailing/prismaOrderPublicNav';

export type FleetBoatListRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  description: string;
  imagePath: string | null;
  requiredClass: { name: string; slug: string };
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

async function loadFleetBoatsForPublicUnchecked(): Promise<FleetBoatListRow[]> {
  const rows = await prisma.fleetBoat.findMany({
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
  });
  return rows.map((row) => ({
    ...row,
    description: plainTextFromCmsRichTextHtml(row.description),
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
        imagePath: true,
        requiredClass: { select: { id: true, name: true, slug: true } },
      },
    });
    return boat;
  }
);
