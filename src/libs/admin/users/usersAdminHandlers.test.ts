import { APIError } from 'better-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  banUser: vi.fn(),
  createUser: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(async () => {
    await Promise.resolve();
    return new Headers({ 'x-test': '1' });
  }),
  removeUser: vi.fn(),
  setUserPassword: vi.fn(),
  unbanUser: vi.fn(),
  updateUser: vi.fn(),
  userCount: vi.fn(),
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      adminUpdateUser: mocks.updateUser,
      banUser: mocks.banUser,
      createUser: mocks.createUser,
      getSession: mocks.getSession,
      removeUser: mocks.removeUser,
      setUserPassword: mocks.setUserPassword,
      unbanUser: mocks.unbanUser,
    },
  },
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      count: mocks.userCount,
      findMany: mocks.userFindMany,
      findUnique: mocks.userFindUnique,
    },
  },
}));

const { usersAdminHandlers } =
  await import('@/libs/admin/users/usersAdminHandlers');

function createFormData(props?: {
  email?: string;
  name?: string;
  password?: string;
  role?: Role;
}) {
  const formData = new FormData();
  formData.set('email', props?.email ?? 'new-sailor@example.com');
  formData.set('name', props?.name ?? 'New Sailor');
  formData.set('password', props?.password ?? 'correct-password');
  formData.set('role', props?.role ?? Role.USER);
  return formData;
}

function updateFormData(props?: {
  banned?: boolean;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  newPassword?: string;
  role?: Role;
}) {
  const formData = new FormData();
  formData.set('email', props?.email ?? 'updated-sailor@example.com');
  formData.set('name', props?.name ?? 'Updated Sailor');
  formData.set('role', props?.role ?? Role.USER);
  formData.set('newPassword', props?.newPassword ?? '');
  formData.append('emailVerified', String(props?.emailVerified ?? true));
  formData.append('banned', String(props?.banned ?? false));
  return formData;
}

function apiError(code: string) {
  return new APIError('BAD_REQUEST', { code, message: code });
}

beforeEach(() => {
  mocks.banUser.mockReset();
  mocks.createUser.mockReset();
  mocks.getSession.mockReset();
  mocks.headers.mockClear();
  mocks.removeUser.mockReset();
  mocks.setUserPassword.mockReset();
  mocks.unbanUser.mockReset();
  mocks.updateUser.mockReset();
  mocks.userCount.mockReset();
  mocks.userFindMany.mockReset();
  mocks.userFindUnique.mockReset();

  mocks.createUser.mockResolvedValue({ user: { id: 'created-user' } });
  mocks.getSession.mockResolvedValue({ user: { id: 'admin-user' } });
  mocks.userCount.mockResolvedValue(2);
  mocks.userFindUnique.mockResolvedValue({
    banned: false,
    role: Role.USER,
  });
});

