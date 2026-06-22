import 'server-only';
import { APIError } from 'better-auth';
import { headers } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import {
  SailingCardRequestStatus,
  PaymentPurpose,
} from '@/generated/prisma/enums';
import type {
  PaymentPurpose as PaymentPurposeValue,
  PaymentStatus as PaymentStatusValue,
  SailingCardType as SailingCardTypeValue,
} from '@/generated/prisma/enums';
import type {
  AdminUserRow,
  CatalogCreateResult,
  CatalogMutationErr,
  CatalogMutationOk,
  CatalogRow,
  CatalogServerHandlers,
} from '@/libs/admin/catalog/types';
import {
  adminUserMembershipPaymentListStatus,
  cardTypeFilterWhere,
  membershipPaymentStatusFilterWhere,
  pendingCardTypeFromUser,
} from '@/libs/admin/users/adminUserListMembershipPayment';
import type {
  AdminUsersCardTypeFilter,
  AdminUsersMembershipPaymentStatusFilter,
} from '@/libs/admin/users/adminUserListMembershipPayment';
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
import { isRole, Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { emailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';

const VIABLE_ADMIN_FILTER = {
  appRole: Role.ADMIN,
  banned: false,
  emailVerified: true,
} satisfies Prisma.UserWhereInput;

export const ADMIN_USERS_PAGE_SIZE = 50;

export type AdminUsersEmailStatusFilter =
  | 'all'
  | 'bounced'
  | 'ok'
  | 'suppressed';

export type AdminUsersSailingCardStatusFilter =
  | 'all'
  | 'current'
  | 'expired'
  | 'none'
  | 'pending';

export type AdminUsersListFilters = {
  readonly cardType: AdminUsersCardTypeFilter;
  readonly emailStatus: AdminUsersEmailStatusFilter;
  readonly membershipPaymentStatus: AdminUsersMembershipPaymentStatusFilter;
  readonly query: string;
  readonly sailingCardStatus: AdminUsersSailingCardStatusFilter;
};

export type AdminUsersListPage = {
  readonly page: number;
  readonly pageSize: number;
  readonly rows: AdminUserRow[];
  readonly total: number;
};

function sailingCardStatusFromUser(user: {
  readonly _count?: { readonly sailingCardRequests: number };
  readonly sailingCardNumber: number | null;
  readonly sailingCardRequests?: readonly { readonly status: string }[];
  readonly sailingCardYear: number | null;
}): AdminUserRow['sailingCardStatus'] {
  const pendingRequestCount = user._count?.sailingCardRequests;
  const pendingRequest =
    pendingRequestCount === undefined
      ? (user.sailingCardRequests?.some(
          (request) => request.status === SailingCardRequestStatus.pending
        ) ?? false)
      : pendingRequestCount > 0;
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
  _count?: { sailingCardRequests: number };
  id: string;
  email: string;
  name: string;
  appRole: string;
  emailVerified: boolean;
  banned: boolean | null;
  emailBouncedAt: Date | null;
  emailSuppressedAt: Date | null;
  emailSuppressionReason: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  firstName: string | null;
  lastName: string | null;
  mitClassYear: string | null;
  mitDataWarehouseVerifiedAt: Date | null;
  mitId: string | null;
  phone: string | null;
  sailingAffiliation: AdminUserRow['sailingAffiliation'];
  sailingCardNumber: number | null;
  sailingCardRequests?: readonly {
    cardType: SailingCardTypeValue;
    cardYear: number;
    status: SailingCardRequestStatus;
  }[];
  payments?: readonly {
    cardType: SailingCardTypeValue | null;
    cardYear: number | null;
    createdAt: Date;
    purpose: PaymentPurposeValue;
    status: PaymentStatusValue;
  }[];
  sailingCardYear: number | null;
}): AdminUserRow {
  const sailingCardRequests = user.sailingCardRequests ?? [];
  const payments = user.payments ?? [];
  return {
    id: user.id,
    email: user.email,
    emailBouncedAt: user.emailBouncedAt?.toISOString() ?? null,
    emailDeliverabilityStatus: emailDeliverabilityStatus(user),
    emailSuppressedAt: user.emailSuppressedAt?.toISOString() ?? null,
    emailSuppressionReason: user.emailSuppressionReason,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    firstName: user.firstName,
    lastName: user.lastName,
    mitClassYear: user.mitClassYear,
    mitDataWarehouseVerifiedAt:
      user.mitDataWarehouseVerifiedAt?.toISOString() ?? null,
    mitId: user.mitId,
    phone: user.phone,
    sailingAffiliation: user.sailingAffiliation,
    sailingCardNumber: user.sailingCardNumber,
    sailingCardStatus: sailingCardStatusFromUser(user),
    pendingCardType: pendingCardTypeFromUser({ sailingCardRequests }),
    membershipPaymentStatus: adminUserMembershipPaymentListStatus({
      payments,
      sailingCardRequests,
    }),
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

function userSearchWhere(query: string): Prisma.UserWhereInput | null {
  const value = query.trim();
  if (!value) {
    return null;
  }
  const clauses: Prisma.UserWhereInput[] = [
    { email: { contains: value, mode: 'insensitive' } },
    { name: { contains: value, mode: 'insensitive' } },
    { firstName: { contains: value, mode: 'insensitive' } },
    { lastName: { contains: value, mode: 'insensitive' } },
    { phone: { contains: value, mode: 'insensitive' } },
    { emergencyContactName: { contains: value, mode: 'insensitive' } },
    { emergencyContactPhone: { contains: value, mode: 'insensitive' } },
    { mitId: { contains: value, mode: 'insensitive' } },
  ];
  if (isRole(value)) {
    clauses.push({ appRole: { equals: value } });
  }
  const cardNumber = Number.parseInt(value, 10);
  if (Number.isInteger(cardNumber) && String(cardNumber) === value) {
    clauses.push({ sailingCardNumber: cardNumber });
  }
  return { OR: clauses };
}

function emailStatusWhere(
  filter: AdminUsersEmailStatusFilter
): Prisma.UserWhereInput | null {
  if (filter === 'bounced') {
    return { emailBouncedAt: { not: null } };
  }
  if (filter === 'suppressed') {
    return { emailSuppressedAt: { not: null } };
  }
  if (filter === 'ok') {
    return {
      emailBouncedAt: null,
      emailSuppressedAt: null,
    };
  }
  return null;
}

function pendingSailingCardRequestWhere() {
  return {
    sailingCardRequests: {
      some: {
        cardYear: getCurrentSailingCardYear(),
        status: SailingCardRequestStatus.pending,
      },
    },
  } satisfies Prisma.UserWhereInput;
}

function sailingCardStatusWhere(
  filter: AdminUsersSailingCardStatusFilter
): Prisma.UserWhereInput | null {
  if (filter === 'pending') {
    return pendingSailingCardRequestWhere();
  }
  if (filter === 'current') {
    return {
      NOT: pendingSailingCardRequestWhere(),
      sailingCardNumber: { not: null },
      sailingCardYear: getCurrentSailingCardYear(),
    };
  }
  if (filter === 'expired') {
    return {
      NOT: pendingSailingCardRequestWhere(),
      sailingCardNumber: { not: null },
      sailingCardYear: { not: getCurrentSailingCardYear() },
    };
  }
  if (filter === 'none') {
    return {
      NOT: pendingSailingCardRequestWhere(),
      sailingCardNumber: null,
    };
  }
  return null;
}

function adminUsersWhere(
  filters: AdminUsersListFilters
): Prisma.UserWhereInput {
  const clauses = [
    userSearchWhere(filters.query),
    emailStatusWhere(filters.emailStatus),
    sailingCardStatusWhere(filters.sailingCardStatus),
    cardTypeFilterWhere(filters.cardType),
    membershipPaymentStatusFilterWhere(
      filters.membershipPaymentStatus,
      filters.cardType
    ),
  ].filter((clause): clause is Prisma.UserWhereInput => clause !== null);
  return clauses.length === 0 ? {} : { AND: clauses };
}

const adminUserListPaymentSelect = {
  cardType: true,
  cardYear: true,
  createdAt: true,
  purpose: true,
  status: true,
} as const;

const adminUserListRequestSelect = {
  cardType: true,
  cardYear: true,
  status: true,
} as const;

function adminUserListInclude(currentYear: number) {
  return {
    _count: {
      select: {
        sailingCardRequests: {
          where: {
            cardYear: currentYear,
            status: SailingCardRequestStatus.pending,
          },
        },
      },
    },
    payments: {
      orderBy: { createdAt: 'desc' as const },
      select: adminUserListPaymentSelect,
      where: {
        cardYear: currentYear,
        purpose: PaymentPurpose.membership,
      },
    },
    sailingCardRequests: {
      select: adminUserListRequestSelect,
      where: {
        cardYear: currentYear,
        status: SailingCardRequestStatus.pending,
      },
    },
  };
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

export async function listAdminUsersPage(options: {
  readonly filters: AdminUsersListFilters;
  readonly page: number;
  readonly pageSize?: number;
}): Promise<AdminUsersListPage> {
  const pageSize = options.pageSize ?? ADMIN_USERS_PAGE_SIZE;
  const where = adminUsersWhere(options.filters);
  const currentYear = getCurrentSailingCardYear();
  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(options.page, 1), totalPages);
  const rows = await prisma.user.findMany({
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    where,
    select: {
      ...adminUserListInclude(currentYear),
      id: true,
      email: true,
      name: true,
      appRole: true,
      emailVerified: true,
      banned: true,
      emailBouncedAt: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emailSuppressedAt: true,
      emailSuppressionReason: true,
      firstName: true,
      lastName: true,
      mitClassYear: true,
      mitDataWarehouseVerifiedAt: true,
      mitId: true,
      phone: true,
      sailingAffiliation: true,
      sailingCardNumber: true,
      sailingCardYear: true,
    },
  });
  return {
    page,
    pageSize,
    rows: rows.map(rowFromDb),
    total,
  };
}

/**
 * Better Auth–backed handlers for `/admin/users` (not registered in catalog registry).
 */
export const usersAdminHandlers: CatalogServerHandlers = {
  async list(): Promise<CatalogRow[]> {
    const currentYear = getCurrentSailingCardYear();
    const rows = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        ...adminUserListInclude(currentYear),
        id: true,
        email: true,
        name: true,
        appRole: true,
        emailVerified: true,
        banned: true,
        emailBouncedAt: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emailSuppressedAt: true,
        emailSuppressionReason: true,
        firstName: true,
        lastName: true,
        mitClassYear: true,
        mitDataWarehouseVerifiedAt: true,
        mitId: true,
        phone: true,
        sailingAffiliation: true,
        sailingCardNumber: true,
        sailingCardYear: true,
      },
    });
    return rows.map(rowFromDb);
  },

  async getById(id: string): Promise<CatalogRow | null> {
    const currentYear = getCurrentSailingCardYear();
    const row = await prisma.user.findUnique({
      where: { id },
      select: {
        ...adminUserListInclude(currentYear),
        id: true,
        email: true,
        name: true,
        appRole: true,
        emailVerified: true,
        banned: true,
        emailBouncedAt: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emailSuppressedAt: true,
        emailSuppressionReason: true,
        firstName: true,
        lastName: true,
        mitClassYear: true,
        mitDataWarehouseVerifiedAt: true,
        mitId: true,
        phone: true,
        sailingAffiliation: true,
        sailingCardNumber: true,
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
