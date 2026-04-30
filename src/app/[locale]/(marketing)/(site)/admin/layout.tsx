import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { requireAdmin } from '@/libs/auth/dal';

export default async function AdminSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_admin') }]}
    >
      <SiteSectionMain maxWidth="7xl" variant="catalog">
        {props.children}
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
