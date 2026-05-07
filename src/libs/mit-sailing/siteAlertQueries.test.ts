import { describe, expect, it, vi } from 'vitest';

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
  it('selects minimal fields and filters before end date', async () => {
    findMany.mockResolvedValue([
      {
        body: 'Demo site alert',
        id: 'seed-site-alert-demo-through-2030',
        startDate: new Date(Date.UTC(2025, 0, 1)),
      },
    ]);
    const { listSiteAlertsForBannerAt } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    await listSiteAlertsForBannerAt(new Date('2026-04-15T16:00:00.000Z'));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          body: true,
          id: true,
          startDate: true,
        },
        where: expect.objectContaining({
          isPublished: true,
          lastDate: { gt: expect.any(Date) },
          startDate: { lte: expect.any(Date) },
        }),
      })
    );
  });
});

describe('listPublishedSiteAlerts', () => {
  it('selects published alert fields without end date', async () => {
    findMany.mockResolvedValue([]);
    const { listPublishedSiteAlerts } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    await listPublishedSiteAlerts();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          body: true,
          id: true,
          startDate: true,
        },
        where: { isPublished: true },
      })
    );
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
