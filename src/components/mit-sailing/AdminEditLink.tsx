import { Pencil } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

type AdminEditLinkProps = {
  href: string;
  locale: string;
};

/**
 * @param props - Admin edit link target and active locale
 * @returns Compact edit affordance for public pages with admin backing
 */
export async function AdminEditLink(props: AdminEditLinkProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminCatalogResource',
  });

  return (
    <Link
      className={`inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName}`}
      href={props.href}
    >
      <Pencil aria-hidden size={15} />
      {t('action_edit')}
    </Link>
  );
}
