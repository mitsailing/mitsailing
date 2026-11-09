import type { AuthStrategy } from 'payload';
import { auth } from '@/libs/auth';
import {
  getAppRolePermissions,
  hasAnyPermission,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';
import { CMS_ADMIN_PERMISSIONS } from '@/payload/access';

type BetterAuthSessionUser = {
  id?: unknown;
  email?: unknown;
  name?: unknown;
  appRole?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Maps a Better Auth staff session into a Payload users doc (find-or-create).
 * Sailors and other roles without CMS admin permissions never get a Payload user.
 */
export const betterAuthStrategy: AuthStrategy = {
  name: 'better-auth',
  authenticate: async ({ headers, payload }) => {
    const session = await auth.api.getSession({ headers });
    if (!session || !isRecord(session.user)) {
      return { user: null };
    }

    const sessionUser = session.user as BetterAuthSessionUser;
    const betterAuthUserId =
      typeof sessionUser.id === 'string' ? sessionUser.id : null;
    const email =
      typeof sessionUser.email === 'string' ? sessionUser.email : null;
    if (!betterAuthUserId || !email) {
      return { user: null };
    }

    const appRole = normalizeAppRole(sessionUser.appRole);
    const permissions = getAppRolePermissions(appRole);
    if (!hasAnyPermission(permissions, CMS_ADMIN_PERMISSIONS)) {
      return { user: null };
    }

    const existing = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: {
        betterAuthUserId: {
          equals: betterAuthUserId,
        },
      },
    });

    const displayName =
      typeof sessionUser.name === 'string' && sessionUser.name.length > 0
        ? sessionUser.name
        : email;

    const [existingUser] = existing.docs;
    let user = existingUser;
    if (!user) {
      user = await payload.create({
        collection: 'users',
        data: {
          appRole,
          betterAuthUserId,
          email,
          name: displayName,
        },
        overrideAccess: true,
      });
    } else if (
      user.appRole !== appRole ||
      user.email !== email ||
      user.name !== displayName
    ) {
      user = await payload.update({
        collection: 'users',
        data: {
          appRole,
          email,
          name: displayName,
        },
        id: user.id,
        overrideAccess: true,
      });
    }

    return {
      user: {
        ...user,
        collection: 'users',
        _strategy: 'better-auth',
      },
    };
  },
};
