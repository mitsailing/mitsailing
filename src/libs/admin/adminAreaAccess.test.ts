import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth/dal', () => ({
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
  mocks.verifySession.mockReset();
});

function session(appRole: unknown, id = 'user-1') {
  return {
    session: { impersonatedBy: null },
    user: {
      appRole,
      banned: false,
      emailVerified: true,
      id,
      role: Role.USER,
    },
  };
}

describe('requireAdminAreaAccess', () => {
  it('builds app-role access and returns only allowed nav items', async () => {
    mocks.verifySession.mockResolvedValue(session(Role.DOCK_STAFF));
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(mocks.verifySession).toHaveBeenCalledWith('en', '/');
    expect(access.appRole).toBe(Role.DOCK_STAFF);
    expect(access.navItems.map((item) => item.href)).toEqual([
      '/admin',
      '/admin/users',
      '/admin/events',
    ]);
    expect(access.permissions).toContain(Permission.USERS_VIEW);
    expect(access.permissions).not.toContain(Permission.CMS_VIEW);
  });

  it('fails closed for comma-separated role strings', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: `${Role.VOLUNTEER},${Role.DOCK_STAFF}`,
        banned: false,
        emailVerified: true,
        id: 'user-1',
        role: Role.DOCK_STAFF,
      },
    });
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    await requireAdminAreaAccess('en');

    expect(mocks.redirect).toHaveBeenCalledWith('/');
  });

  it('shows event navigation to volunteer instructors for assigned event management', async () => {
    mocks.verifySession.mockResolvedValue(
      session(Role.VOLUNTEER_INSTRUCTOR, 'instructor-1')
    );
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(access.navItems.map((item) => item.href)).toContain('/admin/events');
    expect(access.permissions).toContain(Permission.EVENTS_ASSIGNED_MANAGE);
    expect(access.permissions).not.toContain(Permission.EVENTS_MANAGE);
  });

  it('does not load role grants for administrators', async () => {
    mocks.verifySession.mockResolvedValue(session(Role.ADMIN, 'admin-1'));
    const { requireAdminAreaAccess } =
      await import('@/libs/admin/adminAreaAccess');

    const access = await requireAdminAreaAccess('en');

    expect(access.appRole).toBe(Role.ADMIN);
    expect(access.permissions).toContain(Permission.ADMIN_VIEW);
  });
});
