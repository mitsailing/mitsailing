import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/libs/DB', () => ({ prisma: {} }));

describe('mapSiteAlertsToBannerRows', () => {
  it('uses start date as the visible banner date', async () => {
    const { mapSiteAlertsToBannerRows } =
      await import('@/libs/mit-sailing/siteAlertQueries');

    const [row] = mapSiteAlertsToBannerRows([
      {
        id: 'seed-site-alert-demo-through-2030',
        body: 'Demo site alert',
        startDateIso: '2025-01-01',
        lastDateIso: '2030-12-31',
      },
    ]);

    expect(row?.dateIso).toBe('2025-01-01');
    expect(row?.dateLabel).toBe('Wed, Jan 1, 2025');
  });
});
