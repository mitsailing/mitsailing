import { describe, expect, it } from 'vitest';
import {
  catalogEditContributorLabel,
  catalogEditTimestamp,
  formatCatalogEditDate,
  formatCatalogEditRelativeTime,
} from '@/components/mit-sailing/admin/catalog/catalogEditMetadataFormat';

describe('catalogEditMetadataFormat', () => {
  it('formats contributor labels with absolute timestamps', () => {
    expect(
      catalogEditContributorLabel(
        { email: 'ada@example.test', name: 'Ada Lovelace' },
        '2026-05-06T14:30:00.000Z',
        'en-US'
      )
    ).toContain('Ada Lovelace ·');
  });

  it('formats recent changes relative to the current time', () => {
    expect(
      formatCatalogEditRelativeTime(
        '2026-05-06T14:00:00.000Z',
        'en-US',
        new Date('2026-05-06T15:00:00.000Z').getTime()
      )
    ).toBe('1 hour ago');
  });

  it('preserves invalid timestamps', () => {
    expect(catalogEditTimestamp('not-a-date')).toBeNull();
    expect(formatCatalogEditDate('not-a-date', 'en-US')).toBe('not-a-date');
    expect(formatCatalogEditRelativeTime('not-a-date', 'en-US')).toBe(
      'not-a-date'
    );
  });
});
