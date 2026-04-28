import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getStaffBySlug } from '@/data/mit-sailing/aboutContent';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const staff = getStaffBySlug(slug);
  const name = staff?.name ?? slug;
  const title = t('meta_title_about_staff', { slug: name });
  return {
    title,
    openGraph: { title, type: 'website' },
    twitter: { card: 'summary', title },
  };
}

/**
 * About staff biographies; `/about/:slug` for non-MITNA paths. Static
 * `about/mitna/...` routes are served by the `about/mitna/` tree.
 *
 * @param props - App Router page props
 * @param props.params - Resolves to `locale` and `slug`
 * @returns Staff profile block
 */
export default async function AboutStaffPage(props: PageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const staff = getStaffBySlug(slug);
  const name = staff?.name ?? slug;
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-mit-text">{name}</h1>
      {staff ? <p className="mt-1 text-slate-600">{staff.role}</p> : null}
    </div>
  );
}
