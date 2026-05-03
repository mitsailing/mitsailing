import 'server-only';
import { APIError } from 'better-auth';
import { headers } from 'next/headers';
import type {
  AdminUserRow,
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { mapAuthAdminErrorToCode } from '@/libs/admin/users/mapAuthAdminError';
import {
  adminUserCreateFormSchema,
  adminUserUpdateFormSchema,
  rawAdminUserCreateFromFormData,
  rawAdminUserUpdateFromFormData,
} from '@/libs/admin/users/usersAdminSchemas';
import { auth } from '@/libs/auth';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';

function rowFromDb(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  banned: boolean | null;
}): AdminUserRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    banned: Boolean(user.banned),
  };
}

async function assertCanRemoveOrDemoteAdmin(
  targetUserId: string
): Promise<CatalogMutationErr | null> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  });
  if (!target || target.role !== Role.ADMIN) {
    return null;
  }
  const admins = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (admins <= 1) {
    return { ok: false, code: 'last_admin' };
  }
  return null;
}

/**
 * Better Auth–backed handlers for `/admin/users` (not registered in catalog registry).
 */
export const usersAdminHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const rows = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        banned: true,
      },
    });
    return rows.map(rowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const row = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        banned: true,
      },
    });
    return row ? rowFromDb(row) : null;
  },

  async createFromForm(formData: FormData): Promise<CatalogCreateResult> {
    const parsed = adminUserCreateFormSchema.safeParse(
      rawAdminUserCreateFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { email, name, password, role } = parsed.data;
    const hdrs = await headers();
    try {
      const result = await auth.api.createUser({
        body: {
          email,
          name,
          password,
          role,
        },
        headers: hdrs,
      });
      const createdId =
        result &&
        typeof result === 'object' &&
        'user' in result &&
        result.user &&
        typeof result.user === 'object' &&
        'id' in result.user &&
        typeof result.user.id === 'string'
          ? result.user.id
          : null;
      if (!createdId) {
        return { ok: false, code: 'unknown' };
      }
      return { ok: true, id: createdId };
    } catch (error: unknown) {
      if (error instanceof APIError) {
        return { ok: false, code: mapAuthAdminErrorToCode(error) };
      }
      return { ok: false, code: 'unknown' };
    }
  },

  async updateFromForm(
    id: string,
    formData: FormData
  ): Promise<CatalogMutationOk | CatalogMutationErr> {
    const parsed = adminUserUpdateFormSchema.safeParse(
      rawAdminUserUpdateFromFormData(formData)
    );
    if (!parsed.success) {
      return { ok: false, code: 'validation_failed' };
    }
    const { email, name, role, emailVerified, banned, newPassword } =
      parsed.data;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!existing) {
      return { ok: false, code: 'not_found' };
    }

    if (existing.role === Role.ADMIN && role === Role.USER) {
      const block = await assertCanRemoveOrDemoteAdmin(id);
      if (block) {
        return block;
      }
    }

    if (existing.role === Role.ADMIN && banned) {
      const block = await assertCanRemoveOrDemoteAdmin(id);
      if (block) {
        return block;
      }
    }

    const hdrs = await headers();
    const trimmedPassword = newPassword.trim();
    const data: Record<string, unknown> = {
      email,
      name,
      role,
      emailVerified,
      banned,
    };

    let userUpdated = false;
    try {
      await auth.api.adminUpdateUser({
        body: { userId: id, data },
        headers: hdrs,
      });
      userUpdated = true;
    } catch (error: unknown) {
      if (
        error instanceof APIError &&
        error.body?.code === 'NO_DATA_TO_UPDATE'
      ) {
        userUpdated = false;
      } else if (error instanceof APIError) {
        return { ok: false, code: mapAuthAdminErrorToCode(error) };
      } else {
        return { ok: false, code: 'unknown' };
      }
    }

    if (trimmedPassword.length > 0) {
      try {
        await auth.api.setUserPassword({
          body: { userId: id, newPassword: trimmedPassword },
          headers: hdrs,
        });
      } catch (error: unknown) {
        if (error instanceof APIError) {
          return { ok: false, code: mapAuthAdminErrorToCode(error) };
        }
        return { ok: false, code: 'unknown' };
      }
    }

    if (!userUpdated && trimmedPassword.length === 0) {
      return { ok: false, code: 'no_data_to_update' };
    }

    return { ok: true };
  },

  async delete(id: string): Promise<CatalogMutationOk | CatalogMutationErr> {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    const selfId = session?.user?.id;
    if (selfId && selfId === id) {
      return { ok: false, code: 'cannot_remove_self' };
    }

    const block = await assertCanRemoveOrDemoteAdmin(id);
    if (block) {
      return block;
    }

    try {
      await auth.api.removeUser({
        body: { userId: id },
        headers: hdrs,
      });
      return { ok: true };
    } catch (error: unknown) {
      if (error instanceof APIError) {
        return { ok: false, code: mapAuthAdminErrorToCode(error) };
      }
      return { ok: false, code: 'unknown' };
    }
  },
};
