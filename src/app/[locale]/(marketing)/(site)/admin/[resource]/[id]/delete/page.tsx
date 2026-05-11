import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { adminCatalogResourceIndexPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { deleteCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import { Link } from '@/libs/I18nNavigation';

type PageProps = {
  params: Promise<{ locale: string; resource: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, resource } = await props.params;
  const def = tryGetCatalogDefinition(resource);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  if (!def) {
    return { title: t('meta_title_admin') };
  }
  return { title: t('meta_title_admin_catalog_delete') };
}

/**
 * Delete confirmation for a catalog row (Rails-style destroy flow).
 *
 * @param props - App Router page props
 * @param props.params - `locale`, `resource`, and row `id`
 * @returns Confirm UI
 */
export default async function AdminCatalogResourceDeletePage(props: PageProps) {
  const { locale, resource, id } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource) || !def.capabilities.delete) {
    notFound();
  }

  const handlers = getCatalogServerHandlers(resource);
  const row = await handlers.getById(id);
  if (!row) {
    notFound();
  }

  const name = typeof row.name === 'string' ? row.name : String(row.id ?? id);

  const deleteAction = deleteCatalogResourceAction.bind(
    null,
    locale,
    resource,
    id
  );

  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const tr = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });
  const tCommon = await getTranslations({
    locale,
    namespace: 'Common',
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold text-mit-text">
        {t('title_admin_catalog_delete')}
      </h1>

      {errorCode ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorCode === 'foreign_key'
            ? tr('delete_error_foreign_key')
            : tr('delete_error')}
        </p>
      ) : null}

      <p className="text-sm text-mit-text">
        {tr('delete_confirm_message', { name })}
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
          <Link href={adminCatalogResourceIndexPath(resource)}>
            {tr('cancel')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
