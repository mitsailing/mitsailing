import 'server-only';
import { Role } from '@/libs/auth/roles';
import { setBetterAuthRoleMirror } from '@/libs/auth/server-admin';
import { logger } from '@/libs/Logger';
import { getAuthZenStack } from '@/libs/zenstack/auth';
import type { AppAuthContext } from '@/libs/zenstack/authContext';

export type AppRoleUpdateResult =
  | { ok: true }
  | {
      ok: false;
      code: 'forbidden' | 'last_admin' | 'role_mirror_inconsistent';
    };

const VIABLE_ADMIN_FILTER = {
  appRole: Role.ADMIN,
  banned: false,
  emailVerified: true,
};

function isViableAdmin(user: {
  appRole: unknown;
  banned: unknown;
  emailVerified: unknown;
}): boolean {
  return (
    user.appRole === Role.ADMIN &&
    user.banned === false &&
    user.emailVerified === true
  );
}

export async function updateUserAppRole(props: {
  authContext: AppAuthContext;
  nextRole: Role;
  requestHeaders: Headers;
  targetUserId: string;
}): Promise<AppRoleUpdateResult> {
  if (props.authContext.appRole !== Role.ADMIN) {
    return { code: 'forbidden', ok: false };
  }

  const db = getAuthZenStack();
  const targetUser = await db.user.findUnique({
    where: { id: props.targetUserId },
    select: { appRole: true, banned: true, emailVerified: true },
  });
  if (!targetUser) {
    return { code: 'forbidden', ok: false };
  }

  if (isViableAdmin(targetUser) && props.nextRole !== Role.ADMIN) {
    // TODO: Make last-admin protection transactional if concurrent admin edits become a realistic operational risk.
    const adminCount = await db.user.count({
      where: VIABLE_ADMIN_FILTER,
    });
    if (adminCount <= 1) {
      return { code: 'last_admin', ok: false };
    }
  }

  await setBetterAuthRoleMirror({
    requestHeaders: props.requestHeaders,
    role: props.nextRole,
    userId: props.targetUserId,
  });

  try {
    await db.user.update({
      where: { id: props.targetUserId },
      data: { appRole: props.nextRole },
    });
  } catch (error) {
    try {
      await setBetterAuthRoleMirror({
        requestHeaders: props.requestHeaders,
        role: targetUser.appRole,
        userId: props.targetUserId,
      });
    } catch (rollbackError) {
      logger.error('Failed to roll back Better Auth role mirror: {error}', {
        error,
        operation: 'updateUserAppRole',
        rollbackError,
        targetUserId: props.targetUserId,
      });
      return { code: 'role_mirror_inconsistent', ok: false };
    }
    throw error;
  }

  return { ok: true };
}
