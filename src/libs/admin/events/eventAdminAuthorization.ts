import 'server-only';
import { redirect } from 'next/navigation';
import type { AuthSession } from '@/libs/auth/dal';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import type { ZenStackDb } from '@/libs/zenstack/auth';
import { zenstackForAuthContext } from '@/libs/zenstack/auth';
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
  db: ZenStackDb;
  event: AdminEventAccessRecord;
  session: NonNullable<AuthSession>;
};

export type AdminEventListAccess = {
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
    db: zenstackForAuthContext(authContext),
    session,
  };
}

async function canUpdateEvent(props: {
  db: ZenStackDb;
  event: Pick<AdminEventAccessRecord, 'id' | 'slug'>;
}): Promise<boolean> {
  const result = await props.db.event.updateMany({
    where: { id: props.event.id },
    data: { slug: props.event.slug },
  });
  return result.count > 0;
}

async function findEventAccessRecord(props: {
  db: ZenStackDb;
  slug: string;
}): Promise<AdminEventAccessRecord | null> {
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
  if (!(await canUpdateEvent({ db: props.db, event }))) {
    return null;
  }
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
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    redirect(getI18nPath('/', props.locale));
  }
  const db = zenstackForAuthContext(authContext);
  const event = await findEventAccessRecord({
    db,
    slug: props.slug,
  });
  if (!event) {
    if (!(await eventExists(props.slug))) {
      return null;
    }
    redirect(getI18nPath('/admin/events', props.locale));
  }
  return { db, event, session };
}
