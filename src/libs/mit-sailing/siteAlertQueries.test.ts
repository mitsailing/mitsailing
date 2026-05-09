import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
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

beforeEach(() => {
  findMany.mockReset();
});

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

  it('uses the Eastern calendar day before UTC midnight', async () => {
    findMany.mockResolvedValue([]);
    const { listSiteAlertsForBannerAt } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const todayDate = prismaDateFromIsoCalendar('2026-04-14');

    await listSiteAlertsForBannerAt(new Date('2026-04-15T03:30:00.000Z'));

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

describe('buildSiteAlertBannerCollapseAlerts', () => {
  it('changes when alert body text changes', async () => {
    const { buildSiteAlertBannerCollapseAlerts } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const [current] = buildSiteAlertBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'alert-1',
      },
    ]);
    const [updated] = buildSiteAlertBannerCollapseAlerts([
      {
        bodyPlainText: 'Updated text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'alert-1',
      },
    ]);

    expect(updated?.contentFingerprint).not.toBe(current?.contentFingerprint);
  });

  it('changes when alert date changes', async () => {
    const { buildSiteAlertBannerCollapseAlerts } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const [current] = buildSiteAlertBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'alert-1',
      },
    ]);
    const [updated] = buildSiteAlertBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-16',
        dateLabel: 'Thu, Apr 16, 2026',
        id: 'alert-1',
      },
    ]);

    expect(updated?.contentFingerprint).not.toBe(current?.contentFingerprint);
  });

  it('keeps fingerprint when alert date label changes', async () => {
    const { buildSiteAlertBannerCollapseAlerts } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const [current] = buildSiteAlertBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'alert-1',
      },
    ]);
    const [updated] = buildSiteAlertBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'April 15, 2026',
        id: 'alert-1',
      },
    ]);

    expect(updated?.contentFingerprint).toBe(current?.contentFingerprint);
  });
});
