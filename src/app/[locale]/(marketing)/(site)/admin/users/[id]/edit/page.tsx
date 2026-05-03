import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { updateAdminUserAction } from '@/libs/admin/users/adminUserActions';
import { usersAdminEditDefinition } from '@/libs/admin/users/userAdminDefinitions';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users_edit') };
}

/**
 * `GET /admin/users/:id/edit` — edit user form.
 *
 * @param props - App Router page props
 * @returns Update form
 */
export default async function AdminUsersEditPage(props: PageProps) {
  const { locale, id } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);

  const row = await usersAdminHandlers.getById(id);
  if (!row) {
    notFound();
  }

  const updateAction = updateAdminUserAction.bind(null, locale, id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminCatalogForm
        key={`user-${id}`}
        definition={usersAdminEditDefinition}
        errorCode={errorCode ?? null}
        formAction={updateAction}
        headingKey="edit_heading"
        messageNamespace="AdminUsers"
        row={row}
      />
    </div>
  );
}
