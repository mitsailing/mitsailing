import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyNewsRows } from '@/libs/legacy-sync/legacyNewsImport';

const mocks = vi.hoisted(() => ({
  siteAlertUpsert: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    siteAlert: { upsert: mocks.siteAlertUpsert },
  },
}));

describe('importLegacyNewsRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.siteAlertUpsert.mockResolvedValue({ id: 'alert-1' });
  });

  it('imports valid legacy news and skips incomplete rows', async () => {
    await expect(
      importLegacyNewsRows([
        {
          end_date: '2026-06-30',
          id: '12',
          news: 'Sailing &amp; racing',
          news_date: '2026-06-01',
          updater: 'admin',
        },
        {
          end_date: null,
          id: null,
          news: 'Missing id',
          news_date: '2026-06-01',
          updater: null,
        },
        {
          end_date: '2026-05-31',
          id: '13',
          news: 'Inverted dates',
          news_date: '2026-06-01',
          updater: 'admin',
        },
      ])
    ).resolves.toEqual({ imported: 1, skipped: 2 });

    expect(mocks.siteAlertUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: 'Sailing & racing',
          legacyNewsId: '12',
        }),
      })
    );
  });
});
