import { cache } from 'react';
import { prisma } from '@/libs/DB';
import { cacheDbListOrEmpty } from '@/libs/mit-sailing/cacheDbListOrEmpty';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
import {
  hrefClassesCategoryFromSlug,
  mapNameSlugRowsToNavLinks,
} from '@/libs/mit-sailing/mapNavLinksFromNameSlug';
import { listRequiredRatingsForTarget } from '@/libs/mit-sailing/sailingRatingQueries';
import type { SailingRatingBrief } from '@/libs/mit-sailing/sailingRatingQueries';
import {
  SITE_NAV_CACHE_REVALIDATE_SECONDS,
  siteNavClassesCacheTag,
} from '@/libs/mit-sailing/siteNavCache';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { lexicalToHtml } from '@/libs/payload/lexicalHtml';
import { mediaUrls, payloadIdString } from '@/libs/payload/mediaUrls';

export type CatalogClassCard = {
  id: string;
  name: string;
  slug: string;
  level: string;
  description: string;
  imagePaths: string[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Maps visible category rows (already ordered, e.g. by `displayOrder`) to header links.
 *
 * @param categories - Category rows from Payload
 * @returns Dropdown items for the Classes nav (order preserved)
 */
export function mapClassCategoriesToNavDropdownItems(
  categories: readonly Pick<ClassCategoryNavRow, 'name' | 'slug'>[]
): { label: string; href: string }[] {
  return mapNameSlugRowsToNavLinks(categories, hrefClassesCategoryFromSlug);
}

async function loadClassCategoriesForNavUnchecked(): Promise<
  ClassCategoryNavRow[]
> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'class-categories',
    depth: 0,
    limit: 200,
    overrideAccess: false,
    sort: 'displayOrder,name',
    where: {
      isVisible: { equals: true },
    },
  });
  return result.docs.map((row) => ({
    displayOrder: row.displayOrder,
    id: payloadIdString(row.id),
    name: row.name,
    slug: row.slug,
  }));
}

/**
 * Visible categories for nav dropdown, ordered for display. Request-cached; returns
 * an empty list when the database read fails so the shell can still render.
 *
 * @returns Category rows for header dropdown
 */
export const listClassCategoriesForNav = cacheDbListOrEmpty(
  'class categories for site nav',
  loadClassCategoriesForNavUnchecked,
  {
    keyParts: [siteNavClassesCacheTag],
    revalidate: SITE_NAV_CACHE_REVALIDATE_SECONDS,
    tags: [siteNavClassesCacheTag],
  }
);

function categorySection(
  category: unknown
): CatalogCategorySection['category'] | null {
  if (!isRecord(category)) {
    return null;
  }
  const { displayOrder, id, isVisible, name, slug } = category;
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof name !== 'string' ||
    typeof slug !== 'string' ||
    typeof displayOrder !== 'number' ||
    isVisible === false
  ) {
    return null;
  }
  return {
    displayOrder,
    id: payloadIdString(id),
    name,
    slug,
  };
}

/**
 * Group sailing classes by category for `/classes` (sections follow `displayOrder`).
 *
 * @returns Sections with anchored category slugs
 */
export async function listSailingClassesGroupedForCatalog(): Promise<
  CatalogCategorySection[]
> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'classes',
    depth: 1,
    limit: 500,
    overrideAccess: false,
    sort: 'displayOrder,name',
    where: {
      isVisible: { equals: true },
    },
  });

  const byCategory = new Map<string, CatalogCategorySection>();
  for (const row of result.docs) {
    const category = categorySection(row.category);
    if (!category) {
      continue;
    }
    const card: CatalogClassCard = {
      description: plainTextFromCmsRichTextHtml(lexicalToHtml(row.description)),
      id: payloadIdString(row.id),
      imagePaths: mediaUrls(row.images),
      level: row.level,
      name: row.name,
      slug: row.slug,
    };
    const existing = byCategory.get(category.id);
    if (existing) {
      existing.classes.push(card);
    } else {
      byCategory.set(category.id, { category, classes: [card] });
    }
  }

  return [...byCategory.values()].toSorted(
    (a, b) =>
      a.category.displayOrder - b.category.displayOrder ||
      a.category.name.localeCompare(b.category.name)
  );
}

