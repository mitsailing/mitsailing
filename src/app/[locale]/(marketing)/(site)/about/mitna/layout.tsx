import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MitnaSubNavLayout } from '@/components/mit-sailing/MitnaSubNavLayout';
import { Link } from '@/libs/I18nNavigation';

export default async function MitnaLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <div>
      <nav
        className="mb-6 text-sm text-slate-600"
        aria-label={t('mitna_breadcrumb_aria')}
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="text-blue-800 hover:underline">
              {t('crumb_home')}
            </Link>
          </li>
          <li aria-hidden className="text-slate-400">
            /
          </li>
          <li>
            <Link href="/about/" className="text-blue-800 hover:underline">
              {t('section_about')}
            </Link>
          </li>
          <li aria-hidden className="text-slate-400">
            /
          </li>
          <li className="text-slate-800">{t('mitna_title')}</li>
        </ol>
      </nav>
      <MitnaSubNavLayout locale={locale}>{props.children}</MitnaSubNavLayout>
    </div>
  );
}
