import { Pencil } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { adminHeaderLinkVisibleFromSession } from '@/libs/auth/adminHeaderLink';
import { getSession } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';

type PublicAdminEditLinkSession = {
  session?: { impersonatedBy?: string | null } | null;
  user?: { id?: string | null; role?: unknown } | null;
} | null;

function publicAdminEditLinkVisible(
  session: PublicAdminEditLinkSession
): boolean {
  return adminHeaderLinkVisibleFromSession({
    impersonatedBy: session?.session?.impersonatedBy,
    userId: session?.user?.id,
    userRole: session?.user?.role,
  });
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

  const t = await getTranslations('AdminCatalogResource');
  return (
    <div className={cn('mb-6 flex justify-end', props.className)}>
      <Link
        className="inline-flex items-center gap-1.5 rounded-md border border-mit-line bg-background px-3 py-1.5 text-sm font-semibold text-mit-red-ink no-underline shadow-xs hover:bg-mit-red-highlight"
        href={props.href}
      >
        <Pencil aria-hidden className="size-4" />
        {t('action_edit_public_page')}
      </Link>
    </div>
  );
}