export type SailingClassCatalogDetail = {
  id: string;
  name: string;
  slug: string;
  level: string;
  /** CMS-authored HTML; sanitize in the class detail view before rich text render. */
  description: string;
  imagePaths: string[];
  classCategory: { name: string; slug: string };
  prerequisiteIds: string[];
  relatedEventIds: string[];
  unlockedBoatIds: string[];
  prerequisites: { id: string; name: string; slug: string }[];
  requiredRatings: SailingRatingBrief[];
  grantableRatings: SailingRatingBrief[];
  relatedEvents: { id: string; name: string; slug: string }[];
  unlockedBoats: {
    id: string;
    name: string;
    slug: string;
    /** Fleet boat CMS HTML; sanitize in the class detail view (catalog `richText`). */
    description: string;
    type: string;
    capacity: number;
    imagePath: string | null;
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

function namedSlugFromRelation(value: unknown): {
  id: string;
  name: string;
  slug: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, name, slug } = value;
  if (
    id === undefined ||
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

function unlockedBoatFromRelation(value: unknown): {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  capacity: number;
  imagePath: string | null;
} | null {
  if (!isRecord(value)) {
    return null;
  }
  const { capacity, description, id, images, name, slug, type } = value;
  if (
    id === undefined ||
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof name !== 'string' ||
    typeof slug !== 'string' ||
    typeof type !== 'string' ||
    typeof capacity !== 'number'
  ) {
    return null;
  }
  return {
    capacity,
    description: lexicalToHtml(description),
    id: payloadIdString(id),
    imagePath: mediaUrls(images)[0] ?? null,
    name,
    slug,
    type,
  };
}

/**
 * Published catalog detail for a sailing class (`null` when missing).
 *
 * @returns Resolved prerequisites, related events, and unlocked boats
 */
export const getSailingClassCatalogBySlug = cache(
  async (slug: string): Promise<SailingClassCatalogDetail | null> => {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'classes',
      depth: 2,
      limit: 1,
      overrideAccess: false,
      where: {
        and: [{ slug: { equals: slug } }, { isVisible: { equals: true } }],
      },
    });
    const [sailingClass] = result.docs;
    if (!sailingClass) {
      return null;
    }

    const { category } = sailingClass;
    if (
      typeof category !== 'object' ||
      category === null ||
      typeof category.name !== 'string' ||
      typeof category.slug !== 'string'
    ) {
      return null;
    }

    const id = payloadIdString(sailingClass.id);
    const prerequisiteRelations = Array.isArray(sailingClass.prerequisites)
      ? sailingClass.prerequisites
      : [];
    const prerequisites = prerequisiteRelations
      .map((item) => namedSlugFromRelation(item))
      .filter(
        (
          item: ReturnType<typeof namedSlugFromRelation>
        ): item is NonNullable<typeof item> => item !== null
      )
      .toSorted(
        (
          a: { id: string; name: string; slug: string },
          b: { id: string; name: string; slug: string }
        ) => a.name.localeCompare(b.name)
      );
    const prerequisiteIds = prerequisites.map(
      (p: { id: string; name: string; slug: string }) => p.id
    );

    const unlockedBoatRelations = Array.isArray(sailingClass.unlockedBoats)
      ? sailingClass.unlockedBoats
      : [];
    const unlockedBoats = unlockedBoatRelations
      .map((item) => unlockedBoatFromRelation(item))
      .filter(
        (
          item: ReturnType<typeof unlockedBoatFromRelation>
        ): item is NonNullable<typeof item> => item !== null
      );
    const unlockedBoatIds = unlockedBoats.map((b: { id: string }) => b.id);

    const relatedEventLinks = await prisma.sailingClassRelatedEvent.findMany({
      where: { sailingClassId: id },
      orderBy: { event: { name: 'asc' } },
      select: {
        event: {
          select: { id: true, name: true, slug: true, isPublished: true },
        },
      },
    });
    const relatedEvents = relatedEventLinks
      .map((link) => link.event)
      .filter((event) => event.isPublished)
      .map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
      }));
    const relatedEventIds = relatedEvents.map((e) => e.id);

    const [requiredRatingRules, grantableRatingRules] = await Promise.all([
      listRequiredRatingsForTarget({
        targetType: 'class',
        targetId: id,
        ruleType: 'requires',
      }),
      listRequiredRatingsForTarget({
        targetType: 'class',
        targetId: id,
        ruleType: 'grants',
      }),
    ]);

    return {
      classCategory: { name: category.name, slug: category.slug },
      description: lexicalToHtml(sailingClass.description),
      grantableRatings: grantableRatingRules
        .toSorted((a, b) => a.displayOrder - b.displayOrder)
        .map((rule) => rule.sailingRating),
      id,
      imagePaths: mediaUrls(sailingClass.images),
      level: sailingClass.level,
      name: sailingClass.name,
      prerequisiteIds,
      prerequisites: orderByIdOrder(prerequisiteIds, prerequisites),
      relatedEventIds,
      relatedEvents: orderByIdOrder(relatedEventIds, relatedEvents),
      requiredRatings: requiredRatingRules
        .toSorted((a, b) => a.displayOrder - b.displayOrder)
        .map((rule) => rule.sailingRating),
      slug: sailingClass.slug,
      unlockedBoatIds,
      unlockedBoats: orderByIdOrder(unlockedBoatIds, unlockedBoats),
    };
  }
);
