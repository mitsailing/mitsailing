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
  await db.publicSlug.deleteMany({
    where: {
      scope: options.scope,
      slug: options.currentSlug,
      sluggableId: options.sluggableId,
      sluggableType: options.sluggableType,
    },
  });

  if (options.previousSlug === options.currentSlug) {
    return;
  }

  await db.publicSlug.createMany({
    data: [
      {
        scope: options.scope,
        slug: options.previousSlug,
        sluggableId: options.sluggableId,
        sluggableType: options.sluggableType,
        source: options.source ?? 'automatic',
      },
    ],
    skipDuplicates: true,
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
