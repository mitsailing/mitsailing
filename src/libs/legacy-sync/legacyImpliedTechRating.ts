import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import {
  catalogRatingIdsImplyingTech,
  SWIM_CATALOG_RATING_ID,
  TECH_CATALOG_RATING_ID,
} from '@/libs/legacy-sync/legacyRatingCatalogMap';

export type LegacyUserRatingGrantRow = {
  readonly id: string;
  readonly issuedAt: Date;
  readonly issuedByUserId: string;
  readonly sailingRatingId: string;
  readonly userId: string;
};

type LegacyImpliedTechRatingDb = Pick<Prisma.TransactionClient, '$executeRaw'>;

/**
 * Adds tech rating rows for non-swim grants imported in the same batch.
 *
 * @param rows - User rating grant rows from the current import batch
 * @returns Grant rows including any implied tech ratings
 */
export function appendImpliedTechRatingRows(
  rows: readonly LegacyUserRatingGrantRow[]
): LegacyUserRatingGrantRow[] {
  const implyingTech = new Set(catalogRatingIdsImplyingTech());
  const usersWithTech = new Set(
    rows
      .filter((row) => row.sailingRatingId === TECH_CATALOG_RATING_ID)
      .map((row) => row.userId)
  );
  const implied: LegacyUserRatingGrantRow[] = [];
  for (const row of rows) {
    if (
      row.sailingRatingId === SWIM_CATALOG_RATING_ID ||
      !implyingTech.has(row.sailingRatingId) ||
      row.sailingRatingId === TECH_CATALOG_RATING_ID ||
      usersWithTech.has(row.userId)
    ) {
      continue;
    }
    implied.push({
      id: randomUUID(),
      userId: row.userId,
      issuedByUserId: row.issuedByUserId,
      sailingRatingId: TECH_CATALOG_RATING_ID,
      issuedAt: row.issuedAt,
    });
    usersWithTech.add(row.userId);
  }
  return [...rows, ...implied];
}

/**
 * Backfills tech rating grants for sailors who already have a catalog grant
 * that implies tech but no explicit tech / learn-to-sail row in Pavilion.
 *
 * @param props - Database client for raw SQL inserts
 * @returns Number of tech rating rows inserted
 */
export async function backfillImpliedTechRatingGrants(props: {
  readonly db: LegacyImpliedTechRatingDb;
}): Promise<number> {
  const catalogIds = catalogRatingIdsImplyingTech();
  if (catalogIds.length === 0) {
    return 0;
  }

  const inserted = await props.db.$executeRaw`
    INSERT INTO user_sailing_ratings (
      id,
      user_id,
      sailing_rating_id,
      issued_by_user_id,
      issued_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid()::text,
      source.user_id,
      ${TECH_CATALOG_RATING_ID},
      source.issued_by_user_id,
      source.issued_at,
      NOW(),
      NOW()
    FROM (
      SELECT DISTINCT ON (usr.user_id)
        usr.user_id,
        usr.issued_by_user_id,
        usr.issued_at
      FROM user_sailing_ratings AS usr
      INNER JOIN sailing_ratings AS sr ON sr.id = usr.sailing_rating_id
      WHERE sr.id = ANY(${catalogIds}::text[])
      ORDER BY usr.user_id, usr.issued_at ASC, usr.id ASC
    ) AS source
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_sailing_ratings AS existing
      WHERE existing.user_id = source.user_id
        AND existing.sailing_rating_id = ${TECH_CATALOG_RATING_ID}
    )
  `;
  return Number(inserted);
}
