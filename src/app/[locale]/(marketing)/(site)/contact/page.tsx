import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CmsPageBlocks } from '@/components/mit-sailing/cms/CmsPageBlocks';
import { ContactPageView } from '@/components/mit-sailing/contact/ContactPageView';
import { loadPublishedCmsPageByPath } from '@/libs/mit-sailing/cmsQueries';
import { submitContactFormAction } from '@/libs/mit-sailing/contactActions';

type ContactPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function contactStatus(value?: string): 'invalid' | 'sent' | undefined {
  if (value === 'invalid' || value === 'sent') {
    return value;
  }
  return undefined;
}

function currentNewYorkYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
    }).format(new Date())
  );
}

export async function generateMetadata(
  props: ContactPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const cmsPage = await loadPublishedCmsPageByPath('/contact');
  if (cmsPage) {
    const description = cmsPage.metaDescription || undefined;
    return {
      title: cmsPage.metaTitle,
      description,
      openGraph: {
        title: cmsPage.metaTitle,
        description,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: cmsPage.metaTitle,
        description,
      },
    };
  }
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_contact') };
}

export default async function ContactPage(props: ContactPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const cmsPage = await loadPublishedCmsPageByPath('/contact');
  const formAction = submitContactFormAction.bind(null, locale);
  const pageView = (
    <ContactPageView
      currentYear={currentNewYorkYear()}
      formAction={formAction}
      status={contactStatus(searchParams?.status)}
    />
  );

  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  if (cmsPage) {
    return (
      <>
        <CmsPageBlocks page={cmsPage} />
        {pageView}
      </>
    );
  }
  return (
    <>
      <h1 className="font-mit-serif text-3xl font-semibold text-mit-text">
        {t('title_contact')}
      </h1>
      {pageView}
    </>
  );
}
