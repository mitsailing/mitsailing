import { describe, expect, it } from 'vitest';
import {
  adminHeaderLinkVisibleFromClientSessionData,
  adminHeaderLinkVisibleFromSession,
} from '@/libs/auth/adminHeaderLink';
import { Role } from '@/libs/auth/roles';

describe('adminHeaderLinkVisibleFromSession', () => {
  it('hides admin header link from visitor', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: null,
        userRole: Role.ADMIN,
      })
    ).toBe(false);
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: '',
        userRole: Role.ADMIN,
      })
    ).toBe(false);
  });

  it('hides admin header link from sailor', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'user-1',
        userRole: Role.USER,
      })
    ).toBe(false);
  });

  it('hides admin header link from impersonating admin', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: 'admin-1',
        userId: 'user-1',
        userRole: Role.ADMIN,
      })
    ).toBe(false);
  });

  it('shows admin header link to admin', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'admin-1',
        userRole: Role.ADMIN,
      })
    ).toBe(true);
  });

  it('hides admin header link from roles with no launch admin permissions', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'volunteer-1',
        userRole: Role.VOLUNTEER,
      })
    ).toBe(false);
  });

  it('shows admin header link to staff roles with launch admin permissions', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'instructor-1',
        userRole: Role.VOLUNTEER_INSTRUCTOR,
      })
    ).toBe(true);
  });

  it('uses one normalized role instead of every comma-separated role', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'volunteer-1',
        userRole: `${Role.VOLUNTEER},${Role.DOCK_STAFF}`,
      })
    ).toBe(false);
  });
});

describe('adminHeaderLinkVisibleFromClientSessionData', () => {
  it('shows distinct client visibility for admin and impersonating admin', () => {
    expect(
      adminHeaderLinkVisibleFromClientSessionData({
        session: {},
        user: { id: 'admin-1', role: Role.ADMIN },
      })
    ).toBe(true);
    expect(
      adminHeaderLinkVisibleFromClientSessionData({
        session: { impersonatedBy: 'admin-1' },
        user: { id: 'user-1', role: Role.ADMIN },
      })
    ).toBe(false);
  });

  it('protects visitor from malformed client session data', () => {
    expect(adminHeaderLinkVisibleFromClientSessionData(null)).toBe(false);
    expect(adminHeaderLinkVisibleFromClientSessionData('signed-in')).toBe(
      false
    );
    expect(
      adminHeaderLinkVisibleFromClientSessionData({
        session: {},
        user: { id: 123, role: Role.ADMIN },
      })
    ).toBe(false);
  });
});
