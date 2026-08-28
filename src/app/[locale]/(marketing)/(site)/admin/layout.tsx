import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminSideNav } from '@/components/mit-sailing/admin/AdminSideNav';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { SiteSidebarLayout } from '@/components/mit-sailing/SiteSidebarLayout';
import { requireAdminAreaAccess } from '@/libs/admin/adminAreaAccess';

export default async function AdminSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { navItems } = await requireAdminAreaAccess(locale);
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
        className="mx-0 pt-5 pb-10 md:pt-6 md:pb-12 lg:px-8"
        maxWidth="admin"
        variant="catalog"
      >
        <SiteSidebarLayout
          density="content-fit"
          sidebar={<AdminSideNav items={navItems} />}
        >
          {props.children}
        </SiteSidebarLayout>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
