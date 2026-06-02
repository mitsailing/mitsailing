import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  importLegacyData: vi.fn(),
  legacyMysqlSyncConfigFromEnv: vi.fn(),
  runLegacyMysqlSync: vi.fn(),
}));

vi.mock('@/libs/legacy-sync/legacyDataImport', () => ({
  importLegacyDataFromSchema: mocks.importLegacyData,
}));

vi.mock('@/libs/legacy-sync/legacyMysqlSync', () => ({
  runLegacyMysqlSync: mocks.runLegacyMysqlSync,
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
    mocks.runLegacyMysqlSync.mockImplementation(() => {
      mocks.calls.push('sync');
      return { rowCount: 10, skipped: false, tableCount: 2 };
    });
    mocks.importLegacyData.mockImplementation(() => {
      mocks.calls.push('import');
    });
  });

  it('runs the full import after a successful mirror sync', async () => {
    const { processLegacyMysqlSyncJob } =
      await import('@/worker/legacyMysqlSyncJob');

    await processLegacyMysqlSyncJob();

    expect(mocks.runLegacyMysqlSync).toHaveBeenCalledOnce();
    expect(mocks.importLegacyData).toHaveBeenCalledOnce();
    expect(mocks.calls).toEqual(['sync', 'import']);
  });

  it('skips import when the mirror sync is disabled', async () => {
    mocks.legacyMysqlSyncConfigFromEnv.mockReturnValueOnce({ enabled: false });
    const { processLegacyMysqlSyncJob } =
      await import('@/worker/legacyMysqlSyncJob');

    await processLegacyMysqlSyncJob();

    expect(mocks.runLegacyMysqlSync).not.toHaveBeenCalled();
    expect(mocks.importLegacyData).not.toHaveBeenCalled();
  });

  it('skips import when another sync is already running', async () => {
    mocks.runLegacyMysqlSync.mockResolvedValueOnce({
      rowCount: 0,
      skipped: true,
      tableCount: 0,
    });
    const { processLegacyMysqlSyncJob } =
      await import('@/worker/legacyMysqlSyncJob');

    await processLegacyMysqlSyncJob();

    expect(mocks.runLegacyMysqlSync).toHaveBeenCalledOnce();
    expect(mocks.importLegacyData).not.toHaveBeenCalled();
  });
});
