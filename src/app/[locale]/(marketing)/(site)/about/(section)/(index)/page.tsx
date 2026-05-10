import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AboutPageView } from '@/components/mit-sailing/about/AboutPageView';
import { loadPublishedCmsPageByPath } from '@/libs/mit-sailing/cmsQueries';
import type { PublicCmsPage } from '@/libs/mit-sailing/cmsQueries';

type AboutPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AboutPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'About',
  });
  const title = t('meta_title');
  const description = t('meta_description');
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function AboutPage(props: AboutPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  let cmsPage: PublicCmsPage | null = null;
  try {
    cmsPage = await loadPublishedCmsPageByPath('/about/');
  } catch (error: unknown) {
    console.error('Failed to load About CMS page', error);
  }
  return <AboutPageView cmsPage={cmsPage} />;
}
