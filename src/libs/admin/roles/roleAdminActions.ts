'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/libs/auth';
import { requirePermission } from '@/libs/auth/dal';
import type { RolePermissionGrant } from '@/libs/auth/permissions';
import {
  isKnownPermission,
  isRoleGrantablePermission,
  isRolePermissionGrantRole,
  Permission,
  ROLE_PERMISSION_GRANT_ROLES,
} from '@/libs/auth/permissions';
import { invalidateRolePermissionGrants } from '@/libs/auth/rolePermissionGrants';
import { isRole, normalizeRole, Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

const ADMIN_ROLES_PATH = '/admin/roles';

function adminRolesRedirect(locale: string, status: string): never {
  redirect(`${getI18nPath(ADMIN_ROLES_PATH, locale)}?status=${status}`);
}

function grantFromValue(value: FormDataEntryValue): RolePermissionGrant | null {
  if (typeof value !== 'string') {
    return null;
  }
  const [roleKey, permissionKey, extra] = value.split(':');
  if (extra) {
    return null;
  }
  if (!(isRole(roleKey) && isKnownPermission(permissionKey))) {
    return null;
  }
  if (!isRolePermissionGrantRole(roleKey)) {
    return null;
  }
  if (!isRoleGrantablePermission(permissionKey)) {
    return null;
  }
  return { roleKey, permissionKey };
}

function selectedRolePermissionGrants(
  formData: FormData
): RolePermissionGrant[] {
  const grants = formData.getAll('grant').flatMap((value) => {
    const grant = grantFromValue(value);
    return grant ? [grant] : [];
  });
  const unique = new Map(
    grants.map((grant) => [`${grant.roleKey}:${grant.permissionKey}`, grant])
  );
  return [...unique.values()];
}

function selectedRole(formData: FormData): Role {
  return formData.getAll('role').find(isRole) ?? Role.USER;
}

async function wouldRemoveLastAdmin(props: {
  userId: string;
  nextRole: Role;
}): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: props.userId },
    select: { role: true },
  });
  if (!target) {
    return false;
  }
  if (
    normalizeRole(target.role) !== Role.ADMIN ||
    props.nextRole === Role.ADMIN
  ) {
    return false;
  }
  const adminCount = await prisma.user.count({
    where: { role: Role.ADMIN },
  });
  return adminCount <= 1;
}

export async function saveRolePermissionGrantsAction(
  locale: string,
  formData: FormData
): Promise<void> {
  await requirePermission(Permission.ROLES_MANAGE_PERMISSIONS, locale);
  const grants = selectedRolePermissionGrants(formData);
  await prisma.$transaction(async (tx) => {
    await tx.rolePermissionGrant.deleteMany({
      where: { roleKey: { in: [...ROLE_PERMISSION_GRANT_ROLES] } },
    });
    await tx.rolePermissionGrant.createMany({
      data: grants,
      skipDuplicates: true,
    });
  });
  invalidateRolePermissionGrants();
  adminRolesRedirect(locale, 'saved');
}

export async function updateUserRolesAction(
  locale: string,
  userId: string,
  formData: FormData
): Promise<void> {
  await requirePermission(Permission.ROLES_ASSIGN, locale);
  const role = selectedRole(formData);
  if (await wouldRemoveLastAdmin({ userId, nextRole: role })) {
    adminRolesRedirect(locale, 'last_admin');
  }
  await auth.api.setRole({
    body: { role, userId },
    headers: await headers(),
  });
  adminRolesRedirect(locale, 'user_saved');
}
