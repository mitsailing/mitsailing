import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';

export type LegacyMemberRow = {
  readonly active: string | null;
  readonly card: string | null;
  readonly email: string | null;
  readonly emer_email: string | null;
  readonly emer_name: string | null;
  readonly emer_phone: string | null;
  readonly expire_date: string | null;
  readonly first: string | null;
  readonly id: string | null;
  readonly last: string | null;
  readonly memb_type: string | null;
  readonly phone: string | null;
  readonly record: string | null;
  readonly record_date: string | null;
  readonly status_type: string | null;
  readonly username: string | null;
};

export type LegacyPaymentRow = {
  readonly amount: string | null;
  readonly billTo_email: string | null;
  readonly billTo_firstName: string | null;
  readonly billTo_lastName: string | null;
  readonly category: string | null;
  readonly date: string | null;
  readonly description: string | null;
  readonly last4: string | null;
  readonly omarsid: string | null;
  readonly settled: string | null;
  readonly userid: string | null;
};

type CanonicalLegacyUser = {
  readonly email: string;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly firstName: string | null;
  readonly key: string;
  readonly lastName: string | null;
  readonly legacySailingCard: LegacySailingCardSnapshot | null;
  readonly legacyMemberIds: readonly string[];
  readonly legacyMemberRows: readonly LegacyMemberRow[];
  readonly mitId: string | null;
  readonly name: string;
  readonly phone: string | null;
  readonly role: Role;
};

export type LegacyMemberPaymentMap = {
  readonly canonicalUsers: CanonicalLegacyUser[];
  readonly memberUserKeyByEmail: ReadonlyMap<string, string>;
  readonly memberUserKeyByLegacyId: ReadonlyMap<string, string>;
  readonly memberUserKeyByUsername: ReadonlyMap<string, string>;
};

export type LegacyUserIdentityMaps = {
  readonly legacyMemberIdToUserId: ReadonlyMap<string, string>;
  readonly usernameToUserId: ReadonlyMap<string, string>;
};

type LegacyPaymentImportDb = Pick<
  Prisma.TransactionClient,
  '$executeRaw' | '$queryRaw' | 'payment'
>;
type LegacyUserIdentityDb = Pick<Prisma.TransactionClient, 'user'>;

type LegacySailingCardSnapshot = {
  readonly expiresOn: Date;
  readonly issuedAt: Date | null;
  readonly number: number;
  readonly year: number;
};

export type LegacyPaymentImportResult = {
  readonly cardRecordsMerged: number;
  readonly paymentsImported: number;
  readonly paymentsNeedingReview: number;
  readonly usersCreated: number;
  readonly usersMatched: number;
};

export type LegacyUserImportResult = Pick<
  LegacyPaymentImportResult,
  'cardRecordsMerged' | 'usersCreated' | 'usersMatched'
>;

function stringValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function nullableString(value: string | null | undefined): string | null {
  const normalized = stringValue(value);
  return normalized === '' ? null : normalized;
}

function normalizeLegacyEmail(value: string | null | undefined): string {
  return stringValue(value).toLowerCase();
}

function stableLegacyPaymentId(orderNumber: string): string {
  const digest = createHash('sha256')
    .update(orderNumber)
    .digest('hex')
    .slice(0, 32);
  return `legacy-payment-${digest}`;
}

function isActiveMember(row: LegacyMemberRow): boolean {
  return stringValue(row.active) === '1';
}

function isValidMitId(value: string | null | undefined): boolean {
  return /^\d{9}$/u.test(stringValue(value));
}

function compareLegacyMemberRecency(
  left: LegacyMemberRow,
  right: LegacyMemberRow
): number {
  return (
    stringValue(right.record_date).localeCompare(
      stringValue(left.record_date)
    ) || stringValue(right.record).localeCompare(stringValue(left.record))
  );
}

