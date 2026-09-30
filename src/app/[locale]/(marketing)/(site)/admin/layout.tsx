import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminSideNav } from '@/components/mit-sailing/admin/AdminSideNav';
import { AdminWorkspaceLayout } from '@/components/mit-sailing/admin/AdminWorkspaceLayout';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { requireAdminAreaAccess } from '@/libs/admin/adminAreaAccess';
import {
  adminNavGroupsForPermissions,
  adminNavItemsForPermissions,
} from '@/libs/admin/adminNavigation';

export default async function AdminSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { permissions } = await requireAdminAreaAccess(locale);
  const navItems = adminNavItemsForPermissions(permissions);
  const navGroups = adminNavGroupsForPermissions(permissions);
  const homeItem = navItems.find((item) => item.href === '/admin');
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
        className="mx-0 px-4 lg:px-8"
        maxWidth="admin"
        variant="admin"
      >
        <AdminWorkspaceLayout
          sidebar={<AdminSideNav groups={navGroups} homeItem={homeItem} />}
        >
          {props.children}
        </AdminWorkspaceLayout>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
