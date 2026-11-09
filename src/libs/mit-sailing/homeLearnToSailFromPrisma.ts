import 'server-only';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { lexicalToHtml } from '@/libs/payload/lexicalHtml';
import { payloadIdString } from '@/libs/payload/mediaUrls';

type HomeLearnToSailClassCard = {
  id: string;
  name: string;
  slug: string;
  level: string;
  description: string;
  prerequisiteIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstPrerequisiteId(
  prerequisites: readonly unknown[] | null | undefined
): string[] {
  if (!prerequisites || prerequisites.length === 0) {
    return [];
  }
  for (const item of prerequisites) {
    if (isRecord(item) && item.id !== undefined) {
      if (item.isVisible === false) {
        continue;
      }
      const { id } = item;
      if (typeof id === 'string' || typeof id === 'number') {
        return [payloadIdString(id)];
      }
    }
    if (typeof item === 'string' || typeof item === 'number') {
      return [payloadIdString(item)];
    }
  }
  return [];
}

type PayloadHomeClassDoc = {
  id: number | string;
  name: string;
  slug: string;
  level: string;
  description: unknown;
  prerequisites?: readonly unknown[] | null;
};

function mapHomeClassCard(row: PayloadHomeClassDoc): HomeLearnToSailClassCard {
  return {
    description: plainTextFromCmsRichTextHtml(lexicalToHtml(row.description)),
    id: payloadIdString(row.id),
    level: row.level,
    name: row.name,
    prerequisiteIds: firstPrerequisiteId(row.prerequisites),
    slug: row.slug,
  };
}

function asHomeClassDoc(row: unknown): PayloadHomeClassDoc | null {
  if (!isRecord(row)) {
    return null;
  }
  if (
    (typeof row.id !== 'string' && typeof row.id !== 'number') ||
    typeof row.name !== 'string' ||
    typeof row.slug !== 'string' ||
    typeof row.level !== 'string'
  ) {
    return null;
  }
  return {
    description: row.description,
    id: row.id,
    level: row.level,
    name: row.name,
    prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites : null,
    slug: row.slug,
  };
}

/**
 * Introduction-category classes for the home Learn to Sail block.
 *
 * `description` is a plain excerpt (home cards stay text-only for layout).
 *
 * @returns Intro sailing classes
 */
export async function loadHomeLearnToSailIntroductionClasses() {
  const payload = await getPayloadClient();
  const categories = await payload.find({
    collection: 'class-categories',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    where: {
      and: [
        { slug: { equals: 'introduction' } },
        { isVisible: { equals: true } },
      ],
    },
  });
  const [category] = categories.docs;
  if (!category) {
    return [];
  }

  const classes = await payload.find({
    collection: 'classes',
    depth: 1,
    limit: 100,
    overrideAccess: false,
    sort: 'displayOrder,name',
    where: {
      and: [
        { isVisible: { equals: true } },
        { category: { equals: category.id } },
      ],
    },
  });

  return classes.docs
    .map((row) => asHomeClassDoc(row))
    .filter((row): row is PayloadHomeClassDoc => row !== null)
    .map((row) => mapHomeClassCard(row));
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
  const payload = await getPayloadClient();
  const classes = await payload.find({
    collection: 'classes',
    depth: 1,
    limit: orderedSlugs.length,
    overrideAccess: false,
    where: {
      and: [
        { isVisible: { equals: true } },
        { slug: { in: [...orderedSlugs] } },
      ],
    },
  });
  const mapped = classes.docs
    .map((row) => asHomeClassDoc(row))
    .filter((row): row is PayloadHomeClassDoc => row !== null);
  const bySlug = new Map(mapped.map((row) => [row.slug, row]));
  return orderedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((row): row is PayloadHomeClassDoc => row !== undefined)
    .map((row) => mapHomeClassCard(row));
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
  const payload = await getPayloadClient();
  const rows = await payload.find({
    collection: 'classes',
    depth: 0,
    limit: unique.length,
    overrideAccess: false,
    where: {
      and: [
        { isVisible: { equals: true } },
        {
          or: unique.map((id) => ({
            id: { equals: id },
          })),
        },
      ],
    },
  });
  const names = new Map<string, string>();
  for (const row of rows.docs) {
    const doc = asHomeClassDoc(row);
    if (doc) {
      names.set(payloadIdString(doc.id), doc.name);
    }
  }
  return names;
}
