import { prisma } from '@/libs/DB';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';

export type LegacyNewsRow = {
  readonly end_date: string | null;
  readonly id: string | null;
  readonly news: string | null;
  readonly news_date: string | null;
  readonly updater: string | null;
};

export type LegacyNewsImportResult = {
  readonly imported: number;
  readonly skipped: number;
};

function stringValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function decodeBasicEntities(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function parseLegacyDate(value: string | null | undefined): Date | null {
  const normalized = stringValue(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    return null;
  }
  return prismaDateFromIsoCalendar(normalized);
}

export async function importLegacyNewsRows(
  rows: readonly LegacyNewsRow[]
): Promise<LegacyNewsImportResult> {
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const legacyNewsId = stringValue(row.id);
    const body = decodeBasicEntities(stringValue(row.news));
    const startDate = parseLegacyDate(row.news_date);
    const lastDate = parseLegacyDate(row.end_date) ?? startDate;
    if (
      !legacyNewsId ||
      !body ||
      !startDate ||
      !lastDate ||
      lastDate < startDate
    ) {
      skipped += 1;
      continue;
    }
    await prisma.siteAlert.upsert({
      where: { legacyNewsId },
      create: {
        legacyNewsId,
        body,
        isPublished: true,
        startDate,
        lastDate,
      },
      update: {
        body,
        isPublished: true,
        startDate,
        lastDate,
      },
    });
    imported += 1;
  }
  return { imported, skipped };
}

export async function importLegacyNewsFromSchema(): Promise<LegacyNewsImportResult> {
  const rows = await prisma.$queryRaw<LegacyNewsRow[]>`
    SELECT *
    FROM legacy.news
    ORDER BY id
  `;
  return importLegacyNewsRows(rows);
}
