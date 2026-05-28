import { describe, expect, it } from 'vitest';
import {
  isLegacyMysqlSyncCronPattern,
  LEGACY_MYSQL_SYNC_DEFAULT_CRON,
} from '@/libs/legacy-sync/legacyMysqlSyncConstants';

describe('isLegacyMysqlSyncCronPattern', () => {
  it('accepts default hourly cron', () => {
    expect(isLegacyMysqlSyncCronPattern(LEGACY_MYSQL_SYNC_DEFAULT_CRON)).toBe(
      true
    );
  });

  it('accepts six fields with extra whitespace', () => {
    expect(isLegacyMysqlSyncCronPattern('  0  15  *  *  *  *  ')).toBe(true);
  });

  it('rejects five-field cron', () => {
    expect(isLegacyMysqlSyncCronPattern('0 0 * * *')).toBe(false);
  });

  it('rejects empty or non-cron text', () => {
    expect(isLegacyMysqlSyncCronPattern('')).toBe(false);
    expect(isLegacyMysqlSyncCronPattern('not-a-cron')).toBe(false);
  });

  it('rejects semantically invalid cron fields', () => {
    expect(isLegacyMysqlSyncCronPattern('60 0 0 0 0 0')).toBe(false);
  });

  it('rejects hashed cron syntax', () => {
    expect(isLegacyMysqlSyncCronPattern('H * * * * *')).toBe(false);
    expect(isLegacyMysqlSyncCronPattern('0 H/15 * * * *')).toBe(false);
  });

  it('accepts day of week aliases', () => {
    expect(isLegacyMysqlSyncCronPattern('0 0 0 * * THU')).toBe(true);
  });
});
