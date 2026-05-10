import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { deleteAdminUserAction } from '@/libs/admin/users/adminUserActions';
import { adminUsersIndexPath } from '@/libs/admin/users/adminUserPaths';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { Link } from '@/libs/I18nNavigation';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users_delete') };
}

function deleteErrorMessage(
  code: string,
  tr: Awaited<ReturnType<typeof getTranslations<'AdminUsers'>>>
): string {
  if (code === 'last_admin') {
    return tr('delete_error_last_admin');
  }
  if (code === 'cannot_remove_self') {
    return tr('delete_error_self');
  }
  return tr('delete_error');
}

/**
 * Delete confirmation for a user (Better Auth removeUser).
 *
 * @param props - App Router page props
 * @returns Confirm UI
 */
export default async function AdminUsersDeletePage(props: PageProps) {
  const { locale, id } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);

  const row = await usersAdminHandlers.getById(id);
  if (!row) {
    notFound();
  }

  const displayName =
    typeof row.name === 'string' && row.name.length > 0
      ? row.name
      : String(row.email ?? id);

  const deleteAction = deleteAdminUserAction.bind(null, locale, id);

  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  const tr = await getTranslations({ locale, namespace: 'AdminUsers' });
  const tCommon = await getTranslations({ locale, namespace: 'Common' });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold text-mit-text">
        {t('title_admin_users_delete')}
      </h1>

      {errorCode ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {deleteErrorMessage(errorCode, tr)}
        </p>
      ) : null}

      <p className="text-sm text-mit-text">
        {tr('delete_confirm_message', { name: displayName })}
      </p>

      <div className="flex flex-wrap gap-3">
        <form action={deleteAction}>
          <SubmitButton
            className="bg-red-700 text-white hover:bg-red-800"
            pendingLabel={tCommon('pending_deleting')}
            variant="destructive"
          >
            {tr('delete_submit')}
          </SubmitButton>
        </form>
        <Button asChild variant="outline">
          <Link href={adminUsersIndexPath()}>{tr('cancel')}</Link>
        </Button>
      </div>
    </div>
  );
}
