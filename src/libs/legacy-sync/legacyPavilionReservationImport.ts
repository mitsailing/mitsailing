import { prisma } from '@/libs/DB';
import { decodeBasicLegacyEntities } from '@/libs/legacy-sync/legacyHtmlEntities';
import type { LegacyMysqlReader } from '@/libs/legacy-sync/legacyMysqlReader';
import { legacyMysqlReaderFromEnv } from '@/libs/legacy-sync/legacyMysqlReader';
import { logger } from '@/libs/Logger';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import { pavilionReservationStoredSlotMinutesFromRaw } from '@/libs/mit-sailing/pavilionReservationSlotMinutes';

export type LegacyReservationDbRow = {
  acct: string | null;
  acadfac: string | null;
  acadfacemail: string | null;
  active: number | null;
  affil: string | null;
  comments: string | null;
  confirmed: number | null;
  contacted: number | null;
  date1: string | null;
  date2: string | null;
  datesel: number | null;
  email: string | null;
  end1: string | null;
  end2: string | null;
  first: string | null;
  groupname: string | null;
  groupsize: string | null;
  infoalcohol: number | null;
  infotent: number | null;
  last: string | null;
  mitid: string | null;
  paid: number | null;
  phone: string | null;
  resid: string;
  start1: string | null;
  start2: string | null;
  tentative: number | null;
  title: string | null;
};

type LegacySlot = {
  date: string;
  endMinutes: number;
  startMinutes: number;
};

type LegacyStatus =
  | 'approved'
  | 'cancelled'
  | 'declined'
  | 'needs_info'
  | 'pending';
type LegacyPaymentStatus = 'paid' | 'unpaid' | 'waived';
type LegacyPersona =
  | 'mit_academic'
  | 'mit_community'
  | 'mit_student'
  | 'non_mit';

const LEGACY_PAVILION_CSV_REQUIRED_HEADERS = [
  'resid',
  'first',
  'last',
  'mitid',
  'email',
  'phone',
  'affil',
  'groupname',
  'title',
  'acadfac',
  'acadfacemail',
  'acct',
  'date1',
  'start1',
  'end1',
  'date2',
  'start2',
  'end2',
  'datesel',
  'comments',
  'infotent',
  'infoalcohol',
  'groupsize',
  'active',
  'tentative',
  'confirmed',
  'paid',
  'contacted',
] as const satisfies readonly (keyof LegacyReservationDbRow)[];

function parseCsvRecords(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error('Legacy pavilion CSV ends inside a quoted field.');
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim().length > 0)
  );
}

function cell(record: Record<string, string>, key: string): string {
  return record[key] ?? '';
}

function as01(value: string): 0 | 1 {
  return value.trim() === '1' ? 1 : 0;
}

function stringValue(value: string | null): string {
  return value ?? '';
}

function numberFlag(value: number | null): 0 | 1 {
  return value === 1 ? 1 : 0;
}

function assertLegacyPavilionCsvHeaders(headers: string[]): void {
  if (headers.length === 0) {
    throw new Error('Legacy pavilion CSV has no header row.');
  }
  const headerSet = new Set(headers);
  const missing = LEGACY_PAVILION_CSV_REQUIRED_HEADERS.filter(
    (required) => !headerSet.has(required)
  );
  if (missing.length > 0) {
    throw new Error(
      `Legacy pavilion CSV is missing required columns: ${missing.join(', ')}.`
    );
  }
}

