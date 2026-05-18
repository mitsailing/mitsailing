import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const {
  authSetRole,
  createMany,
  deleteMany,
  findUnique,
  headers,
  invalidateRolePermissionGrants,
  redirect,
  requirePermission,
  transaction,
  update,
  userCount,
} = vi.hoisted(() => ({
  authSetRole: vi.fn(),
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

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      setRole: authSetRole,
    },
  },
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission,
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
  authSetRole.mockReset();
  createMany.mockReset();
  deleteMany.mockReset();
  findUnique.mockReset();
  headers.mockClear();
  invalidateRolePermissionGrants.mockReset();
  redirect.mockClear();
  requirePermission.mockReset();
  transaction.mockReset();
  update.mockReset();
  userCount.mockReset();

  authSetRole.mockResolvedValue({ user: { id: 'user-1' } });
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
          in: [
            Role.VOLUNTEER,
            Role.VOLUNTEER_INSTRUCTOR,
            Role.DOCK_STAFF,
            Role.DOCK_MASTER,
          ],
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
  it('updates the role through Better Auth', async () => {
    findUnique.mockResolvedValue({ role: Role.USER });
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
    expect(authSetRole).toHaveBeenCalledWith({
      body: {
        role: Role.VOLUNTEER,
        userId: 'user-1',
      },
      headers: expect.any(Headers),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps at least one admin role assigned', async () => {
    findUnique.mockResolvedValue({ role: Role.ADMIN });
    userCount.mockResolvedValue(1);
    const { updateUserRolesAction } =
      await import('@/libs/admin/roles/roleAdminActions');

    await expect(
      updateUserRolesAction('en', 'admin-1', formData([['role', Role.USER]]))
    ).rejects.toThrow('NEXT_REDIRECT:/admin/roles?status=last_admin');

    expect(update).not.toHaveBeenCalled();
  });
});
