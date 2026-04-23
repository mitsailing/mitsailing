import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_about_staff', { slug }) };
}

/**
 * About staff biographies; matches design `/about/:slug` for non-MITNA paths.
 * Static `about/mitna/...` routes are served by the `about/mitna/` tree instead.
 *
 * @param props - App Router page props
 * @param props.params - `locale` and `slug` from the path
 * @returns Placeholder staff page for the given slug
 */
export default async function AboutStaffPage(props: PageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">
        <Link className="text-blue-800 hover:underline" href="/about/">
          {t('back_to_about')}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">
        {t('title_about_staff', { slug })}
      </h1>
    </div>
  );
}
