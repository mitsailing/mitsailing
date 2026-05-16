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
import { emailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';

function rowFromDb(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  banned: boolean | null;
  emailBouncedAt: Date | null;
  emailSuppressedAt: Date | null;
  emailSuppressionReason: string | null;
}): AdminUserRow {
  return {
    id: user.id,
    email: user.email,
    emailBouncedAt: user.emailBouncedAt?.toISOString() ?? null,
    emailDeliverabilityStatus: emailDeliverabilityStatus(user),
    emailSuppressedAt: user.emailSuppressedAt?.toISOString() ?? null,
    emailSuppressionReason: user.emailSuppressionReason,
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

type AdminHeaders = Awaited<ReturnType<typeof headers>>;

function authMutationError(error: unknown): CatalogMutationErr {
  if (error instanceof APIError) {
    return { ok: false, code: mapAuthAdminErrorToCode(error) };
  }
  return { ok: false, code: 'unknown' };
}

async function updateUserDetails(props: {
  id: string;
  data: Record<string, unknown>;
  headers: AdminHeaders;
}): Promise<boolean | CatalogMutationErr> {
  try {
    await auth.api.adminUpdateUser({
      body: { userId: props.id, data: props.data },
      headers: props.headers,
    });
    return true;
  } catch (error: unknown) {
    if (error instanceof APIError && error.body?.code === 'NO_DATA_TO_UPDATE') {
      return false;
    }
    return authMutationError(error);
  }
}

async function updateUserBanState(props: {
  id: string;
  banned: boolean;
  headers: AdminHeaders;
}): Promise<CatalogMutationErr | null> {
  try {
    await (props.banned
      ? auth.api.banUser({
          body: { userId: props.id },
          headers: props.headers,
        })
      : auth.api.unbanUser({
          body: { userId: props.id },
          headers: props.headers,
        }));
    return null;
  } catch (error: unknown) {
    return authMutationError(error);
  }
}

async function setAdminUserPassword(props: {
  id: string;
  newPassword: string;
  headers: AdminHeaders;
}): Promise<CatalogMutationErr | null> {
  try {
    await auth.api.setUserPassword({
      body: { userId: props.id, newPassword: props.newPassword },
      headers: props.headers,
    });
    return null;
  } catch (error: unknown) {
    return authMutationError(error);
  }
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
        emailBouncedAt: true,
        emailSuppressedAt: true,
        emailSuppressionReason: true,
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
        emailBouncedAt: true,
        emailSuppressedAt: true,
        emailSuppressionReason: true,
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
      select: { banned: true, email: true, role: true },
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
    const emailDeliverabilityResetData =
      email === existing.email
        ? {}
        : {
            emailBouncedAt: null,
            emailSuppressedAt: null,
            emailSuppressionReason: null,
          };
    const data: Record<string, unknown> = {
      email,
      name,
      role,
      emailVerified,
      ...emailDeliverabilityResetData,
    };
    const wasBanned = Boolean(existing.banned);
    const banStateChanged = wasBanned !== banned;

    const userUpdate = await updateUserDetails({ id, data, headers: hdrs });
    if (typeof userUpdate !== 'boolean') {
      return userUpdate;
    }

    if (banStateChanged) {
      const banUpdate = await updateUserBanState({ id, banned, headers: hdrs });
      if (banUpdate) {
        return banUpdate;
      }
    }

    if (trimmedPassword.length > 0) {
      const passwordUpdate = await setAdminUserPassword({
        id,
        newPassword: trimmedPassword,
        headers: hdrs,
      });
      if (passwordUpdate) {
        return passwordUpdate;
      }
    }

    if (!userUpdate && !banStateChanged && trimmedPassword.length === 0) {
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
