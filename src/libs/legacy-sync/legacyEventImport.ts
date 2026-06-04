import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { buildLegacyMemberPaymentMap } from '@/libs/legacy-sync/legacyPaymentImport';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyPaymentImport';

type LegacyEventTypeRow = {
  readonly name: string | null;
  readonly rank: string | null;
  readonly type: string | null;
};

type LegacyEventRow = {
  readonly ask_notes: string | null;
  readonly boat_size: string | null;
  readonly deposit: string | null;
  readonly description: string | null;
  readonly desc_type: string | null;
  readonly eid: string | null;
  readonly event_type: string | null;
  readonly faq: string | null;
  readonly faq_page: string | null;
  readonly has_fee: string | null;
  readonly menu: string | null;
  readonly name: string | null;
  readonly nor: string | null;
  readonly nor_page: string | null;
  readonly phone: string | null;
  readonly reg_approve: string | null;
  readonly reg_begin: string | null;
  readonly reg_custom: string | null;
  readonly reg_date: string | null;
  readonly reg_limit: string | null;
  readonly reg_page: string | null;
  readonly reg_repeatcap: string | null;
  readonly reg_team: string | null;
  readonly reg_urlentries: string | null;
  readonly reg_urlreg: string | null;
  readonly res_page: string | null;
  readonly results: string | null;
  readonly short_name: string | null;
  readonly si: string | null;
  readonly si_page: string | null;
  readonly special: string | null;
  readonly team_size: string | null;
  readonly updater: string | null;
  readonly url: string | null;
};

type LegacyEventDateRow = {
  readonly date: string | null;
  readonly eid: string | null;
  readonly end: string | null;
  readonly start: string | null;
};

type LegacyEventRegistrationRow = {
  readonly activereg: string | null;
  readonly confirm: string | null;
  readonly eid: string | null;
  readonly team_id: string | null;
  readonly team_name: string | null;
  readonly userid: string | null;
};

type LegacyEventContactRow = {
  readonly eid: string | null;
  readonly userid: string | null;
};

type LegacyEventFeeRow = {
  readonly eid: string | null;
  readonly feeid: string | null;
  readonly name: string | null;
  readonly price: string | null;
};

type LegacyEventBoatRow = {
  readonly boat_num: string | null;
  readonly boat_pos: string | null;
  readonly e_mail: string | null;
  readonly eid: string | null;
  readonly name: string | null;
  readonly team_id: string | null;
};

type LegacyEventImportDb = Pick<
  Prisma.TransactionClient,
  '$executeRaw' | '$queryRaw' | 'event' | 'eventCategory' | 'user'
>;

type LegacyEventDateStageRow = Readonly<{
  endDateTime: Date;
  eventId: string;
  id: string;
  startDateTime: Date;
}>;

type LegacyEventFeeStageRow = Readonly<{
  amountCents: number;
  description: string;
  eventId: string;
  id: string;
  isDeposit: boolean;
  legacySourceKey: string;
}>;

type LegacyEventAdminStageRow = Readonly<{
  adminUserId: string;
  eventId: string;
  id: string;
}>;

type LegacyEventRegistrationStageRow = Readonly<{
  createdAt: Date;
  eventId: string;
  id: string;
  legacySourceKey: string;
  legacyTeamKey: string | null;
  phone: string;
  status: ReturnType<typeof registrationStatus>;
  swimAgreementAcceptedAt: Date;
  teamName: string | null;
  userId: string;
}>;

type LegacyEventBoatMemberStageRow = Readonly<{
  boatNumber: number;
  email: string;
  fullName: string;
  id: string;
  legacySourceKey: string;
  position: number;
  registrationId: string;
}>;

type LegacyTeamRegistrationRow = Readonly<{
  legacy_team_key: string;
  registration_id: string;
}>;

export type LegacyEventImportRows = {
  readonly boats: readonly LegacyEventBoatRow[];
  readonly contacts: readonly LegacyEventContactRow[];
  readonly dates: readonly LegacyEventDateRow[];
  readonly eventTypes: readonly LegacyEventTypeRow[];
  readonly events: readonly LegacyEventRow[];
  readonly fees: readonly LegacyEventFeeRow[];
  readonly members: readonly LegacyMemberRow[];
  readonly registrations: readonly LegacyEventRegistrationRow[];
};

