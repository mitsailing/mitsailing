import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import {
  AdminPrimaryActionLink,
  AdminSecondaryActionLink,
} from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogResourceTable';
import { AdminCatalogScopeFilter } from '@/components/mit-sailing/admin/catalog/AdminCatalogScopeFilter';
import { AdminSailingClassesGroupedTables } from '@/components/mit-sailing/admin/catalog/AdminSailingClassesGroupedTables';
import { PavilionRateSheet } from '@/components/mit-sailing/admin/pavilion/PavilionRateSheet';
import { cn } from '@/lib/utils';
import {
  adminCatalogResourceIndexPath,
  adminCatalogResourceNewPath,
} from '@/libs/admin/catalog/adminCatalogPaths';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { catalogPermissionForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import { cmsPagePublicPathById } from '@/libs/admin/catalog/cmsCatalogHandlers';
import {
  catalogListOptionsForScope,
  catalogScopedCreatePath,
  catalogScopedListState,
} from '@/libs/admin/catalog/scopedCatalogLists';
import type { CatalogScopedListState } from '@/libs/admin/catalog/scopedCatalogLists';
import type {
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { pavilionRateDraftsFromCatalogRows } from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import type { PavilionRateDraft } from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import { savePavilionRateSheetAction } from '@/libs/admin/pavilion-reservations/pavilionRateSheetActions';
import { requirePermission } from '@/libs/auth/dal';
import { getPathname, Link } from '@/libs/I18nNavigation';
import { isAppRelativeCmsHref, safeCmsHref } from '@/libs/mit-sailing/cmsHref';

type PageProps = {
  params: Promise<{ locale: string; resource: string }>;
  searchParams: Promise<{ menu?: string; page?: string; view?: string }>;
};

function CatalogIndexRecords(props: {
  readonly definition: CatalogResourceDefinition;
  readonly locale: string;
  readonly pavilionRatesView: boolean;
  readonly rateDrafts: PavilionRateDraft[];
  readonly resource: CatalogResourceId;
  readonly rows: CatalogRow[];
}) {
  if (props.pavilionRatesView) {
    return (
      <PavilionRateSheet
        action={savePavilionRateSheetAction.bind(null, props.locale)}
        rows={props.rateDrafts}
      />
    );
  }
  if (props.resource === 'sailing_classes') {
    return (
      <AdminSailingClassesGroupedTables
        definition={props.definition}
        locale={props.locale}
        rows={props.rows}
      />
    );
  }
  return (
    <AdminCatalogTable
      definition={props.definition}
      emptyKey="list_empty"
      locale={props.locale}
      resourceId={props.resource}
      rows={props.rows}
    />
  );
}

function CatalogResourceIndexView(props: {
  readonly catalogScopeFilterAction: string;
  readonly createHref: string;
  readonly createLabel: string;
  readonly definition: CatalogResourceDefinition;
  readonly filterActionLabel: string;
  readonly locale: string;
  readonly pavilionRatesView: boolean;
  readonly pendingFilteringLabel: string;
  readonly rateDrafts: PavilionRateDraft[];
  readonly ratesNavLabel: string;
  readonly ratesTabLabel: string;
  readonly resource: CatalogResourceId;
  readonly rows: CatalogRow[];
  readonly scopeFilterLabel: string;
  readonly scopedCmsPageViewHref: string | null;
  readonly scopedList: CatalogScopedListState | undefined;
  readonly spacesTabLabel: string;
  readonly title: string;
  readonly viewPageLabel: string;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <AdminPageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {props.scopedCmsPageViewHref ? (
              <AdminSecondaryActionLink
                // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- scopedCmsPageViewHref is an allowlisted same-origin CMS path from the catalog page.
                href={props.scopedCmsPageViewHref}
              >
                {props.viewPageLabel}
              </AdminSecondaryActionLink>
            ) : null}
            {props.definition.capabilities.create ? (
              <AdminPrimaryActionLink
                // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- createHref is the static catalog create path for this resource.
                href={props.createHref}
              >
                {props.createLabel}
              </AdminPrimaryActionLink>
            ) : null}
          </div>
        }
        title={props.title}
      />

      {props.resource === 'pavilion_spaces' ? (
        <nav
          aria-label={props.ratesNavLabel}
          className="border-b border-border"
        >
          <div className="flex gap-1">
            <Link
              aria-current={props.pavilionRatesView ? 'page' : undefined}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-semibold no-underline',
                props.pavilionRatesView
                  ? 'border-mit-red text-mit-red'
                  : 'border-transparent text-muted-foreground'
              )}
              // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- catalogScopeFilterAction is the static pavilion spaces admin index path.
              href={props.catalogScopeFilterAction}
            >
              {props.ratesTabLabel}
            </Link>
            <Link
              aria-current={props.pavilionRatesView ? undefined : 'page'}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-semibold no-underline',
                props.pavilionRatesView
                  ? 'border-transparent text-muted-foreground'
                  : 'border-mit-red text-mit-red'
              )}
              // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- list tab href is the static pavilion spaces admin path plus a fixed view query.
              href={`${props.catalogScopeFilterAction}?view=list`}
            >
              {props.spacesTabLabel}
            </Link>
          </div>
        </nav>
      ) : null}

      {props.scopedList ? (
        <AdminCatalogScopeFilter
          action={props.catalogScopeFilterAction}
          actionLabel={props.filterActionLabel}
          label={props.scopeFilterLabel}
          options={props.scopedList.options}
          pendingLabel={props.pendingFilteringLabel}
          queryParamName={props.scopedList.definition.queryParamName}
          selectedValue={props.scopedList.selectedValue}
        />
      ) : null}

      <CatalogIndexRecords
        definition={props.definition}
        locale={props.locale}
        pavilionRatesView={props.pavilionRatesView}
        rateDrafts={props.rateDrafts}
        resource={props.resource}
        rows={props.rows}
      />
    </div>
  );
}

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
  await requirePermission(
    catalogPermissionForOperation({ operation: 'view', resourceId: resource }),
    locale
  );

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
  const catalogScopeFilterAction = getPathname({
    href: adminCatalogResourceIndexPath(resource),
    locale,
  });
  const pavilionRatesView =
    resource === 'pavilion_spaces' && searchParams.view !== 'list';
  const rateDrafts = pavilionRatesView
    ? pavilionRateDraftsFromCatalogRows(rows)
    : [];

  return (
    <CatalogResourceIndexView
      catalogScopeFilterAction={catalogScopeFilterAction}
      createHref={createHref}
      definition={def}
      locale={locale}
      pavilionRatesView={pavilionRatesView}
      pendingFilteringLabel={tCommon('pending_filtering')}
      rateDrafts={rateDrafts}
      resource={resource}
      rows={rows}
      scopedCmsPageViewHref={scopedCmsPageViewHref}
      scopedList={scopedList}
      scopeFilterLabel={scopedList ? tr(scopedList.definition.labelKey) : ''}
      title={t(def.titleKey)}
      viewPageLabel={tr('action_view_page')}
      createLabel={
        resource === 'pavilion_spaces'
          ? tr('pavilion_rates_add_space')
          : tr('action_create')
      }
      filterActionLabel={tr('action_filter')}
      ratesNavLabel={tr('pavilion_rates_nav')}
      ratesTabLabel={tr('pavilion_rates_tab')}
      spacesTabLabel={tr('pavilion_spaces_tab')}
    />
  );
}
