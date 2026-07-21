import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import {
  appendImpliedTechRatingRows,
  backfillImpliedTechRatingGrants,
} from '@/libs/legacy-sync/legacyImpliedTechRating';
import { legacyImportTransactionOptions } from '@/libs/legacy-sync/legacyImportTransaction';
import { loadLegacyUserIdentityMaps } from '@/libs/legacy-sync/legacyMemberIdentity';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyMemberIdentity';
import type { LegacyMysqlReader } from '@/libs/legacy-sync/legacyMysqlReader';
import { legacyMysqlReaderFromEnv } from '@/libs/legacy-sync/legacyMysqlReader';
import { legacyRatingCatalogId } from '@/libs/legacy-sync/legacyRatingCatalogMap';
import { reconcileLegacyRatingCatalogGrants } from '@/libs/legacy-sync/legacyRatingCatalogReconcile';

export type LegacyRatingTypeRow = {
  readonly basic_opt: string | null;
  readonly name: string | null;
  readonly rank: string | null;
  readonly status: string | null;
  readonly type: string | null;
};

export type LegacyRatingRow = {
  readonly basic: string | null;
  readonly eval_date: string | null;
  readonly eval_id: string | null;
  readonly id: string | null;
  readonly rating_type: string | null;
};

type LegacyRatingImportDb = Pick<
  Prisma.TransactionClient,
  '$executeRaw' | '$queryRaw' | 'sailingRating' | 'userSailingRating'
>;

export type LegacyRatingImportResult = {
  readonly catalogGrantsMoved: number;
  readonly catalogDuplicatesRemoved: number;
  readonly legacyCatalogRowsHidden: number;
  readonly ratingTypesImported: number;
  readonly techRatingsImplied: number;
  readonly userRatingsImported: number;
  readonly userRatingsSkipped: number;
};

const FALLBACK_RATING_DISPLAY_ORDER = 999;

function stringValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function positiveInt(value: string | null | undefined): number {
  const parsed = Number(stringValue(value));
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : FALLBACK_RATING_DISPLAY_ORDER;
}

function slugPart(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');
  return slug || 'legacy-rating';
}

function legacyRatingSlug(row: LegacyRatingTypeRow): string {
  const type = stringValue(row.type);
  const digest = createHash('sha256').update(type).digest('hex').slice(0, 8);
  return `legacy-${digest}-${slugPart(stringValue(row.name))}`;
}

