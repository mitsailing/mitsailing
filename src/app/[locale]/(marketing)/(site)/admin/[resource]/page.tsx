import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import {
  AdminPrimaryActionLink,
  AdminSecondaryActionLink,
} from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogScopeFilter } from '@/components/mit-sailing/admin/catalog/AdminCatalogScopeFilter';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import { AdminSailingClassesGroupedTables } from '@/components/mit-sailing/admin/catalog/AdminSailingClassesGroupedTables';
import { adminCatalogResourceNewPath } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import { cmsPagePublicPathById } from '@/libs/admin/catalog/cmsCatalogHandlers';
import {
  catalogListOptionsForScope,
  catalogScopedCreatePath,
  catalogScopedListState,
} from '@/libs/admin/catalog/scopedCatalogLists';
import { isAppRelativeCmsHref, safeCmsHref } from '@/libs/mit-sailing/cmsHref';

type PageProps = {
  params: Promise<{ locale: string; resource: string }>;
  searchParams: Promise<{ menu?: string; page?: string }>;
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
  const searchParams = await props.searchParams;
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource)) {
    notFound();
  }

  const scopedList = await catalogScopedListState({
    resourceId: resource,
    searchParams,
  });
  const handlers = getCatalogServerHandlers(resource);
  const rows =
    scopedList && scopedList.selectedValue === ''
      ? []
      : await handlers.list({
          locale,
          ...catalogListOptionsForScope(scopedList),
        });

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
  const scopedCmsPagePath =
    resource === 'cms_page_blocks' && scopedList?.selectedValue
      ? await cmsPagePublicPathById(scopedList.selectedValue)
      : null;
  const scopedCmsPageHref = safeCmsHref(scopedCmsPagePath);
  const scopedCmsPageViewHref =
    scopedCmsPageHref && isAppRelativeCmsHref(scopedCmsPageHref)
      ? scopedCmsPageHref
      : null;
  const createHref = catalogScopedCreatePath({
    basePath: adminCatalogResourceNewPath(resource),
    state: scopedList,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <AdminPageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {scopedCmsPageViewHref ? (
              <AdminSecondaryActionLink href={scopedCmsPageViewHref}>
                {tr('action_view_page')}
              </AdminSecondaryActionLink>
            ) : null}
            {def.capabilities.create ? (
              <AdminPrimaryActionLink href={createHref}>
                {tr('action_create')}
              </AdminPrimaryActionLink>
            ) : null}
          </div>
        }
        title={t(def.titleKey)}
      />

      {scopedList ? (
        <AdminCatalogScopeFilter
          actionLabel={tr('action_filter')}
          label={tr(scopedList.definition.labelKey)}
          options={scopedList.options}
          pendingLabel={tCommon('pending_filtering')}
          queryParamName={scopedList.definition.queryParamName}
          selectedValue={scopedList.selectedValue}
        />
      ) : null}

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
