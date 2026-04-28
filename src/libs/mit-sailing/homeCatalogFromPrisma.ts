import { prisma } from '@/libs/DB';

/**
 * Featured fleet rows for the home page (stable slug order).
 *
 * @param orderedSlugs - Slugs in display order
 * @returns Matching boats in the same order
 */
export async function loadHomeFeaturedFleetBoats(
  orderedSlugs: readonly string[]
) {
  if (orderedSlugs.length === 0) {
    return [];
  }
  const boats = await prisma.fleetBoat.findMany({
    where: { slug: { in: [...orderedSlugs] } },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      capacity: true,
      description: true,
      imagePaths: true,
      requiredClassId: true,
      requiredClass: { select: { id: true, name: true, slug: true } },
    },
  });
  const bySlug = new Map(boats.map((b) => [b.slug, b]));
  return orderedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);
}

/**
 * Introduction-category classes for the home page grid.
 *
 * @returns Intro sailing classes
 */
export async function loadHomeIntroductionClasses() {
  const rows = await prisma.sailingClass.findMany({
    where: { classCategory: { slug: 'introduction' } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      description: true,
      prerequisiteIds: true,
    },
  });
  return rows;
}

/**
 * “Next” classes on the home page (stable slug order).
 *
 * @param orderedSlugs - Slugs in display order
 * @returns Matching classes in the same order
 */
export async function loadHomeClassesBySlugs(orderedSlugs: readonly string[]) {
  if (orderedSlugs.length === 0) {
    return [];
  }
  const classes = await prisma.sailingClass.findMany({
    where: { slug: { in: [...orderedSlugs] } },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      description: true,
      prerequisiteIds: true,
    },
  });
  const bySlug = new Map(classes.map((c) => [c.slug, c]));
  return orderedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
}

/**
 * Resolve prerequisite display for home “next” cards (first prerequisite name).
 *
 * @param ids - Sailing class ids
 * @returns Map id → display name
 */
export async function loadSailingClassNamesByIds(
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const unique = [...new Set(ids)];
  const rows = await prisma.sailingClass.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}
