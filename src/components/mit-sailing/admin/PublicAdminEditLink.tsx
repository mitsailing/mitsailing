import { Pencil } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import {
  Permission,
  getAppRolePermissions,
  hasPermission,
} from '@/libs/auth/appPermissions';
import { getSession } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';

type PublicAdminEditLinkSession = {
  session?: { impersonatedBy?: string | null } | null;
  user?: {
    appRole?: unknown;
    banned?: unknown;
    emailVerified?: unknown;
    id?: string | null;
  } | null;
} | null;

function publicAdminEditLinkVisible(
  session: PublicAdminEditLinkSession
): boolean {
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    return false;
  }
  return hasPermission(
    getAppRolePermissions(authContext.appRole),
    Permission.CMS_EDIT
  );
}

/**
 * Allows app-admin catalog paths and Payload admin paths under `/cms`.
 *
 * @param href - Candidate edit URL
 * @returns Safe admin edit href, or null when disallowed
 */
export function safePublicAdminEditHref(href: string): string | null {
  if (href.startsWith('/admin/')) {
    return href;
  }
  if (href === '/cms' || href.startsWith('/cms/')) {
    return href;
  }
  return null;
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
  if (!publicAdminEditLinkVisible(session)) {
    return null;
  }

  const safeHref = safePublicAdminEditHref(props.href);
  if (!safeHref) {
    return null;
  }

  const t = await getTranslations('AdminCatalogResource');
  const linkClassName =
    'inline-flex items-center gap-1.5 rounded-md border border-mit-line bg-background px-3 py-1.5 text-sm font-semibold text-mit-red no-underline shadow-xs hover:bg-mit-red-highlight dark:border-white dark:text-white dark:hover:bg-white/10';
  const label = (
    <>
      <Pencil aria-hidden className="size-4" />
      {t('action_edit_public_page')}
    </>
  );

  return (
    <div className={cn('mb-6 flex justify-end', props.className)}>
      {safeHref.startsWith('/cms') ? (
        <a className={linkClassName} href={safeHref}>
          {label}
        </a>
      ) : (
        <Link className={linkClassName} href={safeHref}>
          {label}
        </Link>
      )}
    </div>
  );
}
