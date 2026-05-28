import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/libs/I18nNavigation';

type MitnaSubNavLayoutProps = {
  children: ReactNode;
  locale: string;
};

/**
 * Sub-navigation for the MIT North Association about section (Figma `MitnaSectionLayout`).
 *
 * @param props - Sub-layout props
 * @param props.children - Main column content
 * @param props.locale - Active UI locale
 * @returns Localized two-column layout with a vertical nav
 */
export async function MitnaSubNavLayout(props: MitnaSubNavLayoutProps) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,14rem)_1fr]">
      <nav
        className="flex flex-col gap-1 border-slate-200 md:border-r md:pe-6"
        aria-label={t('mitna_subnav_aria')}
      >
        <Link
          className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          href="/about/mitna/"
        >
          {t('mitna_nav_root')}
        </Link>
        <Link
          className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          href="/about/mitna/constitution/"
        >
          {t('mitna_nav_constitution')}
        </Link>
        <Link
          className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          href="/about/mitna/meetings/"
        >
          {t('mitna_nav_meetings')}
        </Link>
        <Link
          className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          href="/about/mitna/hatch-award/"
        >
          {t('mitna_nav_hatch')}
        </Link>
      </nav>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}
