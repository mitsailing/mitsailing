import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { buildLegacyMemberPaymentMap } from '@/libs/legacy-sync/legacyPaymentImport';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyPaymentImport';

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
  'sailingRating' | 'user' | 'userSailingRating'
>;

export type LegacyRatingImportResult = {
  readonly ratingTypesImported: number;
  readonly userRatingsImported: number;
  readonly userRatingsSkipped: number;
};

function stringValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function positiveInt(value: string | null | undefined): number {
  const parsed = Number(stringValue(value));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 999;
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

function parseLegacyDate(value: string | null | undefined): Date {
  const normalized = stringValue(value);
  const parsed = new Date(`${normalized.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

async function legacyUserIdMap(props: {
  readonly db: LegacyRatingImportDb;
  readonly members: readonly LegacyMemberRow[];
}) {
  const memberMap = buildLegacyMemberPaymentMap(props.members);
  const userKeyByEmail = new Map<string, string>();
  const emails = [
    ...new Set(
      memberMap.canonicalUsers.flatMap((user) => {
        const legacyEmails = user.legacyMemberRows
          .map((row) => stringValue(row.email).toLowerCase())
          .filter((email) => email !== '');
        for (const email of legacyEmails) {
          userKeyByEmail.set(email, user.key);
        }
        return legacyEmails;
      })
    ),
  ];
  const users =
    emails.length === 0
      ? []
      : await props.db.user.findMany({
          select: { email: true, id: true },
          where: { email: { in: emails } },
        });
  const appUserIdByKey = new Map<string, string>();
  for (const user of users) {
    const userKey = userKeyByEmail.get(user.email.toLowerCase());
    if (userKey && !appUserIdByKey.has(userKey)) {
      appUserIdByKey.set(userKey, user.id);
    }
  }
  return new Map(
    [...memberMap.memberUserKeyByLegacyId].flatMap(
      ([legacyMemberId, userKey]) => {
        const userId = appUserIdByKey.get(userKey);
        return userId ? [[legacyMemberId, userId] as const] : [];
      }
    )
  );
}

async function importRatingTypes(props: {
  readonly db: LegacyRatingImportDb;
  readonly ratingTypes: readonly LegacyRatingTypeRow[];
}) {
  const sailingRatingIdByLegacyType = new Map<string, string>();
  let imported = 0;
  for (const row of props.ratingTypes) {
    const legacyRatingType = stringValue(row.type);
    if (!legacyRatingType) {
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
        isVisible: stringValue(row.status) === '1',
        isDeprecated: stringValue(row.status) !== '1',
      },
      update: {
        name,
        shortName: name,
        displayOrder: positiveInt(row.rank),
        isVisible: stringValue(row.status) === '1',
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
  const legacyMemberIdToUserId = await legacyUserIdMap({
    db: props.db,
    members: props.members,
  });
  const rows = props.ratings.flatMap((row) => {
    const userId = legacyMemberIdToUserId.get(stringValue(row.id));
    const issuedByUserId = legacyMemberIdToUserId.get(stringValue(row.eval_id));
    const sailingRatingId = props.sailingRatingIdByLegacyType.get(
      stringValue(row.rating_type)
    );
    if (!userId || !issuedByUserId || !sailingRatingId) {
      return [];
    }
    return [
      {
        id: randomUUID(),
        userId,
        issuedByUserId,
        sailingRatingId,
        issuedAt: parseLegacyDate(row.eval_date),
      },
    ];
  });
  if (rows.length > 0) {
    await props.db.userSailingRating.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
  return {
    imported: rows.length,
    skipped: props.ratings.length - rows.length,
  };
}

export async function importLegacyRatingRows(props: {
  readonly ratingTypes: readonly LegacyRatingTypeRow[];
  readonly ratings: readonly LegacyRatingRow[];
  readonly members: readonly LegacyMemberRow[];
}): Promise<LegacyRatingImportResult> {
  const result = await prisma.$transaction(async (tx) => {
    const db: LegacyRatingImportDb = tx;
    const ratingTypes = await importRatingTypes({
      db,
      ratingTypes: props.ratingTypes,
    });
    const userRatings = await importUserRatings({
      db,
      members: props.members,
      ratings: props.ratings,
      sailingRatingIdByLegacyType: ratingTypes.sailingRatingIdByLegacyType,
    });
    return {
      ratingTypesImported: ratingTypes.imported,
      userRatingsImported: userRatings.imported,
      userRatingsSkipped: userRatings.skipped,
    };
  });
  return result;
}

export async function importLegacyRatingsFromSchema(): Promise<LegacyRatingImportResult> {
  const [ratingTypes, ratings, members] = await Promise.all([
    prisma.$queryRaw<LegacyRatingTypeRow[]>`
      SELECT *
      FROM legacy.rating_type
      ORDER BY rank
    `,
    prisma.$queryRaw<LegacyRatingRow[]>`
      SELECT *
      FROM legacy.ratings
      ORDER BY eval_date, id, rating_type
    `,
    prisma.$queryRaw<LegacyMemberRow[]>`
      SELECT *
      FROM legacy.members
      WHERE active = '1'
      ORDER BY lower(trim(email)), record_date DESC, record DESC
    `,
  ]);
  return importLegacyRatingRows({ members, ratingTypes, ratings });
}
