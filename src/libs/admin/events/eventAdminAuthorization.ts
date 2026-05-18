import 'server-only';
import { ForbiddenError } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';
import { redirect } from 'next/navigation';
import type { Prisma } from '@/generated/prisma/client';
import type { AuthSession } from '@/libs/auth/dal';
import { requireAnyPermission } from '@/libs/auth/dal';
import type { AuthAbility } from '@/libs/auth/permissions';
import {
  AuthAction,
  createAuthAbility,
  Permission,
} from '@/libs/auth/permissions';
import { listRolePermissionGrants } from '@/libs/auth/rolePermissionGrants';
import { normalizeRole, Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

type AdminEventAccessRecord = {
  admins: readonly {
    adminUserId: string;
  }[];
  createdByUserId: string;
  id: string;
  slug: string;
};

export type AdminEventAccess = {
  ability: AuthAbility;
  event: AdminEventAccessRecord;
  session: NonNullable<AuthSession>;
};

export type AdminEventListAccess = {
  ability: AuthAbility;
  eventAccessWhere: Prisma.EventWhereInput;
  session: NonNullable<AuthSession>;
};

async function createEventAdminAbility(
  session: NonNullable<AuthSession>
): Promise<AuthAbility> {
  const role = normalizeRole(session.user.role);
  const grants = role === Role.ADMIN ? [] : await listRolePermissionGrants();
  return createAuthAbility({
    grants,
    role,
    userId: session.user.id,
  });
}

export function getEventAccessWhere(
  ability: AuthAbility
): Prisma.EventWhereInput | null {
  try {
    return accessibleBy(ability, AuthAction.UPDATE).Event;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return null;
    }
    throw error;
  }
}

export async function requireAdminEventListAccess(
  locale: string
): Promise<AdminEventListAccess> {
  const session = await requireAnyPermission(
    [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
    locale
  );
  const ability = await createEventAdminAbility(session);
  const eventAccessWhere = getEventAccessWhere(ability);
  if (!eventAccessWhere) {
    redirect(getI18nPath('/', locale));
  }
  return { ability, eventAccessWhere, session };
}

async function findEventAccessRecord(props: {
  ability: AuthAbility;
  slug: string;
}): Promise<AdminEventAccessRecord | null> {
  const eventAccessWhere = getEventAccessWhere(props.ability);
  if (!eventAccessWhere) {
    return null;
  }
  const event = await prisma.event.findFirst({
    where: { AND: [{ slug: props.slug }, eventAccessWhere] },
    select: {
      id: true,
      slug: true,
      createdByUserId: true,
      admins: { select: { adminUserId: true } },
    },
  });
  return event;
}

async function eventExists(slug: string): Promise<boolean> {
  const count = await prisma.event.count({
    where: { slug },
  });
  return count > 0;
}

export async function requireAdminEventAccess(props: {
  locale: string;
  slug: string;
}): Promise<AdminEventAccess | null> {
  const session = await requireAnyPermission(
    [Permission.EVENTS_CREATE, Permission.EVENTS_MANAGE],
    props.locale
  );
  const ability = await createEventAdminAbility(session);
  const event = await findEventAccessRecord({
    ability,
    slug: props.slug,
  });
  if (!event) {
    if (!(await eventExists(props.slug))) {
      return null;
    }
    redirect(getI18nPath('/admin/events', props.locale));
  }
  return { ability, event, session };
}
