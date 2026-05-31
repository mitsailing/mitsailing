import 'server-only';
import { APIError } from 'better-auth';
import { headers } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import { SailingCardRequestStatus } from '@/generated/prisma/enums';
import type {
  AdminUserRow,
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import { updateUserAppRole } from '@/libs/admin/users/appRoleActions';
import { mapAuthAdminErrorToCode } from '@/libs/admin/users/mapAuthAdminError';
import {
  adminUserCreateFormSchema,
  adminUserUpdateFormSchema,
  rawAdminUserCreateFromFormData,
  rawAdminUserUpdateFromFormData,
} from '@/libs/admin/users/usersAdminSchemas';
import { auth } from '@/libs/auth';
import { normalizeAppRole } from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { emailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';

const VIABLE_ADMIN_FILTER = {
  appRole: Role.ADMIN,
  banned: false,
  emailVerified: true,
} satisfies Prisma.UserWhereInput;

function sailingCardStatusFromUser(user: {
  readonly sailingCardNumber: number | null;
  readonly sailingCardRequests: readonly { readonly status: string }[];
  readonly sailingCardYear: number | null;
}): AdminUserRow['sailingCardStatus'] {
  const pendingRequest = user.sailingCardRequests.some(
    (request) => request.status === SailingCardRequestStatus.pending
  );
  if (pendingRequest) {
    return 'pending';
  }
  if (user.sailingCardNumber === null) {
    return 'none';
  }
  if (user.sailingCardYear === getCurrentSailingCardYear()) {
    return 'current';
  }
  return 'expired';
}

function rowFromDb(user: {
  id: string;
  email: string;
  name: string;
  appRole: string;
  emailVerified: boolean;
  banned: boolean | null;
  emailBouncedAt: Date | null;
  emailSuppressedAt: Date | null;
  emailSuppressionReason: string | null;
  mitId: string | null;
  sailingCardNumber: number | null;
  sailingCardRequests: readonly { status: string }[];
  sailingCardYear: number | null;
}): AdminUserRow {
  return {
    id: user.id,
    email: user.email,
    emailBouncedAt: user.emailBouncedAt?.toISOString() ?? null,
    emailDeliverabilityStatus: emailDeliverabilityStatus(user),
    emailSuppressedAt: user.emailSuppressedAt?.toISOString() ?? null,
    emailSuppressionReason: user.emailSuppressionReason,
    mitId: user.mitId,
    sailingCardNumber: user.sailingCardNumber,
    sailingCardStatus: sailingCardStatusFromUser(user),
    name: user.name,
    appRole: normalizeAppRole(user.appRole),
    emailVerified: user.emailVerified,
    banned: Boolean(user.banned),
  };
}

function isViableAdminUser(user: {
  appRole: unknown;
  banned: unknown;
  emailVerified: unknown;
}): boolean {
  return (
    normalizeAppRole(user.appRole) === Role.ADMIN &&
    user.banned === false &&
    user.emailVerified === true
  );
}

async function assertCanRemoveOrDemoteAdmin(
  targetUserId: string
): Promise<CatalogMutationErr | null> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { appRole: true, banned: true, emailVerified: true },
  });
  if (!target || !isViableAdminUser(target)) {
    return null;
  }
  const adminCount = await prisma.user.count({
    where: VIABLE_ADMIN_FILTER,
  });
  if (adminCount <= 1) {
    return { ok: false, code: 'last_admin' };
  }
  return null;
}

type AdminHeaders = Awaited<ReturnType<typeof headers>>;
type AdminRequestContext =
  | {
      authContext: NonNullable<ReturnType<typeof appAuthContextFromSession>>;
      headers: AdminHeaders;
    }
  | CatalogMutationErr;

function authMutationError(error: unknown): CatalogMutationErr {
  if (error instanceof APIError) {
    return { ok: false, code: mapAuthAdminErrorToCode(error) };
  }
  return { ok: false, code: 'unknown' };
}

async function adminRequestContext(): Promise<AdminRequestContext> {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    return { ok: false, code: 'not_allowed' };
  }
  return { authContext, headers: hdrs };
}

