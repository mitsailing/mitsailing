import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactPageView } from '@/components/mit-sailing/contact/ContactPageView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_contact') };
}

export default async function ContactPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_contact') }]}
    >
      <SiteSectionMain maxWidth="7xl" variant="detail">
        <ContactPageView locale={locale} />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
