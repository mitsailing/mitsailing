import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
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
  readonly mitId: string | null;
  readonly name: string;
  readonly phone: string | null;
};

export type LegacyMemberPaymentMap = {
  readonly canonicalUsers: CanonicalLegacyUser[];
  readonly memberUserKeyByEmail: ReadonlyMap<string, string>;
  readonly memberUserKeyByLegacyId: ReadonlyMap<string, string>;
  readonly memberUserKeyByUsername: ReadonlyMap<string, string>;
};

type LegacyPaymentImportDb = Pick<Prisma.TransactionClient, 'payment' | 'user'>;

type LegacySailingCardSnapshot = {
  readonly expiresOn: Date;
  readonly issuedAt: Date | null;
  readonly number: number;
  readonly year: number;
};

type LegacyPaymentImportResult = {
  readonly cardRecordsMerged: number;
  readonly paymentsImported: number;
  readonly paymentsNeedingReview: number;
  readonly usersCreated: number;
  readonly usersMatched: number;
};

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

function stableLegacyUserId(email: string): string {
  const digest = createHash('sha256').update(email).digest('hex').slice(0, 32);
  return `legacy-user-${digest}`;
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

function canonicalUserFromMembers(
  key: string,
  members: readonly LegacyMemberRow[]
): CanonicalLegacyUser {
  const sorted = members.toSorted(compareLegacyMemberRecency);
  const profile = sorted[0] ?? members[0];
  const mitIds = new Set(
    sorted
      .map((row) => stringValue(row.id))
      .filter((value) => isValidMitId(value))
  );
  const mitId = mitIds.size === 1 ? ([...mitIds].at(0) ?? null) : null;
  return {
    email: key,
    emergencyContactName: nullableString(profile?.emer_name),
    emergencyContactPhone: nullableString(profile?.emer_phone),
    firstName: nullableString(profile?.first),
    key,
    lastName: nullableString(profile?.last),
    legacySailingCard: legacySailingCardFromMembers(sorted),
    mitId,
    name: profile ? displayName(profile) : key,
    phone: nullableString(profile?.phone),
  };
}

export function buildLegacyMemberPaymentMap(
  members: readonly LegacyMemberRow[]
): LegacyMemberPaymentMap {
  const activeByEmail = new Map<string, LegacyMemberRow[]>();
  for (const row of members) {
    const email = normalizeLegacyEmail(row.email);
    if (!isActiveMember(row) || email === '') {
      continue;
    }
    const rows = activeByEmail.get(email) ?? [];
    rows.push(row);
    activeByEmail.set(email, rows);
  }

  const canonicalUsers: CanonicalLegacyUser[] = [];
  const memberUserKeyByEmail = new Map<string, string>();
  const memberUserKeyByLegacyId = new Map<string, string>();
  const memberUserKeyByUsername = new Map<string, string>();

  for (const [email, rows] of activeByEmail) {
    const user = canonicalUserFromMembers(email, rows);
    canonicalUsers.push(user);
    memberUserKeyByEmail.set(email, user.key);
    for (const row of rows) {
      const id = stringValue(row.id);
      if (id) {
        memberUserKeyByLegacyId.set(id, user.key);
      }
      const username = stringValue(row.username).toLowerCase();
      if (username) {
        memberUserKeyByUsername.set(username, user.key);
      }
    }
  }

  return {
    canonicalUsers,
    memberUserKeyByEmail,
    memberUserKeyByLegacyId,
    memberUserKeyByUsername,
  };
}

export function legacyPaymentAmountCents(amount: string | null): number {
  const normalized = stringValue(amount).replaceAll(/[^\d.]/gu, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function racingCardSeasonEndYear(description: string): number | null {
  const match = description.match(/\bRacing Card \d{4}-(\d{4}) for /u);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}

function racingCardUsername(description: string): string | null {
  const match = description.match(/\bRacing Card \d{4}-\d{4} for ([^\s]+)/u);
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

function legacySailingCardUserData(card: LegacySailingCardSnapshot) {
  return {
    sailingCardExpiresOn: card.expiresOn,
    sailingCardIssuedAt: card.issuedAt,
    sailingCardNumber: card.number,
    sailingCardYear: card.year,
  };
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
  const appUserIdByKey = new Map<string, string>();
  let cardRecordsMerged = 0;
  let usersCreated = 0;
  let usersMatched = 0;
  const existingUsers = await props.db.user.findMany({
    where: {
      email: { in: props.map.canonicalUsers.map((user) => user.email) },
    },
    select: {
      email: true,
      id: true,
      sailingCardNumber: true,
      sailingCardYear: true,
    },
  });
  const existingUserByEmail = new Map(
    existingUsers.map((user) => [user.email.toLowerCase(), user])
  );
  const usersToCreate: Prisma.UserCreateManyInput[] = [];

  for (const user of props.map.canonicalUsers) {
    const existing = existingUserByEmail.get(user.email);
    if (existing) {
      if (
        user.legacySailingCard &&
        (existing.sailingCardNumber === null ||
          existing.sailingCardYear === null)
      ) {
        await props.db.user.update({
          data: legacySailingCardUserData(user.legacySailingCard),
          where: { id: existing.id },
        });
        cardRecordsMerged += 1;
      }
      appUserIdByKey.set(user.key, existing.id);
      usersMatched += 1;
      continue;
    }
    const id = stableLegacyUserId(user.email);
    usersToCreate.push({
      id,
      appRole: 'user',
      email: user.email,
      emailVerified: false,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      firstName: user.firstName,
      lastName: user.lastName,
      mitId: user.mitId,
      name: user.name,
      phone: user.phone,
      role: 'user',
      ...(user.legacySailingCard
        ? legacySailingCardUserData(user.legacySailingCard)
        : {}),
    });
    appUserIdByKey.set(user.key, id);
    if (user.legacySailingCard) {
      cardRecordsMerged += 1;
    }
    usersCreated += 1;
  }
  if (usersToCreate.length > 0) {
    await props.db.user.createMany({
      data: usersToCreate,
      skipDuplicates: true,
    });
  }

  return { appUserIdByKey, cardRecordsMerged, usersCreated, usersMatched };
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

async function upsertLegacyPayment(props: {
  readonly appUserIdByKey: ReadonlyMap<string, string>;
  readonly db: LegacyPaymentImportDb;
  readonly map: LegacyMemberPaymentMap;
  readonly payment: LegacyPaymentRow;
}): Promise<PaymentStatus> {
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
  const update = {
    amountCents: data.amountCents,
    cardType: data.cardType,
    cardYear: data.cardYear,
    createdAt: data.createdAt,
    currency: data.currency,
    legacyCategory: data.legacyCategory,
    legacyDescription: data.legacyDescription,
    legacySettled: data.legacySettled,
    payerEmail: data.payerEmail,
    payerName: data.payerName,
    purpose: data.purpose,
    source: data.source,
    userId: data.userId,
  };

  await props.db.payment.upsert({
    where: {
      legacySourceTable_legacySourceId: {
        legacySourceId: orderNumber,
        legacySourceTable: 'payments',
      },
    },
    create: data,
    update,
  });
  return status;
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

    for (const payment of props.payments) {
      const orderNumber = stringValue(payment.omarsid);
      if (orderNumber === '') {
        paymentsNeedingReview += 1;
        continue;
      }
      const status = await upsertLegacyPayment({
        appUserIdByKey: users.appUserIdByKey,
        db,
        map,
        payment,
      });
      paymentsImported += 1;
      if (status === PaymentStatus.needs_review) {
        paymentsNeedingReview += 1;
      }
    }

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
