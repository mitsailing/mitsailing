import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyNewsRows } from '@/libs/legacy-sync/legacyNewsImport';

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  siteAlertUpsert: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    siteAlert: { upsert: mocks.siteAlertUpsert },
  },
}));

describe('importLegacyNewsRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([]);
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

  it('decodes legacy news entities once before import', async () => {
    await expect(
      importLegacyNewsRows([
        {
          end_date: '2026-06-30',
          id: 'double-encoded',
          news: 'Launch &lt;notice&gt; &quot;today&quot; &#39;now&#39; &amp; &amp;lt;literal&amp;gt;',
          news_date: '2026-06-01',
          updater: 'admin',
        },
      ])
    ).resolves.toEqual({ imported: 1, skipped: 0 });

    expect(mocks.siteAlertUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: 'Launch <notice> "today" \'now\' & &lt;literal&gt;',
          legacyNewsId: 'double-encoded',
        }),
      })
    );
  });

  it('imports legacy news from mysql reader fixtures', async () => {
    const { createFixtureLegacyMysqlReader } =
      await import('@/libs/legacy-sync/legacyMysqlReader');
    const { importLegacyNews } =
      await import('@/libs/legacy-sync/legacyNewsImport');
    const reader = createFixtureLegacyMysqlReader({
      news: [
        {
          end_date: '2026-06-30',
          id: '12',
          news: 'Sailing &amp; racing',
          news_date: '2026-06-01',
          updater: 'admin',
        },
      ],
    });

    await expect(importLegacyNews(reader)).resolves.toEqual({
      imported: 1,
      skipped: 0,
    });

    expect(mocks.siteAlertUpsert).toHaveBeenCalledOnce();
  });
});
