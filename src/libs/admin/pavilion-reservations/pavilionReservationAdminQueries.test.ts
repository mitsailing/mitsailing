import { describe, expect, it, vi } from 'vitest';
import { parseAdminPavilionReservationDateFilter } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';

vi.mock('server-only', () => ({}));

describe('parseAdminPavilionReservationDateFilter', () => {
  it('rejects impossible calendar dates', () => {
    expect(parseAdminPavilionReservationDateFilter('2026-99-99')).toBe(
      undefined
    );
  });

  it('accepts valid calendar dates', () => {
    expect(parseAdminPavilionReservationDateFilter('2026-05-16')).toBe(
      '2026-05-16'
    );
  });
});
