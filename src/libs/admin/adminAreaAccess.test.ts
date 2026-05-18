import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  listRolePermissionGrants: vi.fn(),
  redirect: vi.fn(),
  requireAnyPermission: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth/dal', () => ({
  requireAnyPermission: mocks.requireAnyPermission,
  verifySession: mocks.verifySession,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/auth/rolePermissionGrants', () => ({
  listRolePermissionGrants: mocks.listRolePermissionGrants,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.listRolePermissionGrants.mockReset();
  mocks.redirect.mockReset();
  mocks.requireAnyPermission.mockReset();
  mocks.verifySession.mockReset();
});

describe('requireAdminAreaAccess', () => {
  it('builds a single-role ability and returns only allowed nav items', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'user-1', role: Role.DOCK_STAFF },
    });
    mocks.listRolePermissionGrants.mockResolvedValue([
      {
        permissionKey: Permission.ADMIN_VIEW,
        roleKey: Role.DOCK_STAFF,
      },
      {
        permissionKey: Permission.USERS_VIEW,
        roleKey: Role.DOCK_STAFF,
      },
    ]);
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(mocks.verifySession).toHaveBeenCalledWith('en', '/');
    expect(access.role).toBe(Role.DOCK_STAFF);
    expect(access.navItems.map((item) => item.href)).toEqual([
      '/admin',
      '/admin/users',
    ]);
    expect(access.ability.can(Permission.USERS_VIEW, 'Permission')).toBe(true);
    expect(access.ability.can(Permission.CMS_VIEW, 'Permission')).toBe(false);
    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it('uses one normalized role instead of granting every comma-separated role', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'user-1', role: `${Role.VOLUNTEER},${Role.DOCK_STAFF}` },
    });
    mocks.listRolePermissionGrants.mockResolvedValue([
      {
        permissionKey: Permission.ADMIN_VIEW,
        roleKey: Role.DOCK_STAFF,
      },
    ]);
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    await requireAdminAreaAccess('en');

    expect(mocks.redirect).toHaveBeenCalledWith('/');
    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it('shows event navigation to volunteer instructors with event creation access', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'instructor-1', role: Role.VOLUNTEER_INSTRUCTOR },
    });
    mocks.listRolePermissionGrants.mockResolvedValue([
      {
        permissionKey: Permission.ADMIN_VIEW,
        roleKey: Role.VOLUNTEER_INSTRUCTOR,
      },
      {
        permissionKey: Permission.EVENTS_CREATE,
        roleKey: Role.VOLUNTEER_INSTRUCTOR,
      },
    ]);
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(access.navItems.map((item) => item.href)).toContain('/admin/events');
  });
});
