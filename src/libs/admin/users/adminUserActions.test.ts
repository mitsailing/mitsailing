import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    expect(mocks.requirePermission).toHaveBeenCalledWith('users.edit', 'en');
  });

  it('requires users.delete before deleting users through Better Auth', async () => {
    const { deleteAdminUserAction } =
      await import('@/libs/admin/users/adminUserActions');

    await expect(deleteAdminUserAction('en', 'user-1')).rejects.toThrow(
      'NEXT_REDIRECT:/admin/users'
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith('users.delete', 'en');
  });
});