function parseLegacyDate(value: string | null | undefined): Date | null {
  const normalized = stringValue(value);
  if (normalized === '') {
    return null;
  }
  const parsed = new Date(`${normalized.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function importRatingTypes(props: {
  readonly db: LegacyRatingImportDb;
  readonly ratingTypes: readonly LegacyRatingTypeRow[];
}) {
  const sailingRatingIdByLegacyType = new Map<string, string>();
  const catalogSeenActive = new Map<string, boolean>();
  for (const row of props.ratingTypes) {
    const legacyRatingType = stringValue(row.type);
    if (!legacyRatingType) {
      continue;
    }
    const catalogId = legacyRatingCatalogId(legacyRatingType);
    if (!catalogId) {
      continue;
    }
    const isActive = stringValue(row.status) === '1';
    catalogSeenActive.set(
      catalogId,
      (catalogSeenActive.get(catalogId) ?? false) || isActive
    );
  }

  let imported = 0;
  for (const row of props.ratingTypes) {
    const legacyRatingType = stringValue(row.type);
    if (!legacyRatingType) {
      continue;
    }
    const catalogId = legacyRatingCatalogId(legacyRatingType);
    if (catalogId) {
      await props.db.sailingRating.update({
        where: { id: catalogId },
        data: {
          isDeprecated: !(catalogSeenActive.get(catalogId) ?? false),
        },
      });
      sailingRatingIdByLegacyType.set(legacyRatingType, catalogId);
      imported += 1;
      continue;
    }

    const name = stringValue(row.name) || `Legacy rating ${legacyRatingType}`;
    const rating = await props.db.sailingRating.upsert({
      where: { legacyRatingType },
      create: {
        id: randomUUID(),
        legacyRatingType,
        slug: legacyRatingSlug(row),
        name,
        shortName: name,
        description: `Imported legacy rating type ${legacyRatingType}.`,
        category: null,
        level: null,
        windCondition: null,
        guideUrl: null,
        displayOrder: positiveInt(row.rank),
        isVisible: false,
        isDeprecated: stringValue(row.status) !== '1',
      },
      update: {
        name,
        shortName: name,
        displayOrder: positiveInt(row.rank),
        isVisible: false,
        isDeprecated: stringValue(row.status) !== '1',
      },
      select: { id: true },
    });
    sailingRatingIdByLegacyType.set(legacyRatingType, rating.id);
    imported += 1;
  }
  return { imported, sailingRatingIdByLegacyType };
}

async function importUserRatings(props: {
  readonly db: LegacyRatingImportDb;
  readonly members: readonly LegacyMemberRow[];
  readonly ratings: readonly LegacyRatingRow[];
  readonly sailingRatingIdByLegacyType: ReadonlyMap<string, string>;
}) {
  const { legacyMemberIdToUserId } = await loadLegacyUserIdentityMaps({
    db: props.db,
    members: props.members,
  });
  const sourceRows = props.ratings.flatMap((row) => {
    const userId = legacyMemberIdToUserId.get(stringValue(row.id));
    const issuedByUserId = legacyMemberIdToUserId.get(stringValue(row.eval_id));
    const sailingRatingId = props.sailingRatingIdByLegacyType.get(
      stringValue(row.rating_type)
    );
    const issuedAt = parseLegacyDate(row.eval_date);
    if (!userId || !issuedByUserId || !sailingRatingId || !issuedAt) {
      return [];
    }
    return [
      {
        id: randomUUID(),
        userId,
        issuedByUserId,
        sailingRatingId,
        issuedAt,
      },
    ];
  });
  const rows = appendImpliedTechRatingRows(sourceRows);
  if (rows.length > 0) {
    await props.db.userSailingRating.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
  return {
    imported: rows.length,
    skipped: props.ratings.length - sourceRows.length,
  };
}

async function importUserRatingsWithImpliedTech(props: {
  readonly db: LegacyRatingImportDb;
  readonly members: readonly LegacyMemberRow[];
  readonly ratings: readonly LegacyRatingRow[];
  readonly sailingRatingIdByLegacyType: ReadonlyMap<string, string>;
}) {
  const userRatings = await importUserRatings(props);
  const techRatingsImplied = await backfillImpliedTechRatingGrants({
    db: props.db,
  });
  return {
    ...userRatings,
    techRatingsImplied,
  };
}

export async function importLegacyRatingRows(props: {
  readonly ratingTypes: readonly LegacyRatingTypeRow[];
  readonly ratings: readonly LegacyRatingRow[];
  readonly members: readonly LegacyMemberRow[];
}): Promise<LegacyRatingImportResult> {
  const result = await prisma.$transaction(async (tx) => {
    const db: LegacyRatingImportDb = tx;
    const catalogReconcile = await reconcileLegacyRatingCatalogGrants({ db });
    const ratingTypes = await importRatingTypes({
      db,
      ratingTypes: props.ratingTypes,
    });
    const userRatings = await importUserRatingsWithImpliedTech({
      db,
      members: props.members,
      ratings: props.ratings,
      sailingRatingIdByLegacyType: ratingTypes.sailingRatingIdByLegacyType,
    });
    return {
      catalogGrantsMoved: catalogReconcile.grantsMoved,
      catalogDuplicatesRemoved: catalogReconcile.duplicatesRemoved,
      legacyCatalogRowsHidden: catalogReconcile.legacyRowsHidden,
      ratingTypesImported: ratingTypes.imported,
      techRatingsImplied: userRatings.techRatingsImplied,
      userRatingsImported: userRatings.imported,
      userRatingsSkipped: userRatings.skipped,
    };
  }, legacyImportTransactionOptions);
  return result;
}

export async function importLegacyRatings(
  reader: LegacyMysqlReader = legacyMysqlReaderFromEnv()
): Promise<LegacyRatingImportResult> {
  const [ratingTypes, ratings, members] = await Promise.all([
    reader.fetchRatingTypes(),
    reader.fetchRatings(),
    reader.fetchActiveMembers(),
  ]);
  return importLegacyRatingRows({ members, ratingTypes, ratings });
}
