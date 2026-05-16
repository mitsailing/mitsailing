import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import {
  LEGACY_MYSQL_SYNC_JOB_NAME,
  LEGACY_MYSQL_SYNC_SCHEDULER_ID,
} from '@/libs/legacy-sync/legacyMysqlSyncConfig';
import { applyLegacyMysqlSyncScheduler } from '@/worker/legacyMysqlSyncJob';
import type { LegacyMysqlSyncSchedulerQueue } from '@/worker/legacyMysqlSyncJob';

function schedulerQueueMock(): LegacyMysqlSyncSchedulerQueue {
  const removeJobScheduler =
    vi.fn<LegacyMysqlSyncSchedulerQueue['removeJobScheduler']>();
  removeJobScheduler.mockResolvedValue(true);

  const upsertJobScheduler =
    vi.fn<LegacyMysqlSyncSchedulerQueue['upsertJobScheduler']>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- BullMQ Job test double
  upsertJobScheduler.mockResolvedValue({
    id: 'legacy-mysql-sync-scheduler',
  } as unknown as Job);

  return {
    removeJobScheduler,
    upsertJobScheduler,
  };
}

describe('applyLegacyMysqlSyncScheduler', () => {
  it('removes scheduler when sync is disabled', async () => {
    const queue = schedulerQueueMock();

    await applyLegacyMysqlSyncScheduler(queue, { enabled: false });

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(
      LEGACY_MYSQL_SYNC_SCHEDULER_ID
    );
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('registers scheduler when sync is enabled', async () => {
    const queue = schedulerQueueMock();

    await applyLegacyMysqlSyncScheduler(queue, {
      cron: '0 15 * * * *',
      database: 'sailing',
      enabled: true,
      mysqlPassword: 'secret',
      sourceHost: 'sailing.pavilion.lan',
    });

    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      LEGACY_MYSQL_SYNC_SCHEDULER_ID,
      { pattern: '0 15 * * * *' },
      expect.objectContaining({ name: LEGACY_MYSQL_SYNC_JOB_NAME })
    );
  });
});
