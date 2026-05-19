import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  appRoleFromSessionUser: (user: { appRole?: unknown }) =>
    typeof user.appRole === 'string' &&
    [
      'user',
      'volunteer',
      'volunteer_instructor',
      'dock_staff',
      'dock_master',
      'admin',
    ].includes(user.appRole)
      ? user.appRole
      : 'user',
  redirect: vi.fn(),
  requireAnyPermission: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth/dal', () => ({
  appRoleFromSessionUser: mocks.appRoleFromSessionUser,
  requireAnyPermission: mocks.requireAnyPermission,
  sessionImpersonatedBy: (session: { impersonatedBy?: unknown }) =>
    session.impersonatedBy,
  verifySession: mocks.verifySession,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.redirect.mockReset();
  mocks.requireAnyPermission.mockReset();
  mocks.verifySession.mockReset();
});

describe('requireAdminAreaAccess', () => {
  it('builds a single-role ability and returns only allowed nav items', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { appRole: Role.DOCK_STAFF, id: 'user-1', role: Role.USER },
    });
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(mocks.verifySession).toHaveBeenCalledWith('en', '/');
    expect(access.role).toBe(Role.DOCK_STAFF);
    expect(access.navItems.map((item) => item.href)).toEqual([
      '/admin',
      '/admin/users',
      '/admin/events',
    ]);
    expect(access.ability.can(Permission.USERS_VIEW, 'Permission')).toBe(true);
    expect(access.ability.can(Permission.CMS_VIEW, 'Permission')).toBe(false);
    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it('fails closed for comma-separated role strings', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: `${Role.VOLUNTEER},${Role.DOCK_STAFF}`,
        id: 'user-1',
        role: Role.DOCK_STAFF,
      },
    });
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    await requireAdminAreaAccess('en');

    expect(mocks.redirect).toHaveBeenCalledWith('/');
    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it('hides event navigation from volunteer instructors without event management', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.VOLUNTEER_INSTRUCTOR,
        id: 'instructor-1',
        role: Role.DOCK_STAFF,
      },
    });
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(access.navItems.map((item) => item.href)).not.toContain(
      '/admin/events'
    );
  });

  it('does not load role grants for administrators', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { appRole: Role.ADMIN, id: 'admin-1', role: Role.USER },
    });
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(access.role).toBe(Role.ADMIN);
    expect(access.ability.can(Permission.ADMIN_VIEW, 'Permission')).toBe(true);
  });
});
