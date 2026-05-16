import { describe, expect, it } from 'vitest';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';

describe('admin date formatting', () => {
  it('formats dates in venue time', () => {
    expect(formatAdminDate(new Date('2026-05-14T13:00:00.000Z'), 'en')).toBe(
      'May 14, 2026, 9:00 AM'
    );
  });

  it('returns empty text for null dates', () => {
    expect(formatAdminDate(null, 'en')).toBe('');
  });
});
