import { describe, expect, it, vi } from 'vitest';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import {
  siteAlertEligibleForBannerAt,
  siteAlertEligibleForBannerOnEasternDay,
} from '@/libs/mit-sailing/siteAlertBannerEligibility';
import { prismaWhereSiteAlertBannerForCalendarDay } from '@/libs/mit-sailing/siteAlertQueries';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], Result>(
    fn: (...args: Args) => Promise<Result>
  ) => fn,
}));
vi.mock('@/libs/DB', () => ({ prisma: { siteAlert: { findMany } } }));

/** Noon UTC on a calendar day that is still the same NY calendar date in EDT. */
const nyNoonUtc = '2026-04-15T16:00:00.000Z';

function matchesPrismaBannerDateBounds(
  todayIso: string,
  startIso: string,
  lastIso: string
): boolean {
  const today = prismaDateFromIsoCalendar(todayIso);
  const start = prismaDateFromIsoCalendar(startIso);
  const last = prismaDateFromIsoCalendar(lastIso);
  if (!today || !start || !last) {
    return false;
  }
  return (
    start.getTime() <= today.getTime() && last.getTime() >= today.getTime()
  );
}

describe('prismaWhereSiteAlertBannerForCalendarDay', () => {
  it('returns null for invalid calendar keys', () => {
    expect(prismaWhereSiteAlertBannerForCalendarDay('not-a-date')).toBeNull();
  });

  it('matches Postgres DATE lte/gte bounds for a known Eastern day', () => {
    const todayIso = '2026-04-15';
    const todayDate = prismaDateFromIsoCalendar(todayIso);
    expect(todayDate).not.toBeNull();
    expect(prismaWhereSiteAlertBannerForCalendarDay(todayIso)).toEqual({
      isPublished: true,
      lastDate: { gte: todayDate },
      startDate: { lte: todayDate },
    });
  });
});

describe('siteAlertEligibleForBannerOnEasternDay', () => {
  it('mirrors prisma DATE lte/gte semantics for calendar ISO strings', () => {
    const cases: {
      expected: boolean;
      lastIso: string;
      startIso: string;
      todayIso: string;
    }[] = [
      {
        todayIso: '2026-04-15',
        startIso: '2026-04-01',
        lastIso: '2026-04-30',
        expected: true,
      },
      {
        todayIso: '2026-04-15',
        startIso: '2026-04-16',
        lastIso: '2026-05-01',
        expected: false,
      },
      {
        todayIso: '2026-04-15',
        startIso: '2026-04-01',
        lastIso: '2026-04-15',
        expected: true,
      },
      {
        todayIso: '2026-04-15',
        startIso: '2026-04-01',
        lastIso: '2026-04-14',
        expected: false,
      },
    ];

    for (const row of cases) {
      const fromBounds = matchesPrismaBannerDateBounds(
        row.todayIso,
        row.startIso,
        row.lastIso
      );
      expect(fromBounds).toBe(row.expected);

      expect(
        siteAlertEligibleForBannerOnEasternDay({
          isPublished: true,
          lastDateIso: row.lastIso,
          startDateIso: row.startIso,
          todayIso: row.todayIso,
        })
      ).toBe(row.expected);

      expect(
        siteAlertEligibleForBannerOnEasternDay({
          isPublished: false,
          lastDateIso: row.lastIso,
          startDateIso: row.startIso,
          todayIso: row.todayIso,
        })
      ).toBe(false);
    }
  });
});

describe('siteAlertEligibleForBannerAt', () => {
  it('excludes unpublished rows', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: false,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-04-30',
        now: new Date(nyNoonUtc),
      })
    ).toBe(false);
  });

  it('excludes rows before start date', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-16',
        lastDateIso: '2026-05-01',
        now: new Date(nyNoonUtc),
      })
    ).toBe(false);
  });

  it('includes published rows inside window', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-05-01',
        now: new Date(nyNoonUtc),
      })
    ).toBe(true);
  });

  it('includes rows on end date', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-04-15',
        now: new Date(nyNoonUtc),
      })
    ).toBe(true);
  });

  it('excludes rows after end date', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-04-14',
        now: new Date(nyNoonUtc),
      })
    ).toBe(false);
  });
});

describe('mapSiteAlertsToBannerRows', () => {
  it('uses start date as the visible banner date', async () => {
    const { mapSiteAlertsToBannerRows } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const [row] = mapSiteAlertsToBannerRows([
      {
        id: 'seed-site-alert-demo-through-2030',
        body: 'Demo site alert',
        startDateIso: '2025-01-01',
      },
    ]);

    expect(row?.dateIso).toBe('2025-01-01');
    expect(row?.dateLabel).toBe('Wed, Jan 1, 2025');
  });
});

describe('listSiteAlertsForBannerAt', () => {
  it('queries with Eastern calendar bounds and minimal select', async () => {
    findMany.mockResolvedValue([
      {
        body: 'Demo site alert',
        id: 'seed-site-alert-demo-through-2030',
        startDate: new Date(Date.UTC(2025, 0, 1)),
      },
    ]);
    const { listSiteAlertsForBannerAt } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const todayDate = prismaDateFromIsoCalendar('2026-04-15');

    await listSiteAlertsForBannerAt(new Date('2026-04-15T16:00:00.000Z'));

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { startDate: 'desc' },
      select: {
        body: true,
        id: true,
        startDate: true,
      },
      where: {
        isPublished: true,
        lastDate: { gte: todayDate },
        startDate: { lte: todayDate },
      },
    });
  });
});

describe('listPublishedSiteAlerts', () => {
  it('queries published alerts started by the Eastern calendar date', async () => {
    findMany.mockResolvedValue([]);
    const { listPublishedSiteAlerts } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const todayDate = prismaDateFromIsoCalendar('2026-04-15');

    await listPublishedSiteAlerts(new Date('2026-04-15T16:00:00.000Z'));

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { startDate: 'desc' },
      select: {
        body: true,
        id: true,
        startDate: true,
      },
      where: {
        isPublished: true,
        startDate: { lte: todayDate },
      },
    });
  });
});

describe('buildSiteAlertsFingerprint', () => {
  it('changes when alert body text changes', async () => {
    const { buildSiteAlertsFingerprint } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const current = buildSiteAlertsFingerprint([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'alert-1',
      },
    ]);
    const updated = buildSiteAlertsFingerprint([
      {
        bodyPlainText: 'Updated text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'alert-1',
      },
    ]);

    expect(updated).not.toBe(current);
  });
});
