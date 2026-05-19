import { describe, expect, it } from 'vitest';
import {
  adminHeaderLinkVisibleFromClientSessionData,
  adminHeaderLinkVisibleFromSession,
} from '@/libs/auth/adminHeaderLink';
import { Role } from '@/libs/auth/roles';

function sessionInput(props: {
  impersonatedBy?: unknown;
  userAppRole?: unknown;
  userBanned?: unknown;
  userEmailVerified?: unknown;
  userId?: string | null;
}) {
  return {
    impersonatedBy: props.impersonatedBy ?? null,
    userAppRole: props.userAppRole ?? Role.ADMIN,
    userBanned: props.userBanned ?? false,
    userEmailVerified: props.userEmailVerified ?? true,
    userId: Object.hasOwn(props, 'userId') ? props.userId : 'admin-1',
  };
}

describe('adminHeaderLinkVisibleFromSession', () => {
  it('hides admin header link from visitor', () => {
    expect(
      adminHeaderLinkVisibleFromSession(sessionInput({ userId: null }))
    ).toBe(false);
    expect(
      adminHeaderLinkVisibleFromSession(sessionInput({ userId: '' }))
    ).toBe(false);
  });

  it('hides admin header link from sailor', () => {
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({ userAppRole: Role.USER, userId: 'user-1' })
      )
    ).toBe(false);
  });

  it('hides admin header link from impersonating admin', () => {
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({
          impersonatedBy: 'admin-1',
          userId: 'user-1',
          userAppRole: Role.ADMIN,
        })
      )
    ).toBe(false);
  });

  it('shows admin header link to admin', () => {
    expect(adminHeaderLinkVisibleFromSession(sessionInput({}))).toBe(true);
  });

  it('hides admin header link when only role mirror is admin', () => {
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({ userAppRole: Role.USER })
      )
    ).toBe(false);
  });

  it('hides admin header link from roles with no launch admin permissions', () => {
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({ userAppRole: Role.VOLUNTEER, userId: 'volunteer-1' })
      )
    ).toBe(false);
  });

  it('shows admin header link to staff roles with launch admin permissions', () => {
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({
          userAppRole: Role.VOLUNTEER_INSTRUCTOR,
          userId: 'instructor-1',
        })
      )
    ).toBe(true);
  });

  it('hides admin header link from comma-separated role strings', () => {
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({
          userAppRole: `${Role.VOLUNTEER},${Role.DOCK_STAFF}`,
          userId: 'volunteer-1',
        })
      )
    ).toBe(false);
  });

  it('hides admin header link from banned and unverified users', () => {
    expect(
      adminHeaderLinkVisibleFromSession(sessionInput({ userBanned: true }))
    ).toBe(false);
    expect(
      adminHeaderLinkVisibleFromSession(
        sessionInput({ userEmailVerified: false })
      )
    ).toBe(false);
  });
});

describe('adminHeaderLinkVisibleFromClientSessionData', () => {
  it('shows distinct client visibility for admin and impersonating admin', () => {
    expect(
      adminHeaderLinkVisibleFromClientSessionData({
        session: { impersonatedBy: null },
        user: {
          appRole: Role.ADMIN,
          banned: false,
          emailVerified: true,
          id: 'admin-1',
          role: Role.USER,
        },
      })
    ).toBe(true);
    expect(
      adminHeaderLinkVisibleFromClientSessionData({
        session: { impersonatedBy: 'admin-1' },
        user: {
          appRole: Role.ADMIN,
          banned: false,
          emailVerified: true,
          id: 'user-1',
          role: Role.ADMIN,
        },
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
        user: { appRole: Role.ADMIN, id: 123, role: Role.ADMIN },
      })
    ).toBe(false);
  });
});