function appRoleUpdateError(
  result: Exclude<Awaited<ReturnType<typeof updateUserAppRole>>, { ok: true }>
): CatalogMutationErr {
  if (result.code === 'forbidden') {
    return { ok: false, code: 'not_allowed' };
  }
  return result;
}

async function rollbackCreatedUser(props: {
  headers: AdminHeaders;
  id: string;
}): Promise<CatalogMutationErr | null> {
  try {
    await auth.api.removeUser({
      body: { userId: props.id },
      headers: props.headers,
    });
    return null;
  } catch {
    return { ok: false, code: 'role_assignment_rollback_failed' };
  }
}

async function updateAppRoleFromForm(props: {
  currentRole: Role;
  headers: AdminHeaders;
  nextRole: Role;
  targetUserId: string;
}): Promise<CatalogMutationErr | null> {
  if (props.currentRole === props.nextRole) {
    return null;
  }
  const session = await auth.api.getSession({ headers: props.headers });
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    return { ok: false, code: 'not_allowed' };
  }
  const result = await updateUserAppRole({
    authContext,
    nextRole: props.nextRole,
    requestHeaders: props.headers,
    targetUserId: props.targetUserId,
  });
  return result.ok ? null : appRoleUpdateError(result);
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
        appRole: true,
        emailVerified: true,
        banned: true,
        emailBouncedAt: true,
        emailSuppressedAt: true,
        emailSuppressionReason: true,
        mitId: true,
        sailingCardNumber: true,
        sailingCardRequests: {
          orderBy: { requestedAt: 'desc' },
          select: { status: true },
          take: 1,
        },
        sailingCardYear: true,
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
        appRole: true,
        emailVerified: true,
        banned: true,
        emailBouncedAt: true,
        emailSuppressedAt: true,
        emailSuppressionReason: true,
        mitId: true,
        sailingCardNumber: true,
        sailingCardRequests: {
          orderBy: { requestedAt: 'desc' },
          select: { status: true },
          take: 1,
        },
        sailingCardYear: true,
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
    const { appRole, email, name, password } = parsed.data;
    const hdrs = await headers();
    try {
      const result = await auth.api.createUser({
        body: {
          email,
          name,
          password,
          role: Role.USER,
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
      if (appRole !== Role.USER) {
        const context = await adminRequestContext();
        if (!('authContext' in context)) {
          const rollbackError = await rollbackCreatedUser({
            headers: hdrs,
            id: createdId,
          });
          if (rollbackError) {
            return rollbackError;
          }
          return context;
        }
        const roleUpdate = await updateUserAppRole({
          authContext: context.authContext,
          nextRole: appRole,
          requestHeaders: context.headers,
          targetUserId: createdId,
        });
        if (!roleUpdate.ok) {
          const rollbackError = await rollbackCreatedUser({
            headers: context.headers,
            id: createdId,
          });
          if (rollbackError) {
            return rollbackError;
          }
          return appRoleUpdateError(roleUpdate);
        }
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
    const { appRole, email, name, emailVerified, banned, newPassword } =
      parsed.data;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { appRole: true, banned: true, email: true, emailVerified: true },
    });
    if (!existing) {
      return { ok: false, code: 'not_found' };
    }

    const currentRole = normalizeAppRole(existing.appRole);
    if (
      currentRole === Role.ADMIN &&
      (appRole !== Role.ADMIN || banned || !emailVerified)
    ) {
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
      emailVerified,
      ...emailDeliverabilityResetData,
    };
    const wasBanned = Boolean(existing.banned);
    const banStateChanged = wasBanned !== banned;

    const userUpdate = await updateUserDetails({ id, data, headers: hdrs });
    if (typeof userUpdate !== 'boolean') {
      return userUpdate;
    }
    const appRoleUpdate = await updateAppRoleFromForm({
      currentRole,
      headers: hdrs,
      nextRole: appRole,
      targetUserId: id,
    });
    if (appRoleUpdate) {
      return appRoleUpdate;
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

    if (
      !userUpdate &&
      currentRole === appRole &&
      !banStateChanged &&
      trimmedPassword.length === 0
    ) {
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
