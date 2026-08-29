import { Prisma } from '@/generated/prisma/client';
import {
  LEGACY_RATING_TYPE_TO_CATALOG_ID,
  mappedLegacyRatingTypes,
} from '@/libs/legacy-sync/legacyRatingCatalogMap';

type LegacyRatingCatalogReconcileDb = Pick<
  Prisma.TransactionClient,
  '$executeRaw' | 'sailingRating'
>;

export type LegacyRatingCatalogReconcileResult = {
  readonly grantsMoved: number;
  readonly duplicatesRemoved: number;
  readonly legacyRowsHidden: number;
};

function catalogMapSqlValues(): Prisma.Sql {
  const entries = Object.entries(LEGACY_RATING_TYPE_TO_CATALOG_ID);
  if (entries.length === 0) {
    return Prisma.sql`(NULL::text, NULL::text) WHERE false`;
  }
  return Prisma.join(
    entries.map(
      ([legacyType, catalogId]) => Prisma.sql`(${legacyType}, ${catalogId})`
    ),
    ', '
  );
}

/**
 * Moves user grants from legacy-imported duplicate ratings onto the seeded
 * catalog rows the admin UI lists, then hides the orphaned legacy duplicates.
 *
 * @param props - Transaction client for raw SQL and rating updates
 * @returns Counts of grants moved, duplicates removed, and legacy rows hidden
 */
export async function reconcileLegacyRatingCatalogGrants(props: {
  readonly db: LegacyRatingCatalogReconcileDb;
}): Promise<LegacyRatingCatalogReconcileResult> {
  const legacyTypes = mappedLegacyRatingTypes();
  if (legacyTypes.length === 0) {
    return { grantsMoved: 0, duplicatesRemoved: 0, legacyRowsHidden: 0 };
  }

  const catalogMapValues = catalogMapSqlValues();

  const duplicatesRemoved = await props.db.$executeRaw`
    WITH catalog_map (legacy_type, catalog_id) AS (
      VALUES ${catalogMapValues}
    ),
    legacy_grants AS (
      SELECT usr.id,
        usr.user_id,
        usr.issued_at,
        map.catalog_id
      FROM user_sailing_ratings AS usr
      INNER JOIN sailing_ratings AS sr ON sr.id = usr.sailing_rating_id
      INNER JOIN catalog_map AS map ON map.legacy_type = sr.legacy_rating_type
      WHERE sr.slug LIKE 'legacy-%'
    )
    DELETE FROM user_sailing_ratings AS usr
    WHERE usr.id IN (
      SELECT ranked.id
      FROM (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, catalog_id
            ORDER BY issued_at DESC, id DESC
          ) AS row_number
        FROM legacy_grants
      ) AS ranked
      WHERE ranked.row_number > 1
    )
  `;

  await props.db.$executeRaw`
    WITH catalog_map (legacy_type, catalog_id) AS (
      VALUES ${catalogMapValues}
    )
    DELETE FROM user_sailing_ratings AS legacy_grant
    USING sailing_ratings AS sr,
      catalog_map AS map
    WHERE legacy_grant.sailing_rating_id = sr.id
      AND sr.legacy_rating_type = map.legacy_type
      AND sr.slug LIKE 'legacy-%'
      AND EXISTS (
        SELECT 1
        FROM user_sailing_ratings AS catalog_grant
        WHERE catalog_grant.user_id = legacy_grant.user_id
          AND catalog_grant.sailing_rating_id = map.catalog_id
      )
  `;

  const grantsMoved = await props.db.$executeRaw`
    WITH catalog_map (legacy_type, catalog_id) AS (
      VALUES ${catalogMapValues}
    )
    UPDATE user_sailing_ratings AS usr
    SET sailing_rating_id = map.catalog_id,
        updated_at = NOW()
    FROM sailing_ratings AS sr,
      catalog_map AS map
    WHERE usr.sailing_rating_id = sr.id
      AND sr.legacy_rating_type = map.legacy_type
      AND sr.slug LIKE 'legacy-%'
      AND sr.id <> map.catalog_id
  `;

  const legacyRowsHidden = await props.db.sailingRating.updateMany({
    where: {
      slug: { startsWith: 'legacy-' },
      legacyRatingType: { in: legacyTypes },
    },
    data: {
      legacyRatingType: null,
      isVisible: false,
      isDeprecated: true,
    },
  });

  const legacyOnlyRowsHidden = await props.db.sailingRating.updateMany({
    where: {
      slug: { startsWith: 'legacy-' },
      isVisible: true,
    },
    data: {
      isVisible: false,
    },
  });

  return {
    grantsMoved,
    duplicatesRemoved,
    legacyRowsHidden: legacyRowsHidden.count + legacyOnlyRowsHidden.count,
  };
}
