import type { Prisma } from '@/generated/prisma/client';
import { Role } from '@/libs/auth/roles';
import { normalizeImportedPersonName } from '@/libs/mit-sailing/personName';
import {
  normalizeInternationalPhone,
  normalizeUsPhone,
} from '@/utils/phoneValidation';

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

type LegacySailingCardSnapshot = {
  readonly expiresOn: Date;
  readonly issuedAt: Date | null;
  readonly number: number;
  readonly year: number;
};

type LegacyEmergencyContact = {
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
};

export type LegacyCanonicalUser = {
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
  readonly canonicalUsers: readonly LegacyCanonicalUser[];
  readonly memberUserKeyByEmail: ReadonlyMap<string, string>;
  readonly memberUserKeyByLegacyId: ReadonlyMap<string, string>;
  readonly memberUserKeyByUsername: ReadonlyMap<string, string>;
};

export type LegacyUserIdentityMaps = {
  readonly legacyMemberIdToUserId: ReadonlyMap<string, string>;
  readonly usernameToUserId: ReadonlyMap<string, string>;
};

type LegacyUserIdentityDb = Pick<Prisma.TransactionClient, '$queryRaw'>;

function stringValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function nullableString(value: string | null | undefined): string | null {
  const normalized = stringValue(value);
  return normalized === '' ? null : normalized;
}

function nullableLegacyUsPhone(
  value: string | null | undefined
): string | null {
  const rawPhone = nullableString(value);
  if (!rawPhone) {
    return null;
  }
  const phone = normalizeUsPhone(rawPhone);
  return phone.ok ? phone.phone : null;
}

function legacyEmergencyContact(
  name: string | null | undefined,
  phone: string | null | undefined
): LegacyEmergencyContact {
  const emergencyContactName = nullableString(name);
  const rawPhone = nullableString(phone);
  if (!emergencyContactName || !rawPhone) {
    return {
      emergencyContactName: null,
      emergencyContactPhone: null,
    };
  }
  const emergencyContactPhone = normalizeInternationalPhone(rawPhone);
  if (!emergencyContactPhone.ok) {
    return {
      emergencyContactName: null,
      emergencyContactPhone: null,
    };
  }
  return {
    emergencyContactName,
    emergencyContactPhone: emergencyContactPhone.phone,
  };
}

/**
 * Normalizes legacy member email for identity matching and staging.
 *
 * @param value - Raw legacy email value
 * @returns Lowercased email string
 */
export function normalizeLegacyEmail(value: string | null | undefined): string {
  return stringValue(value).toLowerCase();
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
  const name = normalizeImportedPersonName({
    firstName: stringValue(row.first),
    lastName: stringValue(row.last),
  });
  const joined = name.name;
  return joined || normalizeLegacyEmail(row.email) || 'Legacy sailor';
}

function nullableImportedNamePart(value: string | null | undefined) {
  const normalized = normalizeImportedPersonName({
    firstName: stringValue(value),
    lastName: '',
  }).firstName;
  return normalized === '' ? null : normalized;
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
  if (normalized === '5' || normalized === '12') {
    return Role.VOLUNTEER_INSTRUCTOR;
  }
  if (normalized === '6') {
    return Role.DOCK_STAFF;
  }
  if (normalized === '7' || normalized === '8') {
    return Role.DOCK_MASTER;
  }
  if (normalized === '9') {
    return Role.ADMIN;
  }
  return Role.USER;
}

function canonicalUserFromMembers(
  key: string,
  members: readonly LegacyMemberRow[]
): LegacyCanonicalUser {
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
  const emergencyContact = legacyEmergencyContact(
    profile?.emer_name,
    profile?.emer_phone
  );
  return {
    email,
    emergencyContactName: emergencyContact.emergencyContactName,
    emergencyContactPhone: emergencyContact.emergencyContactPhone,
    firstName: nullableImportedNamePart(profile?.first),
    key,
    lastName: nullableImportedNamePart(profile?.last),
    legacySailingCard: legacySailingCardFromMembers(sorted),
    legacyMemberIds,
    legacyMemberRows: sorted,
    mitId,
    name: profile ? displayName(profile) : key,
    phone: nullableLegacyUsPhone(profile?.phone),
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
  user: LegacyCanonicalUser,
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
  canonicalUsers: readonly LegacyCanonicalUser[]
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

/**
 * Groups active legacy members by shared legacy id or normalized email.
 *
 * @param members - Legacy member rows from Pavilion
 * @returns Canonical users and lookup maps for payment import
 */
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

async function findAppUsersByNormalizedEmails(props: {
  readonly db: LegacyUserIdentityDb;
  readonly emails: readonly string[];
}) {
  if (props.emails.length === 0) {
    return [];
  }
  const rows = await props.db.$queryRaw<{ email: string; id: string }[]>`
    SELECT "id", "email"
    FROM "user"
    WHERE lower("email") = ANY(${props.emails}::text[])
  `;
  return rows;
}

/**
 * Maps legacy member ids and usernames to app user ids after user import.
 *
 * @param props - Database client and legacy member rows
 * @returns Legacy member id and username maps to app user ids
 */
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
  const users = await findAppUsersByNormalizedEmails({
    db: props.db,
    emails,
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
