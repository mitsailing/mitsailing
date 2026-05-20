import 'server-only';
import { redirect } from 'next/navigation';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { eventAccessModeWithAuthContext } from '@/libs/admin/events/zenstackEventAccess';
import type { AuthSession } from '@/libs/auth/dal';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import type { ZenStackDb } from '@/libs/zenstack/auth';
import { zenstackForAuthContext } from '@/libs/zenstack/auth';
import type { AppAuthContext } from '@/libs/zenstack/authContext';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';
import { getI18nPath } from '@/utils/Helpers';

type AdminEventAccessRecord = {
  admins: readonly {
    adminUserId: string;
  }[];
  id: string;
  slug: string;
};

export type AdminEventAccess = {
  accessMode: AdminEventAccessMode;
  db: ZenStackDb;
  event: AdminEventAccessRecord;
  session: NonNullable<AuthSession>;
};

export type AdminEventListAccess = {
  authContext: AppAuthContext;
  db: ZenStackDb;
  session: NonNullable<AuthSession>;
};

export async function requireAdminEventListAccess(
  locale: string
): Promise<AdminEventListAccess> {
  const session = await requireAdmin(locale);
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    redirect(getI18nPath('/', locale));
  }
  return {
    authContext,
    db: zenstackForAuthContext(authContext),
    session,
  };
}

async function findEventAccessRecord(props: {
  authContext: AppAuthContext;
  minimumAccessMode: AdminEventAccessMode;
  slug: string;
}): Promise<{
  accessMode: AdminEventAccessMode;
  event: AdminEventAccessRecord;
} | null> {
  const event = await prisma.event.findFirst({
    where: { slug: props.slug },
    select: {
      id: true,
      slug: true,
      admins: { select: { adminUserId: true } },
    },
  });
  if (!event) {
    return null;
  }
  const accessMode = eventAccessModeWithAuthContext({
    authContext: props.authContext,
    event,
  });
  if (!accessMode) {
    return null;
  }
  if (props.minimumAccessMode === 'editable' && accessMode !== 'editable') {
    return null;
  }
  return { accessMode, event };
}

async function eventExists(slug: string): Promise<boolean> {
  const count = await prisma.event.count({
    where: { slug },
  });
  return count > 0;
}

export async function requireAdminEventAccess(props: {
  locale: string;
  minimumAccessMode?: AdminEventAccessMode;
  slug: string;
}): Promise<AdminEventAccess | null> {
  const session = await requireAdmin(props.locale);
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    redirect(getI18nPath('/', props.locale));
  }
  const db = zenstackForAuthContext(authContext);
  const event = await findEventAccessRecord({
    authContext,
    minimumAccessMode: props.minimumAccessMode ?? 'editable',
    slug: props.slug,
  });
  if (!event) {
    if (!(await eventExists(props.slug))) {
      return null;
    }
    redirect(getI18nPath('/admin/events', props.locale));
  }
  return { accessMode: event.accessMode, db, event: event.event, session };
}
