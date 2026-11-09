import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AboutPageView } from '@/components/mit-sailing/about/AboutPageView';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { loadAboutPageContent } from '@/libs/mit-sailing/loadAboutPageContent';

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
  const [content, t] = await Promise.all([
    loadAboutPageContent(),
    getTranslations({ locale, namespace: 'MitSailingAbout' }),
  ]);
  return (
    <>
      <PublicAdminEditLink
        className="mx-auto mb-0 w-full max-w-5xl px-6 pt-4"
        href="/cms/globals/about"
      />
      <AboutPageView content={content} profileLabel={t('view_profile')} />
    </>
  );
}
