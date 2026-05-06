import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import { AdminSailingClassesGroupedTables } from '@/components/mit-sailing/admin/catalog/AdminSailingClassesGroupedTables';
import { adminCatalogResourceNewPath } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import { Link } from '@/libs/I18nNavigation';

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-mit-text">
          {t(def.titleKey)}
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline"
            href="/admin/"
          >
            {tr('back_admin')}
          </Link>
          {def.publicPreview ? (
            <Link
              className="text-sm font-medium text-mit-red no-underline hover:underline"
              href={def.publicPreview.path}
            >
              {tr(def.publicPreview.labelKey)}
            </Link>
          ) : null}
          {def.capabilities.create ? (
            <Link
              className="rounded-md bg-mit-red px-3 py-1.5 text-sm font-semibold text-white no-underline hover:bg-mit-red-hover"
              href={adminCatalogResourceNewPath(resource)}
            >
              {tr('action_create')}
            </Link>
          ) : null}
        </div>
      </div>

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
