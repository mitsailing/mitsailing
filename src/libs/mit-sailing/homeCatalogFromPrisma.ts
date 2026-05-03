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
    where: {
      isVisible: true,
      classCategory: { slug: 'introduction' },
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      description: true,
      prerequisiteEdges: {
        where: { prerequisiteClass: { isVisible: true } },
        take: 1,
        orderBy: { prerequisiteClassId: 'asc' },
        select: { prerequisiteClassId: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    level: r.level,
    description: r.description,
    prerequisiteIds:
      r.prerequisiteEdges[0] === undefined
        ? []
        : [r.prerequisiteEdges[0].prerequisiteClassId],
  }));
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
    where: { slug: { in: [...orderedSlugs] }, isVisible: true },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      description: true,
      prerequisiteEdges: {
        where: { prerequisiteClass: { isVisible: true } },
        take: 1,
        orderBy: { prerequisiteClassId: 'asc' },
        select: { prerequisiteClassId: true },
      },
    },
  });
  const bySlug = new Map(classes.map((c) => [c.slug, c]));
  return orderedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      level: r.level,
      description: r.description,
      prerequisiteIds:
        r.prerequisiteEdges[0] === undefined
          ? []
          : [r.prerequisiteEdges[0].prerequisiteClassId],
    }));
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
    where: { id: { in: unique }, isVisible: true },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}
