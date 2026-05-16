import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { prisma } from '../src/libs/DB';
import { prismaDateFromIsoCalendar } from '../src/libs/mit-sailing/isoCalendarDate';

type LegacyCsvRow = {
  resid: string;
  first: string;
  last: string;
  mitid: string;
  email: string;
  phone: string;
  affil: string;
  groupname: string;
  title: string;
  acadfac: string;
  acadfacemail: string;
  acct: string;
  date1: string;
  start1: string;
  end1: string;
  date2: string;
  start2: string;
  end2: string;
  datesel: number;
  comments: string;
  infotent: 0 | 1;
  infoalcohol: 0 | 1;
  groupsize: string;
  active: 0 | 1;
  tentative: 0 | 1;
  confirmed: 0 | 1;
  paid: 0 | 1;
  contacted: 0 | 1;
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

const DEFAULT_CSV_PATH =
  '/Users/andrewkelley/GitHub/reservations/src/app/admin/legacy/reservations.csv';

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

function rowsFromCsv(csv: string): LegacyCsvRow[] {
  const byteOrderMark = 65_279;
  const records = parseCsvRecords(
    csv.codePointAt(0) === byteOrderMark ? csv.slice(1) : csv
  );
  const headers = records[0]?.map((header) => header.trim()) ?? [];
  return records.slice(1).flatMap((fields) => {
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

function decodeBasicEntities(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function inferSpaceSlugs(row: LegacyCsvRow): string[] {
  const hay = `${row.title} ${row.groupname} ${row.comments}`.toLowerCase();
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
  }
  if (/\b(dock|grill|patio)\b/u.test(hay)) {
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
  return slugs.length > 0 ? slugs : ['roof_deck'];
}

function parseLegacyTimeOfDay(value: string): number | null {
  const match = value
    .trim()
    .match(/^\d{4}-\d{2}-\d{2}\s+(\d{1,2}):(\d{2}):\d{2}\s/u);
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

function optionSlot(row: LegacyCsvRow, option: 1 | 2): LegacySlot | null {
  const date = (option === 1 ? row.date1 : row.date2).trim();
  const startMinutes = parseLegacyTimeOfDay(
    option === 1 ? row.start1 : row.start2
  );
  const rawEndMinutes = parseLegacyTimeOfDay(
    option === 1 ? row.end1 : row.end2
  );
  if (!date || startMinutes === null || rawEndMinutes === null) {
    return null;
  }
  const endMinutes =
    rawEndMinutes <= startMinutes ? rawEndMinutes + 24 * 60 : rawEndMinutes;
  if (endMinutes > 26 * 60 || endMinutes <= startMinutes) {
    return null;
  }
  return { date, endMinutes, startMinutes };
}

function resolveSlot(row: LegacyCsvRow): LegacySlot | null {
  if (row.confirmed !== 1 && row.paid !== 1) {
    return optionSlot(row, 1) ?? optionSlot(row, 2);
  }
  return (
    (row.datesel === 2 ? optionSlot(row, 2) : optionSlot(row, 1)) ??
    optionSlot(row, 1)
  );
}

function statusFromRow(row: LegacyCsvRow): {
  paymentStatus: LegacyPaymentStatus;
  status: LegacyStatus;
} {
  if (
    row.active === 0 &&
    row.tentative === 0 &&
    row.confirmed === 0 &&
    row.paid === 0 &&
    row.contacted === 0
  ) {
    return { paymentStatus: 'unpaid', status: 'cancelled' };
  }
  if (row.confirmed === 1 || row.paid === 1) {
    return {
      paymentStatus: row.paid === 1 ? 'paid' : 'unpaid',
      status: 'approved',
    };
  }
  if (row.tentative === 1) {
    return { paymentStatus: 'unpaid', status: 'needs_info' };
  }
  return { paymentStatus: 'unpaid', status: 'pending' };
}

function personaFromAffil(affil: string): LegacyPersona {
  const normalized = affil.trim().toLowerCase();
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

function createdAtFromResid(resid: string): Date {
  const match = resid.match(/^(\d{4}-\d{2}-\d{2}):(\d{2}):(\d{2}):(\d{2})-/u);
  if (!match) {
    return new Date('2025-06-01T12:00:00.000Z');
  }
  return new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.000Z`);
}

function referenceCodeFromResid(resid: string): string {
  return `LEG-${resid.replaceAll(/[^a-zA-Z0-9]+/gu, '-').replaceAll(/^-|-$/gu, '')}`;
}

function intOrNull(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function main(): Promise<void> {
  const csvPath = process.argv[2] ?? DEFAULT_CSV_PATH;
  const csv = await readFile(csvPath, 'utf8');
  const rows = rowsFromCsv(csv);
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
    if (!slot || !requestedDate || !row.email.trim()) {
      skipped += 1;
      continue;
    }

    const itemIds = inferSpaceSlugs(row)
      .map((slug) => itemIdBySlug.get(slug) ?? null)
      .filter((itemId): itemId is string => itemId !== null);
    if (itemIds.length === 0) {
      skipped += 1;
      continue;
    }

    const { paymentStatus, status } = statusFromRow(row);
    const referenceCode = referenceCodeFromResid(row.resid);
    const createdAt = createdAtFromResid(row.resid);

    await prisma.$transaction(async (tx) => {
      const request = await tx.pavilionReservationRequest.upsert({
        where: { referenceCode },
        create: {
          id: `legacy-${row.resid.replaceAll(/[^a-zA-Z0-9]+/gu, '-')}`,
          referenceCode,
          status,
          persona: personaFromAffil(row.affil),
          requesterEmail: row.email.trim(),
          firstName: row.first.trim() || 'Legacy',
          lastName: row.last.trim() || 'Requester',
          phone: row.phone.trim() || 'Unknown',
          eventName:
            decodeBasicEntities(row.title.trim()) || '(Untitled event)',
          groupName: decodeBasicEntities(row.groupname.trim()) || null,
          groupSize: intOrNull(row.groupsize),
          description:
            decodeBasicEntities(row.comments.trim()) ||
            `Imported legacy reservation ${row.resid}.`,
          hasTent: row.infotent === 1,
          servesAlcohol: row.infoalcohol === 1,
          projectTitle: null,
          advisorName: decodeBasicEntities(row.acadfac.trim()) || null,
          advisorEmail: row.acadfacemail.trim() || null,
          costCenter: row.acct.trim() || null,
          mitId: row.mitid.trim() || null,
          mitAccount: row.acct.trim() || null,
          estimatedTotalCents: null,
          createdAt,
          adminNotes: `Imported from legacy reservation CSV row ${row.resid}. Space list inferred from text.`,
          paymentStatus,
          paidAt: paymentStatus === 'paid' ? createdAt : null,
          slots: {
            create: itemIds.map((itemId, index) => ({
              itemId,
              requestedDate,
              startMinutes: slot.startMinutes,
              endMinutes: slot.endMinutes,
              estimatedAmountCents: null,
              displayOrder: index,
            })),
          },
        },
        update: {
          status,
          adminNotes: `Imported from legacy reservation CSV row ${row.resid}. Space list inferred from text.`,
          paymentStatus,
          paidAt: paymentStatus === 'paid' ? createdAt : null,
        },
        select: { id: true },
      });

      await tx.pavilionReservationSlot.deleteMany({
        where: { requestId: request.id },
      });
      await tx.pavilionReservationSlot.createMany({
        data: itemIds.map((itemId, index) => ({
          requestId: request.id,
          itemId,
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

  console.log(
    `Imported ${imported} legacy Pavilion reservations; skipped ${skipped}.`
  );
}

async function run(): Promise<void> {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await run();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
