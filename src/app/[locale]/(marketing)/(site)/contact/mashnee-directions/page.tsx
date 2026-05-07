import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MashneeDirectionsView } from '@/components/mit-sailing/contact/MashneeDirectionsView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_mashnee') };
}

export default async function MashneeDirectionsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: t('section_contact'), href: '/contact/' },
        { label: t('title_mashnee') },
      ]}
    >
      <SiteSectionMain variant="detail">
        <MashneeDirectionsView locale={locale} />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