function parsePositiveInteger(value: string | null | undefined): number | null {
  const normalized = stringValue(value);
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLegacyDate(value: string | null | undefined): Date | null {
  const normalized = stringValue(value);
  if (normalized === '') {
    return null;
  }
  const parsed = new Date(`${normalized.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function displayName(row: LegacyMemberRow): string {
  const first = stringValue(row.first);
  const last = stringValue(row.last);
  const joined = `${first} ${last}`.trim();
  return joined || normalizeLegacyEmail(row.email) || 'Legacy sailor';
}

function legacySailingCardFromMembers(
  members: readonly LegacyMemberRow[]
): LegacySailingCardSnapshot | null {
  const cardRows = members
    .map((row) => ({
      expiresOn: parseLegacyDate(row.expire_date),
      issuedAt: parseLegacyDate(row.record_date),
      number: parsePositiveInteger(row.card),
    }))
    .filter(
      (
        row
      ): row is {
        readonly expiresOn: Date;
        readonly issuedAt: Date | null;
        readonly number: number;
      } => row.number !== null && row.expiresOn !== null
    )
    .toSorted(
      (left, right) =>
        right.expiresOn.getTime() - left.expiresOn.getTime() ||
        (right.issuedAt?.getTime() ?? 0) - (left.issuedAt?.getTime() ?? 0)
    );
  const card = cardRows.at(0);
  if (!card) {
    return null;
  }
  return {
    expiresOn: card.expiresOn,
    issuedAt: card.issuedAt,
    number: card.number,
    year: card.expiresOn.getUTCFullYear(),
  };
}

function roleFromLegacyMemberType(value: string | null | undefined): Role {
  const normalized = stringValue(value);
  if (normalized === '4') {
    return Role.VOLUNTEER;
  }
  if (normalized === '12') {
    return Role.VOLUNTEER_INSTRUCTOR;
  }
  if (normalized === '6') {
    return Role.DOCK_STAFF;
  }
  return Role.USER;
}

function canonicalUserFromMembers(
  key: string,
  members: readonly LegacyMemberRow[]
): CanonicalLegacyUser {
  const sorted = members.toSorted(compareLegacyMemberRecency);
  const profile = sorted[0] ?? members[0];
  const fallbackEmail = sorted
    .map((row) => normalizeLegacyEmail(row.email))
    .find((email) => email !== '');
  const profileEmail = normalizeLegacyEmail(profile?.email);
  const email = profileEmail === '' ? (fallbackEmail ?? key) : profileEmail;
  const legacyMemberIds = [
    ...new Set(
      sorted
        .map((row) => stringValue(row.id))
        .filter((legacyMemberId) => legacyMemberId !== '')
    ),
  ];
  const mitIds = new Set(
    sorted
      .map((row) => stringValue(row.id))
      .filter((value) => isValidMitId(value))
  );
  const mitId = mitIds.size === 1 ? ([...mitIds].at(0) ?? null) : null;
  return {
    email,
    emergencyContactName: nullableString(profile?.emer_name),
    emergencyContactPhone: nullableString(profile?.emer_phone),
    firstName: nullableString(profile?.first),
    key,
    lastName: nullableString(profile?.last),
    legacySailingCard: legacySailingCardFromMembers(sorted),
    legacyMemberIds,
    legacyMemberRows: sorted,
    mitId,
    name: profile ? displayName(profile) : key,
    phone: nullableString(profile?.phone),
    role: roleFromLegacyMemberType(profile?.memb_type),
  };
}

class LegacyIdentityGroups {
  private readonly parent = new Map<string, string>();

  private add(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
    }
  }

  find(key: string): string {
    this.add(key);
    const parent = this.parent.get(key);
    if (parent === undefined || parent === key) {
      return key;
    }
    const root = this.find(parent);
    this.parent.set(key, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) {
      this.parent.set(rightRoot, leftRoot);
    }
  }
}

function legacyIdentityKeys(row: LegacyMemberRow): string[] {
  const keys: string[] = [];
  const legacyMemberId = stringValue(row.id);
  const email = normalizeLegacyEmail(row.email);
  if (legacyMemberId !== '') {
    keys.push(`id:${legacyMemberId}`);
  }
  if (email !== '') {
    keys.push(`email:${email}`);
  }
  return keys;
}

function activeLegacyMemberRowsWithIdentity(
  members: readonly LegacyMemberRow[]
): LegacyMemberRow[] {
  return members.filter(
    (row) => isActiveMember(row) && legacyIdentityKeys(row).length > 0
  );
}

function unionLegacyIdentityKeys(
  groups: LegacyIdentityGroups,
  keys: readonly string[]
) {
  const [firstKey] = keys;
  if (!firstKey) {
    return;
  }

  for (const key of keys) {
    groups.union(firstKey, key);
  }
}

function legacyIdentityGroupsForRows(rows: readonly LegacyMemberRow[]) {
  const groups = new LegacyIdentityGroups();
  for (const row of rows) {
    unionLegacyIdentityKeys(groups, legacyIdentityKeys(row));
  }
  return groups;
}

function appendLegacyMemberRow(
  rowsByRoot: Map<string, LegacyMemberRow[]>,
  root: string,
  row: LegacyMemberRow
) {
  const rows = rowsByRoot.get(root) ?? [];
  rows.push(row);
  rowsByRoot.set(root, rows);
}

function legacyMemberRowsByIdentityRoot(
  rows: readonly LegacyMemberRow[],
  groups: LegacyIdentityGroups
) {
  const rowsByRoot = new Map<string, LegacyMemberRow[]>();
  for (const row of rows) {
    const [firstKey] = legacyIdentityKeys(row);
    if (firstKey) {
      appendLegacyMemberRow(rowsByRoot, groups.find(firstKey), row);
    }
  }
  return rowsByRoot;
}

function canonicalLegacyUsersByIdentityRoot(
  rowsByRoot: ReadonlyMap<string, readonly LegacyMemberRow[]>
) {
  return [...rowsByRoot.entries()]
    .map(([key, rows]) => canonicalUserFromMembers(key, rows))
    .filter((user) => user.email !== '');
}

function addLegacyMemberLookupKeys(
  props: {
    readonly memberUserKeyByEmail: Map<string, string>;
    readonly memberUserKeyByLegacyId: Map<string, string>;
    readonly memberUserKeyByUsername: Map<string, string>;
  },
  user: CanonicalLegacyUser,
  row: LegacyMemberRow
) {
  const email = normalizeLegacyEmail(row.email);
  if (email) {
    props.memberUserKeyByEmail.set(email, user.key);
  }
  const id = stringValue(row.id);
  if (id) {
    props.memberUserKeyByLegacyId.set(id, user.key);
  }
  const username = stringValue(row.username).toLowerCase();
  if (username) {
    props.memberUserKeyByUsername.set(username, user.key);
  }
}

function legacyMemberPaymentLookups(
  canonicalUsers: readonly CanonicalLegacyUser[]
): Omit<LegacyMemberPaymentMap, 'canonicalUsers'> {
  const memberUserKeyByEmail = new Map<string, string>();
  const memberUserKeyByLegacyId = new Map<string, string>();
  const memberUserKeyByUsername = new Map<string, string>();
  const props = {
    memberUserKeyByEmail,
    memberUserKeyByLegacyId,
    memberUserKeyByUsername,
  };

  for (const user of canonicalUsers) {
    for (const row of user.legacyMemberRows) {
      addLegacyMemberLookupKeys(props, user, row);
    }
  }

  return props;
}

export function buildLegacyMemberPaymentMap(
  members: readonly LegacyMemberRow[]
): LegacyMemberPaymentMap {
  const activeRows = activeLegacyMemberRowsWithIdentity(members);
  const groups = legacyIdentityGroupsForRows(activeRows);
  const rowsByRoot = legacyMemberRowsByIdentityRoot(activeRows, groups);
  const canonicalUsers = canonicalLegacyUsersByIdentityRoot(rowsByRoot);
  const lookups = legacyMemberPaymentLookups(canonicalUsers);

  return {
    canonicalUsers,
    memberUserKeyByEmail: lookups.memberUserKeyByEmail,
    memberUserKeyByLegacyId: lookups.memberUserKeyByLegacyId,
    memberUserKeyByUsername: lookups.memberUserKeyByUsername,
  };
}

export async function loadLegacyUserIdentityMaps(props: {
  readonly db: LegacyUserIdentityDb;
  readonly members: readonly LegacyMemberRow[];
}): Promise<LegacyUserIdentityMaps> {
  const memberMap = buildLegacyMemberPaymentMap(props.members);
  const userKeyByEmail = new Map<string, string>();
  const emails = [
    ...new Set(
      memberMap.canonicalUsers.flatMap((user) => {
        const legacyEmails = user.legacyMemberRows
          .map((row) => normalizeLegacyEmail(row.email))
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

  const legacyMemberIdToUserId = new Map<string, string>();
  for (const [legacyMemberId, userKey] of memberMap.memberUserKeyByLegacyId) {
    const userId = appUserIdByKey.get(userKey);
    if (userId) {
      legacyMemberIdToUserId.set(legacyMemberId, userId);
    }
  }
  const usernameToUserId = new Map<string, string>();
  for (const [username, userKey] of memberMap.memberUserKeyByUsername) {
    const userId = appUserIdByKey.get(userKey);
    if (userId) {
      usernameToUserId.set(username, userId);
    }
  }
  return { legacyMemberIdToUserId, usernameToUserId };
}

export function legacyPaymentAmountCents(amount: string | null): number {
  const normalized = stringValue(amount).replaceAll(/[^\d,.-]/gu, '');
  const match = /-?[\d,]+(?:\.\d+)?/u.exec(normalized);
  const parsed = Number((match?.[0] ?? '').replaceAll(',', ''));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function racingCardSeasonEndYear(description: string): number | null {
  const match = /\bRacing Card \d{4}-(\d{4}) for /u.exec(description);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}

function racingCardUsername(description: string): string | null {
  const match = /\bRacing Card \d{4}-\d{4} for ([^\s]+)/u.exec(description);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

function isLegacyDepositPayment(payment: LegacyPaymentRow): boolean {
  const sourceId = stringValue(payment.omarsid);
  const description = stringValue(payment.description).toLowerCase();
  return sourceId.startsWith('BD-') || description.includes('damage deposit');
}

export function legacyPaymentPurpose(payment: LegacyPaymentRow): {
  readonly cardType: SailingCardType | null;
  readonly cardYear: number | null;
  readonly purpose: PaymentPurpose;
} {
  const category = stringValue(payment.category);
  const description = stringValue(payment.description);
  const year = racingCardSeasonEndYear(description);
  if (category === 'Racing' && year !== null) {
    return {
      cardType: SailingCardType.racing,
      cardYear: year,
      purpose: PaymentPurpose.membership,
    };
  }
  return {
    cardType: null,
    cardYear: null,
    purpose: PaymentPurpose.event_payment,
  };
}

export function legacyPaymentStatus(payment: LegacyPaymentRow): PaymentStatus {
  if (isLegacyDepositPayment(payment) || stringValue(payment.settled) !== '1') {
    return PaymentStatus.needs_review;
  }
  return PaymentStatus.paid;
}

export function legacyPaymentUserId(props: {
  readonly appUserIdByKey: ReadonlyMap<string, string>;
  readonly map: LegacyMemberPaymentMap;
  readonly payment: LegacyPaymentRow;
}): string | null {
  const legacyId = stringValue(props.payment.userid);
  const username = racingCardUsername(stringValue(props.payment.description));
  const email = normalizeLegacyEmail(props.payment.billTo_email);
  const userKey =
    props.map.memberUserKeyByLegacyId.get(legacyId) ??
    (username ? props.map.memberUserKeyByUsername.get(username) : undefined) ??
    props.map.memberUserKeyByEmail.get(email);
  return userKey ? (props.appUserIdByKey.get(userKey) ?? null) : null;
}

type LegacyUpdatedUserRow = Readonly<{
  id: string;
}>;

type LegacyUserStageRow = Readonly<{
  appRole: Role;
  email: string;
  emailVerified: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  firstName: string | null;
  id: string;
  lastName: string | null;
  mitId: string | null;
  name: string;
  phone: string | null;
  role: Role;
  sailingCardExpiresOn: Date | null;
  sailingCardIssuedAt: Date | null;
  sailingCardNumber: number | null;
  sailingCardYear: number | null;
  userKey: string;
}>;

type LegacyUserIdRow = Readonly<{
  id: string;
  user_key: string;
}>;

type LegacyInsertedUserRow = LegacyUserIdRow &
  Readonly<{
    sailing_card_number: number | null;
  }>;

function stageRows<T extends object>(rows: readonly T[]): T[][] {
  const firstRow = rows.at(0);
  if (!firstRow) {
    return [];
  }
  const maxParameters = 65_535;
  const columnCount = Object.keys(firstRow).length;
  const size = Math.max(1, Math.floor(maxParameters / columnCount));
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function legacyUserStageRow(user: CanonicalLegacyUser): LegacyUserStageRow {
  return {
    id: randomUUID(),
    appRole: user.role,
    email: user.email,
    emailVerified: false,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    firstName: user.firstName,
    lastName: user.lastName,
    mitId: user.mitId,
    name: user.name,
    phone: user.phone,
    role: user.role,
    sailingCardExpiresOn: user.legacySailingCard?.expiresOn ?? null,
    sailingCardIssuedAt: user.legacySailingCard?.issuedAt ?? null,
    sailingCardNumber: user.legacySailingCard?.number ?? null,
    sailingCardYear: user.legacySailingCard?.year ?? null,
    userKey: user.key,
  };
}

function legacyUserStageSql(row: LegacyUserStageRow) {
  return Prisma.sql`(
    ${row.userKey},
    ${row.id},
    ${row.email},
    ${row.name},
    ${row.emailVerified},
    ${row.phone},
    ${row.emergencyContactName},
    ${row.emergencyContactPhone},
    ${row.firstName},
    ${row.lastName},
    ${row.mitId},
    ${row.sailingCardNumber},
    ${row.sailingCardYear},
    ${row.sailingCardExpiresOn},
    ${row.sailingCardIssuedAt},
    ${row.appRole},
    ${row.role}
  )`;
}

async function createLegacyUserStage(props: {
  readonly db: LegacyPaymentImportDb;
  readonly users: readonly CanonicalLegacyUser[];
}) {
  await props.db.$executeRaw`
    CREATE TEMP TABLE legacy_import_users (
      user_key text PRIMARY KEY,
      id text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      email_verified boolean NOT NULL,
      phone text,
      emergency_contact_name text,
      emergency_contact_phone text,
      first_name text,
      last_name text,
      mit_id text,
      sailing_card_number integer,
      sailing_card_year integer,
      sailing_card_expires_on timestamp,
      sailing_card_issued_at timestamp,
      app_role text NOT NULL,
      role text NOT NULL
    ) ON COMMIT DROP
  `;
  const rows = props.users.map(legacyUserStageRow);
  for (const chunk of stageRows(rows)) {
    await props.db.$executeRaw`
      INSERT INTO legacy_import_users (
        user_key,
        id,
        email,
        name,
        email_verified,
        phone,
        emergency_contact_name,
        emergency_contact_phone,
        first_name,
        last_name,
        mit_id,
        sailing_card_number,
        sailing_card_year,
        sailing_card_expires_on,
        sailing_card_issued_at,
        app_role,
        role
      )
      VALUES ${Prisma.join(chunk.map(legacyUserStageSql), ', ')}
    `;
  }
}

async function legacyUserIdRowsForStage(props: {
  readonly db: LegacyPaymentImportDb;
}) {
  const rows = await props.db.$queryRaw<LegacyUserIdRow[]>`
    SELECT DISTINCT ON (source.user_key)
      source.user_key,
      target."id"
    FROM legacy_import_users AS source
    INNER JOIN "user" AS target
      ON lower(target."email") = source.email
    ORDER BY source.user_key, target."created_at" ASC
  `;
  return rows;
}

function preparedLegacyUsersSql() {
  return Prisma.sql`
    SELECT
      source.*,
      CASE
        WHEN source.mit_id IS NULL THEN 0
        ELSE count(*) OVER (PARTITION BY source.mit_id)
      END AS mit_id_stage_count,
      CASE
        WHEN source.sailing_card_number IS NULL OR source.sailing_card_year IS NULL THEN 0
        ELSE count(*) OVER (
          PARTITION BY source.sailing_card_year, source.sailing_card_number
        )
      END AS sailing_card_stage_count
    FROM legacy_import_users AS source
  `;
}

async function mergeExistingLegacySailingCards(props: {
  readonly db: LegacyPaymentImportDb;
}) {
  const rows = await props.db.$queryRaw<LegacyUpdatedUserRow[]>`
    WITH prepared AS (${preparedLegacyUsersSql()})
    UPDATE "user" AS target
    SET "sailing_card_expires_on" = prepared.sailing_card_expires_on::date,
        "sailing_card_issued_at" = prepared.sailing_card_issued_at::timestamp,
        "sailing_card_number" = prepared.sailing_card_number::integer,
        "sailing_card_year" = prepared.sailing_card_year::integer
    FROM prepared
    WHERE lower(target."email") = prepared.email
      AND prepared.sailing_card_number IS NOT NULL
      AND prepared.sailing_card_year IS NOT NULL
      AND prepared.sailing_card_stage_count = 1
      AND (
        target."sailing_card_number" IS NULL
        OR target."sailing_card_year" IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "user" AS card_owner
        WHERE card_owner."id" <> target."id"
          AND card_owner."sailing_card_number" = prepared.sailing_card_number
          AND card_owner."sailing_card_year" = prepared.sailing_card_year
      )
    RETURNING target."id"
  `;
  return rows.length;
}

async function insertStagedLegacyUsers(props: {
  readonly db: LegacyPaymentImportDb;
}) {
  const rows = await props.db.$queryRaw<LegacyInsertedUserRow[]>`
    WITH prepared AS (${preparedLegacyUsersSql()}),
    inserted AS (
      INSERT INTO "user" (
        "id",
        "app_role",
        "name",
        "email",
        "email_verified",
        "phone",
        "emergency_contact_name",
        "emergency_contact_phone",
        "first_name",
        "last_name",
        "mit_id",
        "sailing_card_number",
        "sailing_card_year",
        "sailing_card_expires_on",
        "sailing_card_issued_at",
        "role",
        "created_at",
        "updated_at"
      )
      SELECT
        prepared.id,
        prepared.app_role::"AppRole",
        prepared.name,
        prepared.email,
        prepared.email_verified,
        prepared.phone,
        prepared.emergency_contact_name,
        prepared.emergency_contact_phone,
        prepared.first_name,
        prepared.last_name,
        CASE
          WHEN prepared.mit_id IS NOT NULL
            AND prepared.mit_id_stage_count = 1
            AND NOT EXISTS (
              SELECT 1
              FROM "user" AS mit_owner
              WHERE mit_owner."mit_id" = prepared.mit_id
            )
          THEN prepared.mit_id
          ELSE NULL
        END,
        CASE
          WHEN prepared.sailing_card_number IS NOT NULL
            AND prepared.sailing_card_year IS NOT NULL
            AND prepared.sailing_card_stage_count = 1
            AND NOT EXISTS (
              SELECT 1
              FROM "user" AS card_owner
              WHERE card_owner."sailing_card_number" = prepared.sailing_card_number
                AND card_owner."sailing_card_year" = prepared.sailing_card_year
            )
          THEN prepared.sailing_card_number
          ELSE NULL
        END,
        CASE
          WHEN prepared.sailing_card_number IS NOT NULL
            AND prepared.sailing_card_year IS NOT NULL
            AND prepared.sailing_card_stage_count = 1
            AND NOT EXISTS (
              SELECT 1
              FROM "user" AS card_owner
              WHERE card_owner."sailing_card_number" = prepared.sailing_card_number
                AND card_owner."sailing_card_year" = prepared.sailing_card_year
            )
          THEN prepared.sailing_card_year
          ELSE NULL
        END,
        CASE
          WHEN prepared.sailing_card_number IS NOT NULL
            AND prepared.sailing_card_year IS NOT NULL
            AND prepared.sailing_card_stage_count = 1
            AND NOT EXISTS (
              SELECT 1
              FROM "user" AS card_owner
              WHERE card_owner."sailing_card_number" = prepared.sailing_card_number
                AND card_owner."sailing_card_year" = prepared.sailing_card_year
            )
          THEN prepared.sailing_card_expires_on::date
          ELSE NULL
        END,
        CASE
          WHEN prepared.sailing_card_number IS NOT NULL
            AND prepared.sailing_card_year IS NOT NULL
            AND prepared.sailing_card_stage_count = 1
            AND NOT EXISTS (
              SELECT 1
              FROM "user" AS card_owner
              WHERE card_owner."sailing_card_number" = prepared.sailing_card_number
                AND card_owner."sailing_card_year" = prepared.sailing_card_year
            )
          THEN prepared.sailing_card_issued_at::timestamp
          ELSE NULL
        END,
        prepared.role,
        NOW(),
        NOW()
      FROM prepared
      WHERE NOT EXISTS (
        SELECT 1
        FROM "user" AS existing_user
        WHERE lower(existing_user."email") = prepared.email
      )
      RETURNING "id", lower("email") AS email, "sailing_card_number"
    )
    SELECT
      source.user_key,
      inserted.id,
      inserted.sailing_card_number
    FROM inserted
    INNER JOIN legacy_import_users AS source
      ON source.email = inserted.email
  `;
  return rows;
}

async function ensureLegacyUsers(props: {
  readonly db: LegacyPaymentImportDb;
  readonly map: LegacyMemberPaymentMap;
}): Promise<{
  readonly appUserIdByKey: ReadonlyMap<string, string>;
  readonly cardRecordsMerged: number;
  readonly usersCreated: number;
  readonly usersMatched: number;
}> {
  if (props.map.canonicalUsers.length === 0) {
    return {
      appUserIdByKey: new Map(),
      cardRecordsMerged: 0,
      usersCreated: 0,
      usersMatched: 0,
    };
  }
  await createLegacyUserStage({
    db: props.db,
    users: props.map.canonicalUsers,
  });
  const existingRows = await legacyUserIdRowsForStage({ db: props.db });
  const existingUserKeys = new Set(existingRows.map((row) => row.user_key));
  const existingCardMerges = await mergeExistingLegacySailingCards({
    db: props.db,
  });
  const insertedRows = await insertStagedLegacyUsers({ db: props.db });
  const appUserRows = await legacyUserIdRowsForStage({ db: props.db });
  const appUserIdByKey = new Map(
    appUserRows.map((row) => [row.user_key, row.id])
  );
  return {
    appUserIdByKey,
    cardRecordsMerged:
      existingCardMerges +
      insertedRows.filter((row) => row.sailing_card_number !== null).length,
    usersCreated: insertedRows.length,
    usersMatched: existingUserKeys.size,
  };
}

async function importLegacyUserRows(props: {
  readonly members: readonly LegacyMemberRow[];
}): Promise<LegacyUserImportResult> {
  const map = buildLegacyMemberPaymentMap(props.members);
  const result = await prisma.$transaction(async (tx) => {
    const db: LegacyPaymentImportDb = tx;
    const users = await ensureLegacyUsers({ db, map });
    return {
      cardRecordsMerged: users.cardRecordsMerged,
      usersCreated: users.usersCreated,
      usersMatched: users.usersMatched,
    };
  });
  return result;
}

function payerName(payment: LegacyPaymentRow): string | null {
  const name = `${stringValue(payment.billTo_firstName)} ${stringValue(
    payment.billTo_lastName
  )}`.trim();
  return name || null;
}

function legacyPaymentCreatedAt(payment: LegacyPaymentRow): Date {
  return parseLegacyDate(payment.date) ?? new Date(0);
}

type LegacyPaymentWrite = Readonly<{
  data: Prisma.PaymentCreateManyInput;
  status: PaymentStatus;
}>;

function legacyPaymentWrite(props: {
  readonly appUserIdByKey: ReadonlyMap<string, string>;
  readonly map: LegacyMemberPaymentMap;
  readonly payment: LegacyPaymentRow;
}): LegacyPaymentWrite {
  const orderNumber = stringValue(props.payment.omarsid);
  const purpose = legacyPaymentPurpose(props.payment);
  const matchedUserId = legacyPaymentUserId({
    appUserIdByKey: props.appUserIdByKey,
    map: props.map,
    payment: props.payment,
  });
  const unmatchedStatus =
    matchedUserId === null ? PaymentStatus.needs_review : null;
  const status = unmatchedStatus ?? legacyPaymentStatus(props.payment);
  const data = {
    amountCents: legacyPaymentAmountCents(props.payment.amount),
    cardType:
      purpose.purpose === PaymentPurpose.membership ? purpose.cardType : null,
    cardYear:
      purpose.purpose === PaymentPurpose.membership ? purpose.cardYear : null,
    createdAt: legacyPaymentCreatedAt(props.payment),
    currency: 'usd',
    id: stableLegacyPaymentId(orderNumber),
    legacyCategory: stringValue(props.payment.category) || 'Unknown',
    legacyDescription:
      stringValue(props.payment.description) || `Legacy payment ${orderNumber}`,
    legacySettled: stringValue(props.payment.settled) === '1',
    legacySourceId: orderNumber,
    legacySourceTable: 'payments',
    payerEmail: normalizeLegacyEmail(props.payment.billTo_email) || null,
    payerName: payerName(props.payment),
    purpose: purpose.purpose,
    source: PaymentSource.legacy,
    status,
    userId: matchedUserId,
  };
  return { data, status };
}

function legacyPaymentUpdateSql(writes: readonly LegacyPaymentWrite[]) {
  return Prisma.join(
    writes.map((write) => {
      const { data } = write;
      return Prisma.sql`(${data.legacySourceId}, ${data.amountCents}, ${data.cardType}, ${data.cardYear}, ${data.createdAt}, ${data.currency}, ${data.legacyCategory}, ${data.legacyDescription}, ${data.legacySettled}, ${data.payerEmail}, ${data.payerName}, ${data.purpose}, ${data.source}, ${data.status}, ${data.userId})`;
    }),
    ', '
  );
}

async function updateExistingLegacyPayments(props: {
  readonly db: LegacyPaymentImportDb;
  readonly writes: readonly LegacyPaymentWrite[];
}) {
  if (props.writes.length === 0) {
    return;
  }
  await props.db.$executeRaw`
    UPDATE "payments" AS target
    SET "amount_cents" = source.amount_cents::integer,
        "card_type" = source.card_type::text::"sailing_card_type",
        "card_year" = source.card_year::integer,
        "created_at" = source.created_at::timestamp,
        "currency" = source.currency::text,
        "legacy_category" = source.legacy_category::text,
        "legacy_description" = source.legacy_description::text,
        "legacy_settled" = source.legacy_settled::boolean,
        "payer_email" = source.payer_email::text,
        "payer_name" = source.payer_name::text,
        "purpose" = source.purpose::text::"payment_purpose",
        "source" = source.source::text::"payment_source",
        "status" = CASE
          WHEN target."status" = 'needs_review'
            THEN source.status::text::"payment_status"
          ELSE target."status"
        END,
        "updated_at" = NOW(),
        "user_id" = source.user_id::text
    FROM (
      VALUES ${legacyPaymentUpdateSql(props.writes)}
    ) AS source(
      legacy_source_id,
      amount_cents,
      card_type,
      card_year,
      created_at,
      currency,
      legacy_category,
      legacy_description,
      legacy_settled,
      payer_email,
      payer_name,
      purpose,
      source,
      status,
      user_id
    )
    WHERE target."legacy_source_table" = 'payments'
      AND target."legacy_source_id" = source.legacy_source_id
  `;
}

async function writeLegacyPayments(props: {
  readonly db: LegacyPaymentImportDb;
  readonly writes: readonly LegacyPaymentWrite[];
}) {
  if (props.writes.length === 0) {
    return;
  }
  const existingRows = await props.db.payment.findMany({
    select: { legacySourceId: true },
    where: {
      legacySourceId: {
        in: props.writes.map((write) => String(write.data.legacySourceId)),
      },
      legacySourceTable: 'payments',
    },
  });
  const existingSourceIds = new Set(
    existingRows.flatMap((row) =>
      row.legacySourceId === null ? [] : [row.legacySourceId]
    )
  );
  const newWrites = props.writes.filter(
    (write) => !existingSourceIds.has(String(write.data.legacySourceId))
  );
  const existingWrites = props.writes.filter((write) =>
    existingSourceIds.has(String(write.data.legacySourceId))
  );

  if (newWrites.length > 0) {
    await props.db.payment.createMany({
      data: newWrites.map((write) => write.data),
      skipDuplicates: true,
    });
  }
  await updateExistingLegacyPayments({ db: props.db, writes: existingWrites });
}

export async function importLegacyPaymentRows(props: {
  readonly members: readonly LegacyMemberRow[];
  readonly payments: readonly LegacyPaymentRow[];
}): Promise<LegacyPaymentImportResult> {
  const map = buildLegacyMemberPaymentMap(props.members);
  const result = await prisma.$transaction(async (tx) => {
    const db: LegacyPaymentImportDb = tx;
    const users = await ensureLegacyUsers({ db, map });
    let paymentsImported = 0;
    let paymentsNeedingReview = 0;
    const paymentWrites: LegacyPaymentWrite[] = [];

    for (const payment of props.payments) {
      const orderNumber = stringValue(payment.omarsid);
      if (orderNumber === '') {
        paymentsNeedingReview += 1;
        continue;
      }
      const write = legacyPaymentWrite({
        appUserIdByKey: users.appUserIdByKey,
        map,
        payment,
      });
      paymentWrites.push(write);
      paymentsImported += 1;
      if (write.status === PaymentStatus.needs_review) {
        paymentsNeedingReview += 1;
      }
    }
    await writeLegacyPayments({ db, writes: paymentWrites });

    return {
      cardRecordsMerged: users.cardRecordsMerged,
      paymentsImported,
      paymentsNeedingReview,
      usersCreated: users.usersCreated,
      usersMatched: users.usersMatched,
    };
  });
  return result;
}

export async function importLegacyPaymentsFromSchema(): Promise<LegacyPaymentImportResult> {
  const [members, payments] = await Promise.all([
    prisma.$queryRaw<LegacyMemberRow[]>`
      SELECT *
      FROM legacy.members
      WHERE active = '1'
      ORDER BY lower(trim(email)), record_date DESC, record DESC
    `,
    prisma.$queryRaw<LegacyPaymentRow[]>`
      SELECT *
      FROM legacy.payments
      ORDER BY date, omarsid
    `,
  ]);
  return importLegacyPaymentRows({ members, payments });
}

export async function importLegacyUsersFromSchema(): Promise<LegacyUserImportResult> {
  const members = await prisma.$queryRaw<LegacyMemberRow[]>`
    SELECT *
    FROM legacy.members
    WHERE active = '1'
    ORDER BY lower(trim(email)), record_date DESC, record DESC
  `;
  return importLegacyUserRows({ members });
}