export type LegacyEventImportResult = {
  readonly adminsImported: number;
  readonly boatMembersImported: number;
  readonly categoriesImported: number;
  readonly datesImported: number;
  readonly eventsImported: number;
  readonly feesImported: number;
  readonly registrationsImported: number;
  readonly registrationsSkipped: number;
};

function stringValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function flag(value: string | null | undefined): boolean {
  return stringValue(value) === '1';
}

function positiveInt(value: string | null | undefined): number | null {
  const normalized = stringValue(value);
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInt(value: string | null | undefined): number | null {
  const normalized = stringValue(value);
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function amountCents(value: string | null | undefined): number {
  const parsed = Number(stringValue(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

function legacyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function slugPart(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');
  return slug || 'legacy-event';
}

function legacyEventSlug(row: LegacyEventRow): string {
  const eid = stringValue(row.eid);
  return `legacy-${legacyHash(eid)}-${slugPart(stringValue(row.short_name) || stringValue(row.name))}`;
}

function parseLegacyDate(value: string | null | undefined): Date | null {
  const normalized = stringValue(value);
  if (normalized === '') {
    return null;
  }
  const date = new Date(`${normalized.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLegacyDateTime(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined
): Date | null {
  const date = stringValue(dateValue).slice(0, 10);
  const time = stringValue(timeValue) || '00:00:00';
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return null;
  }
  const parsed = new Date(`${date}T${time.slice(0, 8)}.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function registrationStart(value: string | null | undefined): Date | null {
  return parseLegacyDate(value);
}

function registrationEnd(value: string | null | undefined): Date | null {
  const parsed = parseLegacyDate(value);
  if (!parsed) {
    return null;
  }
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

function legacyRegistrationSourceKey(row: LegacyEventRegistrationRow): string {
  return `event_reg:${stringValue(row.eid)}:${stringValue(row.userid)}:${stringValue(row.team_id)}`;
}

function legacyFeeSourceKey(row: LegacyEventFeeRow): string {
  return `event_fee:${stringValue(row.feeid)}`;
}

function legacyBoatMemberSourceKey(row: LegacyEventBoatRow): string {
  return `event_boat:${stringValue(row.eid)}:${stringValue(row.team_id)}:${stringValue(row.boat_num)}:${stringValue(row.boat_pos)}`;
}

function registrationStatus(row: LegacyEventRegistrationRow) {
  if (!flag(row.activereg)) {
    return 'cancelled' as const;
  }
  return flag(row.confirm) ? ('approved' as const) : ('pending' as const);
}

function stageChunks<T>(rows: readonly T[], columnCount: number): T[][] {
  const maxParameters = 65_535;
  const size = Math.max(1, Math.floor(maxParameters / columnCount));
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function eventDateStageSql(row: LegacyEventDateStageRow) {
  return Prisma.sql`(${row.id}, ${row.eventId}, ${row.startDateTime}, ${row.endDateTime})`;
}

function eventFeeStageSql(row: LegacyEventFeeStageRow) {
  return Prisma.sql`(${row.id}, ${row.legacySourceKey}, ${row.eventId}, ${row.description}, ${row.amountCents}, ${row.isDeposit})`;
}

function eventAdminStageSql(row: LegacyEventAdminStageRow) {
  return Prisma.sql`(${row.id}, ${row.eventId}, ${row.adminUserId})`;
}

function eventRegistrationStageSql(row: LegacyEventRegistrationStageRow) {
  return Prisma.sql`(${row.id}, ${row.legacySourceKey}, ${row.legacyTeamKey}, ${row.eventId}, ${row.userId}, ${row.status}, ${row.phone}, ${row.createdAt}, ${row.swimAgreementAcceptedAt}, ${row.teamName})`;
}

function eventBoatMemberStageSql(row: LegacyEventBoatMemberStageRow) {
  return Prisma.sql`(${row.id}, ${row.legacySourceKey}, ${row.registrationId}, ${row.boatNumber}, ${row.position}, ${row.fullName}, ${row.email})`;
}

async function legacyUserIdentityMaps(props: {
  readonly db: LegacyEventImportDb;
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

async function importEventCategories(props: {
  readonly db: LegacyEventImportDb;
  readonly eventTypes: readonly LegacyEventTypeRow[];
}) {
  const categoryIdByLegacyType = new Map<string, string>();
  let imported = 0;
  for (const row of props.eventTypes) {
    const legacyEventType = stringValue(row.type);
    if (!legacyEventType) {
      continue;
    }
    const category = await props.db.eventCategory.upsert({
      where: { legacyEventType },
      create: {
        id: randomUUID(),
        legacyEventType,
        name: stringValue(row.name) || `Legacy event type ${legacyEventType}`,
        displayOrder: positiveInt(row.rank) ?? 999,
        isVisible: true,
        accentClassName: null,
        createdAt: new Date(0),
      },
      update: {
        name: stringValue(row.name) || `Legacy event type ${legacyEventType}`,
        displayOrder: positiveInt(row.rank) ?? 999,
        isVisible: true,
      },
      select: { id: true },
    });
    categoryIdByLegacyType.set(legacyEventType, category.id);
    imported += 1;
  }
  return { categoryIdByLegacyType, imported };
}

type LegacyEventWriteContext = Readonly<{
  eventCategoryId: string;
  legacyEventId: string;
  name: string;
  registrationMode: 'external' | 'none' | 'standard';
}>;

function legacyEventRegistrationMode(
  row: LegacyEventRow
): 'external' | 'none' | 'standard' {
  if (stringValue(row.reg_urlreg)) {
    return 'external';
  }
  return flag(row.reg_page) ? 'standard' : 'none';
}

function legacyEventDetailPageKind(
  row: LegacyEventRow
): 'external' | 'standard' {
  return stringValue(row.url) ? 'external' : 'standard';
}

function legacyEventIsPublished(row: LegacyEventRow): boolean {
  return flag(row.menu) || flag(row.reg_page) || flag(row.res_page);
}

function legacyEventWriteData(
  row: LegacyEventRow,
  context: LegacyEventWriteContext
) {
  return {
    name: context.name,
    shortName: stringValue(row.short_name) || context.name,
    eventCategoryId: context.eventCategoryId,
    description: stringValue(row.description),
    isSpecial: flag(row.special),
    maxParticipants: positiveInt(row.reg_limit),
    requiresApproval: flag(row.reg_approve),
    requiresPhone: flag(row.phone),
    usesTeamRegistration: flag(row.reg_team),
    boatsPerTeam: positiveInt(row.team_size) ?? 1,
    personsPerBoat: positiveInt(row.boat_size) ?? 1,
    allowRepeatTeamCaptain: flag(row.reg_repeatcap),
    registrationStart: registrationStart(row.reg_begin),
    registrationEnd: registrationEnd(row.reg_date),
    detailPageKind: legacyEventDetailPageKind(row),
    externalDetailUrl: stringValue(row.url) || null,
    registrationMode: context.registrationMode,
    externalRegistrationUrl: stringValue(row.reg_urlreg) || null,
    externalEntriesUrl: stringValue(row.reg_urlentries) || null,
    faqVisible: flag(row.faq_page),
    faqContent: stringValue(row.faq),
    noticeOfRaceVisible: flag(row.nor_page),
    noticeOfRaceContent: stringValue(row.nor),
    sailingInstructionsVisible: flag(row.si_page),
    sailingInstructionsContent: stringValue(row.si),
    resultsVisible: flag(row.res_page),
    resultsContent: stringValue(row.results),
    isPublished: legacyEventIsPublished(row),
    paymentsEnabled: flag(row.has_fee),
    paymentDeadlineAt: registrationEnd(row.reg_date),
  };
}

function legacyEventCreateData(
  row: LegacyEventRow,
  context: LegacyEventWriteContext
) {
  return {
    id: randomUUID(),
    legacyEventId: context.legacyEventId,
    slug: legacyEventSlug(row),
    createdAt: parseLegacyDate(row.reg_begin) ?? new Date(0),
    sailingCardRequirement: 'NONE' as const,
    addressPreset: 'pavilion' as const,
    ...legacyEventWriteData(row, context),
  };
}

async function importEvents(props: {
  readonly categoryIdByLegacyType: ReadonlyMap<string, string>;
  readonly db: LegacyEventImportDb;
  readonly events: readonly LegacyEventRow[];
}) {
  const eventIdByLegacyEid = new Map<string, string>();
  let imported = 0;
  for (const row of props.events) {
    const legacyEventId = stringValue(row.eid);
    const eventCategoryId = props.categoryIdByLegacyType.get(
      stringValue(row.event_type)
    );
    if (!legacyEventId || !eventCategoryId) {
      continue;
    }
    const name = stringValue(row.name) || `Legacy event ${legacyEventId}`;
    const context = {
      eventCategoryId,
      legacyEventId,
      name,
      registrationMode: legacyEventRegistrationMode(row),
    };
    const event = await props.db.event.upsert({
      where: { legacyEventId },
      create: legacyEventCreateData(row, context),
      update: legacyEventWriteData(row, context),
      select: { id: true },
    });
    eventIdByLegacyEid.set(legacyEventId, event.id);
    imported += 1;
  }
  return { eventIdByLegacyEid, imported };
}

async function importEventDates(props: {
  readonly dates: readonly LegacyEventDateRow[];
  readonly db: LegacyEventImportDb;
  readonly eventIdByLegacyEid: ReadonlyMap<string, string>;
}) {
  const rows = props.dates.flatMap((row) => {
    const eventId = props.eventIdByLegacyEid.get(stringValue(row.eid));
    const startDateTime = parseLegacyDateTime(row.date, row.start);
    const endDateTime = parseLegacyDateTime(row.date, row.end);
    if (!eventId || !startDateTime || !endDateTime) {
      return [];
    }
    if (endDateTime <= startDateTime) {
      endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
    }
    return [{ endDateTime, eventId, id: randomUUID(), startDateTime }];
  });
  await props.db.$executeRaw`
    CREATE TEMP TABLE legacy_import_event_dates (
      id text PRIMARY KEY,
      event_id text NOT NULL,
      start_datetime timestamp NOT NULL,
      end_datetime timestamp NOT NULL
    ) ON COMMIT DROP
  `;
  for (const chunk of stageChunks(rows, 4)) {
    await props.db.$executeRaw`
      INSERT INTO legacy_import_event_dates (
        id,
        event_id,
        start_datetime,
        end_datetime
      )
      VALUES ${Prisma.join(chunk.map(eventDateStageSql), ', ')}
    `;
  }
  if (props.eventIdByLegacyEid.size > 0) {
    const eventIds = [...props.eventIdByLegacyEid.values()];
    await props.db.$executeRaw`
      DELETE FROM "event_dates"
      WHERE "event_id" IN (${Prisma.join(eventIds)})
    `;
  }
  if (rows.length > 0) {
    await props.db.$executeRaw`
      INSERT INTO "event_dates" (
        "id",
        "event_id",
        "start_datetime",
        "end_datetime"
      )
      SELECT
        source.id,
        source.event_id,
        source.start_datetime,
        source.end_datetime
      FROM legacy_import_event_dates AS source
    `;
  }
  return rows.length;
}

async function importEventFees(props: {
  readonly db: LegacyEventImportDb;
  readonly eventIdByLegacyEid: ReadonlyMap<string, string>;
  readonly fees: readonly LegacyEventFeeRow[];
}) {
  const rows = props.fees.flatMap((row) => {
    const eventId = props.eventIdByLegacyEid.get(stringValue(row.eid));
    const legacySourceKey = legacyFeeSourceKey(row);
    if (!eventId || !stringValue(row.feeid)) {
      return [];
    }
    return [
      {
        amountCents: amountCents(row.price),
        description: stringValue(row.name) || 'Legacy fee',
        eventId,
        id: randomUUID(),
        isDeposit: false,
        legacySourceKey,
      },
    ];
  });
  await props.db.$executeRaw`
    CREATE TEMP TABLE legacy_import_event_fees (
      id text PRIMARY KEY,
      legacy_source_key text NOT NULL UNIQUE,
      event_id text NOT NULL,
      description text NOT NULL,
      amount_cents integer NOT NULL,
      is_deposit boolean NOT NULL
    ) ON COMMIT DROP
  `;
  for (const chunk of stageChunks(rows, 6)) {
    await props.db.$executeRaw`
      INSERT INTO legacy_import_event_fees (
        id,
        legacy_source_key,
        event_id,
        description,
        amount_cents,
        is_deposit
      )
      VALUES ${Prisma.join(chunk.map(eventFeeStageSql), ', ')}
      ON CONFLICT (legacy_source_key) DO UPDATE
      SET description = EXCLUDED.description,
          amount_cents = EXCLUDED.amount_cents
    `;
  }
  if (rows.length > 0) {
    await props.db.$executeRaw`
      INSERT INTO "event_entry_fees" (
        "id",
        "legacy_source_key",
        "event_id",
        "description",
        "amount_cents",
        "is_deposit"
      )
      SELECT
        source.id,
        source.legacy_source_key,
        source.event_id,
        source.description,
        source.amount_cents,
        source.is_deposit
      FROM legacy_import_event_fees AS source
      ON CONFLICT ("legacy_source_key") DO UPDATE
      SET "description" = EXCLUDED."description",
          "amount_cents" = EXCLUDED."amount_cents"
    `;
  }
  return rows.length;
}

async function importEventAdmins(props: {
  readonly contacts: readonly LegacyEventContactRow[];
  readonly db: LegacyEventImportDb;
  readonly eventIdByLegacyEid: ReadonlyMap<string, string>;
  readonly events: readonly LegacyEventRow[];
  readonly legacyMemberIdToUserId: ReadonlyMap<string, string>;
  readonly usernameToUserId: ReadonlyMap<string, string>;
}) {
  const pairs = new Map<string, { eventId: string; userId: string }>();
  const add = (eventId: string | undefined, userId: string | undefined) => {
    if (eventId && userId) {
      pairs.set(`${eventId}:${userId}`, { eventId, userId });
    }
  };
  for (const row of props.contacts) {
    add(
      props.eventIdByLegacyEid.get(stringValue(row.eid)),
      props.legacyMemberIdToUserId.get(stringValue(row.userid))
    );
  }
  for (const row of props.events) {
    add(
      props.eventIdByLegacyEid.get(stringValue(row.eid)),
      props.usernameToUserId.get(stringValue(row.updater).toLowerCase())
    );
  }
  const rows = [...pairs.values()].map((pair) => ({
    id: randomUUID(),
    eventId: pair.eventId,
    adminUserId: pair.userId,
  }));
  await props.db.$executeRaw`
    CREATE TEMP TABLE legacy_import_event_admins (
      id text PRIMARY KEY,
      event_id text NOT NULL,
      admin_user_id text NOT NULL,
      UNIQUE (event_id, admin_user_id)
    ) ON COMMIT DROP
  `;
  for (const chunk of stageChunks(rows, 3)) {
    await props.db.$executeRaw`
      INSERT INTO legacy_import_event_admins (
        id,
        event_id,
        admin_user_id
      )
      VALUES ${Prisma.join(chunk.map(eventAdminStageSql), ', ')}
      ON CONFLICT (event_id, admin_user_id) DO NOTHING
    `;
  }
  if (rows.length > 0) {
    await props.db.$executeRaw`
      INSERT INTO "event_admins" (
        "id",
        "event_id",
        "admin_user_id"
      )
      SELECT
        source.id,
        source.event_id,
        source.admin_user_id
      FROM legacy_import_event_admins AS source
      ON CONFLICT ("event_id", "admin_user_id") DO NOTHING
    `;
  }
  return rows.length;
}

async function importEventRegistrations(props: {
  readonly db: LegacyEventImportDb;
  readonly eventIdByLegacyEid: ReadonlyMap<string, string>;
  readonly legacyMemberIdToUserId: ReadonlyMap<string, string>;
  readonly registrations: readonly LegacyEventRegistrationRow[];
}) {
  let skipped = 0;
  const rows = props.registrations.flatMap((row) => {
    const legacyEid = stringValue(row.eid);
    const eventId = props.eventIdByLegacyEid.get(legacyEid);
    const userId = props.legacyMemberIdToUserId.get(stringValue(row.userid));
    if (!eventId || !userId) {
      skipped += 1;
      return [];
    }
    const legacySourceKey = legacyRegistrationSourceKey(row);
    const teamId = stringValue(row.team_id);
    return [
      {
        createdAt: new Date(0),
        eventId,
        id: randomUUID(),
        legacySourceKey,
        legacyTeamKey: teamId ? `${legacyEid}:${teamId}` : null,
        phone: 'Unknown',
        status: registrationStatus(row),
        swimAgreementAcceptedAt: new Date(0),
        teamName: teamId
          ? stringValue(row.team_name) || `Legacy team ${teamId}`
          : null,
        userId,
      },
    ];
  });
  await props.db.$executeRaw`
    CREATE TEMP TABLE legacy_import_event_registrations (
      id text PRIMARY KEY,
      legacy_source_key text NOT NULL UNIQUE,
      legacy_team_key text,
      event_id text NOT NULL,
      user_id text NOT NULL,
      status text NOT NULL,
      phone text NOT NULL,
      created_at timestamp NOT NULL,
      swim_agreement_accepted_at timestamp NOT NULL,
      team_name text
    ) ON COMMIT DROP
  `;
  for (const chunk of stageChunks(rows, 10)) {
    await props.db.$executeRaw`
      INSERT INTO legacy_import_event_registrations (
        id,
        legacy_source_key,
        legacy_team_key,
        event_id,
        user_id,
        status,
        phone,
        created_at,
        swim_agreement_accepted_at,
        team_name
      )
      VALUES ${Prisma.join(chunk.map(eventRegistrationStageSql), ', ')}
      ON CONFLICT (legacy_source_key) DO UPDATE
      SET status = EXCLUDED.status,
          team_name = EXCLUDED.team_name
    `;
  }
  if (rows.length > 0) {
    await props.db.$executeRaw`
      UPDATE "event_registrations" AS target
      SET "status" = source.status::text::"EventRegistrationStatus"
      FROM legacy_import_event_registrations AS source
      WHERE target."legacy_source_key" = source.legacy_source_key
    `;
    await props.db.$executeRaw`
      INSERT INTO "event_registrations" (
        "id",
        "legacy_source_key",
        "event_id",
        "user_id",
        "status",
        "phone",
        "created_at",
        "swim_agreement_accepted_at"
      )
      SELECT
        source.id,
        source.legacy_source_key,
        source.event_id,
        source.user_id,
        source.status::text::"EventRegistrationStatus",
        source.phone,
        source.created_at,
        source.swim_agreement_accepted_at
      FROM legacy_import_event_registrations AS source
      WHERE NOT EXISTS (
        SELECT 1
        FROM "event_registrations" AS target
        WHERE target."legacy_source_key" = source.legacy_source_key
      )
    `;
    await props.db.$executeRaw`
      INSERT INTO "event_registration_teams" (
        "id",
        "registration_id",
        "team_name",
        "allow_repeat_captain"
      )
      SELECT
        source.id,
        registration.id,
        source.team_name,
        false
      FROM legacy_import_event_registrations AS source
      INNER JOIN "event_registrations" AS registration
        ON registration."legacy_source_key" = source.legacy_source_key
      WHERE source.legacy_team_key IS NOT NULL
        AND source.team_name IS NOT NULL
      ON CONFLICT ("registration_id") DO UPDATE
      SET "team_name" = EXCLUDED."team_name"
    `;
  }
  const teamRows =
    rows.length === 0
      ? []
      : await props.db.$queryRaw<LegacyTeamRegistrationRow[]>`
          SELECT
            source.legacy_team_key,
            registration."id" AS registration_id
          FROM legacy_import_event_registrations AS source
          INNER JOIN "event_registrations" AS registration
            ON registration."legacy_source_key" = source.legacy_source_key
          WHERE source.legacy_team_key IS NOT NULL
        `;
  return {
    imported: rows.length,
    registrationIdByLegacyTeam: new Map(
      teamRows.map((row) => [row.legacy_team_key, row.registration_id])
    ),
    skipped,
  };
}

async function importBoatMembers(props: {
  readonly boats: readonly LegacyEventBoatRow[];
  readonly db: LegacyEventImportDb;
  readonly registrationIdByLegacyTeam: ReadonlyMap<string, string>;
}) {
  const rows = props.boats.flatMap((row) => {
    const registrationId = props.registrationIdByLegacyTeam.get(
      `${stringValue(row.eid)}:${stringValue(row.team_id)}`
    );
    const fullName = stringValue(row.name);
    const email = stringValue(row.e_mail).toLowerCase();
    const boatNumber = positiveInt(row.boat_num);
    const position = nonNegativeInt(row.boat_pos);
    if (
      !registrationId ||
      !fullName ||
      !email ||
      !boatNumber ||
      position === null
    ) {
      return [];
    }
    const legacySourceKey = legacyBoatMemberSourceKey(row);
    return [
      {
        boatNumber,
        email,
        fullName,
        id: randomUUID(),
        legacySourceKey,
        position,
        registrationId,
      },
    ];
  });
  await props.db.$executeRaw`
    CREATE TEMP TABLE legacy_import_event_boat_members (
      id text PRIMARY KEY,
      legacy_source_key text NOT NULL UNIQUE,
      registration_id text NOT NULL,
      boat_number integer NOT NULL,
      position integer NOT NULL,
      full_name text NOT NULL,
      email text NOT NULL,
      UNIQUE (registration_id, boat_number, position)
    ) ON COMMIT DROP
  `;
  for (const chunk of stageChunks(rows, 7)) {
    await props.db.$executeRaw`
      INSERT INTO legacy_import_event_boat_members (
        id,
        legacy_source_key,
        registration_id,
        boat_number,
        position,
        full_name,
        email
      )
      VALUES ${Prisma.join(chunk.map(eventBoatMemberStageSql), ', ')}
      ON CONFLICT (legacy_source_key) DO UPDATE
      SET boat_number = EXCLUDED.boat_number,
          position = EXCLUDED.position,
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email
    `;
  }
  if (rows.length > 0) {
    await props.db.$executeRaw`
      UPDATE "event_registration_boat_members" AS target
      SET "boat_number" = source.boat_number,
          "position" = source.position,
          "full_name" = source.full_name,
          "email" = source.email
      FROM legacy_import_event_boat_members AS source
      WHERE target."legacy_source_key" = source.legacy_source_key
    `;
    await props.db.$executeRaw`
      UPDATE "event_registration_boat_members" AS target
      SET "legacy_source_key" = source.legacy_source_key,
          "full_name" = source.full_name,
          "email" = source.email
      FROM legacy_import_event_boat_members AS source
      WHERE target."registration_id" = source.registration_id
        AND target."boat_number" = source.boat_number
        AND target."position" = source.position
        AND target."legacy_source_key" IS NULL
    `;
    await props.db.$executeRaw`
      INSERT INTO "event_registration_boat_members" (
        "id",
        "legacy_source_key",
        "registration_id",
        "boat_number",
        "position",
        "full_name",
        "email"
      )
      SELECT
        source.id,
        source.legacy_source_key,
        source.registration_id,
        source.boat_number,
        source.position,
        source.full_name,
        source.email
      FROM legacy_import_event_boat_members AS source
      WHERE NOT EXISTS (
        SELECT 1
        FROM "event_registration_boat_members" AS target
        WHERE target."legacy_source_key" = source.legacy_source_key
      )
        AND NOT EXISTS (
          SELECT 1
          FROM "event_registration_boat_members" AS target
          WHERE target."registration_id" = source.registration_id
            AND target."boat_number" = source.boat_number
            AND target."position" = source.position
        )
    `;
  }
  return rows.length;
}

export async function importLegacyEventRows(
  rows: LegacyEventImportRows
): Promise<LegacyEventImportResult> {
  const result = await prisma.$transaction(async (tx) => {
    const db: LegacyEventImportDb = tx;
    const categoryResult = await importEventCategories({
      db,
      eventTypes: rows.eventTypes,
    });
    const eventResult = await importEvents({
      categoryIdByLegacyType: categoryResult.categoryIdByLegacyType,
      db,
      events: rows.events,
    });
    const datesImported = await importEventDates({
      dates: rows.dates,
      db,
      eventIdByLegacyEid: eventResult.eventIdByLegacyEid,
    });
    const feesImported = await importEventFees({
      db,
      eventIdByLegacyEid: eventResult.eventIdByLegacyEid,
      fees: rows.fees,
    });
    const legacyUserMaps = await legacyUserIdentityMaps({
      db,
      members: rows.members,
    });
    const adminsImported = await importEventAdmins({
      contacts: rows.contacts,
      db,
      eventIdByLegacyEid: eventResult.eventIdByLegacyEid,
      events: rows.events,
      legacyMemberIdToUserId: legacyUserMaps.legacyMemberIdToUserId,
      usernameToUserId: legacyUserMaps.usernameToUserId,
    });
    const registrations = await importEventRegistrations({
      db,
      eventIdByLegacyEid: eventResult.eventIdByLegacyEid,
      legacyMemberIdToUserId: legacyUserMaps.legacyMemberIdToUserId,
      registrations: rows.registrations,
    });
    const boatMembersImported = await importBoatMembers({
      boats: rows.boats,
      db,
      registrationIdByLegacyTeam: registrations.registrationIdByLegacyTeam,
    });
    return {
      adminsImported,
      boatMembersImported,
      categoriesImported: categoryResult.imported,
      datesImported,
      eventsImported: eventResult.imported,
      feesImported,
      registrationsImported: registrations.imported,
      registrationsSkipped: registrations.skipped,
    };
  });
  return result;
}

export async function importLegacyEventsFromSchema(): Promise<LegacyEventImportResult> {
  const [
    eventTypes,
    events,
    dates,
    registrations,
    contacts,
    fees,
    boats,
    members,
  ] = await Promise.all([
    prisma.$queryRaw<LegacyEventTypeRow[]>`
      SELECT *
      FROM legacy.event_types
      ORDER BY rank
    `,
    prisma.$queryRaw<LegacyEventRow[]>`
      SELECT *
      FROM legacy.events
      ORDER BY idx
    `,
    prisma.$queryRaw<LegacyEventDateRow[]>`
      SELECT *
      FROM legacy.event_dates
      ORDER BY eid, date, start
    `,
    prisma.$queryRaw<LegacyEventRegistrationRow[]>`
      SELECT *
      FROM legacy.event_regs
      ORDER BY eid, team_id, userid
    `,
    prisma.$queryRaw<LegacyEventContactRow[]>`
      SELECT *
      FROM legacy.event_contact
      ORDER BY eid, userid
    `,
    prisma.$queryRaw<LegacyEventFeeRow[]>`
      SELECT *
      FROM legacy.event_fees
      ORDER BY eid, feeid
    `,
    prisma.$queryRaw<LegacyEventBoatRow[]>`
      SELECT *
      FROM legacy.event_boats
      ORDER BY eid, team_id, boat_num, boat_pos
    `,
    prisma.$queryRaw<LegacyMemberRow[]>`
      SELECT *
      FROM legacy.members
      WHERE active = '1'
      ORDER BY lower(trim(email)), record_date DESC, record DESC
    `,
  ]);
  return importLegacyEventRows({
    boats,
    contacts,
    dates,
    eventTypes,
    events,
    fees,
    members,
    registrations,
  });
}
