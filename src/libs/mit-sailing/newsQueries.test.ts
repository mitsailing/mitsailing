import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';
import { prismaWhereNewsBannerForCalendarDay } from '@/libs/mit-sailing/newsQueries';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], Result>(
    fn: (...args: Args) => Promise<Result>
  ) => fn,
}));
vi.mock('@/libs/DB', () => ({ prisma: { news: { findMany } } }));

beforeEach(() => {
  findMany.mockReset();
});

describe('prismaWhereNewsBannerForCalendarDay', () => {
  it('returns null for invalid calendar keys', () => {
    expect(prismaWhereNewsBannerForCalendarDay('not-a-date')).toBeNull();
  });

  it('matches Postgres DATE lte/gte bounds for a known Eastern day', () => {
    const todayIso = '2026-04-15';
    const todayDate = prismaDateFromIsoCalendar(todayIso);
    expect(todayDate).not.toBeNull();
    expect(prismaWhereNewsBannerForCalendarDay(todayIso)).toEqual({
      isPublished: true,
      lastDate: { gte: todayDate },
      startDate: { lte: todayDate },
    });
  });
});

describe('mapNewsToBannerRows', () => {
  it('uses start date as the visible banner date', async () => {
    const { mapNewsToBannerRows } =
      await import('@/libs/mit-sailing/newsQueries');

    const [row] = mapNewsToBannerRows([
      {
        id: 'seed-site-alert-demo-through-2030',
        body: 'Demo news',
        startDateIso: '2025-01-01',
      },
    ]);

    expect(row?.dateIso).toBe('2025-01-01');
    expect(row?.dateLabel).toBe('Wed, Jan 1, 2025');
    expect(row?.bodyHtml).toBe('Demo news');
    expect(row?.bodyPlainText).toBe('Demo news');
  });

  it('unwraps body links in banner html while keeping bold', async () => {
    const { mapNewsToBannerRows } =
      await import('@/libs/mit-sailing/newsQueries');

    const [row] = mapNewsToBannerRows([
      {
        id: 'news-with-link',
        body: '<p><strong>Bold</strong> <a href="/news">linked</a></p>',
        startDateIso: '2025-01-01',
      },
    ]);

    expect(row?.bodyHtml).toBe('<p><strong>Bold</strong> linked</p>');
    expect(row?.bodyPlainText).toBe('Bold linked');
  });
});

describe('listNewsForBannerAt', () => {
  it('queries with Eastern calendar bounds and minimal select', async () => {
    findMany.mockResolvedValue([
      {
        body: 'Demo news',
        id: 'seed-site-alert-demo-through-2030',
        startDate: new Date(Date.UTC(2025, 0, 1)),
      },
    ]);
    const { listNewsForBannerAt } =
      await import('@/libs/mit-sailing/newsQueries');

    const todayDate = prismaDateFromIsoCalendar('2026-04-15');

    await listNewsForBannerAt(new Date('2026-04-15T16:00:00.000Z'));

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
    const { listNewsForBannerAt } =
      await import('@/libs/mit-sailing/newsQueries');

    const todayDate = prismaDateFromIsoCalendar('2026-04-14');

    await listNewsForBannerAt(new Date('2026-04-15T03:30:00.000Z'));

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

describe('listPublishedNews', () => {
  it('queries published alerts started by the Eastern calendar date', async () => {
    findMany.mockResolvedValue([]);
    const { listPublishedNews } =
      await import('@/libs/mit-sailing/newsQueries');

    const todayDate = prismaDateFromIsoCalendar('2026-04-15');

    await listPublishedNews(new Date('2026-04-15T16:00:00.000Z'));

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

describe('buildNewsBannerCollapseAlerts', () => {
  it('changes when alert body text changes', async () => {
    const { buildNewsBannerCollapseAlerts } =
      await import('@/libs/mit-sailing/newsQueries');

    const [current] = buildNewsBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'news-1',
      },
    ]);
    const [updated] = buildNewsBannerCollapseAlerts([
      {
        bodyPlainText: 'Updated text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'news-1',
      },
    ]);

    expect(updated?.contentFingerprint).not.toBe(current?.contentFingerprint);
  });

  it('changes when alert date changes', async () => {
    const { buildNewsBannerCollapseAlerts } =
      await import('@/libs/mit-sailing/newsQueries');

    const [current] = buildNewsBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'news-1',
      },
    ]);
    const [updated] = buildNewsBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-16',
        dateLabel: 'Thu, Apr 16, 2026',
        id: 'news-1',
      },
    ]);

    expect(updated?.contentFingerprint).not.toBe(current?.contentFingerprint);
  });

  it('keeps fingerprint when alert date label changes', async () => {
    const { buildNewsBannerCollapseAlerts } =
      await import('@/libs/mit-sailing/newsQueries');

    const [current] = buildNewsBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'Wed, Apr 15, 2026',
        id: 'news-1',
      },
    ]);
    const [updated] = buildNewsBannerCollapseAlerts([
      {
        bodyPlainText: 'Current text',
        dateIso: '2026-04-15',
        dateLabel: 'April 15, 2026',
        id: 'news-1',
      },
    ]);

    expect(updated?.contentFingerprint).toBe(current?.contentFingerprint);
  });
});
