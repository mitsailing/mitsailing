import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import { AdminSailingClassesGroupedTables } from '@/components/mit-sailing/admin/catalog/AdminSailingClassesGroupedTables';
import { adminCatalogResourceNewPath } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';

type PageProps = {
  params: Promise<{ locale: string; resource: string }>;
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
  return { title: t(def.metaTitleKey) };
}

/**
 * `GET /admin/:resource` — catalog resource index (Rails scaffold index).
 *
 * @param props - App Router page props
 * @param props.params - `locale` and `resource` (registered catalog id)
 * @returns List table for the resource
 */
export default async function AdminCatalogResourceIndexPage(props: PageProps) {
  const { locale, resource } = await props.params;
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource)) {
    notFound();
  }

  const handlers = getCatalogServerHandlers(resource);
  const rows = await handlers.list({ locale });

  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const tr = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminPageHeader
        actions={
          def.capabilities.create ? (
            <AdminPrimaryActionLink
              href={adminCatalogResourceNewPath(resource)}
            >
              {tr('action_create')}
            </AdminPrimaryActionLink>
          ) : undefined
        }
        title={t(def.titleKey)}
      />

      {resource === 'sailing_classes' ? (
        <AdminSailingClassesGroupedTables
          definition={def}
          locale={locale}
          rows={rows}
        />
      ) : (
        <AdminCatalogTable
          definition={def}
          locale={locale}
          resourceId={resource}
          rows={rows}
        />
      )}
    </div>
  );
}
