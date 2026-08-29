import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  close: vi.fn(),
  importLegacyData: vi.fn(),
  legacyMysqlSyncConfigFromEnv: vi.fn(),
}));

vi.mock('@/libs/legacy-sync/legacyDataImport', () => ({
  importLegacyData: mocks.importLegacyData,
}));

vi.mock('@/libs/legacy-sync/legacyMysqlReader', () => ({
  createLegacyMysqlReader: () => ({
    close: mocks.close,
  }),
}));

vi.mock('@/libs/legacy-sync/legacyMysqlSyncConfig', () => ({
  LEGACY_MYSQL_SYNC_JOB_NAME: 'legacy-mysql-sync',
  LEGACY_MYSQL_SYNC_SCHEDULER_ID: 'legacy-mysql-sync-scheduler',
  legacyMysqlSyncConfigFromEnv: mocks.legacyMysqlSyncConfigFromEnv,
}));

describe('processLegacyMysqlSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.legacyMysqlSyncConfigFromEnv.mockReturnValue({
      cron: '0 0 * * * *',
      database: 'sailing',
      enabled: true,
      mysqlPassword: 'secret',
      sourceHost: 'sailing.mit.edu',
    });
    mocks.importLegacyData.mockResolvedValue({
      result: {},
      skipped: false,
    });
  });

  it('imports legacy data from mysql when sync is enabled', async () => {
    const { processLegacyMysqlSyncJob } =
      await import('@/worker/legacyMysqlSyncJob');

    await processLegacyMysqlSyncJob();

    expect(mocks.importLegacyData).toHaveBeenCalledOnce();
    expect(mocks.importLegacyData).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceHost: 'sailing.mit.edu',
        useAdvisoryLock: true,
      })
    );
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('skips import when sync is disabled', async () => {
    mocks.legacyMysqlSyncConfigFromEnv.mockReturnValueOnce({ enabled: false });
    const { processLegacyMysqlSyncJob } =
      await import('@/worker/legacyMysqlSyncJob');

    await processLegacyMysqlSyncJob();

    expect(mocks.importLegacyData).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('skips import when another import is already running', async () => {
    mocks.importLegacyData.mockResolvedValueOnce({ skipped: true });
    const { processLegacyMysqlSyncJob } =
      await import('@/worker/legacyMysqlSyncJob');

    await processLegacyMysqlSyncJob();

    expect(mocks.importLegacyData).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