describe('usersAdminHandlers', () => {
  describe('list', () => {
    it('lists users with boolean ban state', async () => {
      mocks.userFindMany.mockResolvedValue([
        {
          banned: null,
          email: 'sailor@example.com',
          emailVerified: true,
          id: 'user-1',
          name: 'Sailor',
          role: Role.USER,
        },
        {
          banned: true,
          email: 'admin@example.com',
          emailVerified: false,
          id: 'user-2',
          name: 'Admin',
          role: Role.ADMIN,
        },
      ]);

      await expect(usersAdminHandlers.list()).resolves.toEqual([
        {
          banned: false,
          email: 'sailor@example.com',
          emailVerified: true,
          id: 'user-1',
          name: 'Sailor',
          role: Role.USER,
        },
        {
          banned: true,
          email: 'admin@example.com',
          emailVerified: false,
          id: 'user-2',
          name: 'Admin',
          role: Role.ADMIN,
        },
      ]);
    });
  });

  describe('getById', () => {
    it('returns one user when found and null when missing', async () => {
      mocks.userFindUnique
        .mockResolvedValueOnce({
          banned: false,
          email: 'sailor@example.com',
          emailVerified: true,
          id: 'user-1',
          name: 'Sailor',
          role: Role.USER,
        })
        .mockResolvedValueOnce(null);

      await expect(usersAdminHandlers.getById('user-1')).resolves.toMatchObject(
        {
          banned: false,
          email: 'sailor@example.com',
          id: 'user-1',
        }
      );
      await expect(
        usersAdminHandlers.getById('missing-user')
      ).resolves.toBeNull();
    });
  });

  describe('createFromForm', () => {
    it('creates user and maps duplicate email and validation failures', async () => {
      await expect(
        usersAdminHandlers.createFromForm(createFormData())
      ).resolves.toEqual({ id: 'created-user', ok: true });

      mocks.createUser.mockRejectedValue(
        apiError('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
      );

      await expect(
        usersAdminHandlers.createFromForm(createFormData())
      ).resolves.toEqual({ code: 'duplicate_email', ok: false });

      await expect(
        usersAdminHandlers.createFromForm(createFormData({ email: 'bad' }))
      ).resolves.toEqual({ code: 'validation_failed', ok: false });
    });

    it('maps invalid user id shape and network errors to unknown', async () => {
      mocks.createUser.mockImplementation(async () => {
        await Promise.resolve();
        return { user: { id: 1 } };
      });
      await expect(
        usersAdminHandlers.createFromForm(createFormData())
      ).resolves.toEqual({ code: 'unknown', ok: false });

      mocks.createUser.mockRejectedValue(new Error('network'));
      await expect(
        usersAdminHandlers.createFromForm(createFormData())
      ).resolves.toEqual({ code: 'unknown', ok: false });
    });
  });

  describe('updateFromForm', () => {
    it('updates details, ban state, and password', async () => {
      mocks.userFindUnique.mockResolvedValue({
        banned: false,
        role: Role.USER,
      });

      await expect(
        usersAdminHandlers.updateFromForm(
          'user-1',
          updateFormData({ banned: true, newPassword: 'new-password' })
        )
      ).resolves.toEqual({ ok: true });

      expect(mocks.updateUser).toHaveBeenCalledWith({
        body: {
          data: {
            email: 'updated-sailor@example.com',
            emailVerified: true,
            name: 'Updated Sailor',
            role: Role.USER,
          },
          userId: 'user-1',
        },
        headers: expect.any(Headers),
      });
      expect(mocks.banUser).toHaveBeenCalledWith({
        body: { userId: 'user-1' },
        headers: expect.any(Headers),
      });
      expect(mocks.setUserPassword).toHaveBeenCalledWith({
        body: { newPassword: 'new-password', userId: 'user-1' },
        headers: expect.any(Headers),
      });
    });

    it('unbans user and maps no data to update', async () => {
      mocks.userFindUnique.mockResolvedValue({
        banned: true,
        role: Role.USER,
      });
      await expect(
        usersAdminHandlers.updateFromForm(
          'user-1',
          updateFormData({ banned: false })
        )
      ).resolves.toEqual({ ok: true });
      expect(mocks.unbanUser).toHaveBeenCalledWith({
        body: { userId: 'user-1' },
        headers: expect.any(Headers),
      });

      mocks.userFindUnique.mockResolvedValue({
        banned: false,
        role: Role.USER,
      });
      mocks.updateUser.mockRejectedValue(apiError('NO_DATA_TO_UPDATE'));
      await expect(
        usersAdminHandlers.updateFromForm('user-1', updateFormData())
      ).resolves.toEqual({ code: 'no_data_to_update', ok: false });
    });

    it('blocks last admin demotion and ban', async () => {
      mocks.userFindUnique.mockResolvedValue({
        banned: false,
        role: Role.ADMIN,
      });
      mocks.userCount.mockResolvedValue(1);

      await expect(
        usersAdminHandlers.updateFromForm(
          'admin-1',
          updateFormData({ role: Role.USER })
        )
      ).resolves.toEqual({ code: 'last_admin', ok: false });

      await expect(
        usersAdminHandlers.updateFromForm(
          'admin-1',
          updateFormData({ banned: true, role: Role.ADMIN })
        )
      ).resolves.toEqual({ code: 'last_admin', ok: false });
    });

    it('demotes admin when another admin remains', async () => {
      mocks.userFindUnique.mockResolvedValue({
        banned: false,
        role: Role.ADMIN,
      });
      mocks.userCount.mockResolvedValue(2);

      await expect(
        usersAdminHandlers.updateFromForm(
          'admin-1',
          updateFormData({ role: Role.USER })
        )
      ).resolves.toEqual({ ok: true });
    });

    it('maps validation failure and missing user on update', async () => {
      await expect(
        usersAdminHandlers.updateFromForm(
          'user-1',
          updateFormData({ email: 'bad' })
        )
      ).resolves.toEqual({ code: 'validation_failed', ok: false });

      mocks.userFindUnique.mockResolvedValue(null);
      await expect(
        usersAdminHandlers.updateFromForm('missing-user', updateFormData())
      ).resolves.toEqual({ code: 'not_found', ok: false });
    });

    it('maps auth API network and password errors', async () => {
      mocks.userFindUnique.mockResolvedValue({
        banned: false,
        role: Role.USER,
      });
      mocks.updateUser.mockRejectedValue(new Error('network'));
      await expect(
        usersAdminHandlers.updateFromForm('user-1', updateFormData())
      ).resolves.toEqual({ code: 'unknown', ok: false });

      mocks.updateUser.mockImplementation(async () => {
        await Promise.resolve();
      });
      mocks.banUser.mockRejectedValue(new Error('network'));
      await expect(
        usersAdminHandlers.updateFromForm(
          'user-1',
          updateFormData({ banned: true })
        )
      ).resolves.toEqual({ code: 'unknown', ok: false });

      mocks.userFindUnique.mockResolvedValue({
        banned: false,
        role: Role.USER,
      });
      mocks.banUser.mockImplementation(async () => {
        await Promise.resolve();
      });
      mocks.setUserPassword.mockRejectedValue(new Error('network'));
      await expect(
        usersAdminHandlers.updateFromForm(
          'user-1',
          updateFormData({ newPassword: 'new-secret-password' })
        )
      ).resolves.toEqual({ code: 'unknown', ok: false });

      mocks.setUserPassword.mockRejectedValue(apiError('PASSWORD_COMPROMISED'));
      await expect(
        usersAdminHandlers.updateFromForm(
          'user-1',
          updateFormData({ newPassword: 'new-secret-password' })
        )
      ).resolves.toEqual({ code: 'password_compromised', ok: false });
    });
  });

  describe('delete', () => {
    it('deletes user with self, last-admin, and error guards', async () => {
      mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
      await expect(usersAdminHandlers.delete('user-1')).resolves.toEqual({
        code: 'cannot_remove_self',
        ok: false,
      });

      mocks.getSession.mockResolvedValue({ user: { id: 'admin-user' } });
      mocks.userFindUnique.mockResolvedValue({ role: Role.ADMIN });
      mocks.userCount.mockResolvedValue(1);
      await expect(usersAdminHandlers.delete('last-admin')).resolves.toEqual({
        code: 'last_admin',
        ok: false,
      });

      mocks.userFindUnique.mockResolvedValue({ role: Role.USER });
      await expect(usersAdminHandlers.delete('user-2')).resolves.toEqual({
        ok: true,
      });
      expect(mocks.removeUser).toHaveBeenCalledWith({
        body: { userId: 'user-2' },
        headers: expect.any(Headers),
      });

      mocks.removeUser.mockRejectedValue(
        apiError('YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS')
      );
      await expect(usersAdminHandlers.delete('user-3')).resolves.toEqual({
        code: 'not_allowed',
        ok: false,
      });

      mocks.removeUser.mockRejectedValue(new Error('network'));
      await expect(usersAdminHandlers.delete('user-4')).resolves.toEqual({
        code: 'unknown',
        ok: false,
      });
    });
  });
});
