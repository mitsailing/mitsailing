import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/libs/I18nNavigation';

type SiteSectionShellProps = {
  children: ReactNode;
  locale: string;
  /** Breadcrumb label after "Home" (e.g. Events, Admin). */
  sectionTitle: string;
};

export async function SiteSectionShell(props: SiteSectionShellProps) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <div>
      <nav className="mb-6 text-slate-600" aria-label={t('crumb_aria')}>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          <li>
            <Link href="/" className="text-blue-800 hover:underline">
              {t('crumb_home')}
            </Link>
          </li>
          <li aria-hidden className="text-slate-400">
            /
          </li>
          <li className="text-slate-800">{props.sectionTitle}</li>
        </ol>
      </nav>
      {props.children}
    </div>
  );
}
