import { describe, expect, it } from 'vitest';
import {
  adminPavilionReservationDetailPath,
  adminPavilionReservationIndexPath,
  validateAdminPavilionReservationHref,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';

describe('pavilionReservationAdminPaths', () => {
  it('builds the admin index path', () => {
    expect(adminPavilionReservationIndexPath()).toBe(
      '/admin/pavilion-reservations'
    );
  });

  it('encodes detail path ids', () => {
    expect(adminPavilionReservationDetailPath('legacy/id with spaces')).toBe(
      '/admin/pavilion-reservations/legacy%2Fid%20with%20spaces'
    );
  });

  it('accepts pavilion reservation admin hrefs', () => {
    const href = {
      pathname: '/admin/pavilion-reservations',
      query: { status: 'pending' },
    };

    expect(validateAdminPavilionReservationHref(href)).toBe(href);
    expect(
      validateAdminPavilionReservationHref('/admin/pavilion-reservations/abc')
    ).toBe('/admin/pavilion-reservations/abc');
  });

  it('rejects hrefs outside the pavilion reservation admin section', () => {
    expect(() =>
      validateAdminPavilionReservationHref('/admin/pavilion-reservation')
    ).toThrow('Invalid Pavilion reservation admin href');
  });
});
