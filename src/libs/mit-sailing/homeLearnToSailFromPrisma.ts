import 'server-only';
import { prisma } from '@/libs/DB';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';

/**
 * Introduction-category classes for the home Learn to Sail block.
 *
 * `description` is a plain excerpt (`catalogFieldUsesRichText('sailing_classes',
 * 'description')` is true, but home cards stay text-only for layout).
 *
 * @returns Intro sailing classes
 */
export async function loadHomeLearnToSailIntroductionClasses() {
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
    description: plainTextFromCmsRichTextHtml(r.description),
    prerequisiteIds:
      r.prerequisiteEdges[0] === undefined
        ? []
        : [r.prerequisiteEdges[0].prerequisiteClassId],
  }));
}

/**
 * Next classes for the home Learn to Sail block.
 *
 * `description` is a plain excerpt (see {@link loadHomeLearnToSailIntroductionClasses}).
 *
 * @param orderedSlugs - Slugs in display order
 * @returns Matching classes in the same order
 */
export async function loadHomeLearnToSailNextClassesBySlugs(
  orderedSlugs: readonly string[]
) {
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
      description: plainTextFromCmsRichTextHtml(r.description),
      prerequisiteIds:
        r.prerequisiteEdges[0] === undefined
          ? []
          : [r.prerequisiteEdges[0].prerequisiteClassId],
    }));
}

/**
 * Resolve prerequisite display for home Learn to Sail next cards.
 *
 * @param ids - Sailing class ids
 * @returns Map id to display name
 */
export async function loadHomeLearnToSailPrerequisiteNamesByIds(
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
