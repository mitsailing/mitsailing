import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  countAdmins: vi.fn(),
  findUnique: vi.fn(),
  loggerError: vi.fn(),
  setRole: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/zenstack/auth', () => ({
  getAuthZenStack: () => ({
    user: {
      count: mocks.countAdmins,
      findUnique: mocks.findUnique,
      update: mocks.updateUser,
    },
  }),
}));

vi.mock('@/libs/auth/server-admin', () => ({
  setBetterAuthRoleMirror: mocks.setRole,
}));

vi.mock('@/libs/Logger', () => ({
  logger: { error: mocks.loggerError },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.countAdmins.mockReset();
  mocks.findUnique.mockReset();
  mocks.loggerError.mockReset();
  mocks.setRole.mockReset();
  mocks.updateUser.mockReset();
});

describe('updateUserAppRole', () => {
  it('updates appRole and Better Auth role mirror', async () => {
    mocks.countAdmins.mockResolvedValue(2);
    mocks.findUnique.mockResolvedValue({
      appRole: Role.ADMIN,
      banned: false,
      emailVerified: true,
    });
    mocks.setRole.mockImplementation(async () => {});
    mocks.updateUser.mockResolvedValue({ id: 'user-1' });
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
        nextRole: Role.DOCK_STAFF,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.setRole).toHaveBeenCalledWith({
      requestHeaders: expect.any(Headers),
      role: Role.DOCK_STAFF,
      userId: 'user-1',
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      data: { appRole: Role.DOCK_STAFF },
      where: { id: 'user-1' },
    });
  });

  it('blocks demoting the last admin', async () => {
    mocks.countAdmins.mockResolvedValue(1);
    mocks.findUnique.mockResolvedValue({
      appRole: Role.ADMIN,
      banned: false,
      emailVerified: true,
    });
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
        nextRole: Role.USER,
        requestHeaders: new Headers(),
        targetUserId: 'admin-1',
      })
    ).resolves.toEqual({ code: 'last_admin', ok: false });

    expect(mocks.setRole).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.countAdmins).toHaveBeenCalledWith({
      where: {
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
      },
    });
  });

  it('demotes an unusable admin without counting viable admins', async () => {
    mocks.findUnique.mockResolvedValue({
      appRole: Role.ADMIN,
      banned: true,
      emailVerified: true,
    });
    mocks.setRole.mockImplementation(async () => {});
    mocks.updateUser.mockResolvedValue({ id: 'admin-1' });
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
        nextRole: Role.USER,
        requestHeaders: new Headers(),
        targetUserId: 'admin-1',
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.countAdmins).not.toHaveBeenCalled();
  });

  it('blocks non-admin role changes', async () => {
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.DOCK_MASTER, id: 'dockmaster-1' },
        nextRole: Role.ADMIN,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).resolves.toEqual({ code: 'forbidden', ok: false });

    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('stops before appRole update when Better Auth mirror fails', async () => {
    mocks.findUnique.mockResolvedValue({
      appRole: Role.USER,
      banned: false,
      emailVerified: true,
    });
    mocks.setRole.mockRejectedValue(new Error('mirror unavailable'));
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
        nextRole: Role.DOCK_STAFF,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).rejects.toThrow('mirror unavailable');

    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('rolls back Better Auth role mirror when appRole update fails', async () => {
    mocks.countAdmins.mockResolvedValue(2);
    mocks.findUnique.mockResolvedValue({
      appRole: Role.ADMIN,
      banned: false,
      emailVerified: true,
    });
    mocks.setRole.mockImplementation(async () => {});
    mocks.updateUser.mockRejectedValue(new Error('database unavailable'));
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
        nextRole: Role.DOCK_STAFF,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).rejects.toThrow('database unavailable');

    expect(mocks.setRole).toHaveBeenNthCalledWith(1, {
      requestHeaders: expect.any(Headers),
      role: Role.DOCK_STAFF,
      userId: 'user-1',
    });
    expect(mocks.setRole).toHaveBeenNthCalledWith(2, {
      requestHeaders: expect.any(Headers),
      role: Role.ADMIN,
      userId: 'user-1',
    });
  });

  it('reports mirror inconsistency when rollback also fails', async () => {
    mocks.countAdmins.mockResolvedValue(2);
    mocks.findUnique.mockResolvedValue({
      appRole: Role.ADMIN,
      banned: false,
      emailVerified: true,
    });
    mocks.setRole
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce(new Error('rollback unavailable'));
    mocks.updateUser.mockRejectedValue(new Error('database unavailable'));
    const { updateUserAppRole } =
      await import('@/libs/admin/users/appRoleActions');

    await expect(
      updateUserAppRole({
        authContext: { appRole: Role.ADMIN, id: 'admin-1' },
        nextRole: Role.DOCK_STAFF,
        requestHeaders: new Headers(),
        targetUserId: 'user-1',
      })
    ).resolves.toEqual({ code: 'role_mirror_inconsistent', ok: false });

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to roll back Better Auth role mirror: {error}',
      expect.objectContaining({
        operation: 'updateUserAppRole',
        targetUserId: 'user-1',
      })
    );
  });
});
