import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

const mocks = vi.hoisted(() => ({
  createFromForm: vi.fn(),
  deleteUser: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  updateFromForm: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/admin/users/usersAdminHandlers', () => ({
  usersAdminHandlers: {
    createFromForm: mocks.createFromForm,
    delete: mocks.deleteUser,
    updateFromForm: mocks.updateFromForm,
  },
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

beforeEach(() => {
  mocks.createFromForm.mockReset();
  mocks.deleteUser.mockReset();
  mocks.redirect.mockClear();
  mocks.requirePermission.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.updateFromForm.mockReset();

  mocks.createFromForm.mockResolvedValue({ id: 'user-1', ok: true });
  mocks.deleteUser.mockResolvedValue({ ok: true });
  mocks.requirePermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'admin-1', role: 'admin' },
  });
  mocks.updateFromForm.mockResolvedValue({ ok: true });
});

describe('admin user actions', () => {
  it.each([
    {
      name: 'creating users',
      run: async () => {
        const { createAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return createAdminUserAction('en', new FormData());
      },
    },
    {
      name: 'updating users',
      run: async () => {
        const { updateAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return updateAdminUserAction('en', 'user-1', new FormData());
      },
    },
  ])('requires users.edit before $name through Better Auth', async (action) => {
    await expect(action.run()).rejects.toThrow('NEXT_REDIRECT:/admin/users');

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_EDIT,
      'en'
    );
  });

  it.each([
    {
      name: 'creating users',
      permission: Permission.USERS_EDIT,
      run: async () => {
        const { createAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return createAdminUserAction('en', new FormData());
      },
    },
    {
      name: 'updating users',
      permission: Permission.USERS_EDIT,
      run: async () => {
        const { updateAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return updateAdminUserAction('en', 'user-1', new FormData());
      },
    },
    {
      name: 'deleting users',
      permission: Permission.USERS_DELETE,
      run: async () => {
        const { deleteAdminUserAction } =
          await import('@/libs/admin/users/adminUserActions');
        return deleteAdminUserAction('en', 'user-1');
      },
    },
  ])('stops before $name when permission is denied', async (action) => {
    mocks.requirePermission.mockRejectedValue(new Error('permission denied'));

    await expect(action.run()).rejects.toThrow('permission denied');

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      action.permission,
      'en'
    );
    expect(mocks.createFromForm).not.toHaveBeenCalled();
    expect(mocks.updateFromForm).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('requires users.delete before deleting users through Better Auth', async () => {
    const { deleteAdminUserAction } =
      await import('@/libs/admin/users/adminUserActions');

    await expect(deleteAdminUserAction('en', 'user-1')).rejects.toThrow(
      'NEXT_REDIRECT:/admin/users'
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_DELETE,
      'en'
    );
  });
});
