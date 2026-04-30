import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MitnaMarketingPageShell } from '@/components/mit-sailing/MitnaMarketingPageShell';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_mitna_hatch') };
}

export default async function MitnaHatchAwardPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <MitnaMarketingPageShell locale={locale} page="hatch">
      <h1 className="font-mit-serif text-2xl font-semibold tracking-tight text-mit-text">
        {t('title_mitna_hatch')}
      </h1>
    </MitnaMarketingPageShell>
  );
}
