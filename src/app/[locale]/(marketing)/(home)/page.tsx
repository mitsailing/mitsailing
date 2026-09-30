import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MitSailingHomePageView } from '@/components/mit-sailing/home/MitSailingHomePageView';
import { loadPublishedCmsPageByPath } from '@/libs/mit-sailing/cmsQueries';

type IndexPageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Prefer published CMS SEO fields; ignore blank strings from admin forms.
 *
 * @param value - CMS meta title or description
 * @param fallback - i18n copy used when CMS text is missing
 * @returns CMS text when present, otherwise the i18n fallback
 */
function cmsTextOrFallback(
  value: string | undefined,
  fallback: string
): string {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? fallback : trimmed;
}

/**
 * Document, Open Graph, and Twitter metadata for `/`.
 *
 * @param props - Resolved title and description
 * @returns Metadata for the document title and social cards
 */
function homeMetadata(props: { description: string; title: string }): Metadata {
  return {
    description: props.description,
    openGraph: {
      description: props.description,
      title: props.title,
      type: 'website',
    },
    title: props.title,
    twitter: {
      card: 'summary_large_image',
      description: props.description,
      title: props.title,
    },
  };
}

export async function generateMetadata(
  props: IndexPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'MitSailingHome' }),
    loadPublishedCmsPageByPath('/'),
  ]);
  return homeMetadata({
    description: cmsTextOrFallback(
      page?.metaDescription,
      t('meta_description')
    ),
    title: cmsTextOrFallback(page?.metaTitle, t('meta_title')),
  });
}

export default async function Index(props: IndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  return <MitSailingHomePageView locale={locale} />;
}
