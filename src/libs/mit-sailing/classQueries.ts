import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { cacheDbListOrEmpty } from '@/libs/mit-sailing/cacheDbListOrEmpty';
import {
  hrefClassesCategoryFromSlug,
  mapNameSlugRowsToNavLinks,
} from '@/libs/mit-sailing/mapNavLinksFromNameSlug';
import { prismaOrderByDisplayOrderAscNameAsc } from '@/libs/mit-sailing/prismaOrderPublicNav';

export type CatalogClassCard = {
  id: string;
  name: string;
  slug: string;
  level: string;
  description: string;
};

export type CatalogCategorySection = {
  category: {
    id: string;
    slug: string;
    name: string;
    displayOrder: number;
  };
  classes: CatalogClassCard[];
};

export type ClassCategoryNavRow = {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
};

/**
 * Maps visible category rows (already ordered, e.g. by `displayOrder`) to header links.
 *
 * @param categories - Category rows from Prisma
 * @returns Dropdown items for the Classes nav (order preserved)
 */
export function mapClassCategoriesToNavDropdownItems(
  categories: readonly Pick<ClassCategoryNavRow, 'name' | 'slug'>[]
): { label: string; href: string }[] {
  return mapNameSlugRowsToNavLinks(categories, hrefClassesCategoryFromSlug);
}

// eslint-disable-next-line @typescript-eslint/promise-function-async -- thin Prisma wrapper
const loadClassCategoriesForNavUnchecked = (): Promise<ClassCategoryNavRow[]> =>
  prisma.classCategory.findMany({
    where: { isVisible: true },
    orderBy: prismaOrderByDisplayOrderAscNameAsc,
    select: { id: true, slug: true, name: true, displayOrder: true },
  });

/**
 * Visible categories for nav dropdown, ordered for display. Request-cached; returns
 * an empty list when the database read fails so the shell can still render.
 *
 * @returns Category rows for header dropdown
 */
export const listClassCategoriesForNav = cacheDbListOrEmpty(
  'class categories for site nav',
  loadClassCategoriesForNavUnchecked
);

/**
 * Group sailing classes by category for `/classes` (sections follow `displayOrder`).
 *
 * @returns Sections with anchored category slugs
 */
export async function listSailingClassesGroupedForCatalog(): Promise<
  CatalogCategorySection[]
> {
  const classes = await prisma.sailingClass.findMany({
    orderBy: [{ classCategory: { displayOrder: 'asc' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      description: true,
      classCategory: {
        select: {
          id: true,
          slug: true,
          name: true,
          displayOrder: true,
          isVisible: true,
        },
      },
    },
  });

  const sections: CatalogCategorySection[] = [];
  let current: CatalogCategorySection | undefined;

  for (const row of classes) {
    const cat = row.classCategory;
    if (!cat.isVisible) {
      continue;
    }
    const card: CatalogClassCard = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      level: row.level,
      description: row.description,
    };
    if (current && current.category.id === cat.id) {
      current.classes.push(card);
    } else {
      current = {
        category: {
          id: cat.id,
          slug: cat.slug,
          name: cat.name,
          displayOrder: cat.displayOrder,
        },
        classes: [card],
      };
      sections.push(current);
    }
  }

  return sections;
}

export type SailingClassCatalogDetail = {
  id: string;
  name: string;
  slug: string;
  level: string;
  description: string;
  classCategory: { name: string; slug: string };
  prerequisiteIds: string[];
  relatedEventIds: string[];
  unlockedBoatIds: string[];
  prerequisites: { id: string; name: string; slug: string }[];
  relatedEvents: { id: string; name: string; slug: string }[];
  unlockedBoats: {
    id: string;
    name: string;
    slug: string;
    description: string;
    type: string;
    capacity: number;
    imagePaths: string[];
  }[];
};

function orderByIdOrder<T extends { id: string }>(
  idsInOrder: string[],
  rows: T[]
): T[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  for (const id of idsInOrder) {
    const row = map.get(id);
    if (row) {
      out.push(row);
    }
  }
  return out;
}

/**
 * Published catalog detail for a sailing class (`null` when missing).
 *
 * @returns Resolved prerequisites, related events, and unlocked boats
 */
export const getSailingClassCatalogBySlug = cache(
  async (slug: string): Promise<SailingClassCatalogDetail | null> => {
    const decoded = decodeURIComponent(slug);
    const sailingClass = await prisma.sailingClass.findFirst({
      where: { slug: decoded },
      select: {
        id: true,
        name: true,
        slug: true,
        level: true,
        description: true,
        prerequisiteIds: true,
        relatedEventIds: true,
        unlockedBoatIds: true,
        classCategory: { select: { name: true, slug: true } },
      },
    });

    if (!sailingClass) {
      return null;
    }

    const [prereqClasses, relatedEvents, unlockedBoats] = await Promise.all([
      sailingClass.prerequisiteIds.length === 0
        ? Promise.resolve([] as { id: string; name: string; slug: string }[])
        : prisma.sailingClass.findMany({
            where: { id: { in: sailingClass.prerequisiteIds } },
            select: { id: true, name: true, slug: true },
          }),
      sailingClass.relatedEventIds.length === 0
        ? Promise.resolve([] as { id: string; name: string; slug: string }[])
        : prisma.event.findMany({
            where: {
              id: { in: sailingClass.relatedEventIds },
              isPublished: true,
            },
            select: { id: true, name: true, slug: true },
          }),
      sailingClass.unlockedBoatIds.length === 0
        ? Promise.resolve(
            [] as {
              id: string;
              name: string;
              slug: string;
              description: string;
              type: string;
              capacity: number;
              imagePaths: string[];
            }[]
          )
        : prisma.fleetBoat.findMany({
            where: { id: { in: sailingClass.unlockedBoatIds } },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              type: true,
              capacity: true,
              imagePaths: true,
            },
          }),
    ]);

    return {
      id: sailingClass.id,
      name: sailingClass.name,
      slug: sailingClass.slug,
      level: sailingClass.level,
      description: sailingClass.description,
      classCategory: sailingClass.classCategory,
      prerequisiteIds: sailingClass.prerequisiteIds,
      relatedEventIds: sailingClass.relatedEventIds,
      unlockedBoatIds: sailingClass.unlockedBoatIds,
      prerequisites: orderByIdOrder(
        sailingClass.prerequisiteIds,
        prereqClasses
      ),
      relatedEvents: orderByIdOrder(
        sailingClass.relatedEventIds,
        relatedEvents
      ),
      unlockedBoats: orderByIdOrder(
        sailingClass.unlockedBoatIds,
        unlockedBoats
      ),
    };
  }
);
