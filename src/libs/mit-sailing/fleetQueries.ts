import { cache } from 'react';
import { prisma } from '@/libs/DB';

export type FleetBoatListRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  description: string;
  requiredClass: { name: string; slug: string };
};

/**
 * All fleet boats for public list (single query).
 *
 * @returns Fleet rows with required class label
 */
export async function listFleetBoatsForPublic(): Promise<FleetBoatListRow[]> {
  const rows = await prisma.fleetBoat.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      capacity: true,
      description: true,
      requiredClass: { select: { name: true, slug: true } },
    },
  });
  return rows;
}

export type FleetBoatDetail = {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  description: string;
  imagePaths: string[];
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
        imagePaths: true,
        requiredClass: { select: { id: true, name: true, slug: true } },
      },
    });
    return boat;
  }
);
