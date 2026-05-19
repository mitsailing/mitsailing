import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Permission,
  ROLE_PERMISSION_GRANT_ROLES,
} from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const {
  createMany,
  deleteMany,
  findUnique,
  headers,
  invalidateRolePermissionGrants,
  redirect,
  requirePermission,
  setRole,
  transaction,
  update,
  userCount,
} = vi.hoisted(() => ({
  createMany: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  headers: vi.fn(async () => {
    await Promise.resolve();
    return new Headers({ 'x-test': '1' });
  }),
  invalidateRolePermissionGrants: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requirePermission: vi.fn(),
  setRole: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  userCount: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('next/headers', () => ({
  headers,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission,
}));

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      setRole,
    },
  },
}));

vi.mock('@/libs/auth/rolePermissionGrants', () => ({
  invalidateRolePermissionGrants,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: transaction,
    rolePermissionGrant: {
      createMany,
      deleteMany,
    },
    user: {
      count: userCount,
      findUnique,
      update,
    },
  },
}));

function formData(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  createMany.mockReset();
  deleteMany.mockReset();
  findUnique.mockReset();
  headers.mockClear();
  invalidateRolePermissionGrants.mockReset();
  redirect.mockClear();
  requirePermission.mockReset();
  setRole.mockReset();
  transaction.mockReset();
  update.mockReset();
  userCount.mockReset();

  findUnique.mockResolvedValue({ appRole: Role.USER, role: Role.USER });
  setRole.mockResolvedValue({ user: { id: 'user-1' } });
  update.mockResolvedValue({ id: 'user-1' });
  requirePermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'admin-1', role: Role.ADMIN },
  });
  transaction.mockImplementation(async (runTransaction) => {
    await runTransaction({
      rolePermissionGrant: {
        createMany,
        deleteMany,
      },
      user: {
        count: userCount,
        findUnique,
        update,
      },
    });
  });
});

describe('saveRolePermissionGrantsAction', () => {
  it('replaces editable role grants from checked permissions in one transaction', async () => {
    const { saveRolePermissionGrantsAction } =
      await import('@/libs/admin/roles/roleAdminActions');

    await expect(
      saveRolePermissionGrantsAction(
        'en',
        formData([
          ['grant', `${Role.VOLUNTEER}:${Permission.RATINGS_ASSIGN}`],
          ['grant', `${Role.DOCK_STAFF}:${Permission.CARDS_APPROVE}`],
          ['grant', `${Role.USER}:${Permission.ADMIN_VIEW}`],
          ['grant', `${Role.DOCK_STAFF}:${Permission.ADMIN_VIEW}`],
          ['grant', `${Role.DOCK_STAFF}:${Permission.USERS_EDIT}`],
          ['grant', `${Role.ADMIN}:${Permission.USERS_DELETE}`],
          ['grant', `unknown:${Permission.USERS_DELETE}`],
        ])
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/roles?status=saved');

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.ROLES_MANAGE_PERMISSIONS,
      'en'
    );
    expect(transaction).toHaveBeenCalledOnce();
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        roleKey: {
          in: [...ROLE_PERMISSION_GRANT_ROLES],
        },
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { roleKey: Role.VOLUNTEER, permissionKey: Permission.RATINGS_ASSIGN },
        { roleKey: Role.DOCK_STAFF, permissionKey: Permission.CARDS_APPROVE },
        { roleKey: Role.DOCK_STAFF, permissionKey: Permission.ADMIN_VIEW },
        { roleKey: Role.DOCK_STAFF, permissionKey: Permission.USERS_EDIT },
      ],
      skipDuplicates: true,
    });
    expect(invalidateRolePermissionGrants).toHaveBeenCalledOnce();
  });
});

describe('updateUserRolesAction', () => {
  it('updates app role and role mirror through Better Auth', async () => {
    findUnique.mockResolvedValue({ appRole: Role.USER, role: Role.USER });
    const { updateUserRolesAction } =
      await import('@/libs/admin/roles/roleAdminActions');

    await expect(
      updateUserRolesAction(
        'en',
        'user-1',
        formData([['role', Role.VOLUNTEER]])
      )
    ).rejects.toThrow('NEXT_REDIRECT:/admin/roles?status=user_saved');

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.ROLES_ASSIGN,
      'en'
    );
    expect(transaction).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      data: { appRole: Role.VOLUNTEER },
      where: { id: 'user-1' },
    });
    expect(setRole).toHaveBeenCalledWith({
      body: { role: Role.VOLUNTEER, userId: 'user-1' },
      headers: expect.any(Headers),
    });
  });

  it('leaves app role unchanged when Better Auth role mirror update fails', async () => {
    findUnique.mockResolvedValue({ appRole: Role.ADMIN, role: Role.ADMIN });
    userCount.mockResolvedValue(2);
    setRole.mockRejectedValue(new Error('auth down'));
    const { updateUserRolesAction } =
      await import('@/libs/admin/roles/roleAdminActions');

    await expect(
      updateUserRolesAction('en', 'admin-1', formData([['role', Role.USER]]))
    ).rejects.toThrow('auth down');

    expect(userCount).toHaveBeenCalledWith({
      where: { appRole: Role.ADMIN },
    });
    expect(setRole).toHaveBeenCalledWith({
      body: { role: Role.USER, userId: 'admin-1' },
      headers: expect.any(Headers),
    });
    expect(update).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('keeps at least one admin role assigned', async () => {
    findUnique.mockResolvedValue({ appRole: Role.ADMIN, role: Role.USER });
    userCount.mockResolvedValue(1);
    const { updateUserRolesAction } =
      await import('@/libs/admin/roles/roleAdminActions');

    await expect(
      updateUserRolesAction('en', 'admin-1', formData([['role', Role.USER]]))
    ).rejects.toThrow('NEXT_REDIRECT:/admin/roles?status=last_admin');

    expect(userCount).toHaveBeenCalledWith({
      where: { appRole: Role.ADMIN },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('checks last-admin demotion inside a transaction', async () => {
    transaction.mockImplementationOnce(async (runTransaction) => {
      await runTransaction({
        user: {
          count: userCount,
          findUnique,
          update,
        },
      });
    });
    findUnique.mockResolvedValue({ appRole: Role.ADMIN, role: Role.USER });
    userCount.mockResolvedValue(1);
    const { updateUserRolesAction } =
      await import('@/libs/admin/roles/roleAdminActions');

    await expect(
      updateUserRolesAction('en', 'admin-1', formData([['role', Role.USER]]))
    ).rejects.toThrow('NEXT_REDIRECT:/admin/roles?status=last_admin');

    expect(transaction).toHaveBeenCalledOnce();
    expect(userCount).toHaveBeenCalledWith({
      where: { appRole: Role.ADMIN },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
