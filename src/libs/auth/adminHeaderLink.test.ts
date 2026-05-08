import { describe, expect, it } from 'vitest';
import {
  adminHeaderLinkVisibleFromClientSessionData,
  adminHeaderLinkVisibleFromSession,
} from '@/libs/auth/adminHeaderLink';
import { Role } from '@/libs/auth/roles';

describe('adminHeaderLinkVisibleFromSession', () => {
  it('visitor does not see the admin header link', () => {
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

  it('sailor does not see the admin header link', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'user-1',
        userRole: Role.USER,
      })
    ).toBe(false);
  });

  it('impersonating admin does not see the admin header link', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: 'admin-1',
        userId: 'user-1',
        userRole: Role.ADMIN,
      })
    ).toBe(false);
  });

  it('admin sees the admin header link', () => {
    expect(
      adminHeaderLinkVisibleFromSession({
        impersonatedBy: null,
        userId: 'admin-1',
        userRole: Role.ADMIN,
      })
    ).toBe(true);
  });
});

describe('adminHeaderLinkVisibleFromClientSessionData', () => {
  it('admin and impersonating admin get distinct client visibility', () => {
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

  it('visitor is protected from malformed client session data', () => {
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
