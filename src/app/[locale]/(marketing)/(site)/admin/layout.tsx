import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminSideNav } from '@/components/mit-sailing/admin/AdminSideNav';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { SiteSidebarLayout } from '@/components/mit-sailing/SiteSidebarLayout';
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
      <SiteSectionMain
        className="pt-5 pb-10 md:pt-6 md:pb-12"
        maxWidth="7xl"
        variant="catalog"
      >
        <SiteSidebarLayout
          density="collapsible"
          stretch
          sidebar={<AdminSideNav />}
        >
          {props.children}
        </SiteSidebarLayout>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
