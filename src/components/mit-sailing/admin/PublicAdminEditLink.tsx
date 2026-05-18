import { Pencil } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { getSession } from '@/libs/auth/dal';
import {
  AuthSubject,
  createAuthAbility,
  Permission,
} from '@/libs/auth/permissions';
import { listRolePermissionGrants } from '@/libs/auth/rolePermissionGrants';
import { normalizeRole } from '@/libs/auth/roles';
import { Link } from '@/libs/I18nNavigation';

type PublicAdminEditLinkSession = {
  session?: { impersonatedBy?: string | null } | null;
  user?: { id?: string | null; role?: unknown } | null;
} | null;

function publicAdminEditLinkVisible(
  session: PublicAdminEditLinkSession,
  grants: Awaited<ReturnType<typeof listRolePermissionGrants>>
): boolean {
  const userId = session?.user?.id;
  if (typeof userId !== 'string' || userId.length === 0) {
    return false;
  }
  if (session?.session?.impersonatedBy) {
    return false;
  }
  const ability = createAuthAbility({
    grants,
    role: normalizeRole(session?.user?.role),
    userId,
  });
  return ability.can(Permission.CMS_EDIT, AuthSubject.PERMISSION);
}

/**
 * Admin-only public page affordance linking back to the relevant edit screen.
 *
 * @param props - Edit URL plus optional wrapper class
 * @returns Link for admins, otherwise nothing
 */
export async function PublicAdminEditLink(props: {
  className?: string;
  href: string;
}) {
  const session = await getSession();
  const grants = await listRolePermissionGrants();
  if (!publicAdminEditLinkVisible(session, grants)) {
    return null;
  }

  const safeHref = props.href.startsWith('/admin/') ? props.href : '/admin';
  const t = await getTranslations('AdminCatalogResource');
  return (
    <div className={cn('mb-6 flex justify-end', props.className)}>
      <Link
        className="inline-flex items-center gap-1.5 rounded-md border border-mit-line bg-background px-3 py-1.5 text-sm font-semibold text-mit-red no-underline shadow-xs hover:bg-mit-red-highlight dark:border-white dark:text-white dark:hover:bg-white/10"
        href={safeHref}
      >
        <Pencil aria-hidden className="size-4" />
        {t('action_edit_public_page')}
      </Link>
    </div>
  );
}
