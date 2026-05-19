import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { createAdminUserAction } from '@/libs/admin/users/adminUserActions';
import { usersAdminDefinition } from '@/libs/admin/users/userAdminDefinitions';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users_new') };
}

/**
 * `GET /admin/users/new` — create user form.
 *
 * @param props - App Router page props
 * @returns Create form
 */
export default async function AdminUsersNewPage(props: PageProps) {
  const { locale } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);
  await requirePermission(Permission.USERS_EDIT, locale);

  const createAction = createAdminUserAction.bind(null, locale);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminCatalogForm
        key="user-new"
        definition={usersAdminDefinition}
        errorCode={errorCode ?? null}
        formAction={createAction}
        headingKey="new_heading"
        messageNamespace="AdminUsers"
      />
    </div>
  );
}
