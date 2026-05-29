import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PricingPageView } from '@/components/mit-sailing/pricing/PricingPageView';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getCurrentUser } from '@/libs/auth/dal';

type PricingPageProps = {
  readonly params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PricingPageProps) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'PricingPage' });

  return {
    description: t('meta_description'),
    title: t('meta_title'),
  };
}

export default async function PricingPage(props: PricingPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const [t, currentUser] = await Promise.all([
    getTranslations({ locale, namespace: 'PricingPage' }),
    getCurrentUser(),
  ]);

  return (
    <SiteSectionShell locale={locale} segments={[{ label: t('breadcrumb') }]}>
      <PricingPageView isSignedIn={Boolean(currentUser)} />
    </SiteSectionShell>
  );
}
