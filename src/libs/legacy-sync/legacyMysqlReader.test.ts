import { describe, expect, it, vi } from 'vitest';
import {
  createFixtureLegacyMysqlReader,
  createLegacyMysqlReader,
} from '@/libs/legacy-sync/legacyMysqlReader';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/libs/legacy-sync/mysqlConnection', () => ({
  LEGACY_MYSQL_SOURCE: {
    database: 'sailing',
    host: 'sailing.pavilion.lan',
    port: 3306,
    user: 'dock_readonly',
  },
  legacyMysqlHostFromEnv: () => '127.0.0.1',
  openLegacyMysqlConnection: () => ({
    close: mocks.close,
    mysql: { query: mocks.query },
  }),
}));

describe('createLegacyMysqlReader', () => {
  it('queries active members with mysql zero-date normalization', async () => {
    mocks.query.mockResolvedValueOnce([
      [{ active: '1', email: 'sailor@example.com', expire_date: '0000-00-00' }],
      [],
    ]);
    const reader = createLegacyMysqlReader({ password: 'secret' });

    await expect(reader.fetchActiveMembers()).resolves.toEqual([
      { active: '1', email: 'sailor@example.com', expire_date: null },
    ]);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM `members` WHERE active = '1'")
    );
  });

  it('orders rating types by rank', async () => {
    mocks.query.mockResolvedValueOnce([[{ name: 'Provisional' }], []]);
    const reader = createLegacyMysqlReader({ password: 'secret' });

    await reader.fetchRatingTypes();

    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM `rating_type` ORDER BY `rank`')
    );
  });
});

describe('createFixtureLegacyMysqlReader', () => {
  it('returns configured fixture rows', async () => {
    const reader = createFixtureLegacyMysqlReader({
      news: [
        {
          end_date: null,
          id: '1',
          news: 'Hello',
          news_date: '2026-01-01',
          updater: null,
        },
      ],
    });

    await expect(reader.fetchNews()).resolves.toEqual([
      {
        end_date: null,
        id: '1',
        news: 'Hello',
        news_date: '2026-01-01',
        updater: null,
      },
    ]);
  });
});