export function legacyPavilionReservationRowsFromCsv(
  csv: string
): LegacyReservationDbRow[] {
  const byteOrderMark = 65_279;
  const records = parseCsvRecords(
    csv.codePointAt(0) === byteOrderMark ? csv.slice(1) : csv
  );
  const headers = records[0]?.map((header) => header.trim()) ?? [];
  assertLegacyPavilionCsvHeaders(headers);
  return records.slice(1).flatMap((fields, rowIndex) => {
    if (fields.length !== headers.length) {
      throw new Error(
        `Legacy pavilion CSV row ${rowIndex + 2} has wrong field count: expected ${headers.length}, received ${fields.length}.`
      );
    }
    const record = Object.fromEntries(
      headers.map((header, index) => [header, fields[index] ?? ''])
    );
    const resid = cell(record, 'resid').trim();
    if (!resid) {
      return [];
    }
    return [
      {
        resid,
        first: cell(record, 'first'),
        last: cell(record, 'last'),
        mitid: cell(record, 'mitid'),
        email: cell(record, 'email'),
        phone: cell(record, 'phone'),
        affil: cell(record, 'affil'),
        groupname: cell(record, 'groupname'),
        title: cell(record, 'title'),
        acadfac: cell(record, 'acadfac'),
        acadfacemail: cell(record, 'acadfacemail'),
        acct: cell(record, 'acct'),
        date1: cell(record, 'date1'),
        start1: cell(record, 'start1'),
        end1: cell(record, 'end1'),
        date2: cell(record, 'date2'),
        start2: cell(record, 'start2'),
        end2: cell(record, 'end2'),
        datesel: Number(cell(record, 'datesel')) || 0,
        comments: cell(record, 'comments'),
        infotent: as01(cell(record, 'infotent')),
        infoalcohol: as01(cell(record, 'infoalcohol')),
        groupsize: cell(record, 'groupsize'),
        active: as01(cell(record, 'active')),
        tentative: as01(cell(record, 'tentative')),
        confirmed: as01(cell(record, 'confirmed')),
        paid: as01(cell(record, 'paid')),
        contacted: as01(cell(record, 'contacted')),
      },
    ];
  });
}

function inferSpaceSlugs(row: LegacyReservationDbRow): string[] {
  const hay =
    `${stringValue(row.title)} ${stringValue(row.groupname)} ${stringValue(row.comments)}`.toLowerCase();
  const slugs: string[] = [];
  const add = (slug: string) => {
    if (!slugs.includes(slug)) {
      slugs.push(slug);
    }
  };
  if (/\b(roof deck|east roof|upper deck|roof tent|rooftop)\b/u.test(hay)) {
    add('roof_deck');
  }
  if (/\b(casual party|wooden dock|party space|shore school)\b/u.test(hay)) {
    add('casual_dock');
  }
  if (/\b(party boat|riverboat|cruise|charles river|boat dock)\b/u.test(hay)) {
    add('party_boat');
  } else if (/\b(dock|grill|patio)\b/u.test(hay)) {
    add('casual_dock');
  }
  if (/\b(wedding|ceremony|reception)\b/u.test(hay)) {
    add('wedding_space');
  }
  if (/\b(lab access|dock experiment)\b/u.test(hay)) {
    add('lab_access');
  }
  if (/\b(group sailing|sailing lesson)\b/u.test(hay)) {
    add('group_sailing');
  }
  return slugs;
}

function resolveInferredSpaceItemIds(props: {
  itemIdBySlug: Map<string, string>;
  row: LegacyReservationDbRow;
}): { itemIds: string[]; ok: true } | { missingSlugs: string[]; ok: false } {
  const slugs = inferSpaceSlugs(props.row);
  if (slugs.length === 0) {
    return { missingSlugs: [], ok: false };
  }

  const itemIds: string[] = [];
  const missingSlugs: string[] = [];
  for (const slug of slugs) {
    const itemId = props.itemIdBySlug.get(slug);
    if (itemId) {
      itemIds.push(itemId);
    } else {
      missingSlugs.push(slug);
    }
  }

  if (missingSlugs.length > 0) {
    return { missingSlugs, ok: false };
  }
  return { itemIds, ok: true };
}

