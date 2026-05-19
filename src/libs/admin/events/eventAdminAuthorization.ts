import 'server-only';
import { ForbiddenError } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';
import { redirect } from 'next/navigation';
import type { Prisma } from '@/generated/prisma/client';
import type { AuthSession } from '@/libs/auth/dal';
import { appRoleFromSessionUser, requireAdmin } from '@/libs/auth/dal';
import type { AuthAbility } from '@/libs/auth/permissions';
import { AuthAction, createAuthAbility } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

type AdminEventAccessRecord = {
  admins: readonly {
    adminUserId: string;
  }[];
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

function createEventAdminAbility(
  session: NonNullable<AuthSession>
): AuthAbility {
  return createAuthAbility({
    role: appRoleFromSessionUser(session.user),
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
  const session = await requireAdmin(locale);
  const ability = createEventAdminAbility(session);
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
  const session = await requireAdmin(props.locale);
  const ability = createEventAdminAbility(session);
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
