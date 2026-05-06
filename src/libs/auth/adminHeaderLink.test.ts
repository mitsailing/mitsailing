import { describe, expect, it } from 'vitest';
import { adminEditLinkVisibleFromSession } from '@/libs/auth/adminHeaderLink';
import { Role } from '@/libs/auth/roles';

describe('adminEditLinkVisibleFromSession', () => {
  it('shows links for signed-in admins', () => {
    expect(
      adminEditLinkVisibleFromSession({
        userId: 'user-admin',
        userRole: Role.ADMIN,
        impersonatedBy: null,
      })
    ).toBe(true);
  });

  it('hides links for non-admin users', () => {
    expect(
      adminEditLinkVisibleFromSession({
        userId: 'user-member',
        userRole: Role.USER,
        impersonatedBy: null,
      })
    ).toBe(false);
  });

  it('hides links during impersonation', () => {
    expect(
      adminEditLinkVisibleFromSession({
        userId: 'user-admin',
        userRole: Role.ADMIN,
        impersonatedBy: 'user-member',
      })
    ).toBe(false);
  });
});
