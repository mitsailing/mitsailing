import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getStaffBySlug } from '@/data/mit-sailing/aboutContent';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

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
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingAbout',
  });
  const staff = getStaffBySlug(slug);
  const name = staff?.name ?? slug;
  return (
    <>
      <Link
        className={`mb-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName}`}
        href="/about/"
      >
        <ArrowLeft aria-hidden size={16} />
        {t('back_to_about')}
      </Link>
      <h1 className="font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {name}
      </h1>
      {staff ? (
        <p className="mt-2 text-base text-mit-text">{staff.role}</p>
      ) : null}
    </>
  );
}
