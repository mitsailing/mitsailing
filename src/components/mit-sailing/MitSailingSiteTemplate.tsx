'use client';

import { useTranslations } from 'next-intl';
import { AppConfig } from '@/utils/AppConfig';

type MitSailingSiteTemplateProps = {
  leftNav: React.ReactNode;
  rightNav?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Public + signed-in site chrome (replaces the boilerplate {@link BaseTemplate} for MIT Sailing).
 *
 * @param props - Template props
 * @param props.leftNav - Main navigation column (usually list items)
 * @param props.rightNav - Optional account / sign-in column
 * @param props.children - Main content
 * @returns Full-page shell with header, main, and footer
 */
export function MitSailingSiteTemplate({
  leftNav,
  rightNav,
  children,
}: MitSailingSiteTemplateProps) {
  const t = useTranslations('MitSailingLayout');

  return (
    <div className="w-full text-slate-800 antialiased">
      <div className="mx-auto max-w-3xl px-1">
        <header className="border-b border-slate-200">
          <div className="pt-10 pb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              {AppConfig.name}
            </h1>
            <p className="text-base text-slate-600">{t('site_tagline')}</p>
          </div>

          <div className="flex justify-between gap-4">
            <nav aria-label={t('main_nav_aria')}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base">
                {leftNav}
              </ul>
            </nav>
            {rightNav ? (
              <nav aria-label={t('utility_nav_aria')}>
                <ul className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-base">
                  {rightNav}
                </ul>
              </nav>
            ) : null}
          </div>
        </header>

        <main className="py-6 text-base leading-relaxed">{children}</main>

        <footer className="mt-8 border-t border-slate-200 py-6 text-center text-sm text-slate-600">
          {t('footer_legal', { year: new Date().getFullYear() })}
        </footer>
      </div>
    </div>
  );
}