function parseLegacyDateTimeTimeOfDay(value: string | null): number | null {
  const match = stringValue(value)
    .trim()
    .match(/^\d{4}-\d{2}-\d{2}\s+(\d{1,2}):(\d{2}):\d{2}$/u);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

export function minutesFromMysqlTime(value: string | null): number | null {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/u);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

export function minutesFromLegacyTime(value: string | null): number | null {
  return minutesFromMysqlTime(value) ?? parseLegacyDateTimeTimeOfDay(value);
}

function optionSlot(
  row: LegacyReservationDbRow,
  option: 1 | 2
): LegacySlot | null {
  const date = stringValue(option === 1 ? row.date1 : row.date2).trim();
  const startMinutes = minutesFromLegacyTime(
    option === 1 ? row.start1 : row.start2
  );
  const rawEndMinutes = minutesFromLegacyTime(
    option === 1 ? row.end1 : row.end2
  );
  if (!date || startMinutes === null || rawEndMinutes === null) {
    return null;
  }
  const slotMinutes = pavilionReservationStoredSlotMinutesFromRaw({
    startMinutes,
    rawEndMinutes,
  });
  if (slotMinutes === null) {
    return null;
  }
  return {
    date,
    endMinutes: slotMinutes.endMinutes,
    startMinutes: slotMinutes.startMinutes,
  };
}

function resolveSlot(row: LegacyReservationDbRow): LegacySlot | null {
  if (numberFlag(row.confirmed) !== 1 && numberFlag(row.paid) !== 1) {
    return optionSlot(row, 1) ?? optionSlot(row, 2);
  }
  return (
    (row.datesel === 2 ? optionSlot(row, 2) : optionSlot(row, 1)) ??
    optionSlot(row, 1)
  );
}

function statusFromRow(row: LegacyReservationDbRow): {
  paymentStatus: LegacyPaymentStatus;
  status: LegacyStatus;
} {
  if (
    numberFlag(row.active) === 0 &&
    numberFlag(row.tentative) === 0 &&
    numberFlag(row.confirmed) === 0 &&
    numberFlag(row.paid) === 0 &&
    numberFlag(row.contacted) === 0
  ) {
    return { paymentStatus: 'unpaid', status: 'cancelled' };
  }
  if (numberFlag(row.confirmed) === 1 || numberFlag(row.paid) === 1) {
    return {
      paymentStatus: numberFlag(row.paid) === 1 ? 'paid' : 'unpaid',
      status: 'approved',
    };
  }
  if (numberFlag(row.tentative) === 1) {
    return { paymentStatus: 'unpaid', status: 'needs_info' };
  }
  return { paymentStatus: 'unpaid', status: 'pending' };
}

function personaFromAffil(affil: string | null): LegacyPersona {
  const normalized = stringValue(affil).trim().toLowerCase();
  if (normalized === 'acad') {
    return 'mit_academic';
  }
  if (normalized === 'student') {
    return 'mit_student';
  }
  if (normalized === 'mitgroup') {
    return 'mit_community';
  }
  return 'non_mit';
}

const LEGACY_RESID_FALLBACK_CREATED_AT = new Date('2025-06-01T12:00:00.000Z');

function createdAtFromResid(resid: string): Date {
  const match = resid.match(/^(\d{4}-\d{2}-\d{2}):(\d{2}):(\d{2}):(\d{2})-/u);
  if (!match) {
    return LEGACY_RESID_FALLBACK_CREATED_AT;
  }
  const createdAt = new Date(
    `${match[1]}T${match[2]}:${match[3]}:${match[4]}.000Z`
  );
  return Number.isNaN(createdAt.getTime())
    ? LEGACY_RESID_FALLBACK_CREATED_AT
    : createdAt;
}

export function legacyReservationReferenceCode(resid: string): string {
  return `LEG-${resid.replaceAll(/[^a-zA-Z0-9]+/gu, '-').replaceAll(/^-|-$/gu, '')}`;
}

function legacyReservationId(resid: string): string {
  return `legacy-${resid.replaceAll(/[^a-zA-Z0-9]+/gu, '-')}`;
}

function intOrNull(value: string | null): number | null {
  const parsed = Number(stringValue(value).trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function legacyReservationSlotDeleteWhere(requestId: string): {
  requestId: string;
} {
  if (!requestId) {
    throw new Error(
      'A request id is required to replace legacy reservation slots.'
    );
  }
  return { requestId };
}

export type LegacyPavilionReservationImportResult = {
  imported: number;
  skipped: number;
};

export async function importLegacyPavilionReservationRows(
  rows: readonly LegacyReservationDbRow[]
): Promise<LegacyPavilionReservationImportResult> {
  const items = await prisma.pavilionReservableItem.findMany({
    select: { id: true, slug: true },
    where: { kind: 'space' },
  });
  const itemIdBySlug = new Map(items.map((item) => [item.slug, item.id]));
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const slot = resolveSlot(row);
    const requestedDate = slot ? prismaDateFromIsoCalendar(slot.date) : null;
    if (!slot || !requestedDate || !stringValue(row.email).trim()) {
      skipped += 1;
      continue;
    }

    const spaceResolution = resolveInferredSpaceItemIds({ itemIdBySlug, row });
    if (!spaceResolution.ok) {
      if (spaceResolution.missingSlugs.length > 0) {
        logger.warn(
          '[legacy-pavilion-reservation-import] resid={resid} missing_catalog_slugs={missingCatalogSlugs}',
          {
            missingCatalogSlugs: spaceResolution.missingSlugs,
            resid: row.resid,
          }
        );
      }
      skipped += 1;
      continue;
    }
    const { itemIds } = spaceResolution;

    const { paymentStatus, status } = statusFromRow(row);
    const referenceCode = legacyReservationReferenceCode(row.resid);
    const createdAt = createdAtFromResid(row.resid);

    await prisma.$transaction(async (tx) => {
      const request = await tx.pavilionReservationRequest.upsert({
        where: { referenceCode },
        create: {
          id: legacyReservationId(row.resid),
          referenceCode,
          status,
          persona: personaFromAffil(row.affil),
          requesterEmail: stringValue(row.email).trim(),
          firstName: stringValue(row.first).trim() || 'Legacy',
          lastName: stringValue(row.last).trim() || 'Requester',
          phone: stringValue(row.phone).trim() || 'Unknown',
          eventName:
            decodeBasicLegacyEntities(stringValue(row.title).trim()) ||
            '(Untitled event)',
          groupName:
            decodeBasicLegacyEntities(stringValue(row.groupname).trim()) ||
            null,
          groupSize: intOrNull(row.groupsize),
          description:
            decodeBasicLegacyEntities(stringValue(row.comments).trim()) ||
            `Imported legacy reservation ${row.resid}.`,
          hasTent: numberFlag(row.infotent) === 1,
          servesAlcohol: numberFlag(row.infoalcohol) === 1,
          projectTitle: null,
          advisorName:
            decodeBasicLegacyEntities(stringValue(row.acadfac).trim()) || null,
          advisorEmail: stringValue(row.acadfacemail).trim() || null,
          costCenter: stringValue(row.acct).trim() || null,
          mitId: stringValue(row.mitid).trim() || null,
          mitAccount: stringValue(row.acct).trim() || null,
          estimatedTotalCents: null,
          createdAt,
          adminNotes: `Imported from legacy reservation row ${row.resid}. Space list inferred from text.`,
          paymentStatus,
          paidAt: paymentStatus === 'paid' ? createdAt : null,
        },
        update: {
          status,
          adminNotes: `Imported from legacy reservation row ${row.resid}. Space list inferred from text.`,
          paymentStatus,
          paidAt: paymentStatus === 'paid' ? createdAt : null,
        },
        select: { id: true },
      });

      await tx.pavilionReservationSlot.deleteMany({
        where: legacyReservationSlotDeleteWhere(request.id),
      });
      await tx.pavilionReservationSlot.createMany({
        data: itemIds.map((itemId, index) => ({
          requestId: request.id,
          itemId,
          itemKind: 'space',
          requestedDate,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          estimatedAmountCents: null,
          displayOrder: index,
        })),
      });
    });
    imported += 1;
  }

  return { imported, skipped };
}

export async function importLegacyPavilionReservations(
  reader: LegacyMysqlReader = legacyMysqlReaderFromEnv()
): Promise<LegacyPavilionReservationImportResult> {
  const rows = await reader.fetchReservations();
  return importLegacyPavilionReservationRows(rows);
}
