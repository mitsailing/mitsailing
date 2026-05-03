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
    where: { isVisible: true },
    orderBy: [
      { classCategory: { displayOrder: 'asc' } },
      { displayOrder: 'asc' },
      { name: 'asc' },
    ],
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
      where: { slug: decoded, isVisible: true },
      select: {
        id: true,
        name: true,
        slug: true,
        level: true,
        description: true,
        classCategory: { select: { name: true, slug: true } },
        prerequisiteEdges: {
          where: { prerequisiteClass: { isVisible: true } },
          orderBy: { prerequisiteClass: { name: 'asc' } },
          select: {
            prerequisiteClass: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        relatedEvents: {
          where: { event: { isPublished: true } },
          orderBy: { event: { name: 'asc' } },
          select: {
            event: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        unlockedBoatLinks: {
          orderBy: { fleetBoat: { displayOrder: 'asc' } },
          select: {
            fleetBoat: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                type: true,
                capacity: true,
                imagePaths: true,
              },
            },
          },
        },
      },
    });

    if (!sailingClass) {
      return null;
    }

    const prerequisites = sailingClass.prerequisiteEdges.map(
      (e) => e.prerequisiteClass
    );
    const prerequisiteIds = prerequisites.map((p) => p.id);

    const relatedEvents = sailingClass.relatedEvents.map((r) => r.event);
    const relatedEventIds = relatedEvents.map((e) => e.id);

    const unlockedBoats = sailingClass.unlockedBoatLinks.map(
      (l) => l.fleetBoat
    );
    const unlockedBoatIds = unlockedBoats.map((b) => b.id);

    return {
      id: sailingClass.id,
      name: sailingClass.name,
      slug: sailingClass.slug,
      level: sailingClass.level,
      description: sailingClass.description,
      classCategory: sailingClass.classCategory,
      prerequisiteIds,
      relatedEventIds,
      unlockedBoatIds,
      prerequisites: orderByIdOrder(prerequisiteIds, prerequisites),
      relatedEvents: orderByIdOrder(relatedEventIds, relatedEvents),
      unlockedBoats: orderByIdOrder(unlockedBoatIds, unlockedBoats),
    };
  }
);
