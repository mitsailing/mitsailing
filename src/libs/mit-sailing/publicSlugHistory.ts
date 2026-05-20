import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';

type PublicSlugScope = 'classes' | 'cms' | 'events' | 'fleet';
export type PublicSluggableType =
  | 'CmsPage'
  | 'Event'
  | 'FleetBoat'
  | 'SailingClass';
type PublicSlugSource = 'automatic' | 'manual' | 'migration';

type PublicSlugDb = typeof prisma | Prisma.TransactionClient;

type PublicSlugHistoryOptions = {
  currentSlug: string;
  db?: PublicSlugDb;
  previousSlug: string;
  scope: PublicSlugScope;
  sluggableId: string;
  sluggableType: PublicSluggableType;
  source?: PublicSlugSource;
};

export async function recordPublicSlugHistory(
  options: PublicSlugHistoryOptions
): Promise<void> {
  const db = options.db ?? prisma;
  const slugsToDelete = [options.currentSlug];
  if (options.previousSlug !== options.currentSlug) {
    slugsToDelete.push(options.previousSlug);
  }
  await db.publicSlug.deleteMany({
    where: {
      scope: options.scope,
      slug: { in: slugsToDelete },
    },
  });

  if (options.previousSlug === options.currentSlug) {
    return;
  }

  const source = options.source ?? 'automatic';
  await db.publicSlug.upsert({
    create: {
      scope: options.scope,
      slug: options.previousSlug,
      sluggableId: options.sluggableId,
      sluggableType: options.sluggableType,
      source,
    },
    update: {
      sluggableId: options.sluggableId,
      source,
    },
    where: {
      slug_sluggableType_scope: {
        scope: options.scope,
        slug: options.previousSlug,
        sluggableType: options.sluggableType,
      },
    },
  });
}

export async function deletePublicSlugHistoryForTarget(options: {
  db?: PublicSlugDb;
  sluggableId: string;
  sluggableType: PublicSluggableType;
}): Promise<void> {
  const db = options.db ?? prisma;
  await db.publicSlug.deleteMany({
    where: {
      sluggableId: options.sluggableId,
      sluggableType: options.sluggableType,
    },
  });
}
